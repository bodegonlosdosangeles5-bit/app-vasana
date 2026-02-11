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
      <DialogContent className="max-w-3xl bg-white border-slate-200 text-slate-900 shadow-2xl max-h-[90vh] flex flex-col p-5 overflow-hidden rounded-3xl">
        
        {/* Header Ultra Compacto */}
        <div className="flex flex-col gap-2 pb-2 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-teal-50 rounded-lg shrink-0">
                <BarChart3 className="h-5 w-5 text-teal-600" strokeWidth={2} />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-800 uppercase tracking-tight leading-none">
                  Estadísticas de Producción
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs mt-0.5">
                  Resumen de rendimiento para Villa Martelli.
                </DialogDescription>
              </div>
            </div>
            
            <div className="flex gap-2 self-end sm:self-center">
               <Button
                onClick={handlePreviewPDF}
                disabled={isPreviewing}
                variant="outline"
                size="sm"
                className="h-7 text-[10px] border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 gap-1.5 font-medium rounded-md px-2.5 no-print transition-all"
              >
                <Eye className="h-3 w-3" />
                {isPreviewing ? "..." : "Vista Previa"}
              </Button>
              <Button
                onClick={handleExportPDF}
                disabled={isExporting}
                variant="outline"
                size="sm"
                className="h-7 text-[10px] border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 gap-1.5 font-medium rounded-md px-2.5 no-print transition-all"
              >
                <Download className="h-3 w-3" />
                {isExporting ? "..." : "Exportar"}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-2 flex-1 flex flex-col gap-3 min-h-0 print-container" ref={reportRef}>
          
          {/* Tarjetas Ultra Compactas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
            {/* Tarjeta Semanal */}
            <Card className="bg-white border-0 shadow-sm rounded-xl overflow-hidden relative group hover:shadow-md transition-all duration-300">
              <CardContent className="py-3 px-4 relative z-10">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Semanal</p>
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                    <Calendar className="h-3.5 w-3.5 text-blue-600" strokeWidth={2} />
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{stats.weeklyTotal.toLocaleString()}</p>
                  <p className="text-xs font-bold text-slate-400">kg</p>
                </div>
                <div className="h-1 w-8 bg-blue-500 rounded-full mt-2 opacity-20"></div>
              </CardContent>
            </Card>

            {/* Tarjeta Mensual */}
            <Card className="bg-white border-0 shadow-sm rounded-xl overflow-hidden relative group hover:shadow-md transition-all duration-300">
              <CardContent className="py-3 px-4 relative z-10">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">PRODUCCIÓN {stats.monthName}</p>
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center">
                    <TrendingUp className="h-3.5 w-3.5 text-teal-600" strokeWidth={2} />
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{stats.monthlyTotal.toLocaleString()}</p>
                  <p className="text-xs font-bold text-slate-400">kg</p>
                </div>
                <div className="h-1 w-8 bg-teal-500 rounded-full mt-2 opacity-20"></div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-3 flex-1 flex flex-col min-h-0">
            <Tabs value={viewType} onValueChange={(v) => setViewType(v as "daily" | "weekly" | "monthly")} className="w-full flex-1 flex flex-col">
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-2">
                <h4 className="font-bold flex items-center gap-1.5 text-slate-700 text-sm">
                  Kilos Producidos
                </h4>
                
                <TabsList className="bg-slate-100 p-0.5 h-auto rounded-full no-print flex gap-1 scale-90 origin-right">
                  <TabsTrigger 
                    value="daily" 
                    className="text-[10px] font-semibold py-0.5 px-2.5 rounded-full text-slate-500 data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                  >
                    Diario
                  </TabsTrigger>
                  <TabsTrigger 
                    value="weekly" 
                    className="text-[10px] font-semibold py-0.5 px-2.5 rounded-full text-slate-500 data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                  >
                    Semanal
                  </TabsTrigger>
                  <TabsTrigger 
                    value="monthly" 
                    className="text-[10px] font-semibold py-0.5 px-2.5 rounded-full text-slate-500 data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                  >
                    Mensual
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Gráfico aún más bajo */}
              <div className="w-full h-[200px] mt-auto relative">
                {loadingView ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500"></div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartDynamicData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barGradientClean" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0d9488" stopOpacity={1} />
                          <stop offset="100%" stopColor="#0d9488" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        fontWeight={600}
                        dy={5}
                        interval={viewType === 'daily' ? 1 : 0} 
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(v) => `${v}`}
                        fontWeight={500}
                        dx={-5}
                      />
                      <Tooltip 
                        cursor={{ fill: '#f1f5f9', radius: 4 }}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 text-white text-[10px] rounded-lg py-1 px-2 shadow-xl border border-slate-800">
                                <p className="font-bold mb-0.5">{label}</p>
                                <p className="text-teal-400 font-bold">{payload[0].value?.toLocaleString()} kg</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey="total" 
                        radius={[3, 3, 3, 3]} 
                        barSize={20}
                        animationDuration={1000}
                      >
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
