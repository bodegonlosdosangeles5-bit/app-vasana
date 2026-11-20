import { useEffect, useState } from "react";
import { Bell, ArrowRight } from "lucide-react";
import { Producto } from "@/services/productoService";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Momento de carga del producto en ms. Usa created_at y, si está vacío (la base
// nueva no tiene default en esa columna), lo saca del id "P-<timestamp ms>-xxxxx".
const momentoCarga = (p: Producto): number | null => {
  if (p.created_at) {
    const t = new Date(p.created_at).getTime();
    if (!isNaN(t)) return t;
  }
  const m = /^P-(\d{12,})-/.exec(p.id || "");
  return m ? Number(m[1]) : null;
};

// Inicio del día de hoy (00:00 hora local)
const inicioDeHoy = (ahora: number) => {
  const d = new Date(ahora);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

interface Props {
  productos: Producto[];
  onVerProductos?: () => void;
}

// Campana de notificaciones del encabezado: productos cargados HOY con materias
// primas faltantes. Se limpia sola a la medianoche (00:00), cuando termina el día.
export const FaltantesRecientesNotice = ({ productos, onVerProductos }: Props) => {
  const [ahora, setAhora] = useState(() => Date.now());
  const [abierto, setAbierto] = useState(false);

  // Re-evaluar cada minuto para que a las 00:00 se limpie sin recargar la página
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const desde = inicioDeHoy(ahora);
  const recientes = productos
    .map((p) => ({ p, creado: momentoCarga(p) }))
    .filter(({ p, creado }) =>
      creado !== null &&
      creado >= desde &&
      creado <= ahora + 60 * 1000 &&
      (p.missingIngredients?.length || 0) > 0
    )
    .sort((a, b) => b.creado! - a.creado!);

  if (recientes.length === 0) return null;

  const horaCarga = (creado: number) =>
    new Date(creado).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${recientes.length} producto(s) cargados hoy con faltante de materia prima`}
          title="Faltantes de hoy"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-[#023F86] dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-[#F7A600] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#023F86]/40"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white dark:ring-slate-800">
            {recientes.length}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[22rem] max-w-[calc(100vw-2rem)] p-0 overflow-hidden rounded-xl">
        {/* Encabezado */}
        <div className="flex items-start justify-between px-4 pt-3 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Faltantes de hoy</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Se limpia a las 00:00</p>
          </div>
          <span className="mt-0.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-950/50 dark:text-red-400">
            {recientes.length}
          </span>
        </div>

        {/* Lista */}
        <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {recientes.map(({ p, creado }) => (
            <li key={p.id} className="flex gap-2.5 px-4 py-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm text-slate-800 dark:text-slate-100">
                    <span className="font-semibold">Lote {p.lote_code}</span>
                    <span className="text-slate-400"> · </span>
                    {p.name}
                  </p>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{horaCarga(creado!)}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {p.missingIngredients!.map((m) => `${m.name} · ${m.required} ${m.unit}`).join("  ·  ")}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* Pie */}
        {onVerProductos && (
          <div className="border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => { setAbierto(false); onVerProductos(); }}
              className="flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#023F86] hover:bg-slate-50 dark:text-blue-300 dark:hover:bg-slate-800/60 transition-colors"
            >
              Ver todos los productos <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
