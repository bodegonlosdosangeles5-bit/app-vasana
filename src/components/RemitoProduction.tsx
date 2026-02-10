import { useState, useEffect, useMemo } from "react";
import { FileText, Package, CheckCircle, XCircle, RefreshCw, AlertCircle, CheckSquare, Square } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useRealtimeRemitos } from "@/hooks/useRealtimeRemitos";
import { useRemitosPolling } from "@/hooks/useRemitosPolling";
import { ProductionItem } from "@/services/remitoService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner"; // Assuming sonner is used for toasts based on other files

interface RemitoProductionProps {
  productionItems: ProductionItem[];
}

export const RemitoProduction = ({ productionItems }: RemitoProductionProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const realtimeHook = useRealtimeRemitos();
  const pollingHook = useRemitosPolling()
  ;
  
  // Usar polling si hay error de Realtime, sino usar Realtime
  const {
    currentRemito,
    loading,
    error,
    generateRemitoForVillaMartelli
  } = realtimeHook.realtimeError ? pollingHook : realtimeHook;

  // Filtrar items de Villa Martelli
  const villaMartelliItems = useMemo(() => {
    return productionItems.filter(item => {
      const normalizedStatus = item.status.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
      const normalizedDestination = item.destination.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
      
      const isTerminated = ['terminado', 'finalizado', 'completo', 'available'].includes(normalizedStatus);
      const isVillaMartelli = normalizedDestination === 'villamartelli';
      const hasStock = item.stock_actual !== undefined ? item.stock_actual > 0 : true; // If undefined (legacy), assume it has stock if it's in the list
      
      return isTerminated && isVillaMartelli && hasStock;
    });
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
    
    if (selectedProducts.length === 0) {
      console.log('⚠️ No hay productos seleccionados para generar remito');
      setShowSuccessMessage("⚠️ Selecciona al menos un producto para generar el remito");
      setTimeout(() => setShowSuccessMessage(null), 3000);
      return;
    }

    try {
      setIsGenerating(true);
      const totalKilos = selectedProducts.reduce((sum, item) => sum + item.batchSize, 0);
      
      // 1. Crear el Remito Header
      const { data: remitoData, error: remitoError } = await supabase
        .from('remitos')
        .insert({
          id: `R-${Date.now()}`,
          fecha: new Date().toISOString(),
          destino: 'Villa Martelli',
          total_kilos: totalKilos,
          estado: 'abierto'
        })
        .select()
        .single();

      if (remitoError) throw remitoError;

      // 2. Procesar cada item
      for (const product of selectedProducts) {
        // a. Crear Item de Remito
        const { error: itemError } = await supabase
          .from('remito_items')
          .insert({
            id: `RI-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            remito_id: remitoData.id,
            producto_id: product.id,
            nombre_producto: product.name,
            kilos_sumados: product.batchSize,
            cantidad_lotes: 1,
            lote: product.lote_code || product.id,
            cliente_o_stock: product.type === 'client' ? product.clientName : 'Stock'
          });

        if (itemError) throw itemError;

        // b. Actualizar Stock del Producto (SOLO STOCK, NO PRODUCCIÓN)
        // Obtenemos el producto actual para saber su stock
        const { data: currentProduct, error: fetchError } = await supabase
          .from('productos')
          .select('stock_actual, batch_size')
          .eq('id', product.id)
          .single();

        if (fetchError) { 
           console.error("Error fetching product for stock update", fetchError);
           // Fallback if stock_actual doesn't exist yet
        }

        const currentStock = currentProduct?.stock_actual !== undefined ? currentProduct.stock_actual : (currentProduct?.batch_size || 0);
        const newStock = Math.max(0, currentStock - product.batchSize);

        // Actualizamos stock_actual. NO tocamos batch_size (Producción Histórica).
        // NO cambiamos status a 'entregado' si eso lo borra de las métricas.
        const { error: updateError } = await supabase
          .from('productos')
          .update({ 
            stock_actual: newStock,
          })
          .eq('id', product.id);

        if (updateError) throw updateError;
      }

      setShowSuccessMessage(`✅ Remito generado exitosamente con ${selectedProducts.length} productos (${totalKilos} kg)`);
      setTimeout(() => setShowSuccessMessage(null), 5000);
      
      // Limpiar selección
      setSelectedItems(new Set());

    } catch (error: unknown) {
      const err = error as Error;
      console.error('❌ Error generando remito:', err);
      setShowSuccessMessage(`❌ Error al generar el remito: ${err.message}`);
      setTimeout(() => setShowSuccessMessage(null), 5000);
    } finally {
      setIsGenerating(false);
    }
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
          Remito de Producción - Villa Martelli
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span>{selectedProducts.length} de {villaMartelliItems.length} productos seleccionados</span>
          </div>
          <Button
            onClick={handleGenerateRemito}
            disabled={isGenerating || loading || selectedProducts.length === 0}
            className="flex items-center gap-2"
          >
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {isGenerating ? 'Generando...' : 'Generar Remito'}
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
                <p className="text-sm font-medium text-primary">
                  {selectedProducts.length} seleccionados
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {villaMartelliItems.map((item) => (
                  <div 
                    key={item.id} 
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedItems.has(item.id) 
                        ? 'border-primary bg-primary/5' 
                        : 'border-muted bg-muted/50'
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
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">{item.name}</span>
                          <Badge variant="outline" className="ml-2">
                            {item.batchSize} kg
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Lote: {item.lote_code || item.id}</div>
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



    </div>
  );
};
