import { useState, useEffect, useMemo } from "react";
import { Search, Package, MapPin, AlertTriangle, Edit, Save, X, Plus, Trash2, Beaker, ChevronLeft, ChevronRight, StickyNote } from "lucide-react";
import MapaUbicacionRacks from './MapaUbicacionRacks';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRealtimeInventory } from "@/hooks/useRealtimeInventory";
import { InventoryItem, InventoryService } from "@/services/inventoryService";
import { useAuth } from "@/components/Auth/AuthProvider";
import { ActivityLogService } from "@/services/activityLogService";
import { toast } from "sonner";
export const InventorySection = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperAdmin = user?.role === 'superadmin';
  const canNuevoInsumo = isAdmin || user?.role === 'user' || user?.role === 'consulta';
  const canEditInsumo = isAdmin || user?.user_name === 'varela';
  
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  // Snapshot completo de materias primas para el mapa de racks (se pide solo
  // al abrir el detalle, no en cada carga de la lista paginada).
  const [rackMapItems, setRackMapItems] = useState<InventoryItem[]>([]);
  const [rackMapLoading, setRackMapLoading] = useState(false);

  const [newItem, setNewItem] = useState({
    name: "",
    certificate: "",
    rack: "",
    place: "",
    level: "",
    currentStock: "",
    category: "Aceites Esenciales",
    unit: "g", // Gramos por defecto
    status: "normal"
  });

  // Debounce de la búsqueda: espera a que el usuario deje de tipear antes de
  // consultar la base de datos, para no disparar una query por cada letra.
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearchTerm(searchTerm), 350);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  // Volver a la página 1 cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  // Usar el hook de Realtime para manejar las materias primas.
  // Paginado y ordenado alfabéticamente del lado del servidor: solo se traen
  // los ITEMS_PER_PAGE registros de la página actual, no toda la tabla.
  const {
    inventoryItems,
    totalCount,
    loading,
    error,
    createInventoryItem,
    updateInventoryItem,
    deleteInventoryItem
  } = useRealtimeInventory({ page: currentPage, pageSize: ITEMS_PER_PAGE, search: debouncedSearchTerm });

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical": return "destructive";
      case "low": return "warning";
      default: return "success";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "critical": return "Crítico";
      case "low": return "Bajo";
      default: return "Normal";
    }
  };

  const getStockPercentage = (current: number, min: number, max: number) => {
    return Math.round((current / max) * 100);
  };

  // Función para convertir gramos a kilogramos para mostrar
  const convertToDisplayUnit = (value: number, unit: string) => {
    if (unit === 'g' && value >= 1000) {
      return `${(value / 1000).toFixed(2)} kg`;
    }
    return `${value} ${unit}`;
  };

  // Función para convertir de kilogramos a gramos para guardar
  const convertToStorageUnit = (value: number, unit: string) => {
    if (unit === 'kg') {
      return value * 1000;
    }
    return value;
  };

  // Función para obtener la unidad de almacenamiento (siempre gramos)
  const getStorageUnit = (displayUnit: string) => {
    return 'g';
  };

  // Función para determinar la unidad basada en el formato del número
  const getSmartUnit = (value: number) => {
    const str = value.toString();
    // Si tiene punto decimal y es menor a 1, es gramos
    if (str.includes('.') && value < 1) {
      return 'g';
    }
    // Si es un número entero o mayor a 1, es kilogramos
    return 'kg';
  };

  // Función para convertir a gramos basado en la unidad inteligente
  const convertToGrams = (value: number) => {
    const unit = getSmartUnit(value);
    return unit === 'kg' ? value * 1000 : value;
  };

  // Función para mostrar el valor con la unidad correcta
  const displayWithSmartUnit = (value: number) => {
    const unit = getSmartUnit(value);
    return unit === 'kg' ? `${value} kg` : `${value} g`;
  };

  const handleEditItem = (item: InventoryItem) => {
    // Convertir de gramos a la unidad de visualización apropiada
    const displayValue = item.currentStock >= 1000 ? item.currentStock / 1000 : item.currentStock;
    const displayUnit = item.currentStock >= 1000 ? 'kg' : 'g';
    
    setEditingItem({ 
      ...item, 
      unit: displayUnit,
      currentStock: displayValue
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!canEditInsumo) {
      toast.error('No tienes permisos para realizar esta acción');
      return;
    }
    if (editingItem) {
      try {
        // Convertir a gramos para almacenamiento usando la lógica inteligente
        const currentValue = parseFloat(editingItem.currentStock.toString()) || 0;
        const stockInGrams = convertToGrams(currentValue);
        
        const updates = {
          ...editingItem,
          currentStock: stockInGrams,
          unit: 'g', // Siempre almacenar en gramos
          location: `${editingItem.rack}-${editingItem.place}-${editingItem.level}`,
        };
        const result = await updateInventoryItem(editingItem.id, updates);
        if (!result) {
          toast.error('Error al guardar los cambios. Por favor intenta nuevamente.');
          return;
        }
        setIsEditModalOpen(false);

        await ActivityLogService.log({
          user_name: user?.user_name || 'desconocido',
          user_role: user?.role || 'user',
          accion: 'Editó materia prima',
          entidad: 'Inventario',
          descripcion: `Editó "${editingItem.name}" en inventario`,
          color_tag: 'yellow'
        });

        setEditingItem(null);
      } catch (error) {
        console.error('Error actualizando materia prima:', error);
        toast.error('Error al guardar los cambios. Por favor intenta nuevamente.');
      }
    }
  };

  const handleCancelEdit = () => {
    setIsEditModalOpen(false);
    setEditingItem(null);
  };

  const handleInputChange = (field: string, value: string) => {
    if (editingItem) {
      setEditingItem(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleAddItem = () => {
    setNewItem({
      name: "",
      certificate: "",
      rack: "",
      place: "",
      level: "",
      currentStock: "",
      category: "Aceites Esenciales",
      unit: "g", // Gramos por defecto
      status: "normal"
    });
    setIsAddModalOpen(true);
  };

  const handleSaveNewItem = async () => {
    if (!canNuevoInsumo) {
      toast.error('No tienes permisos para realizar esta acción');
      return;
    }
    // Validar campos requeridos
    if (!newItem.name.trim()) {
      toast.info('Por favor ingresa el nombre de la materia prima');
      return;
    }
    if (!newItem.certificate.trim()) {
      toast.info('Por favor ingresa el número de certificado');
      return;
    }
    if (!newItem.rack.trim()) {
      toast.info('Por favor ingresa el rack');
      return;
    }
    if (!newItem.place.trim()) {
      toast.info('Por favor ingresa el lugar');
      return;
    }
    if (!newItem.level.trim()) {
      toast.info('Por favor ingresa el nivel');
      return;
    }
    if (!newItem.currentStock || parseFloat(newItem.currentStock) <= 0) {
      toast.info('Por favor ingresa una cantidad válida');
      return;
    }

    setIsCreating(true);
    
    try {
      const stockValue = parseFloat(newItem.currentStock);
      
      // Convertir a gramos para almacenamiento usando lógica inteligente
      const currentStockInGrams = convertToGrams(stockValue);
      
      // Valores por defecto para stock mínimo y máximo
      const minStockInGrams = 5000; // 5kg en gramos por defecto
      const maxStockInGrams = 25000; // 25kg en gramos por defecto
      
      const itemToAdd = {
        name: newItem.name.trim(),
        category: newItem.category,
        currentStock: currentStockInGrams,
        minStock: minStockInGrams,
        maxStock: maxStockInGrams,
        unit: 'g', // Siempre almacenar en gramos
        location: `${newItem.rack}-${newItem.place}-${newItem.level}`,
        certificate: newItem.certificate.trim(),
        rack: newItem.rack.trim(),
        place: newItem.place.trim(),
        level: newItem.level.trim(),
      };

      console.log('🔄 Intentando crear materia prima:', itemToAdd);
      const result = await createInventoryItem(itemToAdd);
      
      if (result) {
        console.log('✅ Materia prima creada exitosamente');
        setIsAddModalOpen(false);

        await ActivityLogService.log({
          user_name: user?.user_name || 'desconocido',
          user_role: user?.role || 'user',
          accion: 'Agregó materia prima',
          entidad: 'Inventario',
          descripcion: `Agregó "${itemToAdd.name}" al inventario`,
          color_tag: 'green'
        });

        setNewItem({
          name: "",
          certificate: "",
          rack: "",
          place: "",
          level: "",
          currentStock: "",
          category: "Aceites Esenciales",
          unit: "g", // Gramos por defecto
          status: "normal"
        });
      } else {
        toast.error('Error al crear la materia prima. Por favor intenta nuevamente.');
      }
    } catch (error) {
      console.error('❌ Error creando materia prima:', error);
      toast.error(`Error al crear la materia prima: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelAdd = () => {
    setIsAddModalOpen(false);
    setNewItem({
      name: "",
      certificate: "",
      rack: "",
      place: "",
      level: "",
      currentStock: "",
      category: "Aceites Esenciales",
      unit: "g", // Gramos por defecto
      status: "normal"
    });
  };

  const handleNewItemInputChange = (field: string, value: string) => {
    setNewItem(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDeleteItem = async () => {
    if (!isSuperAdmin || !deletingItemId) return;

    // Capturar datos ANTES de eliminar para tenerlos disponibles en el log
    const itemData = inventoryItems.find(i => i.id === deletingItemId);
    const itemIdSnapshot = deletingItemId;

    try {
      await deleteInventoryItem(itemIdSnapshot);

      // Registrar en log ANTES de limpiar el estado
      await ActivityLogService.log({
        user_name: user?.user_name || 'desconocido',
        user_role: user?.role || 'superadmin',
        accion: 'Eliminó materia prima',
        entidad: 'Inventario',
        descripcion: itemData
          ? `Eliminó "${itemData.name}" del inventario`
          : `Eliminó materia prima con ID ${itemIdSnapshot}`,
        color_tag: 'red'
      });

      setIsDeleteConfirmOpen(false);
      setDeletingItemId(null);
    } catch (error) {
      console.error('Error eliminando materia prima:', error);
    }
  };

  const handleOpenDetail = async (item: InventoryItem) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
    setRackMapLoading(true);
    try {
      const all = await InventoryService.getInventoryItems();
      setRackMapItems(all);
    } finally {
      setRackMapLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Materias Primas</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Gestión y control de inventario base</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-80 lg:w-96 group">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4 transition-colors group-focus-within:text-pink-500" />
            <Input
              placeholder="Buscar por nombre, certificado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 h-11 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-pink-500/20"
            />
          </div>
          {canNuevoInsumo && (
            <Button onClick={handleAddItem} className="h-11 px-6 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white font-bold shadow-lg shadow-pink-500/20 transition-all hover:-translate-y-0.5">
              <Plus className="h-5 w-5 mr-2" />
              Nuevo Insumo
            </Button>
          )}
        </div>
      </div>

      {/* Indicadores de estado */}
      {loading && (
        <div className="text-center py-8">
          <div className="text-muted-foreground">Cargando materias primas...</div>
        </div>
      )}

      {error && (
        <div className="text-center py-8 text-destructive">
          <div>Error: {error}</div>
        </div>
      )}

      {!loading && !error && totalCount === 0 && (
        <div className="text-center py-12">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {searchTerm ? "No se encontraron materias primas" : "No hay materias primas"}
          </h3>
          <p className="text-muted-foreground">
            {searchTerm
              ? "Intenta con otros términos de búsqueda."
              : "Agrega tu primera materia prima para comenzar."
            }
          </p>
        </div>
      )}

      {!loading && !error && totalCount > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {inventoryItems.map((item) => {
            const stockPercent = item.maxStock ? Math.min(100, (item.currentStock / item.maxStock) * 100) : 0;
            const isLow = item.status !== 'normal';
            
            return (
              <Card 
                key={item.id} 
                className={`relative overflow-hidden bg-white dark:bg-slate-800/80 rounded-[2rem] shadow-sm hover:shadow-2xl transition-all duration-500 ease-out group hover:-translate-y-2 dark:backdrop-blur-xl border ${(item.currentStock || 0) <= 0 ? 'border-red-300 dark:border-red-700' : 'border-slate-100 dark:border-slate-700'} cursor-pointer`}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('button')) return;
                  handleOpenDetail(item);
                }}
              >
                {/* Status Indicator Bar */}
                <div className={`absolute top-0 left-0 w-full h-1.5 ${isLow ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white truncate tracking-tight group-hover:text-pink-500 transition-colors">
                        {item.name}
                        {(item.currentStock || 0) <= 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 mt-1 ml-2">
                            ● AGOTADO
                          </span>
                        )}
                      </h3>
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                        Cert: {item.certificate}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSuperAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingItemId(item.id);
                            setIsDeleteConfirmOpen(true);
                          }}
                          className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {canEditInsumo && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditItem(item)}
                          className="h-9 w-9 text-slate-400 hover:text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-xl transition-all"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Stock Detail */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-pink-500" />
                          <span className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Existencias</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className={`text-lg font-black ${(item.currentStock || 0) <= 0 ? 'text-red-600 dark:text-red-400' : isLow ? 'text-amber-500' : 'text-slate-800 dark:text-white'}`}>
                            {(item.currentStock || 0) <= 0
                              ? '0 kg'
                              : item.currentStock >= 1000 
                              ? `${(item.currentStock / 1000).toLocaleString()} kg` 
                              : `${item.currentStock.toLocaleString()} g`}
                          </span>
                          {(item.currentStock || 0) <= 0 && (
                            <p className="text-xs text-red-500 font-bold mt-0.5">
                              Pendiente de reabastecimiento
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ease-out rounded-full ${(item.currentStock || 0) <= 0 ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-pink-500'}`}
                            style={{ width: `${stockPercent || 50}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           <span>Min: {item.minStock ? (item.minStock/1000) : 5}kg</span>
                           <span>{getStatusText(item.status)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Location detail */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">
                        <MapPin className="h-3.5 w-3.5" /> Ubicación en Planta
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-2 text-center transition-colors group-hover:border-pink-200 dark:group-hover:border-pink-900">
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Rack</p>
                          <p className="text-sm font-black text-slate-700 dark:text-white">{item.rack}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-2 text-center transition-colors group-hover:border-pink-200 dark:group-hover:border-pink-900">
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Lugar</p>
                          <p className="text-sm font-black text-slate-700 dark:text-white">{item.place}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-2 text-center transition-colors group-hover:border-pink-200 dark:group-hover:border-pink-900">
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Nivel</p>
                          <p className="text-sm font-black text-slate-700 dark:text-white">{item.level}</p>
                        </div>
                      </div>
                    </div>

                    {item.observaciones && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                        <StickyNote className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                          {item.observaciones}
                        </p>
                      </div>
                    )}

                    {item.status !== "normal" && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 animate-pulse">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-tight">
                          {item.status === "critical" ? "Reabastecimiento urgente" : "Existencias bajas"}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && !error && totalCount > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between gap-4 bg-white dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} de {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-bold text-slate-700 dark:text-white min-w-[90px] text-center">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Edición */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Materia Prima</DialogTitle>
          </DialogHeader>
          
          {editingItem && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la Materia Prima</Label>
                <Input
                  id="name"
                  value={editingItem.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Nombre de la materia prima"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="certificate">Número de Certificado</Label>
                <Input
                  id="certificate"
                  value={editingItem.certificate}
                  onChange={(e) => handleInputChange('certificate', e.target.value)}
                  placeholder="Número de certificado"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rack">Rack</Label>
                  <Input
                    id="rack"
                    value={editingItem.rack}
                    onChange={(e) => handleInputChange('rack', e.target.value)}
                    placeholder="A"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="place">Lugar</Label>
                  <Input
                    id="place"
                    value={editingItem.place}
                    onChange={(e) => handleInputChange('place', e.target.value)}
                    placeholder="12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">Nivel</Label>
                  <Input
                    id="level"
                    value={editingItem.level}
                    onChange={(e) => handleInputChange('level', e.target.value)}
                    placeholder="3"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currentStock">Cantidad</Label>
                  <Input
                    id="currentStock"
                    type="number"
                    step="0.1"
                    value={editingItem.currentStock.toString()}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      handleInputChange('currentStock', inputValue);
                    }}
                    placeholder="Ej: 1 (kg) o 0.500 (g)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unidad</Label>
                  <select
                    id="unit"
                    value={editingItem.unit}
                    onChange={(e) => {
                      const newUnit = e.target.value;
                      const currentValue = parseFloat(editingItem.currentStock.toString()) || 0;
                      let convertedValue;
                      
                      if (editingItem.unit === 'kg' && newUnit === 'g') {
                        // De kg a g: multiplicar por 1000
                        convertedValue = currentValue * 1000;
                      } else if (editingItem.unit === 'g' && newUnit === 'kg') {
                        // De g a kg: dividir por 1000
                        convertedValue = currentValue / 1000;
                      } else {
                        // Misma unidad: no cambiar
                        convertedValue = currentValue;
                      }
                      
                      handleInputChange('unit', newUnit);
                      handleInputChange('currentStock', convertedValue.toString());
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="g">Gramos (g)</option>
                    <option value="kg">Kilogramos (kg)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  value={editingItem.observaciones || ''}
                  onChange={(e) => handleInputChange('observaciones', e.target.value)}
                  placeholder="Nota opcional (no afecta la búsqueda)"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Agregar Nueva Materia Prima */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Agregar Nueva Materia Prima</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Nombre de la Materia Prima</Label>
              <Input
                id="new-name"
                value={newItem.name}
                onChange={(e) => handleNewItemInputChange('name', e.target.value)}
                placeholder="Nombre de la materia prima"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-certificate">Número de Certificado</Label>
              <Input
                id="new-certificate"
                value={newItem.certificate}
                onChange={(e) => handleNewItemInputChange('certificate', e.target.value)}
                placeholder="Número de certificado"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-rack">Rack</Label>
                <Input
                  id="new-rack"
                  value={newItem.rack}
                  onChange={(e) => handleNewItemInputChange('rack', e.target.value)}
                  placeholder="A"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-place">Lugar</Label>
                <Input
                  id="new-place"
                  value={newItem.place}
                  onChange={(e) => handleNewItemInputChange('place', e.target.value)}
                  placeholder="12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-level">Nivel</Label>
                <Input
                  id="new-level"
                  value={newItem.level}
                  onChange={(e) => handleNewItemInputChange('level', e.target.value)}
                  placeholder="3"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-currentStock">Cantidad</Label>
                <Input
                  id="new-currentStock"
                  type="number"
                  step="0.1"
                  value={newItem.currentStock}
                  onChange={(e) => handleNewItemInputChange('currentStock', e.target.value)}
                  placeholder="25000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-unit">Unidad</Label>
                <select
                  id="new-unit"
                  value={newItem.unit}
                  onChange={(e) => handleNewItemInputChange('unit', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="g">Gramos (g)</option>
                  <option value="kg">Kilogramos (kg)</option>
                </select>
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelAdd} disabled={isCreating}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSaveNewItem} disabled={isCreating}>
              {isCreating ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Eliminar Materia Prima
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              ¿Estás seguro que querés eliminar esta materia prima? 
              Esta acción no se puede deshacer.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteConfirmOpen(false);
                setDeletingItemId(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteItem}
            >
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalle */}
      <Dialog 
        open={isDetailModalOpen} 
        onOpenChange={setIsDetailModalOpen}
      >
        <DialogContent className="max-w-6xl border-none bg-transparent shadow-none p-0 overflow-visible">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedItem?.name}</DialogTitle>
          </DialogHeader>

          {selectedItem && rackMapLoading && (
            <div className="w-full py-24 text-center text-white/80 bg-slate-900/80 rounded-3xl">
              Cargando mapa de racks...
            </div>
          )}

          {selectedItem && !rackMapLoading && (
            <div className="w-full">
              <MapaUbicacionRacks
                rack={parseInt(selectedItem.rack) || 0}
                lugarStr={selectedItem.place || ''}
                nivel={parseInt(selectedItem.level) || 0}
                nombreInsumo={selectedItem.name}
                allItems={rackMapItems.map(i => ({
                  id: i.id,
                  name: i.name,
                  rack: i.rack,
                  place: i.place,
                  level: i.level,
                  currentStock: i.currentStock,
                  certificate: i.certificate,
                  status: i.status,
                  unit: i.unit,
                  minStock: i.minStock || 0,
                }))}
              />
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDetailModalOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};