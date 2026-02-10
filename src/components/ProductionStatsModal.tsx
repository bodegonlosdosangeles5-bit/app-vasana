import { useState, useMemo, useRef, useEffect } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { TrendingUp, BarChart3, Calendar, Package, Download, FileText, Eye, Activity } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Producto } from "@/services/productoService";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import autoTable from "jspdf-autotable";
import { 
  format, 
  subDays, 
  subWeeks, 
  subMonths, 
  startOfDay, 
  isSameDay, 
  isSameWeek, 
  isSameMonth, 
  parseISO,
  startOfMonth,
  parse
} from "date-fns";
import { es } from "date-fns/locale";
import { MetricasService, ProductionViewData } from "@/services/metricasService";

interface ProductionStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  productos: Producto[];
}

export const ProductionStatsModal = ({ isOpen, onClose, productos }: ProductionStatsModalProps) => {
  const [viewType, setViewType] = useState<"daily" | "weekly" | "monthly">("daily");
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [viewData, setViewData] = useState<ProductionViewData[]>([]);
  const [loadingView, setLoadingView] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Cargar datos de la vista al abrir el modal
  const [preciseMetrics, setPreciseMetrics] = useState({ weekly: 0, monthly: 0 });

  // Cargar datos de la vista y métricas exactas al abrir el modal
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setLoadingView(true);
        try {
          // Paralelizar llamadas para eficiencia - Usar funciones TOTALES (Remitos + Producción Actual)
          const [viewDataResult, weeklyResult, monthlyResult] = await Promise.all([
            MetricasService.getProductionSummaryFromView(),
            MetricasService.getWeeklyProductionTotal(),
            MetricasService.getMonthlyProductionTotal()
          ]);
          
          setViewData(viewDataResult);
          setPreciseMetrics({
            weekly: weeklyResult,
            monthly: monthlyResult
          });
        } catch (e) {
          console.error("Error loading metrics:", e);
        } finally {
          setLoadingView(false);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const weekAgo = subDays(now, 7);

    // List of recent lots for the table/PDF - Include ALL production (ignore status) for Villa Martelli
    const villaMartelliProducts = productos.filter(p => 
      p.destination.toLowerCase().replace(/\s+/g, '') === 'villamartelli'
    );

    // List of recent lots for the table from View Data if available, or fallback to productos
    // We prefer viewData because it has "Remito" truth. But viewData is aggregated.
    // For the list of LOTS, we still use 'productos' but filter properly?
    // Actually, user wants "Historical metrics".
    // The TABLE "Listado de Lotes Procesados" uses 'recentLots'.
    // If we use 'productos', we must ensure we include 'entregado' status. 
    // Ideally we should have a view for "Remito Items" history.
    // For now, filtering 'productos' is cleaner for the TABLE, assuming 'entregado' status exists.
    
    // Use Server-Side Totals for accuracy (Calendar Week/Month)
    const weeklyTotal = preciseMetrics.weekly;
    const monthlyTotal = preciseMetrics.monthly;

    const monthAgo = subDays(now, 30);
    const recentLots = villaMartelliProducts
      .filter(p => {
        const pDate = p.date ? parseISO(p.date) : null;
        return pDate && pDate >= monthAgo && pDate <= now;
      })
      .sort((a, b) => new Date(b.date || "").getTime() - new Date(a.date || "").getTime());

    // --- DATOS DINÁMICOS DEL GRÁFICO (Desde la Vista) ---
    let chartDynamicData = [];

    if (viewType === "daily") {
      // Filtrar últimos 14 días de la vista
      const last14Days = subDays(now, 14);
      chartDynamicData = viewData
        .filter(d => parseISO(d.fecha_produccion) >= last14Days)
        .map(d => ({
          name: format(parseISO(d.fecha_produccion), "dd/MM"),
          total: Number(d.total_kg)
        }));
    } else if (viewType === "monthly") {
      // Agrupar por mes_nombre desde la vista (Últimos 12 meses)
      // Usamos un Map para acumular por mes asegurando orden
      const monthlyGroups = new Map<string, { total: number, date: Date }>();
      
      viewData.forEach(d => {
        const date = parseISO(d.fecha_produccion);
        // Generar clave única YYYY-MM para ordenamiento correcto
        const key = format(date, "yyyy-MM");
        const label = format(date, "MMM yy", { locale: es });
        
        if (!monthlyGroups.has(key)) {
          monthlyGroups.set(key, { total: 0, date });
        }
        
        const current = monthlyGroups.get(key)!;
        current.total += Number(d.total_kg);
      });

      // Convertir a array, ordenar por fecha y formato final
      chartDynamicData = Array.from(monthlyGroups.entries())
        .sort((a, b) => a[0].localeCompare(b[0])) // Ordenar por YYYY-MM
        .map(([_, data]) => ({
          name: format(data.date, "MMM yy", { locale: es }).charAt(0).toUpperCase() + format(data.date, "MMM yy", { locale: es }).slice(1),
          total: data.total
        }));
        
    } else {
      // Semanal (Mantenemos lógica de fallback si no hay vista de semanas o usamos la diaria agrupada)
      const weeklyGroups: Record<string, number> = {};
      viewData.forEach(d => {
        const date = parseISO(d.fecha_produccion);
        const label = `Sem ${format(date, "I")}`; // ISO Week
        weeklyGroups[label] = (weeklyGroups[label] || 0) + Number(d.total_kg);
      });
      chartDynamicData = Object.entries(weeklyGroups).slice(-8).map(([name, total]) => ({ name, total }));
    }

    return {
      weeklyTotal,
      monthlyTotal,
      chartDynamicData,
      recentLots,
      monthName: format(now, "MMMM", { locale: es }),
      year: now.getFullYear(),
      reportDate: format(now, "dd 'de' MMMM 'de' yyyy", { locale: es })
    };
  }, [productos, viewData, viewType, preciseMetrics]);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    try {
      setIsExporting(true);
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#09090b",
        scale: 2,
        logging: false,
        useCORS: true
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      pdf.setFillColor(9, 9, 11);
      pdf.rect(0, 0, pdfWidth, 40, "F");
      pdf.setTextColor(234, 179, 8);
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text("Reporte de Producción - Planta Varela", 15, 20);
      pdf.setTextColor(161, 161, 170);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Generado el: ${stats.reportDate}`, 15, 30);
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.text("Resumen General:", 15, 50);
      pdf.setFontSize(12);
      pdf.text(`Producción Semanal: ${stats.weeklyTotal.toLocaleString()} kg`, 20, 60);
      pdf.text(`Producción Mensual (${stats.monthName}): ${stats.monthlyTotal.toLocaleString()} kg`, 20, 70);
      const imgWidth = pdfWidth - 30;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 15, 85, imgWidth, imgHeight);
      pdf.setFontSize(8);
      pdf.setTextColor(113, 113, 122);
      pdf.text("Este reporte fue generado automáticamente por el Sistema de Gestión Planta Varela.", 15, pdfHeight - 10);
      pdf.save(`Reporte_Produccion_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Error al exportar PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreviewPDF = async () => {
    try {
      setIsPreviewing(true);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("PLANTA VARELA - Informe de Producción", 15, 25);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Fecha del reporte: ${stats.reportDate}`, 15, 33);
      pdf.setLineWidth(0.5);
      pdf.line(15, 37, pdfWidth - 15, 37);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("1. Resumen de Producción", 15, 50);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(`• Producción Semanal (últimos 7 días): ${stats.weeklyTotal.toLocaleString()} kg`, 20, 60);
      pdf.text(`• Producción Mensual: ${stats.monthlyTotal.toLocaleString()} kg`, 20, 68);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("2. Listado de Lotes Procesados", 15, 85);
      const tableData = stats.recentLots.map((lot, index) => [
        (index + 1).toString(),
        lot.date ? format(parseISO(lot.date), "dd/MM/yyyy") : "-",
        lot.name,
        lot.lote_code || lot.id,
        `${lot.batchSize} kg`,
        lot.clientName || "Stock"
      ]);
      autoTable(pdf, {
        startY: 90,
        head: [['N°', 'Fecha', 'Producto', 'Lote', 'Peso', 'Destinatario']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [234, 179, 8], textColor: [0, 0, 0] },
        styles: { fontSize: 9 },
        margin: { left: 15, right: 15 },
        columnStyles: {
          0: { cellWidth: 10 }, // Ancho pequeño para N°
        }
      });
      const blob = pdf.output("bloburl");
      window.open(blob, "_blank");
    } catch (error) {
      console.error("Error al generar vista previa:", error);
    } finally {
      setIsPreviewing(false);
    }
  };

  interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ value: number; name: string }>;
    label?: string;
  }

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      return (
        <div className="bg-white border-2 border-teal-500 p-4 rounded-xl shadow-2xl">
          <p className="text-teal-700 font-bold mb-1 text-sm">{label}</p>
          <p className="text-slate-700 text-sm">
            Producción: <span className="font-mono font-bold text-teal-600">{value.toLocaleString()} kg</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl bg-white border-slate-200 text-slate-900 shadow-2xl max-h-[95vh] flex flex-col p-8 overflow-hidden">
        <DialogHeader className="relative pr-12 pb-6 border-b border-slate-200">
          <DialogTitle className="flex items-center gap-3 text-3xl font-bold text-slate-800 uppercase tracking-tight">
            <BarChart3 className="h-8 w-8 text-teal-600" strokeWidth={2} />
            Estadísticas de Producción
          </DialogTitle>
          <DialogDescription className="text-slate-500 mt-2 text-base">
            Resumen de rendimiento y kilos producidos para Villa Martelli.
          </DialogDescription>
          <div className="absolute right-0 top-0 flex gap-3">
            <Button
              onClick={handlePreviewPDF}
              disabled={isPreviewing}
              variant="outline"
              size="default"
              className="border-2 border-teal-500 text-teal-600 hover:bg-teal-50 hover:text-teal-700 gap-2 font-semibold rounded-xl px-6 no-print transition-all"
            >
              <Eye className="h-5 w-5" />
              {isPreviewing ? "Generando..." : "Vista Previa"}
            </Button>
            <Button
              onClick={handleExportPDF}
              disabled={isExporting}
              variant="outline"
              size="default"
              className="border-2 border-amber-500 text-amber-600 hover:bg-amber-50 hover:text-amber-700 gap-2 font-semibold rounded-xl px-6 no-print transition-all"
            >
              <FileText className="h-5 w-5" />
              {isExporting ? "Exportando..." : "Exportar"}
            </Button>
          </div>
        </DialogHeader>

        <div className="mt-6 flex-1 flex flex-col gap-6 min-h-0 print-container" ref={reportRef}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 shrink-0">
            {/* Tarjeta Semanal */}
            <Card className="bg-white border-2 border-blue-400 shadow-lg hover:shadow-xl transition-shadow rounded-2xl overflow-hidden">
              <CardContent className="py-6 px-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" strokeWidth={2} />
                    <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider">Semanal</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-5xl font-black text-blue-700">{stats.weeklyTotal.toLocaleString()}</p>
                  <p className="text-2xl font-bold text-blue-500">kg</p>
                </div>
                <p className="text-xs text-slate-500 mt-2">Última semana completa</p>
              </CardContent>
            </Card>

            {/* Tarjeta Mensual */}
            <Card className="bg-white border-2 border-teal-400 shadow-lg hover:shadow-xl transition-shadow rounded-2xl overflow-hidden">
              <CardContent className="py-6 px-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-teal-600" strokeWidth={2} />
                    <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider">Producción {stats.monthName}</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-5xl font-black text-teal-700">{stats.monthlyTotal.toLocaleString()}</p>
                  <p className="text-2xl font-bold text-teal-500">kg</p>
                </div>
                <p className="text-xs text-slate-500 mt-2">Mes calendario completo</p>
              </CardContent>
            </Card>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex-1 flex flex-col min-h-0 shadow-sm">
            <Tabs value={viewType} onValueChange={(v) => setViewType(v as "daily" | "weekly" | "monthly")} className="w-full flex-1 flex flex-col">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <h4 className="font-bold flex items-center gap-2 text-slate-800 text-lg">
                  <Activity className="h-5 w-5 text-teal-600" strokeWidth={2} />
                  Kilos Producidos
                </h4>
                <TabsList className="bg-white border-2 border-slate-200 p-1.5 h-auto rounded-xl no-print shadow-sm">
                  <TabsTrigger value="daily" className="text-sm py-2 px-4 rounded-lg data-[state=active]:bg-teal-500 data-[state=active]:text-white font-medium">Diario</TabsTrigger>
                  <TabsTrigger value="weekly" className="text-sm py-2 px-4 rounded-lg data-[state=active]:bg-teal-500 data-[state=active]:text-white font-medium">Semanal</TabsTrigger>
                  <TabsTrigger value="monthly" className="text-sm py-2 px-4 rounded-lg data-[state=active]:bg-teal-500 data-[state=active]:text-white font-medium">Mensual</TabsTrigger>
                </TabsList>
              </div>

              <div className="w-full h-[350px] mt-auto relative bg-white rounded-xl p-4 border border-slate-200">
                {loadingView ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-teal-500"></div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartDynamicData}>
                      <defs>
                        <linearGradient id="barGradientClean" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14b8a6" stopOpacity={1} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.3} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#64748b" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                        fontWeight={500}
                      />
                      <YAxis 
                        stroke="#64748b" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }} 
                        tickFormatter={(v) => `${v}kg`}
                        fontWeight={500}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(20, 184, 166, 0.05)' }} />
                      <Bar dataKey="total" radius={[12, 12, 0, 0]} animationDuration={1000}>
                        {stats.chartDynamicData.map((_, i) => (
                          <Cell key={`cell-${i}`} fill="url(#barGradientClean)" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
