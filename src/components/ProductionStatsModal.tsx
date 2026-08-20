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
import { formatFechaCorta, parseFechaSegura } from "@/lib/utils";
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
        const pDate = parseFechaSegura(p.date);
        return pDate && pDate >= monthAgo && pDate <= now;
      })
      .sort((a, b) => Number(a.lote_code || a.id) - Number(b.lote_code || b.id));

    // --- DATOS DINÁMICOS DEL GRÁFICO (Desde la Vista) ---
    let chartDynamicData = [];

    if (viewType === "daily") {
      // Filtrar últimos 14 días de la vista
      const last14Days = subDays(now, 14);
      chartDynamicData = viewData
        .filter(d => {
          const date = parseFechaSegura(d?.fecha_produccion);
          return date && date >= last14Days;
        })
        .map(d => ({
          name: format(parseFechaSegura(d.fecha_produccion)!, "dd/MM"),
          total: Number(d.total_kg)
        }));
    } else if (viewType === "monthly") {
      // Agrupar por mes_nombre desde la vista (Últimos 12 meses)
      const monthlyGroups = new Map<string, { total: number, date: Date }>();
      
      viewData.forEach(d => {
        const date = parseFechaSegura(d?.fecha_produccion);
        if (!date) return;
        const key = format(date, "yyyy-MM");

        if (!monthlyGroups.has(key)) {
          monthlyGroups.set(key, { total: 0, date });
        }

        const current = monthlyGroups.get(key)!;
        current.total += Number(d.total_kg);
      });

      // Convertir a array, ordenar por fecha y formato final
      chartDynamicData = Array.from(monthlyGroups.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([_, data]) => ({
          name: format(data.date, "MMM yy", { locale: es }).charAt(0).toUpperCase() + format(data.date, "MMM yy", { locale: es }).slice(1),
          total: data.total
        }));
        
    } else {
      // Semanal
      const weeklyGroups: Record<string, number> = {};
      viewData.forEach(d => {
        const date = parseFechaSegura(d?.fecha_produccion);
        if (!date) return;
        const label = `Sem ${format(date, "I")}`;
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
        formatFechaCorta(lot.date, "-"),
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
        <div className="bg-background border-2 border-primary p-4 rounded-xl shadow-2xl">
          <p className="text-foreground font-bold mb-1 text-sm">{label}</p>
          <p className="text-muted-foreground text-sm">
            Producción: <span className="font-mono font-bold text-primary">{value.toLocaleString()} kg</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const periodoLabel = viewType === 'daily' 
    ? 'kg/día' 
    : viewType === 'weekly' 
    ? 'kg/semana' 
    : 'kg/mes';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col p-0 overflow-hidden rp-modal">
        
        {/* Glow decorativo */}
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,65,122,0.06), transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }} />

        {/* ── HEADER ─────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #243447 100%)',
          padding: '24px 28px 22px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Ornamento rosa */}
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 120, height: 120, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(232,65,122,0.12), transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Ícono */}
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'linear-gradient(135deg, #e8417a 0%, #c2185b 100%)',
                boxShadow: '0 6px 20px rgba(232,65,122,0.45), 0 0 40px rgba(232,65,122,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="3"/>
                  <polyline points="3,9 21,9"/>
                  <polyline points="9,21 9,9"/>
                  <line x1="13" y1="13" x2="18" y2="13"/>
                  <line x1="13" y1="17" x2="16" y2="17"/>
                </svg>
              </div>
              <div>
                <DialogTitle style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 600, fontSize: 22, color: '#ffffff', lineHeight: 1.2,
                  letterSpacing: 0, margin: 0,
                }}>
                  Reporte de Planta
                </DialogTitle>
                <DialogDescription style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 300, fontSize: 11, letterSpacing: 2,
                  color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginTop: 4,
                }}>
                  Análisis Operativo · Villa Martelli
                </DialogDescription>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={handlePreviewPDF}
                disabled={isPreviewing}
                className="no-print"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500, fontSize: 12,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.65)',
                  padding: '8px 16px', borderRadius: 10,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all 0.2s',
                }}
              >
                <Eye size={14} />
                {isPreviewing ? "..." : "Vista Previa"}
              </button>
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="no-print"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500, fontSize: 12,
                  background: 'linear-gradient(135deg, #e8417a, #c2185b)',
                  border: 'none',
                  color: 'white',
                  padding: '8px 16px', borderRadius: 10,
                  boxShadow: '0 4px 14px rgba(232,65,122,0.4)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all 0.2s',
                }}
              >
                <Download size={14} />
                {isExporting ? "..." : "Exportar"}
              </button>
            </div>
          </div>
        </div>

        {/* ── BODY ───────────────────────────────── */}
        <div className="rp-body flex-1 flex flex-col min-h-0 overflow-y-auto" ref={reportRef}>

          {/* ── METRIC CARDS ─────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '24px 28px 0' }}>
            {/* Semanal */}
            <div className="rp-card" style={{ borderRadius: 18, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, borderRadius: '18px 18px 0 0', background: 'linear-gradient(90deg, #e8417a, transparent)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e8417a', boxShadow: '0 0 6px rgba(232,65,122,0.5)', display: 'inline-block' }} />
                  <span className="rp-label" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase' }}>
                    Semanal
                  </span>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(232,65,122,0.08)', border: '1px solid rgba(232,65,122,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={16} color="#e8417a" />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span className="rp-number" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 52, lineHeight: 1, letterSpacing: -1 }}>
                  {stats.weeklyTotal.toLocaleString()}
                </span>
                <span className="rp-unit" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                  kg
                </span>
              </div>
            </div>

            {/* Mensual */}
            <div className="rp-card" style={{ borderRadius: 18, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, borderRadius: '18px 18px 0 0', background: 'linear-gradient(90deg, #f59e0b, transparent)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px rgba(245,158,11,0.5)', display: 'inline-block' }} />
                  <span className="rp-label" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase' }}>
                    Producción {stats.monthName}
                  </span>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={16} color="#f59e0b" />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span className="rp-number" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 52, lineHeight: 1, letterSpacing: -1 }}>
                  {stats.monthlyTotal.toLocaleString()}
                </span>
                <span className="rp-unit" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                  kg
                </span>
              </div>
            </div>
          </div>

          {/* ── CHART SECTION ────────────────────── */}
          <div className="rp-chart-section" style={{ margin: '20px 28px 0', borderRadius: 20, padding: '22px 24px' }}>
            <Tabs value={viewType} onValueChange={(v) => setViewType(v as "daily" | "weekly" | "monthly")} className="w-full flex-1 flex flex-col">
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h4 className="rp-chart-title" style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 600, fontSize: 17, letterSpacing: 0.3,
                  display: 'flex', alignItems: 'center', gap: 8, margin: 0,
                }}>
                  <Activity size={16} color="#e8417a" />
                  Rendimiento de Planta
                </h4>
                
                <TabsList className="rp-tabs-list no-print" style={{
                  borderRadius: 10, padding: 3, height: 'auto',
                  display: 'flex', gap: 2,
                }}>
                  <TabsTrigger value="daily" className="rp-tab" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 11, padding: '6px 14px', borderRadius: 8 }}>
                    Diario
                  </TabsTrigger>
                  <TabsTrigger value="weekly" className="rp-tab" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 11, padding: '6px 14px', borderRadius: 8 }}>
                    Semanal
                  </TabsTrigger>
                  <TabsTrigger value="monthly" className="rp-tab" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 11, padding: '6px 14px', borderRadius: 8 }}>
                    Mensual
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Chart */}
              <div style={{ width: '100%', height: 250, position: 'relative' }}>
                {loadingView ? (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="animate-spin" style={{ width: 24, height: 24, border: '2px solid rgba(232,65,122,0.2)', borderTopColor: '#e8417a', borderRadius: '50%' }} />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartDynamicData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="rpBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#e8417a" stopOpacity={1} />
                          <stop offset="100%" stopColor="#e8417a" stopOpacity={0.35} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="rp-grid-line" opacity={0.5} />
                      <XAxis 
                        dataKey="name" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        fontWeight={400}
                        fontFamily="'DM Sans', sans-serif"
                        dy={5}
                        interval={viewType === 'daily' ? 1 : 0}
                        className="rp-axis-x"
                      />
                      <YAxis 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(v) => `${v}`}
                        fontWeight={400}
                        fontFamily="'DM Sans', sans-serif"
                        dx={-5}
                        className="rp-axis-y"
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(232,65,122,0.06)', radius: 6 }}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rp-tooltip" style={{
                                padding: '8px 14px', borderRadius: 12,
                                fontFamily: "'DM Sans', sans-serif",
                                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                              }}>
                                <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>{label}</p>
                                <p style={{ fontSize: 12, color: '#e8417a', fontWeight: 700 }}>
                                  {payload[0].value?.toLocaleString()} kg
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey="total" 
                        radius={[4, 4, 4, 4]} 
                        barSize={22}
                        animationDuration={1000}
                      >
                        {stats.chartDynamicData.map((_, i) => (
                          <Cell key={`cell-${i}`} fill="url(#rpBarGrad)" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Tabs>
          </div>

          {/* ── SEPARATOR ────────────────────────── */}
          <div className="rp-divider" style={{ height: 1, margin: '20px 28px 0' }} />

          {/* ── FOOTER ───────────────────────────── */}
          <div style={{ padding: '16px 28px 22px', display: 'flex', alignItems: 'center', gap: 20 }}>
            <span className="rp-footer-text" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>
              Período: <strong className="rp-footer-strong">{stats.monthName} {stats.year}</strong>
            </span>
            <span className="rp-footer-sep" style={{ width: 1, height: 14, display: 'inline-block' }} />
            <span className="rp-footer-text" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>
              Registros: <strong className="rp-footer-strong">{stats.chartDynamicData.length}</strong>
            </span>
            <span className="rp-footer-sep" style={{ width: 1, height: 14, display: 'inline-block' }} />
            <span className="rp-footer-text" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>
              Promedio: <strong className="rp-footer-strong">
                {stats.chartDynamicData.length > 0
                  ? Math.round(stats.chartDynamicData.reduce((s, d) => s + d.total, 0) / stats.chartDynamicData.length).toLocaleString()
                  : 0} {periodoLabel}
              </strong>
            </span>
            
            {/* LIVE indicator */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="rp-live-dot" style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 8px rgba(34,197,94,0.6)',
                display: 'inline-block',
              }} />
              <span className="rp-footer-text" style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600, fontSize: 10, letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}>
                Live
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

