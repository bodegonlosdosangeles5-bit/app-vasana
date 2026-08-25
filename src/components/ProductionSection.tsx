import { useState, useMemo, useEffect } from "react";
import { Truck, Calendar, Weight, MapPin, Clock, TrendingUp, Plus, Eye, Package, Pencil, Trash2, AlertCircle, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RemitoProduction } from "@/components/RemitoProduction";
import { RemitoManualModal } from "@/components/RemitoManualModal";
import { EnvioDetailModal } from "@/components/EnvioDetailModal";
import { Producto } from "@/services/productoService";
import { useRealtimeEnvios } from "@/hooks/useRealtimeEnvios";

import { EnvioConRemitos } from "@/services/envioService";
import { RemitoService, RemitoWithItems } from "@/services/remitoService";
import { useAuth } from "@/components/Auth/AuthProvider";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProductionSectionProps {
  formulas?: Producto[];
  updateProducto?: (id: string, updates: Partial<Producto>) => Promise<Producto | null>;
  deleteProducto?: (id: string) => Promise<boolean>;
}

export const ProductionSection = ({ formulas = [], updateProducto: updateProductoProp, deleteProducto: deleteProductoProp }: ProductionSectionProps) => {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'superadmin';

  // Usar los datos de los props (instancia centralizada en Index.tsx)
  const formulasData = formulas;

  const updateProductoRealtime = updateProductoProp || (async () => null);
  const deleteProductoRealtime = deleteProductoProp || (async () => false);

  const [activeTab, setActiveTab] = useState("remito");
  const [selectedEnvio, setSelectedEnvio] = useState<EnvioConRemitos | null>(null);
  const [isEnvioDetailOpen, setIsEnvioDetailOpen] = useState(false);
  const [selectedRemito, setSelectedRemito] = useState<RemitoWithItems | null>(null);
  const [isRemitoDetailOpen, setIsRemitoDetailOpen] = useState(false);
  const [showRemitoManual, setShowRemitoManual] = useState(false);
  
  // Estados para edición
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    lote: "",
    batchSize: 0,
    destination: "",
    type: "stock" as "stock" | "client",
    clientName: "",
    date: ""
  });

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  // Hook para envíos
  const {
    envios,
    loading: enviosLoading,
    error: enviosError,
    crearEnvioConRemitosPendientes,
    getEnvioConRemitos
  } = useRealtimeEnvios();

  // Función para normalizar texto (quitar tildes, espacios y convertir a minúsculas)
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
      .replace(/\s+/g, ''); // Quitar espacios
  };

  // Función para recargar datos de un envío específico
  const loadEnvioData = async (envioId: string) => {
    const envioData = await getEnvioConRemitos(envioId);
    if (envioData) {
      setSelectedEnvio(envioData);
    }
  };

  // Productos del viaje actual: disponibles en Villa Martelli con stock > 0
  // Cuando se genera un remito el stock baja a 0 y desaparecen automáticamente
  const currentProduction = useMemo(() => {
    return formulasData.filter(producto => {
      const normalizedStatus = normalizeText(producto?.status || "");
      const normalizedDestination = normalizeText(producto?.destination || "");
      
      const isTerminated = ['terminado', 'finalizado', 'completo', 'available'].includes(normalizedStatus);
      const isVillaMartelli = normalizedDestination === 'villamartelli';
      const hasStock = (producto?.stock_actual ?? producto?.batchSize ?? 0) > 0;
      
      return isTerminated && isVillaMartelli && hasStock;
    });
  }, [formulasData]);

  // Calcular el Stock Total Disponible (Solo producción activa para enviar)
  // DEBE coincidir con los items mostrados en "Remito Villa Martelli" (status available y stock > 0)
  const totalStockAvailable = useMemo(() => {
    return currentProduction.reduce((total, producto) => {
      // Filtrar solo los que están disponibles realmente (no entregados, no históricos viejos)
      const stock = producto?.stock_actual ?? (producto?.batchSize || 0);
      
      // Si el stock es 0, no suma
      if (stock <= 0) return total;

      return total + stock;
    }, 0);
  }, [currentProduction]);




  const handleViewEnvio = async (envioId: string) => {
    try {
      const envioConRemitos = await getEnvioConRemitos(envioId);
      if (envioConRemitos) {
        setSelectedEnvio(envioConRemitos);
        setIsEnvioDetailOpen(true);
      }
    } catch (error) {
      console.error('Error obteniendo detalles del envío:', error);
    }
  };

  const handleViewRemito = async (remitoId: string) => {
    try {
      const remitoConItems = await RemitoService.getRemitoWithItems(remitoId);
      if (remitoConItems) {
        setSelectedRemito(remitoConItems);
        setIsRemitoDetailOpen(true);
      }
    } catch (error) {
      console.error('Error obteniendo detalles del remito:', error);
    }
  };

  const handleEditClick = (formula: Producto) => {
    setEditingProducto(formula);
    setEditForm({
      name: formula.name,
      lote: formula.lote_code || formula.id,
      batchSize: formula.batchSize,
      destination: formula.destination,
      type: formula.type,
      clientName: formula.clientName || "",
      date: formula.date ? formula.date : "" 
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingProducto) return;

    if (!canEdit) {
      toast.error("No tienes permisos de administrador para realizar esta acción");
      return;
    }

    try {
      const success = await updateProductoRealtime(editingProducto.id, {
        name: editForm.name,
        lote_code: editForm.lote,
        batchSize: editForm.batchSize,
        destination: editForm.destination,
        type: editForm.type,
        clientName: editForm.type === "client" ? editForm.clientName : undefined,
        date: editForm.date || undefined
      });

      if (success) {
        toast.success("Producto actualizado correctamente");
        
        setIsEditModalOpen(false);
        setEditingProducto(null);
      } else {
        toast.error("Error al actualizar el producto");
      }
    } catch (error) {
      console.error("Error en handleUpdate:", error);
      toast.error("Error al conectar con la base de datos");
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    if (!canEdit) {
      toast.error("No tienes permisos de administrador para realizar esta acción");
      return;
    }

    try {
      const success = await deleteProductoRealtime(productToDelete);
      if (success) {
        toast.success("Producto eliminado correctamente");
        
        setIsDeleteConfirmOpen(false);
        setProductToDelete(null);
      } else {
        toast.error("Error al eliminar el producto");
      }
    } catch (error) {
      console.error("Error en handleDelete:", error);
      toast.error("Error al conectar con la base de datos");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "entregado": return "success";
      case "en_transito": return "warning";
      case "pendiente": return "secondary";
      case "cancelado": return "destructive";
      default: return "secondary";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "entregado": return "Entregado";
      case "en_transito": return "En Tránsito";
      case "pendiente": return "Pendiente";
      case "cancelado": return "Cancelado";
      default: return status;
    }
  };

  return (
    <div className="space-y-6 p-6 bg-white dark:bg-slate-900/50 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm layout-entry">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#023F86]">Control de Producción</h2>
        
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setShowRemitoManual(true)}
            size="lg"
            className="bg-[#F7A600] hover:bg-[#F7A600]/90 text-[#023F86] font-bold shadow-md rounded-xl h-12 px-6"
          >
            <Printer className="w-5 h-5 mr-2" />
            REMITO MANUAL
          </Button>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Kilos en Viaje</p>
              <p className="text-2xl sm:text-3xl font-black text-[#023F86]">{totalStockAvailable.toLocaleString()} kg</p>
            </div>
            <div className="p-3 bg-[#023F86]/10 rounded-2xl">
              <TrendingUp className="h-6 w-6 text-[#023F86]" strokeWidth={2.5} />
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 border-2 border-slate-200 p-1.5 rounded-xl shadow-sm">
          <TabsTrigger value="remito" className="text-sm font-bold rounded-lg data-[state=active]:bg-[#023F86] data-[state=active]:text-white transition-all">Envios a Villa Martelli</TabsTrigger>
          <TabsTrigger value="shipments" className="text-sm font-bold rounded-lg data-[state=active]:bg-[#023F86] data-[state=active]:text-white transition-all">Envíos</TabsTrigger>
        </TabsList>

        <TabsContent value="remito" className="space-y-4">
          <RemitoProduction 
            productionItems={currentProduction} 
            onSuccess={() => setActiveTab("shipments")}
          />
        </TabsContent>

        <TabsContent value="shipments" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Envíos Realizados</h3>
          </div>

          {enviosLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando envíos...</p>
            </div>
          ) : enviosError ? (
            <div className="text-center py-8">
              <p className="text-destructive">Error: {enviosError}</p>
            </div>
          ) : envios.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No hay envíos registrados</p>
              <p className="text-muted-foreground text-sm mt-2">
                Los envíos se generarán automáticamente al procesar remitos
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {envios.map((envio) => (
                <Card key={envio.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base sm:text-lg font-semibold">
                      {envio.numero_envio}
                    </CardTitle>
                    <Badge variant={getStatusColor(envio.estado) as 'default' | 'secondary' | 'destructive' | 'outline'}>
                      {getStatusText(envio.estado)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{envio.fecha_creacion ? new Date(envio.fecha_creacion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : (envio.created_at ? new Date(envio.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-')}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Weight className="h-4 w-4 text-muted-foreground" />
                        <span>{envio.total_kilos} kg</span>
                      </div>
                      <div className="flex flex-col gap-1 text-sm">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="break-words whitespace-normal leading-tight">{envio.destino}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>{envio.total_remitos} Remitos</span>
                      </div>
                    </div>
                    {envio.observaciones && (
                      <div className="pt-2 border-t text-sm">
                        <span className="text-muted-foreground">Observaciones: </span>
                        <span className="font-medium">{envio.observaciones}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewEnvio(envio.id)}
                        className="w-full flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Ver Detalles
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modales de Detalle */}
      <EnvioDetailModal
        envio={selectedEnvio}
        isOpen={isEnvioDetailOpen}
        onClose={() => {
          setIsEnvioDetailOpen(false);
          setSelectedEnvio(null);
        }}
        onRemitoUpdated={() => {
          if (selectedEnvio) {
            loadEnvioData(selectedEnvio.id);
          }
        }}
      />

      <Dialog open={isRemitoDetailOpen} onOpenChange={setIsRemitoDetailOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Detalles del Remito: {selectedRemito?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedRemito && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Destino</Label>
                  <p className="text-sm">{selectedRemito.destino}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Fecha</Label>
                  <p className="text-sm">{new Date(selectedRemito.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Total Kilos</Label>
                  <p className="text-sm font-semibold">{selectedRemito.total_kilos} kg</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Estado</Label>
                  <Badge variant={getStatusColor(selectedRemito.estado) as 'default' | 'secondary' | 'destructive' | 'outline'}>
                    {getStatusText(selectedRemito.estado)}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground mb-3 block">
                  Productos ({selectedRemito.items.length})
                </Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedRemito.items.map((item) => (
                    <div key={item.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.nombre_producto}</p>
                          <p className="text-xs text-muted-foreground">ID: {item.producto_id}</p>
                          {item.lote && <p className="text-xs text-muted-foreground">Lote: {item.lote}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{item.kilos_sumados} kg</p>
                          <p className="text-xs text-muted-foreground">{item.cantidad_lotes} lotes</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRemitoDetailOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-500 text-xl font-bold">
              <Pencil className="h-5 w-5" />
              Editar Producto
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-zinc-400">Nombre del Producto</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="bg-zinc-900 border-zinc-800 focus:border-yellow-500/50 text-white"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-lote" className="text-zinc-400">Número de Lote (Código)</Label>
              <Input
                id="edit-lote"
                value={editForm.lote}
                onChange={(e) => setEditForm({ ...editForm, lote: e.target.value })}
                className="bg-zinc-900 border-zinc-800 focus:border-yellow-500/50 text-white"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-kilos" className="text-zinc-400">Cantidad (kg)</Label>
              <Input
                id="edit-kilos"
                type="number"
                value={editForm.batchSize}
                onChange={(e) => setEditForm({ ...editForm, batchSize: parseFloat(e.target.value) })}
                className="bg-zinc-900 border-zinc-800 focus:border-yellow-500/50 text-white"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-destination" className="text-zinc-400">Destino</Label>
              <Input
                id="edit-destination"
                value={editForm.destination}
                onChange={(e) => setEditForm({ ...editForm, destination: e.target.value })}
                className="bg-zinc-900 border-zinc-800 focus:border-yellow-500/50 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-type" className="text-zinc-400">Tipo</Label>
              <Select value={editForm.type} onValueChange={(val: "stock" | "client") => setEditForm({ ...editForm, type: val })}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editForm.type === "client" && (
              <div className="space-y-2">
                <Label htmlFor="edit-clientName" className="text-zinc-400">Cliente</Label>
                <Input
                  id="edit-clientName"
                  value={editForm.clientName}
                  onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 focus:border-yellow-500/50 text-white"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-date" className="text-zinc-400">Fecha de Producción</Label>
              <Input
                id="edit-date"
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                className="bg-zinc-900 border-zinc-800 focus:border-yellow-500/50 text-white"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="border-zinc-800">Cancelar</Button>
            <Button onClick={handleUpdate} className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500 text-xl font-bold">
              <AlertCircle className="h-5 w-5" />
              Confirmar Eliminación
            </DialogTitle>
          </DialogHeader>
          
          <p className="text-zinc-300 py-4">
            ¿Confirmas que deseas eliminar este lote? Esta acción es <span className="text-red-500 font-bold underline">irreversible</span>.
          </p>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)} className="border-zinc-800">Cancelar</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-500 text-white font-bold">Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RemitoManualModal isOpen={showRemitoManual} onClose={() => setShowRemitoManual(false)} />
    </div>
  );
};