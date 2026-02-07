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
import { TrendingUp, BarChart3, Calendar, Package, Download, FileText, Eye } from "lucide-react";
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
  useEffect(() => {
    if (isOpen) {
      const fetchViewData = async () => {
        setLoadingView(true);
        const data = await MetricasService.getProductionSummaryFromView();
        setViewData(data);
        setLoadingView(false);
      };
      fetchViewData();
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

    // Calculate totals using viewData directly to ensure historical accuracy
    const weeklyTotal = viewData.reduce((sum, d) => {
      const dDate = parseISO(d.fecha_produccion);
      if (isSameWeek(dDate, now, { weekStartsOn: 1 })) {
        return sum + Number(d.total_kg || 0);
      }
      return sum;
    }, 0);

    const monthlyTotal = viewData.reduce((sum, d) => {
      const dDate = parseISO(d.fecha_produccion);
      if (isSameMonth(dDate, now)) {
        return sum + Number(d.total_kg || 0);
      }
      return sum;
    }, 0);

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
  }, [productos, viewData, viewType]);

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
      const tableData = stats.recentLots.map(lot => [
        lot.date ? format(parseISO(lot.date), "dd/MM/yyyy") : "-",
        lot.name,
        (lot as any).lote || lot.id,
        `${lot.batchSize} kg`,
        lot.clientName || "Stock"
      ]);
      autoTable(pdf, {
        startY: 90,
        head: [['Fecha', 'Producto', 'Lote', 'Peso', 'Destinatario']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [234, 179, 8], textColor: [0, 0, 0] },
        styles: { fontSize: 9 },
        margin: { left: 15, right: 15 }
      });
      const blob = pdf.output("bloburl");
      window.open(blob, "_blank");
    } catch (error) {
      console.error("Error al generar vista previa:", error);
    } finally {
      setIsPreviewing(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/90 border border-yellow-500/50 p-3 rounded-lg shadow-xl backdrop-blur-sm">
          <p className="text-yellow-400 font-bold mb-1">{label}</p>
          <p className="text-white text-sm">
            Producción: <span className="font-mono font-bold text-yellow-400">{payload[0].value.toLocaleString()} kg</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl max-h-[95vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="relative pr-12">
          <DialogTitle className="flex items-center gap-3 text-2xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
            <BarChart3 className="h-7 w-7 text-yellow-500" />
            Estadísticas de Producción
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Resumen de rendimiento y kilos producidos para Villa Martelli.
          </DialogDescription>
          <div className="absolute right-0 top-0 mt-[-4px] flex gap-2">
            <Button
              onClick={handlePreviewPDF}
              disabled={isPreviewing}
              variant="outline"
              size="sm"
              className="border-blue-600/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 gap-2 font-semibold no-print"
            >
              <Eye className="h-4 w-4" />
              {isPreviewing ? "Generando..." : "Vista Previa"}
            </Button>
            <Button
              onClick={handleExportPDF}
              disabled={isExporting}
              variant="outline"
              size="sm"
              className="border-yellow-600/30 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400 gap-2 font-semibold no-print"
            >
              <FileText className="h-4 w-4" />
              {isExporting ? "Exportando..." : "Exportar"}
            </Button>
          </div>
        </DialogHeader>

        <div className="mt-4 flex-1 flex flex-col gap-4 min-h-0 print-container" ref={reportRef}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-zinc-400 text-[10px] sm:text-xs font-medium uppercase tracking-wider">Semanal</p>
                  <Calendar className="h-4 w-4 text-yellow-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl sm:text-3xl font-black text-white">{stats.weeklyTotal.toLocaleString()}</p>
                  <p className="text-lg font-bold text-yellow-500">kg</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-zinc-400 text-[10px] sm:text-xs font-medium uppercase tracking-wider">PRODUCCIÓN {stats.monthName.toUpperCase()}</p>
                  <TrendingUp className="h-4 w-4 text-yellow-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl sm:text-3xl font-black text-white">{stats.monthlyTotal.toLocaleString()}</p>
                  <p className="text-lg font-bold text-yellow-500">kg</p>
                </div>
              </CardContent>
            </Card>


          </div>

          <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-5 flex-1 flex flex-col min-h-0">
            <Tabs value={viewType} onValueChange={(v) => setViewType(v as any)} className="w-full flex-1 flex flex-col">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
                <h4 className="font-bold flex items-center gap-2 text-zinc-100 text-sm">
                  <Package className="h-4 w-4 text-yellow-500" />
                  Kilos Producidos
                </h4>
                <TabsList className="bg-zinc-900 border border-zinc-800 p-1 h-8 no-print">
                  <TabsTrigger value="daily" className="text-[10px] py-1 px-3">Diario</TabsTrigger>
                  <TabsTrigger value="weekly" className="text-[10px] py-1 px-3">Semanal</TabsTrigger>
                  <TabsTrigger value="monthly" className="text-[10px] py-1 px-3">Mensual</TabsTrigger>
                </TabsList>
              </div>

              <div className="w-full h-[300px] mt-auto relative">
                {loadingView ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartDynamicData}>
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
                          <stop offset="100%" stopColor="#ca8a04" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}kg`} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]} animationDuration={1000}>
                        {stats.chartDynamicData.map((_, i) => (
                          <Cell key={`cell-${i}`} fill="url(#barGradient)" />
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
