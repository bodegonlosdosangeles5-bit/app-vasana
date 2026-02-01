import { useState, useMemo, useRef } from "react";
import {
  BarChart,
  Bar,
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

interface ProductionStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  productos: Producto[];
}

export const ProductionStatsModal = ({ isOpen, onClose, productos }: ProductionStatsModalProps) => {
  const [viewType, setViewType] = useState<"daily" | "weekly">("daily");
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => {
    // Normalizar "ahora" para incluir todo el día de hoy
    const now = new Date("2026-01-31T23:59:59Z"); // Usar fin del día en UTC para cubrimiento total
    const currentMonth = 0; // Enero (0-indexed)
    const currentYear = 2026;

    // Rango de la semana (últimos 7 días naturales)
    const weekAgo = new Date(now);
    weekAgo.setUTCDate(now.getUTCDate() - 7);
    weekAgo.setUTCHours(0, 0, 0, 0);

    const villaMartelliProducts = productos.filter(p => 
      p.status === 'available' && 
      p.destination.toLowerCase().replace(/\s+/g, '') === 'villamartelli'
    );

    // Weekly stats
    const weeklyTotal = villaMartelliProducts.reduce((sum, p) => {
      const pDate = p.date ? new Date(p.date) : null;
      if (pDate) {
        // Al ser p.date "YYYY-MM-DD", new Date(pDate) es 00:00 UTC
        if (pDate >= weekAgo && pDate <= now) {
          return sum + (p.batchSize || 0);
        }
      }
      return sum;
    }, 0);

    // Monthly stats
    const monthlyTotal = villaMartelliProducts.reduce((sum, p) => {
      const pDate = p.date ? new Date(p.date) : null;
      if (pDate) {
        if (pDate.getUTCMonth() === currentMonth && pDate.getUTCFullYear() === currentYear) {
          return sum + (p.batchSize || 0);
        }
      }
      return sum;
    }, 0);

    // Filter lots for the table (last 30 days)
    const monthAgo = new Date(now);
    monthAgo.setDate(now.getDate() - 30);
    const recentLots = villaMartelliProducts
      .filter(p => {
        const pDate = p.date ? new Date(p.date) : null;
        return pDate && pDate >= monthAgo && pDate <= now;
      })
      .sort((a, b) => new Date(b.date || "").getTime() - new Date(a.date || "").getTime());

    // Data for charts
    const dailyData: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(now.getUTCDate() - i);
      const dateKey = d.toLocaleDateString("es-ES", { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
      dailyData[dateKey] = 0;
    }

    villaMartelliProducts.forEach(p => {
      if (p.date) {
        const d = new Date(p.date); // "YYYY-MM-DD" -> 00:00 UTC
        const dateKey = d.toLocaleDateString("es-ES", { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
        if (dailyData[dateKey] !== undefined) {
          dailyData[dateKey] += p.batchSize || 0;
        }
      }
    });

    const chartDailyData = Object.entries(dailyData).map(([name, total]) => ({ name, total }));

    const weeklyDataChart: Record<string, number> = {};
    for (let i = 3; i >= 0; i--) {
      const weekLabel = `Semana ${4-i}`;
      weeklyDataChart[weekLabel] = 0;
    }

    villaMartelliProducts.forEach(p => {
      if (p.date) {
        const d = new Date(p.date);
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 28) {
          const weekIdx = Math.floor(diffDays / 7);
          const weekLabel = `Semana ${4 - weekIdx}`;
          if (weeklyDataChart[weekLabel] !== undefined) {
            weeklyDataChart[weekLabel] += p.batchSize || 0;
          }
        }
      }
    });

    const chartWeeklyData = Object.entries(weeklyDataChart).map(([name, total]) => ({ name, total }));

    return {
      weeklyTotal,
      monthlyTotal,
      chartDailyData,
      chartWeeklyData,
      recentLots,
      monthName: now.toLocaleDateString("es-ES", { month: 'long' }),
      year: now.getFullYear(),
      reportDate: "31 de enero de 2026"
    };
  }, [productos]);

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
      
      // Estilo de Informe Profesional - Fondo Blanco para ahorro de tinta
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("PLANTA VARELA - Informe de Producción", 15, 25);
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Fecha del reporte: ${stats.reportDate}`, 15, 33);
      pdf.setLineWidth(0.5);
      pdf.line(15, 37, pdfWidth - 15, 37);
      
      // Resumen
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("1. Resumen de Producción", 15, 50);
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(`• Producción Semanal (últimos 7 días): ${stats.weeklyTotal.toLocaleString()} kg`, 20, 60);
      pdf.text(`• Producción Mensual (Enero 2026): ${stats.monthlyTotal.toLocaleString()} kg`, 20, 68);
      
      // Tabla de Datos
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("2. Listado de Lotes Procesados", 15, 85);
      
      const tableData = stats.recentLots.map(lot => [
        lot.date ? new Date(lot.date).toLocaleDateString("es-ES") : "-",
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

      // Abrir vista previa
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
      <DialogContent className="max-w-4xl bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl">
        <style>
          {`
            @media print {
              .no-print { display: none !important; }
              body { background: white !important; color: black !important; }
              .print-container { background: white !important; color: black !important; padding: 20px; }
            }
          `}
        </style>
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
              {isPreviewing ? (
                <div className="h-4 w-4 border-2 border-blue-400 border-t-transparent animate-spin rounded-full" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {isPreviewing ? "Generando..." : "Vista Previa Reporte"}
            </Button>
            
            <Button
              onClick={handleExportPDF}
              disabled={isExporting}
              variant="outline"
              size="sm"
              className="border-yellow-600/30 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400 gap-2 font-semibold no-print"
            >
              {isExporting ? (
                <div className="h-4 w-4 border-2 border-yellow-500 border-t-transparent animate-spin rounded-full" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {isExporting ? "Exportando..." : "Exportar Reporte"}
            </Button>
          </div>
        </DialogHeader>

        <div className="mt-6 space-y-8 print-container" ref={reportRef}>
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-yellow-500/30 transition-all group">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Producción Semanal</p>
                  <Calendar className="h-4 w-4 text-yellow-500 group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black text-white">{stats.weeklyTotal.toLocaleString()}</p>
                  <p className="text-xl font-bold text-yellow-500">kg</p>
                </div>
                <p className="text-zinc-500 text-xs mt-2 italic">Últimos 7 días</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-yellow-500/30 transition-all group">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Producción Mensual</p>
                  <TrendingUp className="h-4 w-4 text-yellow-500 group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black text-white">{stats.monthlyTotal.toLocaleString()}</p>
                  <p className="text-xl font-bold text-yellow-500">kg</p>
                </div>
                <p className="text-zinc-500 text-xs mt-2 italic capitalize">{stats.monthName} {stats.year}</p>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Chart Section */}
          <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-6">
            <Tabs value={viewType} onValueChange={(v) => setViewType(v as any)} className="w-full">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <h4 className="font-bold flex items-center gap-2 text-zinc-100">
                  <Package className="h-4 w-4 text-yellow-500" />
                  Kilos Producidos
                </h4>
                {!isExporting && !isPreviewing && (
                  <TabsList className="bg-zinc-900 border border-zinc-800 p-1 h-9 no-print">
                    <TabsTrigger value="daily" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black text-xs">Diario</TabsTrigger>
                    <TabsTrigger value="weekly" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black text-xs">Semanal</TabsTrigger>
                  </TabsList>
                )}
              </div>

              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={viewType === "daily" ? stats.chartDailyData : stats.chartWeeklyData}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
                        <stop offset="100%" stopColor="#ca8a04" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#71717a" 
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#71717a" 
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}kg`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
                    <Bar 
                      dataKey="total" 
                      radius={[6, 6, 0, 0]}
                      animationDuration={1500}
                    >
                      { (viewType === "daily" ? stats.chartDailyData : stats.chartWeeklyData).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="url(#barGradient)" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
