import { useState, useEffect, useMemo } from "react";
import { FileText, Package, CheckCircle, XCircle, RefreshCw, AlertCircle, CheckSquare, Square } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useRealtimeRemitos } from "@/hooks/useRealtimeRemitos";
import { ProductionItem, RemitoService } from "@/services/remitoService";
import { EnvioService } from "@/services/envioService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner"; 
import { useAuth } from "@/components/Auth/AuthProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ActivityLogService } from "@/services/activityLogService";

interface RemitoProductionProps {
  productionItems: ProductionItem[];
  onSuccess?: () => void;
}

export const RemitoProduction = ({ productionItems, onSuccess }: RemitoProductionProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  
  const { user } = useAuth();
  const canGenerateRemito = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'developer' || user?.user_name === 'jose';

  const {
    currentRemito,
    loading,
    error,
    generateRemitoForVillaMartelli
  } = useRealtimeRemitos();

  // Filtrar items de Villa Martelli
  const villaMartelliItems = useMemo(() => {
    return productionItems.filter(item => {
      const normalizedStatus = item.status.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
      const normalizedDestination = item.destination.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
      
      const isTerminated = ['terminado', 'finalizado', 'completo', 'available'].includes(normalizedStatus);
      const isVillaMartelli = normalizedDestination === 'villamartelli';
      const hasStock = (item.stock_actual ?? item.batchSize) > 0;
      return isTerminated && isVillaMartelli && hasStock;
    }).sort((a, b) => Number(a.lote_code || a.id) - Number(b.lote_code || b.id));
  }, [productionItems]);

  // Seleccionar automáticamente todos los productos de Villa Martelli
  useEffect(() => {
    if (villaMartelliItems.length > 0) {
      const allIds = new Set(villaMartelliItems.map(item => item.id));
      setSelectedItems(prev => {
        // Solo actualizar si realmente hay cambios
        const currentIds = new Set(prev);
        const hasChanges = allIds.size !== currentIds.size || 
          !Array.from(allIds).every(id => currentIds.has(id));
        
        if (hasChanges) {
          console.log('🔄 Actualizando selección automática');
          return allIds;
        }
        return prev;
      });
    }
  }, [villaMartelliItems]);

  // Obtener productos seleccionados
  const selectedProducts = villaMartelliItems.filter(item => selectedItems.has(item.id));

  // Manejar selección individual
  const handleItemToggle = (itemId: string) => {
    console.log('🔄 Toggle item:', itemId);
    console.log('📊 Current selected items:', Array.from(selectedItems));
    
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      const wasSelected = newSet.has(itemId);
      
      if (wasSelected) {
        newSet.delete(itemId);
        console.log('❌ Deseleccionando item:', itemId);
      } else {
        newSet.add(itemId);
        console.log('✅ Seleccionando item:', itemId);
      }
      
      console.log('📊 New selected items:', Array.from(newSet));
      return newSet;
    });
  };

  // Manejar seleccionar/deseleccionar todos
  const handleSelectAll = () => {
    console.log('🔄 Select All clicked');
    console.log('📊 Current selected count:', selectedItems.size);
    console.log('📊 Total items count:', villaMartelliItems.length);
    
    if (selectedItems.size === villaMartelliItems.length) {
      console.log('❌ Deseleccionando todos');
      setSelectedItems(new Set());
    } else {
      console.log('✅ Seleccionando todos');
      const allIds = villaMartelliItems.map(item => item.id);
      setSelectedItems(new Set(allIds));
    }
  };

  const handleGenerateRemito = async () => {
    console.log('🔄 Iniciando generación de remito...');
    
    // 1. Usar toast.promise para mayor visibilidad
    toast.promise(
      (async () => {
        // Generar remito (RemitoService ahora crea el envío automáticamente)
        const result = await RemitoService.generateRemitoForVillaMartelli(selectedProducts);
        
        if (!result || !result.id) {
          throw new Error("No se pudo generar el remito.");
        }

        return { remito: result };
      })(),
      {
        loading: 'Generando remito y registrando envío...',
        success: (data) => {
          // Limpiar UI
          setSelectedItems(new Set());
          setIsConfirmOpen(false);
          setIsGenerating(false);
          
          // Notificar éxito visual
          setShowSuccessMessage(`✅ Remito ${data.remito.id} generado y enviado correctamente.`);
          
          ActivityLogService.log({
            user_name: user?.user_name || 'desconocido',
            user_role: user?.role || 'admin',
            accion: 'Generó remito',
            entidad: 'Remitos Producción',
            descripcion: `Generó remito para Villa Martelli con ${selectedProducts.length} productos`,
            color_tag: 'green'
          });

          // Ejecutar callback para cambiar de pestaña si existe
          if (onSuccess) {
            setTimeout(onSuccess, 1000);
          }

          return `✅ Remito Villa Martelli generado exitosamente.`;
        },
        error: (err) => {
          setIsGenerating(false);
          setIsConfirmOpen(false);
          return `❌ Error: ${err.message}`;
        }
      }
    );
  };

  const onGenerateClick = () => {
    if (selectedProducts.length === 0) {
      toast.warning("⚠️ Selecciona al menos un producto para generar el remito");
      return;
    }
    
    if (!canGenerateRemito) {
      toast.error("❌ No tienes permisos para generar remitos. Solo personal autorizado (Admin) puede realizar esta acción.");
      return;
    }

    // Abrir confirmación
    setIsConfirmOpen(true);
  };



  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case 'abierto':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cerrado':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusText = (estado: string) => {
    switch (estado) {
      case 'abierto':
        return 'Abierto';
      case 'cerrado':
        return 'Cerrado';
      default:
        return 'Desconocido';
    }
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'abierto':
        return 'default';
      case 'cerrado':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Mensaje de éxito */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
            <span className="font-medium">{showSuccessMessage}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5" />
          ENVIO DE PRODUCCION VILLA MARTELLI
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span>{selectedProducts.length} de {villaMartelliItems.length} productos seleccionados</span>
          </div>
          <Button
            onClick={onGenerateClick}
            disabled={isGenerating || loading || selectedProducts.length === 0}
            className="flex items-center gap-2 bg-[#023F86] hover:bg-[#0555B1] shadow-lg shadow-blue-500/20"
          >
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {isGenerating ? 'Generando...' : 'GENERAR ENVIO'}
          </Button>
        </div>
      </div>

      {/* Indicadores de estado */}
      {loading && (
        <div className="text-center py-8">
          <div className="text-muted-foreground">Cargando remito...</div>
        </div>
      )}

      {error && (
        <div className="text-center py-8 text-destructive">
          <div>Error: {error}</div>
        </div>
      )}

      {/* Información de productos disponibles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Productos Disponibles para Villa Martelli
            </CardTitle>
            {villaMartelliItems.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="flex items-center gap-2"
                >
                  {selectedItems.size === villaMartelliItems.length ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {selectedItems.size === villaMartelliItems.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {villaMartelliItems.length === 0 ? (
            <div className="text-center py-4">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No hay productos terminados para Villa Martelli</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {villaMartelliItems.length} productos disponibles
                </p>
                <p className="text-sm font-medium text-[#023F86]">
                   {selectedProducts.length} seleccionados
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {villaMartelliItems.map((item) => (
                  <div 
                    key={item.id} 
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedItems.has(item.id)
                        ? 'border-[#023F86] bg-[#023F86]/5'
                        : 'border-black dark:border-white bg-card shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedItems.has(item.id)}
                        onCheckedChange={(checked) => {
                          console.log('🔄 Checkbox changed:', item.id, 'checked:', checked);
                          if (checked) {
                            setSelectedItems(prev => new Set([...prev, item.id]));
                          } else {
                            setSelectedItems(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(item.id);
                              return newSet;
                            });
                          }
                        }}
                        className="mt-1 !border-black dark:!border-white"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">{item.name}</span>
                          <Badge variant="outline" className="ml-2">
                            {item.batchSize} kg
                          </Badge>
                        </div>
                        <div className="text-xs text-foreground space-y-1">
                          <div>Lote: {item.lote_code || item.id}</div>
                          <div>Fecha: {item.date ? new Date(item.date + 'T00:00:00').toLocaleDateString('es-AR') : '-'}</div>
                          <div>Cantidad: {item.batchSize} kg</div>
                          <div>
                            {item.type === 'client' ? `Cliente: ${item.clientName || 'N/A'}` : 'Stock'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de confirmación para Generar Remito */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-md bg-background border-border text-foreground">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="flex items-center gap-3 text-amber-500 text-xl">
              <AlertCircle className="h-6 w-6" />
              Confirmar Generación de Envio
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-6 space-y-4">
            <p className="text-foreground font-medium">
              ¿Estás seguro de que deseas generar el remito para <span className="text-blue-600 font-bold">{selectedProducts.length} productos</span>?
            </p>
            
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
              <p className="text-sm text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                ¡ATENCIÓN! ACCIÓN IRREVERSIBLE:
              </p>
              <ul className="text-xs text-amber-600 dark:text-amber-300 list-disc list-inside space-y-1">
                <li>La producción actual de estos productos se **REINICIARÁ A CERO**.</li>
                <li>Se descontará el stock de planta definitivamente.</li>
                <li>Se creará un nuevo registro de envío en el historial.</li>
              </ul>
            </div>
            
            <p className="text-sm text-muted-foreground italic">
              Este proceso libera la tarjeta de producción del tablero principal para nuevos lotes.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border mt-2">
            <Button
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isGenerating}
              className="flex-1 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleGenerateRemito}
              disabled={isGenerating}
              className="flex-1 bg-[#023F86] hover:bg-[#0555B1] rounded-xl shadow-lg shadow-blue-500/20"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  GENERAR ENVIO AHORA
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
