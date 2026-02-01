import { useState, useMemo, useEffect } from "react";
import { Truck, Calendar, Weight, MapPin, Clock, TrendingUp, Plus, Eye, Package, Pencil, Trash2, AlertCircle, History, ShieldAlert } from "lucide-react";
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
import { EnvioDetailModal } from "@/components/EnvioDetailModal";
import { Producto } from "@/services/productoService";
import { useRealtimeEnvios } from "@/hooks/useRealtimeEnvios";
import { useRealtimeRemitos } from "@/hooks/useRealtimeRemitos";
import { useRemitos } from "@/hooks/useRemitos";
import { useRealtimeProductos } from "@/hooks/useRealtimeProductos";
import { EnvioConRemitos } from "@/services/envioService";
import { RemitoWithItems } from "@/services/remitoService";
import { useAuth } from "@/components/Auth/AuthProvider";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogService, ActivityLog } from "@/services/logService";

interface ProductionSectionProps {
  formulas?: Producto[]; // Mantener para compatibilidad pero no usar
}

export const ProductionSection = ({ formulas = [] }: ProductionSectionProps) => {
  // Usar el hook de productos en tiempo real
  const { 
    productos, 
    loading: productosLoading, 
    error: productosError, 
    updateProducto: updateProductoRealtime, 
    deleteProducto: deleteProductoRealtime 
  } = useRealtimeProductos();

  const [activeTab, setActiveTab] = useState("current");
  const [selectedEnvio, setSelectedEnvio] = useState<EnvioConRemitos | null>(null);
  const [isEnvioDetailOpen, setIsEnvioDetailOpen] = useState(false);
  const [selectedRemito, setSelectedRemito] = useState<RemitoWithItems | null>(null);
  const [isRemitoDetailOpen, setIsRemitoDetailOpen] = useState(false);
  
  const { user } = useAuth();
  
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
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Hook para envíos
  const {
    envios,
    loading: enviosLoading,
    error: enviosError,
    crearEnvioConRemitosPendientes,
    getEnvioConRemitos
  } = useRealtimeEnvios();

  // Hook para remitos
  const {
    currentRemito,
    loading: remitosLoading,
    error: remitosError
  } = useRealtimeRemitos();

  // Hook para obtener todos los remitos
  const {
    remitos,
    loading: allRemitosLoading,
    error: allRemitosError,
    getRemitoWithItems
  } = useRemitos();

  // Función para normalizar texto (quitar tildes, espacios y convertir a minúsculas)
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
      .replace(/\s+/g, ''); // Quitar espacios
  };

  // Mostrar productos terminados con destino a Villa Martelli
  const currentProduction = useMemo(() => {
    return productos.filter(producto => {
      const normalizedStatus = normalizeText(producto.status);
      const normalizedDestination = normalizeText(producto.destination);
      
      const isTerminated = normalizedStatus === 'available';
      const isVillaMartelli = normalizedDestination === 'villamartelli';
      
      return isTerminated && isVillaMartelli;
    });
  }, [productos]);

  // Calcular la producción total mensual
  const monthlyProduction = useMemo(() => {
    return currentProduction.reduce((total, producto) => total + (producto.batchSize || 0), 0);
  }, [currentProduction]);


  const fetchLogs = async () => {
    setLoadingLogs(true);
    const logs = await LogService.getRecentLogs(5);
    setRecentLogs(logs);
    setLoadingLogs(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

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
      const remitoConItems = await getRemitoWithItems(remitoId);
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
      lote: (formula as any).lote || formula.id,
      batchSize: formula.batchSize,
      destination: formula.destination,
      type: formula.type,
      clientName: formula.clientName || "",
      date: formula.date ? new Date(formula.date).toLocaleDateString('en-CA') : "" // 'en-CA' gives YYYY-MM-DD reliably without shift
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingProducto) return;

    // Verificar seguridad antes de ejecutar
    if (!canEdit) {
      toast.error("No tienes permisos de administrador para realizar esta acción");
      return;
    }

    try {
      const success = await updateProductoRealtime(editingProducto.id, {
        name: editForm.name,
        batchSize: editForm.batchSize,
        destination: editForm.destination,
        type: editForm.type,
        clientName: editForm.type === "client" ? editForm.clientName : undefined,
        date: editForm.date || undefined
      });

      if (success) {
        toast.success("Producto actualizado correctamente");
        
        // Registrar log de auditoría (en segundo plano)
        LogService.saveLog({
          action: 'Edición de Lote',
          detail: `Editado producto "${editForm.name}" (${editForm.batchSize}kg). Destino: ${editForm.destination}`,
          user_name: user?.user_name || 'Admin',
          user_email: user?.user_name, // Usar username como email si no hay email real
          product_id: editingProducto.id
        }).then(() => fetchLogs());

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

    // Verificar seguridad antes de ejecutar
    if (!canEdit) {
      toast.error("No tienes permisos de administrador para realizar esta acción");
      return;
    }

    const targetProduct = productos.find(p => p.id === productToDelete);

    try {
      const success = await deleteProductoRealtime(productToDelete);
      if (success) {
        toast.success("Producto eliminado correctamente");
        
        // Registrar log de auditoría (en segundo plano)
        LogService.saveLog({
          action: 'Eliminación',
          detail: `Eliminado lote "${targetProduct?.name}" de ${targetProduct?.batchSize}kg`,
          user_name: user?.user_name || 'Admin',
          user_email: user?.user_name,
          product_id: productToDelete
        }).then(() => fetchLogs());

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

  const canEdit = user?.role === 'admin' || user?.user_name === 'jose';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white">Control de Producción</h2>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-xs sm:text-sm text-black/80 dark:text-white/80">Kilos disponibles</p>
            <p className="text-lg sm:text-2xl font-bold text-black dark:text-white">{monthlyProduction.toLocaleString()} kg</p>
          </div>
          <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="current" className="text-xs sm:text-sm">Producción Actual</TabsTrigger>
          <TabsTrigger value="remito" className="text-xs sm:text-sm">Remito Villa Martelli</TabsTrigger>
          <TabsTrigger value="shipments" className="text-xs sm:text-sm">Envíos</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-4">
          {currentProduction.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-lg text-black dark:text-white">No hay fórmulas terminadas para Villa Martelli</p>
              <p className="text-muted-foreground text-sm mt-2 text-black dark:text-white">
                Las fórmulas terminadas con destino "Villa Martelli" aparecerán aquí automáticamente
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {currentProduction.map((formula) => (
                <Card key={formula.id} className="card-elegant hover:shadow-md transition-all min-h-[16rem] h-auto py-2">
                  <CardHeader className="h-full">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <CardTitle className="text-base sm:text-lg font-bold text-black dark:text-white break-words leading-tight mb-2">
                          {formula.name}
                        </CardTitle>
                        
                        <div className="flex items-center gap-2 text-sm sm:text-base text-black/80 dark:text-white/80">
                          <span className="font-semibold text-yellow-600 dark:text-yellow-500">Lote:</span>
                          <span className="truncate">{(formula as any).lote || formula.id}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm sm:text-base text-black/80 dark:text-white/80">
                          <span className="font-semibold text-yellow-600 dark:text-yellow-500">Cantidad:</span>
                          <span>{formula.batchSize} kg</span>
                        </div>

                        <div className="flex flex-col gap-0.5 text-sm sm:text-base text-black dark:text-white">
                          <span className="font-semibold text-yellow-600 dark:text-yellow-500">Destino:</span>
                          <span className="break-words whitespace-normal leading-snug">{formula.destination}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-black/60 dark:text-white/60">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formula.date ? new Date(formula.date).toLocaleDateString('es-AR', {
                            day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC'
                          }) : 'No especificada'}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-black/70 dark:text-white/70 pt-1">
                          <Badge variant="outline" className="text-[10px] uppercase font-bold border-zinc-300 dark:border-zinc-700">
                            {formula.type === "client" ? "Cliente" : "Stock"}
                          </Badge>
                          {formula.type === "client" && formula.clientName && (
                            <span className="break-words italic font-medium">({formula.clientName})</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-3 shrink-0">
                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-black/40 dark:text-white/40 hover:text-yellow-500 hover:bg-yellow-500/10 transition-all"
                                onClick={() => handleEditClick(formula)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-black/40 dark:text-white/40 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                onClick={() => {
                                  setProductToDelete(formula.id);
                                  setIsDeleteConfirmOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                        <Badge 
                          variant="default"
                          className="bg-green-600 hover:bg-green-700 text-white shadow-sm px-2 py-0.5"
                        >
                          Terminada
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="remito" className="space-y-4">
          <RemitoProduction productionItems={productos} />
        </TabsContent>

        <TabsContent value="shipments" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Remitos Generados</h3>
          </div>

          {allRemitosLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando remitos...</p>
            </div>
          ) : allRemitosError ? (
            <div className="text-center py-8">
              <p className="text-destructive">Error: {allRemitosError}</p>
            </div>
          ) : remitos.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No hay remitos generados</p>
              <p className="text-muted-foreground text-sm mt-2">
                Ve a la pestaña "Remito" para generar un nuevo remito
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {remitos.map((remito) => (
                <Card key={remito.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base sm:text-lg font-semibold">
                      {remito.id}
                    </CardTitle>
                    <Badge variant={getStatusColor(remito.estado) as any}>
                      {getStatusText(remito.estado)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(remito.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Weight className="h-4 w-4 text-muted-foreground" />
                        <span>{remito.total_kilos} kg</span>
                      </div>
                      <div className="flex flex-col gap-1 text-sm">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="break-words whitespace-normal leading-tight">{remito.destino}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(remito.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {remito.observaciones && (
                      <div className="pt-2 border-t text-sm">
                        <span className="text-muted-foreground">Observaciones: </span>
                        <span className="font-medium">{remito.observaciones}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewRemito(remito.id)}
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
                  <p className="text-sm">{new Date(selectedRemito.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Total Kilos</Label>
                  <p className="text-sm font-semibold">{selectedRemito.total_kilos} kg</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Estado</Label>
                  <Badge variant={getStatusColor(selectedRemito.estado) as any}>
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

      {/* Modal de Edición de Producto */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
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
              <Label htmlFor="edit-lote" className="text-zinc-400">Número de Lote (ID)</Label>
              <Input
                id="edit-lote"
                value={editForm.lote}
                disabled
                className="bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed"
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
              <Select value={editForm.type} onValueChange={(val: any) => setEditForm({ ...editForm, type: val })}>
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

      {/* Modal de Confirmación de Eliminación */}
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

      {/* Sección de Historial de Cambios (Logs) */}
      <div className="mt-12 pt-8 border-t border-zinc-800/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <History className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-black dark:text-white">Historial de Cambios</h3>
              <p className="text-xs text-black/50 dark:text-white/40">Movimientos recientes de administración</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchLogs}
            disabled={loadingLogs}
            className="text-xs text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/5"
          >
            {loadingLogs ? "Cargando..." : "Actualizar historial"}
          </Button>
        </div>

        <div className="space-y-3">
          {recentLogs.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-8 text-center">
              <p className="text-zinc-500 text-sm">No hay registros de actividad recientes</p>
            </div>
          ) : (
            recentLogs.map((log) => (
              <div 
                key={log.id} 
                className="flex items-start gap-4 p-4 bg-zinc-900/20 border border-zinc-800/30 rounded-xl hover:bg-zinc-900/40 transition-colors group"
              >
                <div className={`mt-1 p-1.5 rounded-full ${
                  log.action === 'Eliminación' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                }`}>
                  {log.action === 'Eliminación' ? <ShieldAlert className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                    <p className="text-sm font-bold text-black dark:text-white">
                      {log.action} <span className="text-zinc-500 text-xs font-normal ml-2">por {log.user_name}</span>
                    </p>
                    <p className="text-[10px] tabular-nums text-zinc-500 whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleString('es-AR', {
                        day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
                      }) : 'Recientemente'}
                    </p>
                  </div>
                  <p className="text-xs text-black/60 dark:text-white/30 line-clamp-1 group-hover:line-clamp-none transition-all">
                    {log.detail}
                  </p>
                  {log.product_id && (
                    <p className="text-[9px] text-zinc-600 mt-1 font-mono">ID: {log.product_id}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};