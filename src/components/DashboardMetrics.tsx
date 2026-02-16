import { 
  Package, FlaskConical, Search, X, MapPin, 
  BarChart3, TrendingDown, Calendar, Scale, AlertCircle,
  PackageCheck, Droplets, TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMemo, useState, useEffect } from "react";
import { Producto } from "@/services/productoService";
import { useRealtimeInventory } from "@/hooks/useRealtimeInventory";
import { useRealtimeProductos } from "@/hooks/useRealtimeProductos";
import { MetricasService, ComparativaHoyAyer, ProductionViewData } from "@/services/metricasService";
import { format, subDays, parseISO, startOfWeek, isSameMonth, isSameWeek, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { ProductionStatsModal } from "./ProductionStatsModal";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Activity } from "lucide-react";

interface Metric {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  progress?: number;
  hasNavigation?: boolean;
  hasFormulasList?: boolean;
  hasOutOfStock?: boolean;
  hasSearch?: boolean;
  hasProductionStats?: boolean;
  isCritical?: boolean;
  isReportCard?: boolean;
  isSpecialDona?: boolean;
}

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
  const [comparativa, setComparativa] = useState<ComparativaHoyAyer>({ hoy_total: 0, ayer_total: 0 });
  const [viewData, setViewData] = useState<ProductionViewData[]>([]);
  const [isMetricasLoading, setIsMetricasLoading] = useState(true);

  // Cargar datos de la vista SQL para asegurar consistencia con los reportes
  useEffect(() => {
    let isMounted = true;
    const fetchAllData = async () => {
      try {
        setIsMetricasLoading(true);
        const [compData, summaryData] = await Promise.all([
          MetricasService.getComparativaHoyAyer(),
          MetricasService.getProductionSummaryFromView()
        ]);
        
        if (isMounted) {
          if (compData) {
            setComparativa({
              hoy_total: Number(compData.hoy_total || 0),
              ayer_total: Number(compData.ayer_total || 0)
            });
          }
          if (summaryData) {
            setViewData(summaryData);
          }
        }
      } catch (error) {
        console.error("❌ Fallo crítico al cargar datos de métricas:", error);
      } finally {
        if (isMounted) setIsMetricasLoading(false);
      }
    };
    fetchAllData();
    return () => { isMounted = false; };
  }, [productos]);
  
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

  // Calcular los totales filtrados por tiempo usando la vista SQL para precisión absoluta
  const { weeklyTotal, monthlyTotal, totalAvailableKilosVM } = useMemo(() => {
    const now = new Date();

    // 1. Kilos Disponibles (Stock Total actual en planta - real time desde hook)
    // Solo contar productos con stock disponible real y status available
    const villaMartelliProducts = formulasData.filter(formula => {
      const normalizedStatus = normalizeText(formula?.status || "");
      const normalizedDestination = normalizeText(formula?.destination || "");
      const currentStock = formula?.stock_actual !== undefined ? formula.stock_actual : (formula?.batchSize || 0);
      
      return normalizedStatus === 'available' && 
             normalizedDestination === 'villamartelli' &&
             currentStock > 0;
    });
    
    // Sumar el STOCK REAL, no el batchSize original
    const totalAvailable = villaMartelliProducts.reduce((sum, p) => {
        const stock = p?.stock_actual !== undefined ? p.stock_actual : (p?.batchSize || 0);
        return sum + stock;
    }, 0);

    // 2. Semanal (Desde el Lunes de esta semana - de la Vista SQL)
    // Usamos d.total_kg que viene de la vista y ya suma batch_size (producción histórica)
    const weekly = viewData.reduce((sum, d) => {
      const dDate = parseISO(d.fecha_produccion);
      if (isSameWeek(dDate, now, { weekStartsOn: 1 })) {
        return sum + Number(d.total_kg || 0);
      }
      return sum;
    }, 0);

    // 3. Mensual (Desde el día 1 de este mes - de la Vista SQL)
    // Usamos d.total_kg que viene de la vista y ya suma batch_size (producción histórica)
    const monthly = viewData.reduce((sum, d) => {
      const dDate = parseISO(d.fecha_produccion);
      if (isSameMonth(dDate, now)) {
        return sum + Number(d.total_kg || 0);
      }
      return sum;
    }, 0);

    return { 
      weeklyTotal: weekly, 
      monthlyTotal: monthly, 
      totalAvailableKilosVM: totalAvailable 
    };
  }, [formulasData, viewData]);

  // Metas de progreso para animaciones
  const progressTotalKilosTarget = Math.min(100, Math.max(0, Math.round((totalAvailableKilosVM / 10000) * 100)));

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
      const hasStock = (formula.stock_actual !== undefined ? formula.stock_actual : (formula.batchSize || 0)) > 0;
      
      const isTerminated = normalizedStatus === 'available';
      const isVillaMartelli = normalizedDestination === 'villamartelli';
      
      console.log(`🔍 Producto ${formula.name}:`, {
        status: formula.status,
        normalizedStatus,
        destination: formula.destination,
        normalizedDestination,
        stock: formula.stock_actual,
        hasStock,
        isTerminated,
        isVillaMartelli,
        passes: isTerminated && isVillaMartelli && hasStock
      });
      
      return isTerminated && isVillaMartelli && hasStock;
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

  // Progreso semanal (interno)
  const MAX_KILOS_WEEKLY = 5000;
  const progressWeeklyKilosTarget = Math.min(100, Math.max(0, Math.round((weeklyTotal / MAX_KILOS_WEEKLY) * 100)));

  // Progreso mensual basado en 15000 kilos como máximo
  const MAX_KILOS_MONTHLY = 15000;
  const progressMonthlyTarget = Math.min(100, Math.max(0, Math.round((monthlyTotal / MAX_KILOS_MONTHLY) * 100)));
  
  const [animatedProgressMonthly, setAnimatedProgressMonthly] = useState(0);

  // Animación del progreso mensual
  useEffect(() => {
    setAnimatedProgressMonthly(0);
    if (progressMonthlyTarget > 0) {
      const duration = 2000;
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        setAnimatedProgressMonthly(progressMonthlyTarget * easeOut);
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
  }, [progressMonthlyTarget]);

  useEffect(() => {
    setAnimatedProgressKilos(0);

    if (progressTotalKilosTarget > 0) {
      const duration = 2000;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        setAnimatedProgressKilos(progressTotalKilosTarget * easeOut);

        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
  }, [progressTotalKilosTarget]);

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

  const metrics: Metric[] = [
    {
      title: "Stock Villa Martelli",
      value: `${totalAvailableKilosVM.toLocaleString()} kg`,
      subtitle: "disponibilidad actual",
      icon: Scale,
      colorClass: "text-blue-600 dark:text-blue-400",
      bgClass: "bg-blue-500/10",
      progress: animatedProgressKilos,
      hasFormulasList: true,
    },
    {
      title: "Materias Primas",
      value: outOfStockItems.length.toString(),
      subtitle: outOfStockItems.length > 0 ? "reabastecimiento crítico" : "niveles óptimos",
      icon: Droplets,
      colorClass: outOfStockItems.length > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
      bgClass: outOfStockItems.length > 0 ? "bg-rose-500/10" : "bg-emerald-500/10",
      isCritical: outOfStockItems.length > 0,
      progress: animatedProgressOutOfStock,
      hasOutOfStock: true,
    },
    {
      title: "Stock Finalizado",
      value: formulasTerminadas.length.toString(),
      subtitle: "unidades en planta",
      icon: Package,
      colorClass: "text-primary",
      bgClass: "bg-primary/10",
      progress: animatedProgressTerminados,
      hasNavigation: true,
    },
    {
      title: "REPORTE DE PLANTA",
      value: " ",
      subtitle: "Estadísticas Avanzadas",
      icon: BarChart3,
      colorClass: "text-white",
      bgClass: "bg-white/10",
      hasProductionStats: true,
      isReportCard: true
    },
  ];


  return (
    <div className="space-y-10 pt-4 pb-12 layout-entry">
      {/* Metrics Cards - Premium Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 kpi-staggered">
        {metrics.map((metric: Metric, index) => {
          const Icon = metric.icon;
          const isClickable = metric.hasOutOfStock || metric.hasSearch || metric.hasNavigation || metric.hasFormulasList || metric.hasProductionStats;
          
          return (
            <Card 
              key={index} 
              className={`relative overflow-hidden border-0 rounded-[2.5rem] shadow-sm hover:shadow-2xl
                          transition-all duration-700 ease-in-out group
                          ${isClickable ? 'cursor-pointer hover:-translate-y-3' : ''}
                          ${metric.isReportCard 
                            ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-pink-900/30 text-white border-none' 
                            : 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-100 dark:border-slate-800'
                          }`}
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
              {/* Decorative Geometric Elements */}
              {!metric.isReportCard && !metric.isSpecialDona && (
                <>
                  <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-10 blur-2xl transition-all duration-1000 group-hover:scale-150 ${metric.colorClass.replace('text-', 'bg-')}`} />
                  <div className="absolute bottom-0 left-0 w-full h-1 opacity-20 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
                </>
              )}

              <CardContent className={`relative h-full ${metric.isReportCard ? 'flex flex-col items-center justify-center p-8' : 'p-6'}`}>
                
                {metric.isReportCard ? (
                  <div className="flex flex-col items-center gap-4 z-10 px-2 text-center">
                     <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 transition-all duration-700 group-hover:scale-105 group-hover:bg-pink-500/10">
                      <Icon className="h-6 w-6 text-white" strokeWidth={1.5} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-white text-base font-bold tracking-wide uppercase">
                          {metric.title}
                        </h3>
                        <p className="text-[11px] text-pink-300 font-medium tracking-widest uppercase">
                          {metric.subtitle}
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" className="mt-2 h-9 rounded-xl px-7 bg-white/10 hover:bg-white/20 text-white border border-white/10 font-bold text-[10px] uppercase tracking-[0.15em]">
                       VER REPORTE
                    </Button>
                  </div>
                ) : (
                  <>
                  <div className="flex items-center justify-between mb-5">
                    <div className="space-y-1">
                      <h3 className="text-slate-500 dark:text-slate-400 text-sm font-semibold tracking-tight">
                        {metric.title}
                      </h3>
                      <div className="h-0.5 w-4 bg-pink-500/50 rounded-full" />
                    </div>

                    <div className={`h-10 w-10 flex items-center justify-center rounded-xl ${metric.bgClass} dark:bg-slate-800/80 transition-all duration-500 group-hover:scale-105`}>
                      <Icon className={`h-5 w-5 ${metric.colorClass}`} strokeWidth={1.5} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {metric.isSpecialDona ? (
                      <div className="flex items-center gap-5 min-h-[80px]">
                        {isMetricasLoading ? (
                          <div className="flex-1 flex items-center justify-center">
                            <div className="h-6 w-6 border-2 border-pink-500 border-t-transparent animate-spin rounded-full" />
                          </div>
                        ) : (
                          <>
                            <div className="h-24 w-24 shrink-0 relative bg-slate-50 dark:bg-slate-800/30 rounded-full p-1 border border-slate-100 dark:border-slate-800">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={[
                                      { name: 'Hoy', value: Math.max(0, comparativa?.hoy_total || 0) },
                                      { name: 'Ayer', value: Math.max(1, comparativa?.ayer_total || 0) }
                                    ]}
                                    innerRadius="72%"
                                    outerRadius="100%"
                                    paddingAngle={6}
                                    dataKey="value"
                                    stroke="none"
                                    startAngle={90}
                                    endAngle={-270}
                                  >
                                    <Cell fill="#f43f5e" className="drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                                    <Cell fill="#cbd5e1" className="dark:fill-slate-700" />
                                  </Pie>
                                </PieChart>
                              </ResponsiveContainer>
                              {/* Center value in donut */}
                               <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <Activity className="h-4 w-4 text-pink-500/50" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                                {(comparativa?.hoy_total || 0).toLocaleString()} <span className="text-xl text-slate-400 dark:text-slate-600 font-bold">kg</span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                                {metric.subtitle} <span className="text-pink-500 font-bold ml-1">{(comparativa?.ayer_total || 0).toLocaleString()} kg</span>
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-1.5">
                          <div className={`text-4xl font-bold leading-none kpi-number-entry ${metric.colorClass === 'text-primary' ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>
                            {metric.value.replace(' kg', '')}
                          </div>
                          {metric.value.includes('kg') && (
                             <span className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase">kg</span>
                          )}
                        </div>
                        <p className="text-[13px] text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-2">
                           <span className={`h-1 w-1 rounded-full ${metric.colorClass.replace('text-', 'bg-')}`}></span>
                          {metric.subtitle}
                        </p>
                        
                        {metric.progress !== undefined && (
                          <div className="mt-4 relative h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                             <div 
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-pink-500 to-rose-400 dark:from-pink-600 dark:to-rose-500 transition-all duration-1000 ease-out rounded-full"
                                style={{ width: `${metric.progress}%` }}
                             />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>


      {/* Modal de búsqueda de inventario */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Search className="h-5 w-5 text-pink-500" />
              Buscar Materias Primas
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Barra de búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre, certificado o ubicación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-pink-200 focus:border-pink-400 rounded-xl"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-pink-50 text-pink-500"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Resultados */}
            <div className="max-h-96 overflow-y-auto">
              {inventoryLoading ? (
                <div className="text-center py-8 text-slate-500">
                  Cargando inventario...
                </div>
              ) : filteredInventory.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {searchTerm ? 'No se encontraron resultados' : 'No hay materias primas disponibles'}
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredInventory.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 border border-slate-200 rounded-xl hover:bg-pink-50 hover:border-pink-300 transition-colors space-y-3"
                    >
                      {/* Información principal */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-lg truncate text-slate-800">{item.name}</h4>
                          <p className="text-sm text-slate-500">
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
                          <Package className="h-4 w-4 text-pink-500" />
                          <span className="font-medium text-slate-700">Stock:</span>
                          <span className="text-slate-600">{item.currentStock} {item.unit}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-pink-500" />
                          <span className="font-medium text-slate-700">Ubicación:</span>
                          <span className="truncate text-slate-600">{item.location}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resumen */}
            <div className="text-sm text-slate-500 text-center">
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
                Total de kilos producidos: {totalAvailableKilosVM.toLocaleString()} kg
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
                              {formula.lote_code || formula.id}
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
              Total de productos terminados: {formulasTerminadas.length} | Total de kilos disponibles: {totalAvailableKilosVM.toLocaleString()} kg
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