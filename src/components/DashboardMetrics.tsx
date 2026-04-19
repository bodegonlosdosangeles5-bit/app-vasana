import { 
  Package, FlaskConical, Search, X, MapPin, 
  BarChart3, TrendingDown, Calendar, Scale, AlertCircle,
  PackageCheck, Droplets, TrendingUp, Download, Eye, Pencil, Trash2, Printer
} from "lucide-react";
import { VistaPreviaPlantaVarela } from './VistaPreviaPlantaVarela';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/components/Auth/AuthProvider";
import { LogService } from "@/services/logService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useMemo, useState, useEffect } from "react";
import { Producto } from "@/services/productoService";
import { useRealtimeInventory } from "@/hooks/useRealtimeInventory";
import { InventoryItem } from "@/services/inventoryService";
import { useRealtimeProductos } from "@/hooks/useRealtimeProductos";
import { MetricasService, ComparativaHoyAyer, ProductionViewData } from "@/services/metricasService";
import { format, subDays, parseISO, startOfWeek, isSameMonth, isSameWeek, startOfMonth, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { ProductionStatsModal } from "./ProductionStatsModal";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Activity } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  hasProductionList?: boolean;
  hasOutOfStock?: boolean;
  hasSearch?: boolean;
  hasProductionStats?: boolean;
  isCritical?: boolean;
  isReportCard?: boolean;
  isSpecialDona?: boolean;
}

interface DashboardMetricsProps {
  formulas?: Producto[];
  onNavigateToProduction?: () => void;
  inventoryItems?: InventoryItem[];
}

export const DashboardMetrics = ({ formulas = [], onNavigateToProduction, inventoryItems: inventoryItemsProp }: DashboardMetricsProps) => {
  // Usar el hook de productos en tiempo real
  const { productos, loading: productosLoading, error: productosError, updateProducto, deleteProducto } = useRealtimeProductos();
  
  // Usar los datos del hook en tiempo real o los props como fallback
  const formulasData = productos.length > 0 ? productos : formulas;
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isOutOfStockOpen, setIsOutOfStockOpen] = useState(false);
  const [isFormulasListOpen, setIsFormulasListOpen] = useState(false);
  const [isProductionStatsOpen, setIsProductionStatsOpen] = useState(false);
  const [isProductionListOpen, setIsProductionListOpen] = useState(false);
  const [isExportingProductos, setIsExportingProductos] = useState(false);
  const [isPreviewingProductos, setIsPreviewingProductos] = useState(false);
  const [isExportingViaje, setIsExportingViaje] = useState(false);
  const [isPreviewingViaje, setIsPreviewingViaje] = useState(false);
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'superadmin';
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
  
  // Hook para obtener datos de inventario (solo si no se recibe via props)
  const { inventoryItems: inventoryItemsHook, loading: inventoryLoading } = useRealtimeInventory();
  const inventoryItems = inventoryItemsProp ?? inventoryItemsHook;

  // Función para normalizar texto (quitar tildes, espacios y convertir a minúsculas)
  const normalizeText = (text: string) => {
    if (!text) return "";
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
      .replace(/\s+/g, ''); // Quitar espacios
  };

  // Calcular los totales filtrados por tiempo usando la vista SQL para precisión absoluta
  const { weeklyTotal, monthlyTotal, totalAvailableKilosVM, todayTotal } = useMemo(() => {
    const now = new Date();

    // 1. Producción del Día (Reemplazo del 'Stock Disponible' que se va a 0 al remitir)
    // El usuario quiere ver reflejada la producción de HOY en el Dashboard, independientemente de si ya se remitió.
    const todayTotal = viewData.reduce((sum, d) => {
      if (!d?.fecha_produccion) return sum;
      try {
        const dDate = parseISO(d.fecha_produccion + 'T00:00:00');
        if (isSameDay(dDate, now)) {
          return sum + Number(d.total_kg || 0);
        }
      } catch (e) {
        console.error("Error parsing date in todayTotal", e);
      }
      return sum;
    }, 0);

    // Kilos en Inventario Real (con stock > 0)
    const villaMartelliProducts = formulasData.filter(formula => {
      const normalizedStatus = normalizeText(formula?.status || "");
      const normalizedDestination = normalizeText(formula?.destination || "");
      const currentStock = formula?.stock_actual !== undefined ? formula.stock_actual : (formula?.batchSize || 0);
      
      return normalizedStatus === 'available' && 
             normalizedDestination === 'villamartelli' &&
             currentStock > 0;
    });

    const totalAvailable = villaMartelliProducts.reduce((sum, p) => {
        const stock = p?.stock_actual !== undefined ? p.stock_actual : (p?.batchSize || 0);
        return sum + stock;
    }, 0);

    // 2. Semanal (Desde el Lunes de esta semana - de la Vista SQL)
    // Usamos d.total_kg que viene de la vista y ya suma batch_size (producción histórica)
    const weekly = viewData.reduce((sum, d) => {
      if (!d?.fecha_produccion) return sum;
      try {
        const dDate = parseISO(d.fecha_produccion + 'T00:00:00');
        if (isSameWeek(dDate, now, { weekStartsOn: 1 })) {
          return sum + Number(d.total_kg || 0);
        }
      } catch (e) {
        console.error("Error parsing date in weekly", e);
      }
      return sum;
    }, 0);

    // 3. Mensual (Desde el día 1 de este mes - de la Vista SQL)
    // Usamos d.total_kg que viene de la vista y ya suma batch_size (producción histórica)
    const monthly = viewData.reduce((sum, d) => {
      if (!d?.fecha_produccion) return sum;
      try {
        const dDate = parseISO(d.fecha_produccion + 'T00:00:00');
        if (isSameMonth(dDate, now)) {
          return sum + Number(d.total_kg || 0);
        }
      } catch (e) {
        console.error("Error parsing date in monthly", e);
      }
      return sum;
    }, 0);

     // 4. Fallbacks en caso de que viewData (API SQL) esté vacío
     let finalWeekly = weekly;
     let finalMonthly = monthly;
     let finalToday = todayTotal;

     if (viewData.length === 0) {
       // Si no hay datos de la vista, calcular fallback desde formulasData
       formulasData.forEach(p => {
         if (!p.date) return;
         try {
           const pDate = parseISO(p.date + 'T00:00:00');
           const amount = Number(p.batchSize || 0);
           
           if (isSameDay(pDate, now)) finalToday += amount;
           if (isSameWeek(pDate, now, { weekStartsOn: 1 })) finalWeekly += amount;
           if (isSameMonth(pDate, now)) finalMonthly += amount;
         } catch (e) {}
       });
     }

     return { 
       weeklyTotal: finalWeekly, 
       monthlyTotal: finalMonthly, 
       totalAvailableKilosVM: totalAvailable,
       todayTotal: finalToday
     };
  }, [formulasData, viewData]);

  // Metas de progreso para animaciones
  const progressTotalKilosTarget = Math.min(100, Math.max(0, Math.round((todayTotal / 5000) * 100)));

  // Calcular productos terminados para Villa Martelli
  const formulasTerminadas = useMemo(() => {
    const todayDate = new Date();
    const terminadas = formulasData.filter(formula => {
      const normalizedStatus = normalizeText(formula?.status || "");
      const normalizedDestination = normalizeText(formula?.destination || "");
      
      const isTerminated = ['terminado', 'finalizado', 'completo', 'available'].includes(normalizedStatus);
      const isVillaMartelli = normalizedDestination === 'villamartelli';
      
      let isToday = false;
      try {
        if (formula?.date) {
          isToday = isSameDay(parseISO(formula.date + 'T00:00:00'), todayDate);
        }
      } catch (e) {
         // Silently ignore invalid dates
      }
      const hasStock = (formula?.stock_actual ?? (formula?.batchSize || 0)) > 0;
      
      // Mostrar solo si tiene stock para Villa Martelli
      return isTerminated && isVillaMartelli && hasStock;
    });

    return terminadas.sort((a, b) => Number(a.lote_code || a.id) - Number(b.lote_code || b.id));
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
    // Agrupar por nombre y sumar stock total
    const stockPorNombre = inventoryItems.reduce<
      Record<string, { item: InventoryItem; totalStock: number }>
    >((acc, item) => {
      const nombre = item.name.trim().toLowerCase();
      if (!acc[nombre]) {
        acc[nombre] = { item, totalStock: 0 };
      }
      acc[nombre].totalStock += (item.currentStock || 0);
      return acc;
    }, {});

    // Solo los grupos donde el stock TOTAL es 0
    return Object.values(stockPorNombre)
      .filter(({ totalStock }) => totalStock <= 0)
      .map(({ item }) => item);
  }, [inventoryItems]);

  // Totales para progresos proporcionales
  const totalInventoryItems = inventoryItems.length || 0;
  const totalProductos = formulasData.length || 0;
  const totalKilosTeoricos = useMemo(() => {
    return formulasData.reduce((sum, f) => sum + (f.batchSize || 0), 0);
  }, [formulasData]);

  // Productos del viaje actual: disponibles en Villa Martelli con stock > 0
  // Cuando se genera un remito el stock baja a 0 y desaparecen → la tarjeta se reinicia
  const productosViajeActual = useMemo(() => {
    return formulasData.filter(f => {
      const normalizedStatus = normalizeText(f?.status || "");
      const normalizedDestination = normalizeText(f?.destination || "");
      const currentStock = f?.stock_actual ?? (f?.batchSize || 0);
      
      const isTerminated = ['terminado', 'finalizado', 'completo', 'available'].includes(normalizedStatus);
      const isVillaMartelli = normalizedDestination === 'villamartelli';
      
      return isTerminated && isVillaMartelli && currentStock > 0;
    });
  }, [formulasData]);

  // Kilos fabricados para el viaje actual
  const kilosViajeActual = useMemo(() => {
    return productosViajeActual.reduce((sum, f) => sum + (f.batchSize || 0), 0);
  }, [productosViajeActual]);

  // Lista de productos del viaje actual ordenados por lote_code ascendente
  const productosViajeSorted = useMemo(() => {
    return [...productosViajeActual].sort((a, b) => Number(a.lote_code || a.id) - Number(b.lote_code || b.id));
  }, [productosViajeActual]);

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
      title: "Producción",
      value: `${kilosViajeActual.toLocaleString()} kg`,
      subtitle: "Total viaje actual",
      icon: Scale,
      colorClass: "text-[#023F86]",
      bgClass: "bg-[#023F86]/10",
      progress: animatedProgressKilos,
      hasProductionList: true,
    },
    {
      title: "Materias Primas",
      value: outOfStockItems.length.toString(),
      subtitle: outOfStockItems.length > 0 ? "reabastecimiento crítico" : "niveles óptimos",
      icon: Droplets,
      colorClass: outOfStockItems.length > 0 ? "text-rose-600" : "text-emerald-600",
      bgClass: outOfStockItems.length > 0 ? "bg-rose-500/10" : "bg-emerald-500/10",
      isCritical: outOfStockItems.length > 0,
      progress: animatedProgressOutOfStock,
      hasOutOfStock: true,
    },
    {
      title: "Lotes Finalizados",
      value: formulasTerminadas.length.toString(),
      subtitle: "Unidades en planta",
      icon: Package,
      colorClass: "text-[#F7A600]",
      bgClass: "bg-[#F7A600]/10",
      progress: animatedProgressTerminados,
      hasFormulasList: true,
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

  // ── PDF helpers para el modal de Productos Terminados ──────────────────────

  const handleEditClick = (formula: Producto) => {
    setEditingProducto(formula);
    setEditForm({
      name: formula.name,
      lote: formula.lote_code || formula.id,
      batchSize: formula.batchSize,
      destination: formula.destination,
      type: formula.type,
      clientName: formula.clientName || "",
      date: formula.date ? formula.date : "" // El campo type="date" ya espera YYYY-MM-DD
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingProducto) return;
    if (!canEdit) {
      toast.error("No tienes permisos para realizar esta acción");
      return;
    }
    try {
      const success = await updateProducto(editingProducto.id, {
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
        LogService.saveLog({
          action: 'Edición de Lote',
          detail: `Editado producto "${editForm.name}" (${editForm.batchSize}kg). Destino: ${editForm.destination}`,
          user_name: user?.user_name || 'Admin',
          user_email: user?.user_name,
          product_id: editingProducto.id
        });
        setIsEditModalOpen(false);
        setEditingProducto(null);
      } else {
        toast.error("Error al actualizar el producto");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error al conectar con la base de datos");
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    if (!canEdit) {
      toast.error("No tienes permisos para realizar esta acción");
      return;
    }
    const targetProduct = productos.find(p => p.id === productToDelete);
    const success = await deleteProducto(productToDelete);
    if (success) {
      toast.success("Producto eliminado correctamente");
      if (targetProduct) {
        LogService.saveLog({
          action: 'Eliminación de Lote',
          detail: `Eliminado producto "${targetProduct.name}" (${targetProduct.batchSize}kg)`,
          user_name: user?.user_name || 'Admin',
          user_email: user?.user_name,
        });
      }
      setIsDeleteConfirmOpen(false);
      setProductToDelete(null);
    } else {
      toast.error("No se pudo eliminar el producto");
    }
  };

  const buildProductosTableData = () =>
    formulasTerminadas.map((f, i) => [
      (i + 1).toString(),
      f.name || '—',
      f.lote_code || f.id || '—',
      `${f.batchSize || 0} kg`,
      f.clientName || 'Sin cliente',
      f.date ? format(parseISO(f.date + 'T00:00:00'), 'dd/MM/yyyy') : '—',
    ]);

  const handleExportProductosPDF = async () => {
    try {
      setIsExportingProductos(true);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const today = new Date().toLocaleDateString('es-AR', {
        day: '2-digit', month: 'long', year: 'numeric'
      });

      // Cabecera
      pdf.setFillColor(2, 63, 134);              // Boca Blue
      pdf.rect(0, 0, pdfWidth, 38, 'F');
      pdf.setTextColor(247, 166, 0);              // Boca Gold
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('PLANTA VARELA', 15, 15);
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Listado de Productos Terminados — Villa Martelli', 15, 24);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);           // slate-400
      pdf.text(`Generado: ${today}`, 15, 32);
      pdf.text(`Total: ${formulasTerminadas.length} productos | ${totalAvailableKilosVM.toLocaleString()} kg`, pdfWidth - 15, 32, { align: 'right' });

      // Tabla
      autoTable(pdf, {
        startY: 45,
        head: [['N°', 'Producto', 'Lote', 'Peso', 'Cliente', 'Fecha']],
        body: buildProductosTableData(),
        theme: 'striped',
        headStyles: { fillColor: [2, 63, 134], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 55 },
          2: { cellWidth: 30 },
          3: { cellWidth: 22, halign: 'right' },
          4: { cellWidth: 40 },
          5: { cellWidth: 28, halign: 'center' },
        },
        margin: { left: 15, right: 15 },
      });

      // Pie de página
      const pageCount = (pdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`Pág. ${i} / ${pageCount}`, pdfWidth / 2, 290, { align: 'center' });
        pdf.text('Sistema de Gestión — Planta Varela', 15, 290);
      }

      pdf.save(`Productos_Terminados_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
    } finally {
      setIsExportingProductos(false);
    }
  };

  const handlePreviewProductosPDF = async () => {
    try {
      setIsPreviewingProductos(true);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const today = new Date().toLocaleDateString('es-AR', {
        day: '2-digit', month: 'long', year: 'numeric'
      });

      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text('PLANTA VARELA', 15, 20);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text('Listado de Productos Terminados — Villa Martelli', 15, 29);
      pdf.setFontSize(9);
      pdf.text(`Fecha: ${today}   |   Total: ${formulasTerminadas.length} productos, ${totalAvailableKilosVM.toLocaleString()} kg`, 15, 37);
      pdf.setLineWidth(0.4);
      pdf.setDrawColor(226, 232, 240);
      pdf.line(15, 40, pdfWidth - 15, 40);

      autoTable(pdf, {
        startY: 45,
        head: [['N°', 'Producto', 'Lote', 'Peso', 'Cliente', 'Fecha']],
        body: buildProductosTableData(),
        theme: 'striped',
        headStyles: { fillColor: [244, 63, 94], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 55 },
          2: { cellWidth: 30 },
          3: { cellWidth: 22, halign: 'right' },
          4: { cellWidth: 40 },
          5: { cellWidth: 28, halign: 'center' },
        },
        margin: { left: 15, right: 15 },
      });

      const blob = pdf.output('bloburl');
      window.open(blob as unknown as string, '_blank');
    } catch (err) {
      console.error('Error al previsualizar PDF:', err);
    } finally {
      setIsPreviewingProductos(false);
    }
  };

  // ── PDF helpers para el modal de Viaje Actual ──────────────────────
  const buildViajeTableData = () =>
    productosViajeSorted.map((f, i) => [
      (i + 1).toString(),
      f.lote_code || f.id || '—',
      f.name || '—',
      f.type === 'client' ? (f.clientName || 'Cliente') : 'Stock',
      f.date ? format(parseISO(f.date + 'T00:00:00'), 'dd/MM/yyyy') : '—',
      `${f.batchSize || 0} kg`,
    ]);

  const handleExportViajePDF = async () => {
    try {
      setIsExportingViaje(true);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const today = new Date().toLocaleDateString('es-AR', {
        day: '2-digit', month: 'long', year: 'numeric'
      });

      // Cabecera
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pdfWidth, 38, 'F');
      pdf.setTextColor(59, 130, 246);              // blue-500
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('PLANTA VARELA', 15, 15);
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Producción — Viaje Actual', 15, 24);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);           // slate-400
      pdf.text(`Generado: ${today}`, 15, 32);
      pdf.text(`Total: ${productosViajeActual.length} productos | ${kilosViajeActual.toLocaleString()} kg`, pdfWidth - 15, 32, { align: 'right' });

      // Tabla
      autoTable(pdf, {
        startY: 45,
        head: [['N°', 'Lote', 'Producto', 'Destinatario', 'Fecha', 'Ctd. Fbrc.']],
        body: buildViajeTableData(),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 28 },
          2: { cellWidth: 52 },
          3: { cellWidth: 42 },
          4: { cellWidth: 28, halign: 'center' },
          5: { cellWidth: 22, halign: 'right' },
        },
        margin: { left: 15, right: 15 },
      });

      // Pie de página
      const pageCount = (pdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`Pág. ${i} / ${pageCount}`, pdfWidth / 2, 290, { align: 'center' });
        pdf.text('Sistema de Gestión — Planta Varela', 15, 290);
      }

      pdf.save(`Viaje_Actual_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
    } finally {
      setIsExportingViaje(false);
    }
  };

  const handlePreviewViajePDF = async () => {
    try {
      setIsPreviewingViaje(true);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const today = new Date().toLocaleDateString('es-AR', {
        day: '2-digit', month: 'long', year: 'numeric'
      });

      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text('PLANTA VARELA', 15, 20);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text('Producción — Viaje Actual', 15, 29);
      pdf.setFontSize(9);
      pdf.text(`Fecha: ${today}   |   Total: ${productosViajeActual.length} productos, ${kilosViajeActual.toLocaleString()} kg`, 15, 37);
      pdf.setLineWidth(0.4);
      pdf.setDrawColor(226, 232, 240);
      pdf.line(15, 40, pdfWidth - 15, 40);

      autoTable(pdf, {
        startY: 45,
        head: [['N°', 'Lote', 'Producto', 'Destinatario', 'Fecha', 'Ctd. Fbrc.']],
        body: buildViajeTableData(),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 28 },
          2: { cellWidth: 52 },
          3: { cellWidth: 42 },
          4: { cellWidth: 28, halign: 'center' },
          5: { cellWidth: 22, halign: 'right' },
        },
        margin: { left: 15, right: 15 },
      });

      const blob = pdf.output('bloburl');
      window.open(blob as unknown as string, '_blank');
    } catch (err) {
      console.error('Error al previsualizar PDF:', err);
    } finally {
      setIsPreviewingViaje(false);
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-10 pt-4 pb-12 layout-entry">
      {/* Metrics Cards - Premium Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 kpi-staggered">
        {metrics.map((metric: Metric, index) => {
          const Icon = metric.icon;
          const isClickable = metric.hasOutOfStock || metric.hasSearch || metric.hasNavigation || metric.hasFormulasList || metric.hasProductionList || metric.hasProductionStats;
          
          return (
            <Card 
              key={index} 
              className={`relative overflow-hidden border-0 rounded-[2.5rem] shadow-sm hover:shadow-2xl
                          transition-all duration-700 ease-in-out group
                          ${isClickable ? 'cursor-pointer hover:-translate-y-3' : ''}
                          ${metric.isReportCard 
                            ? 'bg-gradient-to-br from-[#023F86] via-[#0555B1] to-[#023F86] text-white border-none' 
                            : 'bg-white dark:bg-card/40 border border-slate-200'
                          }`}
              onClick={() => {
                if (metric.hasOutOfStock) {
                  setIsOutOfStockOpen(true);
                } else if (metric.hasSearch) {
                  setIsSearchOpen(true);
                } else if (metric.hasNavigation && onNavigateToProduction) {
                  onNavigateToProduction();
                } else if (metric.hasProductionList) {
                  setIsProductionListOpen(true);
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
                  <div className="absolute bottom-0 left-0 w-full h-1 opacity-20 bg-gradient-to-r from-transparent via-border to-transparent" />
                </>
              )}

              <CardContent className={`relative h-full ${metric.isReportCard ? 'flex flex-col items-center justify-center p-8' : 'p-6'}`}>
                
                {metric.isReportCard ? (
                  <div className="flex flex-col items-center gap-4 z-10 px-2 text-center">
                     <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 transition-all duration-700 group-hover:scale-105 group-hover:bg-white/20">
                      <Icon className="h-6 w-6 text-white" strokeWidth={1.5} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-white text-base font-bold tracking-wide uppercase">
                          {metric.title}
                        </h3>
                        <p className="text-[11px] text-blue-100 font-medium tracking-widest uppercase opacity-80">
                          {metric.subtitle}
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" className="mt-2 h-9 rounded-xl px-7 bg-[#F7A600] hover:bg-[#F7A600]/90 text-[#023F86] border-none font-bold text-[10px] uppercase tracking-[0.15em]">
                       VER REPORTE
                    </Button>
                  </div>
                ) : (
                  <>
                  <div className="flex items-center justify-between mb-5">
                    <div className="space-y-1">
                      <h3 className="text-muted-foreground text-sm font-semibold tracking-tight">
                        {metric.title}
                      </h3>
                      <div className="h-0.5 w-4 bg-primary/50 rounded-full" />
                    </div>

                    <div className={`h-10 w-10 flex items-center justify-center rounded-xl ${metric.bgClass} dark:bg-muted/80 transition-all duration-500 group-hover:scale-105`}>
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
                                    <Cell fill="currentColor" className="text-muted/30 dark:text-muted/10" />
                                  </Pie>
                                </PieChart>
                              </ResponsiveContainer>
                              {/* Center value in donut */}
                               <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <Activity className="h-4 w-4 text-pink-500/50" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-3xl font-black text-foreground tracking-tight">
                                {(comparativa?.hoy_total || 0).toLocaleString()} <span className="text-xl text-muted-foreground font-bold">kg</span>
                              </div>
                              <p className="text-xs text-muted-foreground font-medium mt-1">
                                {metric.subtitle} <span className="text-pink-500 font-bold ml-1">{(comparativa?.ayer_total || 0).toLocaleString()} kg</span>
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-1.5">
                          <div className={`text-4xl font-bold leading-none kpi-number-entry ${metric.colorClass === 'text-primary' ? 'text-primary' : 'text-foreground'}`}>
                            {metric.value.replace(' kg', '')}
                          </div>
                          {metric.value.includes('kg') && (
                             <span className="text-sm text-muted-foreground font-bold uppercase">kg</span>
                          )}
                        </div>
                        <p className="text-[13px] text-muted-foreground mt-1.5 flex items-center gap-2">
                           <span className={`h-1 w-1 rounded-full ${metric.colorClass.replace('text-', 'bg-')}`}></span>
                          {metric.subtitle}
                        </p>
                        
                        {metric.progress !== undefined && (
                          <div className="mt-4 relative h-2 w-full bg-slate-100 dark:bg-muted/30 rounded-full overflow-hidden">
                             <div 
                                className="absolute top-0 left-0 h-full bg-[#F7A600] transition-all duration-1000 ease-out rounded-full"
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden bg-background border-border rounded-2xl">
          <DialogDescription className="sr-only">Métricas de producción</DialogDescription>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#023F86]">
              <Search className="h-5 w-5 text-[#F7A600]" />
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
                className="pl-10 border-border focus:border-primary rounded-xl bg-muted/20"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted text-muted-foreground"
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
                          <Package className="h-4 w-4 text-[#F7A600]" />
                          <span className="font-medium text-foreground">Stock:</span>
                          <span className="text-muted-foreground">{item.currentStock} {item.unit}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-[#F7A600]" />
                          <span className="font-medium text-foreground">Ubicación:</span>
                          <span className="truncate text-muted-foreground">{item.location}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resumen */}
            <div className="text-sm text-muted-foreground text-center border-t border-border pt-4">
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden bg-background border-border text-foreground">
          <DialogDescription className="sr-only">Métricas de producción</DialogDescription>
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
            <div className="text-sm text-muted-foreground text-center border-t border-border pt-4">
              Total de materias primas sin stock: {outOfStockItems.length}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de lista de fórmulas terminadas */}
      <Dialog open={isFormulasListOpen} onOpenChange={setIsFormulasListOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden bg-background border-border text-foreground">
          <DialogDescription className="sr-only">Métricas de producción</DialogDescription>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Productos Terminados — Villa Martelli</h2>
            </div>
          </div>
          
          <div className="space-y-4">
            {/* Resumen */}
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-primary">
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
                      className="p-4 border border-border rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors space-y-3"
                    >
                      {/* Información principal */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-lg text-foreground truncate">
                            {formula.name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Cliente: {formula.clientName || 'Sin cliente'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex gap-2">
                            {canEdit && (
                              <>
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary transition-colors"
                                  onClick={(e) => { e.stopPropagation(); handleEditClick(formula); }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors"
                                  onClick={(e) => { e.stopPropagation(); setProductToDelete(formula.id); setIsDeleteConfirmOpen(true); }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                          <div className="text-sm font-bold px-3 py-1 rounded-full bg-primary text-primary-foreground">
                            Terminada
                          </div>
                        </div>
                      </div>

                      {/* Información de producción */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <FlaskConical className="h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground">Lote:</span>
                            <span className="text-primary font-semibold">
                              {formula.lote_code || formula.id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4" /> {/* Espaciador para alinear con el icono de arriba */}
                            <span className="font-medium text-foreground">Cantidad:</span>
                            <span className="text-primary font-semibold">
                              {formula.batchSize || 0} kg
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="font-medium text-foreground">Tipo:</span>
                          <span className="truncate">{formula.type || 'Sin tipo'}</span>
                        </div>
                      </div>

                      {/* Información adicional */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2">
                        <span>Fecha: {formula.date ? format(parseISO(formula.date + 'T00:00:00'), 'dd/MM/yyyy') : 'Sin fecha'}</span>
                        <span>Destino: {formula.destination || 'Sin destino'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resumen final */}
            <div className="text-sm text-muted-foreground text-center border-t border-border pt-4">
              Total de productos terminados: {formulasTerminadas.length} | Total de kilos disponibles: {totalAvailableKilosVM.toLocaleString()} kg
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Listado de Producción - Viaje Actual */}
      <Dialog open={isProductionListOpen} onOpenChange={setIsProductionListOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden bg-background border-border text-foreground">
          <DialogDescription className="sr-only">Métricas de producción</DialogDescription>
          <DialogHeader className="flex flex-col gap-3 border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-500" />
                Producción — Viaje Actual
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handlePreviewViajePDF}
                disabled={isPreviewingViaje}
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 no-print flex-1 sm:flex-none"
              >
                <Eye className="h-3.5 w-3.5" />
                {isPreviewingViaje ? "..." : "Vista Previa"}
              </Button>
              <Button
                onClick={handleExportViajePDF}
                disabled={isExportingViaje}
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 no-print flex-1 sm:flex-none"
              >
                <Download className="h-3.5 w-3.5" />
                {isExportingViaje ? "..." : "Exportar"}
              </Button>
              <Button
                onClick={() => window.print()}
                variant="default"
                size="sm"
                className="h-8 text-xs gap-1.5 no-print flex-1 sm:flex-none bg-[#023F86] hover:bg-[#023F86]/90 text-white"
              >
                <Printer className="h-3.5 w-3.5" />
                REMITO
              </Button>
            </div>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Resumen */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Scale className="h-5 w-5" />
                <span className="font-semibold">
                  {kilosViajeActual.toLocaleString()} kg fabricados para este viaje
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {productosViajeActual.length} productos disponibles para envío
              </p>
            </div>

            {/* Lista de productos */}
            <div className="max-h-96 overflow-y-auto">
              {productosViajeSorted.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay productos fabricados para el viaje actual
                </div>
              ) : (
                <div className="grid gap-3">
                  {productosViajeSorted.map((producto) => (
                    <div
                      key={producto.id}
                      className="p-4 border border-border rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors space-y-3"
                    >
                      {/* Información principal */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-lg text-foreground truncate">
                            {producto.name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {producto.clientName ? `Cliente: ${producto.clientName}` : producto.destination || 'Sin destino'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex gap-2">
                            {canEdit && (
                              <>
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary transition-colors"
                                  onClick={(e) => { e.stopPropagation(); handleEditClick(producto); }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors"
                                  onClick={(e) => { e.stopPropagation(); setProductToDelete(producto.id); setIsDeleteConfirmOpen(true); }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                          <div className={`text-sm font-bold px-3 py-1 rounded-full ${
                            producto.status === 'available' 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}>
                            {producto.status === 'available' ? 'Disponible' : 'Incompleto'}
                          </div>
                        </div>
                      </div>

                      {/* Información de producción */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <FlaskConical className="h-4 w-4 text-blue-500" />
                            <span className="font-medium text-foreground">Lote:</span>
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">
                              {producto.lote_code || producto.id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Scale className="h-4 w-4 text-blue-500" />
                            <span className="font-medium text-foreground">Fabricado:</span>
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">
                              {producto.batchSize || 0} kg
                            </span>
                          </div>

                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="font-medium text-foreground">Tipo:</span>
                          <span className="truncate">{producto.type === 'client' ? 'Cliente' : 'Stock'}</span>
                        </div>
                      </div>

                      {/* Información adicional */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2">
                        <span>Fecha: {producto.date ? format(parseISO(producto.date + 'T00:00:00'), 'dd/MM/yyyy') : 'Sin fecha'}</span>
                        <span>Destino: {producto.destination || 'Sin destino'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resumen final */}
            <div className="text-sm text-muted-foreground text-center border-t border-border pt-4">
              Viaje actual: {productosViajeActual.length} productos | {kilosViajeActual.toLocaleString()} kg fabricados
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

      {/* Modal para editar producto */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl bg-background border-border text-foreground">
          <DialogDescription className="sr-only">Métricas de producción</DialogDescription>
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Editar Producto
            </DialogTitle>
          </DialogHeader>
          
          {editingProducto && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nombre del Producto</Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lote">Número de Lote</Label>
                  <Input
                    id="edit-lote"
                    value={editForm.lote}
                    onChange={(e) => setEditForm({ ...editForm, lote: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-batchSize">Cantidad Fabricada (kg)</Label>
                  <Input
                    id="edit-batchSize"
                    type="number"
                    value={editForm.batchSize}
                    onChange={(e) => setEditForm({ ...editForm, batchSize: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Fecha de Producción</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-destination">Destino</Label>
                  <Select 
                    value={editForm.destination} 
                    onValueChange={(value) => setEditForm({ ...editForm, destination: value })}
                  >
                    <SelectTrigger id="edit-destination">
                      <SelectValue placeholder="Seleccionar destino" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Villa Martelli">Villa Martelli</SelectItem>
                      <SelectItem value="Florencio Varela">Florencio Varela</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Tipo</Label>
                  <Select 
                    value={editForm.type} 
                    onValueChange={(value: "stock" | "client") => setEditForm({ ...editForm, type: value })}
                  >
                    <SelectTrigger id="edit-type">
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stock">Stock</SelectItem>
                      <SelectItem value="client">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editForm.type === "client" && (
                <div className="space-y-2">
                  <Label htmlFor="edit-clientName">Nombre del Cliente</Label>
                  <Input
                    id="edit-clientName"
                    value={editForm.clientName}
                    onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })}
                    placeholder="Ingrese nombre del cliente"
                  />
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border mt-4">
                <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdate}>
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de eliminación */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-md bg-background border-border text-foreground">
          <DialogDescription className="sr-only">Métricas de producción</DialogDescription>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-6 w-6" />
              Confirmar Eliminación
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer y el registro se perderá permanentemente del sistema.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Eliminar Permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Componente Oculto de Impresión en Pantalla, visible solo por @media print */}
      <div className="hidden print:block">
        <VistaPreviaPlantaVarela 
          remito={{
            id: 'Preview',
            destino: 'Villa Martelli',
            fecha: new Date().toISOString().split('T')[0],
            total_kilos: kilosViajeActual,
            estado: 'abierto',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            items: productosViajeSorted.map((prod, index) => ({
              id: String(index),
              remito_id: 'Preview',
              producto_id: prod.id,
              nombre_producto: prod.name,
              kilos_sumados: prod.batchSize || 0,
              cantidad_lotes: 1,
              lote: prod.lote_code || String(prod.id),
              cliente_o_stock: prod.type === 'client' && prod.clientName ? prod.clientName : 'STOCK',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }))
          }} 
        />
      </div>
    </div>
  );
};