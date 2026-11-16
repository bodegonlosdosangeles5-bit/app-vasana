import { useState } from "react";
import {
  Search, X, Loader2, PackageSearch, AlertTriangle, CheckCircle2,
  Truck, HelpCircle, PackageX, FileText
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Producto } from "@/services/productoService";
import { formatFechaCorta } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Consulta de estado de un producto por número de lote o nombre.
// IMPORTANTE: este componente es de SOLO LECTURA. Únicamente hace SELECT sobre
// remito_items / remitos / envios_remitos / envios. Nunca inserta, actualiza ni
// borra datos.
// ─────────────────────────────────────────────────────────────────────────────

interface ProductoStatusLookupProps {
  productos: Producto[];
}

interface RemitoItemRow {
  id: string;
  remito_id: string;
  producto_id: string;
  nombre_producto: string;
  kilos_sumados: number;
  lote: string | null;
  cliente_o_stock: string | null;
}

interface RemitoRow {
  id: string;
  destino: string;
  fecha: string;
  estado: string;
}

interface EnvioRow {
  id: string;
  numero_envio: string;
  destino: string;
  estado: string;
  fecha_creacion: string | null;
  fecha_envio: string | null;
}

interface Movimiento {
  item: RemitoItemRow;
  remito?: RemitoRow;
  envios: EnvioRow[];
}

interface ResultadoProducto {
  producto: Producto;
  movimientos: Movimiento[];
}

interface ResultadoBusqueda {
  termino: string;
  productos: ResultadoProducto[];
  huerfanos: Movimiento[]; // registros en remitos cuyo lote no está en productos (ej. remitos manuales)
  truncado: boolean;
}

const MAX_PRODUCTOS = 30;

const normalize = (text?: string | null) =>
  (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

// Escapa los comodines de ILIKE para que el texto del usuario se busque literal
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

const formatKg = (n?: number | null) =>
  `${Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })} kg`;

export const ProductoStatusLookup = ({ productos }: ProductoStatusLookupProps) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoBusqueda | null>(null);

  const limpiar = () => {
    setQuery("");
    setResultado(null);
    setError(null);
  };

  const buscar = async () => {
    const termino = query.trim();
    if (!termino) return;

    setLoading(true);
    setError(null);

    try {
      const t = normalize(termino);

      // 1) Productos en memoria: búsqueda SOLO por número de lote (exacto)
      let encontrados = productos.filter((p) => normalize(p.lote_code) === t);
      // Si no hubo coincidencias, probar coincidencia parcial de lote
      if (encontrados.length === 0) {
        encontrados = productos.filter((p) => normalize(p.lote_code).includes(t));
      }
      encontrados = [...encontrados].sort(
        (a, b) => Number(a.lote_code) - Number(b.lote_code)
      );
      const truncado = encontrados.length > MAX_PRODUCTOS;
      encontrados = encontrados.slice(0, MAX_PRODUCTOS);

      // 2) Items de remito relacionados (solo lectura)
      const selectItems = "id, remito_id, producto_id, nombre_producto, kilos_sumados, lote, cliente_o_stock";
      const ids = encontrados.map((p) => p.id);
      const lotes = Array.from(
        new Set(encontrados.map((p) => p.lote_code).filter(Boolean))
      );

      const consultas = [
        ids.length > 0
          ? supabase.from("remito_items").select(selectItems).in("producto_id", ids)
          : null,
        lotes.length > 0
          ? supabase.from("remito_items").select(selectItems).in("lote", lotes)
          : null,
        supabase.from("remito_items").select(selectItems).ilike("lote", escapeLike(termino)),
      ].filter(Boolean);

      const respuestas = await Promise.all(consultas);
      const itemsMap = new Map<string, RemitoItemRow>();
      for (const r of respuestas) {
        if (!r) continue;
        if (r.error) throw r.error;
        for (const it of (r.data || []) as RemitoItemRow[]) itemsMap.set(it.id, it);
      }
      const items = Array.from(itemsMap.values());

      // 3) Remitos y envíos asociados
      const remitoIds = Array.from(new Set(items.map((i) => i.remito_id)));
      const remitosMap = new Map<string, RemitoRow>();
      const enviosPorRemito = new Map<string, EnvioRow[]>();

      if (remitoIds.length > 0) {
        const [remitosRes, relRes] = await Promise.all([
          supabase.from("remitos").select("id, destino, fecha, estado").in("id", remitoIds),
          supabase.from("envios_remitos").select("envio_id, remito_id").in("remito_id", remitoIds),
        ]);
        if (remitosRes.error) throw remitosRes.error;
        if (relRes.error) throw relRes.error;

        for (const r of (remitosRes.data || []) as RemitoRow[]) remitosMap.set(r.id, r);

        const envioIds = Array.from(new Set((relRes.data || []).map((r) => r.envio_id)));
        if (envioIds.length > 0) {
          const enviosRes = await supabase
            .from("envios")
            .select("id, numero_envio, destino, estado, fecha_creacion, fecha_envio")
            .in("id", envioIds);
          if (enviosRes.error) throw enviosRes.error;
          const enviosMap = new Map<string, EnvioRow>();
          for (const e of (enviosRes.data || []) as EnvioRow[]) enviosMap.set(e.id, e);
          for (const rel of relRes.data || []) {
            const env = enviosMap.get(rel.envio_id);
            if (!env) continue;
            const list = enviosPorRemito.get(rel.remito_id) || [];
            list.push(env);
            enviosPorRemito.set(rel.remito_id, list);
          }
        }
      }

      const toMovimiento = (item: RemitoItemRow): Movimiento => ({
        item,
        remito: remitosMap.get(item.remito_id),
        envios: enviosPorRemito.get(item.remito_id) || [],
      });

      // 4) Asociar movimientos a cada producto
      const usados = new Set<string>();
      const productosResultado: ResultadoProducto[] = encontrados.map((p) => {
        const movs = items
          .filter(
            (i) =>
              i.producto_id === p.id ||
              (!!p.lote_code && normalize(i.lote) === normalize(p.lote_code))
          )
          .map((i) => {
            usados.add(i.id);
            return toMovimiento(i);
          })
          .sort((a, b) => (b.remito?.fecha || "").localeCompare(a.remito?.fecha || ""));
        return { producto: p, movimientos: movs };
      });

      // Solo son "huérfanos" los registros que no corresponden a NINGÚN producto
      // existente (no solo a los mostrados, que pueden estar recortados).
      const idsExistentes = new Set(productos.map((p) => p.id));
      const lotesExistentes = new Set(productos.map((p) => normalize(p.lote_code)).filter(Boolean));
      const huerfanos = items
        .filter(
          (i) =>
            !usados.has(i.id) &&
            !idsExistentes.has(i.producto_id) &&
            !(i.lote && lotesExistentes.has(normalize(i.lote)))
        )
        .map(toMovimiento)
        .sort((a, b) => (b.remito?.fecha || "").localeCompare(a.remito?.fecha || ""));

      setResultado({ termino, productos: productosResultado, huerfanos, truncado });
    } catch (e) {
      console.error("Error consultando estado de producto:", e);
      setError("No se pudo completar la consulta. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const renderEstado = ({ producto: p, movimientos }: ResultadoProducto) => {
    const stock = p.stock_actual ?? p.batchSize ?? 0;
    const faltantes = p.missingIngredients || [];
    const kilosEnviados = movimientos.reduce((s, m) => s + Number(m.item.kilos_sumados || 0), 0);

    if (p.status === "incomplete" || faltantes.length > 0) {
      return {
        label: "Faltan materias primas",
        icon: AlertTriangle,
        cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
      };
    }
    if (movimientos.length > 0 && stock > 0) {
      return {
        label: `Enviado parcialmente (${formatKg(kilosEnviados)})`,
        icon: Truck,
        cls: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
      };
    }
    if (movimientos.length > 0) {
      return {
        label: "Enviado",
        icon: Truck,
        cls: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
      };
    }
    if (stock > 0) {
      return {
        label: "Completo — pendiente de envío",
        icon: CheckCircle2,
        cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
      };
    }
    return {
      label: "Sin stock (sin remito registrado)",
      icon: PackageX,
      cls: "bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300",
    };
  };

  const renderMovimientos = (movs: Movimiento[]) => (
    <div className="space-y-2">
      {movs.map(({ item, remito, envios }) => (
        <div
          key={item.id}
          className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1"
        >
          <div>
            <span className="text-muted-foreground">Remito: </span>
            <span className="font-medium break-all">{item.remito_id}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Fecha: </span>
            <span className="font-medium">{formatFechaCorta(remito?.fecha)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Kilos: </span>
            <span className="font-medium">{formatKg(item.kilos_sumados)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Destino: </span>
            <span className="font-medium">{remito?.destino || "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Cliente / Stock: </span>
            <span className="font-medium">{item.cliente_o_stock || "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Estado remito: </span>
            <span className="font-medium capitalize">{remito?.estado || "—"}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground">Envío: </span>
            {envios.length > 0 ? (
              <span className="font-medium">
                {envios
                  .map(
                    (e) =>
                      `${e.numero_envio} (${e.estado}, ${formatFechaCorta(e.fecha_envio || e.fecha_creacion)})`
                  )
                  .join(" · ")}
              </span>
            ) : (
              <span className="font-medium text-muted-foreground">Sin envío asociado</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Card className={`${resultado || error ? "md:col-span-2 xl:col-span-4" : "md:col-span-2 xl:col-span-2"} border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm bg-white dark:bg-card/40`}>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-muted-foreground text-sm font-semibold tracking-tight">Consultar estado de producto</h3>
            <div className="h-0.5 w-4 bg-primary/50 rounded-full" />
            <p className="text-xs text-muted-foreground pt-1">
              Buscá por número de lote
            </p>
          </div>
          <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-[#023F86]/10 dark:bg-muted/80">
            <PackageSearch className="h-5 w-5 text-[#023F86] dark:text-[#F7A600]" strokeWidth={1.5} />
          </div>
        </div>

        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            buscar();
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                const value = e.target.value;
                setQuery(value);
                // Al borrar el texto, se limpia el resultado y cualquier leyenda
                if (!value.trim()) {
                  setResultado(null);
                  setError(null);
                }
              }}
              placeholder="Ej: 1234"
              className="h-9 pl-9 pr-9 rounded-lg text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={limpiar}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button type="submit" size="sm" disabled={loading || !query.trim()} className="h-9 rounded-lg">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            Consultar
          </Button>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {resultado && !loading && (
          <div className="space-y-4">
            {resultado.productos.length === 0 && resultado.huerfanos.length === 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-4">
                <HelpCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  {/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(resultado.termino) ? (
                    <>
                      <p className="font-semibold text-red-700 dark:text-red-300">
                        La consulta es solo por número de lote
                      </p>
                      <p className="text-red-700/80 dark:text-red-300/80">
                        “{resultado.termino}” no coincide con ningún lote. No se puede buscar por nombre de producto; ingresá el número de lote.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-red-700 dark:text-red-300">
                        No está en la base de datos
                      </p>
                      <p className="text-red-700/80 dark:text-red-300/80">
                        No se encontró ningún producto ni remito con el lote “{resultado.termino}”.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {resultado.truncado && (
              <p className="text-xs text-muted-foreground">
                Se muestran los primeros {MAX_PRODUCTOS} resultados. Refiná la búsqueda para ver otros.
              </p>
            )}

            {resultado.productos.map((r) => {
              const p = r.producto;
              const estado = renderEstado(r);
              const EstadoIcon = estado.icon;
              const faltantes = p.missingIngredients || [];
              const disponibles = p.ingredients || [];
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Lote {p.lote_code}</p>
                      <p className="text-lg font-semibold leading-tight">{p.name}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${estado.cls}`}>
                      <EstadoIcon className="h-3.5 w-3.5" />
                      {estado.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Producción</p>
                      <p className="font-medium">{formatKg(p.batchSize)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Stock actual</p>
                      <p className="font-medium">{formatKg(p.stock_actual ?? p.batchSize)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Destino</p>
                      <p className="font-medium">{p.destination || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Tipo</p>
                      <p className="font-medium">
                        {p.type === "client" ? `Cliente${p.clientName ? `: ${p.clientName}` : ""}` : "Stock"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Fecha</p>
                      <p className="font-medium">{formatFechaCorta(p.date)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Cargado el</p>
                      <p className="font-medium">{formatFechaCorta(p.created_at)}</p>
                    </div>
                  </div>

                  {faltantes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                        Materias primas faltantes ({faltantes.length})
                      </p>
                      <div className="space-y-1.5">
                        {faltantes.map((m, idx) => {
                          return (
                            <div
                              key={`${m.name}-${idx}`}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm"
                            >
                              <span className="font-medium">{m.name}</span>
                              <span className="text-muted-foreground">
                                Requiere {m.required} {m.unit}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {disponibles.length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground">
                        Ingredientes registrados ({disponibles.length})
                      </summary>
                      <div className="mt-2 space-y-1">
                        {disponibles.map((ing, idx) => (
                          <div key={`${ing.name}-${idx}`} className="flex justify-between gap-2 px-1">
                            <span>{ing.name}</span>
                            <span className="text-muted-foreground">
                              {ing.available} / {ing.required} {ing.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <FileText className="h-4 w-4" /> Remitos y envíos
                    </p>
                    {r.movimientos.length > 0 ? (
                      renderMovimientos(r.movimientos)
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Este lote todavía no figura en ningún remito.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {resultado.huerfanos.length > 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold">
                    Registros en remitos sin producto cargado en la base
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Coinciden con el lote “{resultado.termino}” pero no están en la tabla de productos
                    (por ejemplo, remitos manuales).
                  </p>
                </div>
                {resultado.huerfanos.map((m) => (
                  <div key={m.item.id} className="space-y-1">
                    <p className="text-sm font-medium">
                      {m.item.nombre_producto}
                      {m.item.lote ? ` — Lote ${m.item.lote}` : ""}
                    </p>
                    {renderMovimientos([m])}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
