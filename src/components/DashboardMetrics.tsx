import { Package, FlaskConical, TrendingUp, Search, X, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMemo, useState, useEffect } from "react";
import { Producto } from "@/services/productoService";
import { useRealtimeInventory } from "@/hooks/useRealtimeInventory";
import { useRealtimeProductos } from "@/hooks/useRealtimeProductos";
import { ProductionStatsModal } from "./ProductionStatsModal";
import { BarChart3 } from "lucide-react";

interface DashboardMetricsProps {
  formulas?: Producto[]; // Mantener para compatibilidad pero no usar
  onNavigateToProduction?: () => void;
}

export const DashboardMetrics = ({ formulas = [], onNavigateToProduction }: DashboardMetricsProps) => {
  // Usar el hook de productos en tiempo real
  const { productos, loading: productosLoading, error: productosError } = useRealtimeProductos();
  
  // Usar los datos del hook en tiempo real o los props como fallback
  const formulasData = productos.length > 0 ? productos : formulas;
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isOutOfStockOpen, setIsOutOfStockOpen] = useState(false);
  const [isFormulasListOpen, setIsFormulasListOpen] = useState(false);
  const [isProductionStatsOpen, setIsProductionStatsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [animatedProgressKilos, setAnimatedProgressKilos] = useState(0);
  const [animatedProgressTerminados, setAnimatedProgressTerminados] = useState(0);
  const [animatedProgressOutOfStock, setAnimatedProgressOutOfStock] = useState(0);
  
  // Hook para obtener datos de inventario
  const { inventoryItems, loading: inventoryLoading } = useRealtimeInventory();

  // Función para normalizar texto (quitar tildes, espacios y convertir a minúsculas)
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
      .replace(/\s+/g, ''); // Quitar espacios
  };

  // Calcular los kilos disponibles usando la misma lógica que ProductionSection (excluyendo procesadas)
  const kilosDisponibles = useMemo(() => {
    return formulasData
      .filter(formula => {
        const normalizedStatus = normalizeText(formula.status);
        const normalizedDestination = normalizeText(formula.destination);
        
        const isTerminated = normalizedStatus === 'available';
        const isVillaMartelli = normalizedDestination === 'villamartelli';
        
        return isTerminated && isVillaMartelli;
      })
      .reduce((total, formula) => total + (formula.batchSize || 0), 0);
  }, [formulasData]);

  // Calcular productos terminados para Villa Martelli
  const formulasTerminadas = useMemo(() => {
    console.log('🔍 DashboardMetrics - Filtrado de productos:');
    console.log('📊 Total de productos recibidos:', formulasData.length);
    console.log('📊 Productos recibidos:', formulasData.map(f => ({
      id: f.id,
      name: f.name,
      status: f.status,
      destination: f.destination
    })));
    
    const filtered = formulasData.filter(formula => {
      const normalizedStatus = normalizeText(formula.status);
      const normalizedDestination = normalizeText(formula.destination);
      
      const isTerminated = normalizedStatus === 'available';
      const isVillaMartelli = normalizedDestination === 'villamartelli';
      
      console.log(`🔍 Producto ${formula.name}:`, {
        status: formula.status,
        normalizedStatus,
        destination: formula.destination,
        normalizedDestination,
        isTerminated,
        isVillaMartelli,
        passes: isTerminated && isVillaMartelli
      });
      
      return isTerminated && isVillaMartelli;
    });
    
    console.log(`✅ Productos filtrados para Villa Martelli: ${filtered.length}`);
    return filtered;
  }, [formulasData]);

  // Filtrar inventario según término de búsqueda (igual que InventorySection)
  const filteredInventory = useMemo(() => {
    if (!searchTerm.trim()) return inventoryItems;
    
    const normalizedSearch = normalizeText(searchTerm);
    return inventoryItems.filter(item => 
      normalizeText(item.name).includes(normalizedSearch) ||
      normalizeText(item.certificate || '').includes(normalizedSearch) ||
      normalizeText(item.location || '').includes(normalizedSearch)
    );
  }, [inventoryItems, searchTerm]);

  // Calcular materias primas sin stock (cantidad <= 0)
  const outOfStockItems = useMemo(() => {
    return inventoryItems.filter(item => (item.currentStock || 0) <= 0);
  }, [inventoryItems]);

  // Totales para progresos proporcionales
  const totalInventoryItems = inventoryItems.length || 0;
  const totalProductos = formulasData.length || 0;
  const totalKilosTeoricos = useMemo(() => {
    return formulasData.reduce((sum, f) => sum + (f.batchSize || 0), 0);
  }, [formulasData]);

  // Progreso de materias primas sin stock basado en 200 items como máximo
  const MAX_OUT_OF_STOCK = 200;
  const progressOutOfStockTarget = Math.min(100, Math.max(0, Math.round((outOfStockItems.length / MAX_OUT_OF_STOCK) * 100)));

  // Progreso de productos terminados basado en 50 productos como máximo
  const MAX_PRODUCTOS_TERMINADOS = 50;
  const progressTerminadosTarget = Math.min(100, Math.max(0, Math.round((formulasTerminadas.length / MAX_PRODUCTOS_TERMINADOS) * 100)));

  // Progreso de kilos basado en 5000 kilos como máximo
  const MAX_KILOS = 5000;
  const progressKilosTarget = Math.min(100, Math.max(0, Math.round((kilosDisponibles / MAX_KILOS) * 100)));

  // Animación del progreso de kilos desde 0 hasta el valor final
  useEffect(() => {
    // Resetear el progreso animado cuando cambian los kilos disponibles
    setAnimatedProgressKilos(0);

    if (progressKilosTarget > 0) {
      const duration = 2000; // Duración total de la animación: 2 segundos
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Usar una función de easing para una animación más suave (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const newValue = progressKilosTarget * easeOut;
        
        setAnimatedProgressKilos(newValue);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      const animationFrame = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationFrame);
    }
  }, [progressKilosTarget]);

  // Animación del progreso de productos terminados desde 0 hasta el valor final
  useEffect(() => {
    // Resetear el progreso animado cuando cambian los productos terminados
    setAnimatedProgressTerminados(0);

    if (progressTerminadosTarget > 0) {
      const duration = 2000; // Duración total de la animación: 2 segundos
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Usar una función de easing para una animación más suave (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const newValue = progressTerminadosTarget * easeOut;
        
        setAnimatedProgressTerminados(newValue);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      const animationFrame = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationFrame);
    }
  }, [progressTerminadosTarget, formulasTerminadas.length]);

  // Animación del progreso de materias primas sin stock desde 0 hasta el valor final
  useEffect(() => {
    // Resetear el progreso animado cuando cambian las materias primas sin stock
    setAnimatedProgressOutOfStock(0);

    if (progressOutOfStockTarget > 0) {
      const duration = 2000; // Duración total de la animación: 2 segundos
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Usar una función de easing para una animación más suave (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const newValue = progressOutOfStockTarget * easeOut;
        
        setAnimatedProgressOutOfStock(newValue);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      const animationFrame = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationFrame);
    }
  }, [progressOutOfStockTarget, outOfStockItems.length]);

  const metrics = [
    {
      title: "Materias Primas sin Stock",
      value: outOfStockItems.length.toString(),
      subtitle: "items faltantes",
      icon: Package,
      color: "destructive",
      progress: animatedProgressOutOfStock,
      hasOutOfStock: true,
    },
    {
      title: "Productos Terminados",
      value: formulasTerminadas.length.toString(),
      subtitle: "para Villa Martelli",
      icon: FlaskConical,
      color: "secondary",
      progress: animatedProgressTerminados,
      hasNavigation: true,
    },
    {
      title: "Kilos Disponibles",
      value: `${kilosDisponibles.toLocaleString()} kg`,
      subtitle: "productos producidos",
      icon: TrendingUp,
      color: "accent",
      progress: animatedProgressKilos,
      hasFormulasList: true,
    },
    {
      title: "Estadísticas de Producción",
      value: "Reportes",
      subtitle: "rendimiento gráfico",
      icon: BarChart3,
      color: "warning",
      progress: animatedProgressKilos, // Usar un progreso visual
      hasProductionStats: true,
    },
  ];


  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Metrics Cards - Horizontal Layout */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        {metrics.map((metric: any, index) => {
          const Icon = metric.icon;
          const isClickable = metric.hasOutOfStock || metric.hasSearch || metric.hasNavigation || metric.hasFormulasList || metric.hasProductionStats;
          
          return (
            <Card 
              key={index} 
              className={`metric-card flex-1 bg-white/10 backdrop-blur-md rounded-2xl shadow-md
                          transition-all duration-300 ease-in-out
                          hover:shadow-xl hover:scale-105 hover:border hover:border-yellow-400/60 hover:bg-white/20
                          ${isClickable ? 'cursor-pointer' : ''}`}
              onClick={() => {
                if (metric.hasOutOfStock) {
                  setIsOutOfStockOpen(true);
                } else if (metric.hasSearch) {
                  setIsSearchOpen(true);
                } else if (metric.hasNavigation && onNavigateToProduction) {
                  onNavigateToProduction();
                } else if (metric.hasFormulasList) {
                  setIsFormulasListOpen(true);
                } else if (metric.hasProductionStats) {
                  setIsProductionStatsOpen(true);
                }
              }}
            >
              <CardContent className="card-content">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="card-title">
                    {metric.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    {metric.hasSearch && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSearchOpen(true);
                        }}
                        className="h-8 w-8 p-0 hover:bg-primary/10"
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    )}
                    <div className={`p-2 rounded-lg bg-${metric.color}/10 flex-shrink-0`}>
                      <Icon className="card-icon" />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="metric-value">
                    {metric.value}
                  </div>
                  <p className="metric-label">
                    {metric.subtitle}
                  </p>
                  <div className="mt-4">
                    <Progress value={metric.progress} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>


      {/* Modal de búsqueda de inventario */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Buscar Materias Primas
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Barra de búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, certificado o ubicación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Resultados */}
            <div className="max-h-96 overflow-y-auto">
              {inventoryLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Cargando inventario...
                </div>
              ) : filteredInventory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? 'No se encontraron resultados' : 'No hay materias primas disponibles'}
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredInventory.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 border rounded-lg hover:bg-muted/50 transition-colors space-y-3"
                    >
                      {/* Información principal */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-lg truncate">{item.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Certificado: {item.certificate}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-medium px-2 py-1 rounded-full ${
                            item.status === 'critical' ? 'bg-red-100 text-red-700' :
                            item.status === 'low' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {item.status === 'critical' ? 'Crítico' :
                             item.status === 'low' ? 'Bajo' : 'Normal'}
                          </div>
                        </div>
                      </div>

                      {/* Información de stock y ubicación */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Stock:</span>
                          <span>{item.currentStock} {item.unit}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Ubicación:</span>
                          <span className="truncate">{item.location}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resumen */}
            <div className="text-sm text-muted-foreground text-center">
              {searchTerm ? 
                `Mostrando ${filteredInventory.length} de ${inventoryItems.length} materias primas` :
                `Total: ${inventoryItems.length} materias primas`
              }
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de materias primas sin stock */}
      <Dialog open={isOutOfStockOpen} onOpenChange={setIsOutOfStockOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-destructive" />
              Materias Primas sin Stock
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Resumen */}
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-destructive">
                <Package className="h-5 w-5" />
                <span className="font-semibold">
                  {outOfStockItems.length} materias primas sin stock
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Estas materias primas necesitan ser reabastecidas urgentemente
              </p>
            </div>

            {/* Lista de materias primas sin stock */}
            <div className="max-h-96 overflow-y-auto">
              {inventoryLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Cargando inventario...
                </div>
              ) : outOfStockItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  ¡Excelente! No hay materias primas sin stock
                </div>
              ) : (
                <div className="grid gap-3">
                  {outOfStockItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 border border-destructive/20 rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors space-y-3"
                    >
                      {/* Información principal */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-lg text-destructive truncate">
                            {item.name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Certificado: {item.certificate || 'Sin certificado'}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium px-2 py-1 rounded-full bg-destructive text-destructive-foreground">
                            Sin Stock
                          </div>
                        </div>
                      </div>

                      {/* Información de stock y ubicación */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-destructive" />
                          <span className="font-medium">Stock actual:</span>
                          <span className="text-destructive font-semibold">
                            {item.currentStock || 0} {item.unit || 'unidades'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Ubicación:</span>
                          <span className="truncate">{item.location || 'Sin ubicación'}</span>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resumen final */}
            <div className="text-sm text-muted-foreground text-center border-t pt-4">
              Total de materias primas sin stock: {outOfStockItems.length}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de lista de fórmulas terminadas */}
      <Dialog open={isFormulasListOpen} onOpenChange={setIsFormulasListOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-accent" />
              Productos Terminados - Villa Martelli
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Resumen */}
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-accent">
                <TrendingUp className="h-5 w-5" />
                <span className="font-semibold">
                  {formulasTerminadas.length} productos terminados
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Total de kilos producidos: {kilosDisponibles.toLocaleString()} kg
              </p>
            </div>

            {/* Lista de fórmulas terminadas */}
            <div className="max-h-96 overflow-y-auto">
              {formulasTerminadas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay productos terminados para Villa Martelli
                </div>
              ) : (
                <div className="grid gap-3">
                  {formulasTerminadas.map((formula) => (
                    <div
                      key={formula.id}
                      className="p-4 border border-accent/20 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors space-y-3"
                    >
                      {/* Información principal */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-lg text-accent truncate">
                            {formula.name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Cliente: {formula.clientName || 'Sin cliente'}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium px-2 py-1 rounded-full bg-accent text-accent-foreground">
                            Terminada
                          </div>
                        </div>
                      </div>

                      {/* Información de producción */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <FlaskConical className="h-4 w-4 text-accent" />
                            <span className="font-medium">Lote:</span>
                            <span className="text-accent font-semibold">
                              {(formula as any).lote || formula.id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4" /> {/* Espaciador para alinear con el icono de arriba */}
                            <span className="font-medium">Cantidad:</span>
                            <span className="text-accent font-semibold">
                              {formula.batchSize || 0} kg
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Tipo:</span>
                          <span className="truncate">{formula.type || 'Sin tipo'}</span>
                        </div>
                      </div>

                      {/* Información adicional */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Fecha: {formula.date ? new Date(formula.date).toLocaleDateString() : 'Sin fecha'}</span>
                        <span>Destino: {formula.destination || 'Sin destino'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resumen final */}
            <div className="text-sm text-muted-foreground text-center border-t pt-4">
              Total de productos terminados: {formulasTerminadas.length} | Total de kilos: {kilosDisponibles.toLocaleString()} kg
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Estadísticas de Producción */}
      <ProductionStatsModal
        isOpen={isProductionStatsOpen}
        onClose={() => setIsProductionStatsOpen(false)}
        productos={formulasData}
      />

    </div>
  );
};