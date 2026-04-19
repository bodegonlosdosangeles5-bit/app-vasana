import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  parseISO,
  startOfMonth,
  parse,
  isSameDay,
  format
} from "date-fns";
import { CheckCircle, XCircle, Clock, Beaker, Filter, Edit, Save, X, Plus, Upload, Package, Trash2, AlertCircle, Eye, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ProductoService } from "@/services/productoService";
import { ActivityLogService } from "@/services/activityLogService";

import { useAuth } from "@/components/Auth/AuthProvider";
import { toast } from "sonner";

interface FormulasSectionProps {
  formulas?: any[];
  setFormulas?: (formulas: any[]) => void;
  createFormula?: (formula: any) => Promise<any>;
  updateFormula?: (id: string, updates: any) => Promise<any>;
  deleteFormula?: (id: string) => Promise<boolean>;
  addMissingIngredient?: (formulaId: string, ingredient: { name: string; required: number; unit: string; }) => Promise<boolean>;
  removeMissingIngredient?: (formulaId: string, ingredientName: string) => Promise<boolean>;
  updateIncompleteFormulasStatus?: () => Promise<{ updated: number; formulas: any[] }>;
  loading?: boolean;
  error?: string | null;
}

export const FormulasSection = ({ 
  formulas = [], 
  setFormulas = () => {}, 
  createFormula, 
  updateFormula, 
  deleteFormula,
  addMissingIngredient,
  removeMissingIngredient,
  updateIncompleteFormulasStatus,
  loading: propLoading = false,
  error: propError = null
}: FormulasSectionProps) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const canCargarProducto = isAdmin || user?.role === 'user';

  // Usar directamente los datos de los props (instancia centralizada en Index.tsx)
  const formulasData = formulas;
  const loading = propLoading;
  const error = propError;

  // Funciones CRUD venidas de props
  const createProducto = createFormula;
  const updateProducto = updateFormula;
  const deleteProducto = deleteFormula;
  const addMissingIngredientReal = addMissingIngredient;
  const removeMissingIngredientReal = removeMissingIngredient;
  const [selectedFormula, setSelectedFormula] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<any>(null);
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(true);
  const [destinationFilter, setDestinationFilter] = useState<string>("all");
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [isAddIngredientModalOpen, setIsAddIngredientModalOpen] = useState(false);
  const [selectedFormulaForIngredient, setSelectedFormulaForIngredient] = useState<any>(null);
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    required: "",
    unit: "kg"
  });
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);
  const [statusChangingFormulas, setStatusChangingFormulas] = useState<Set<string>>(new Set());
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);
  const [newFormula, setNewFormula] = useState({
    lot: "",
    name: "",
    batchSize: "",
    batchUnit: "kg",
    date: new Date().toLocaleDateString('en-CA'), // Inicializar con la fecha de hoy en formato local YYYY-MM-DD
    status: "available",
    type: "stock",
    clientName: ""
  });
  const [missingIngredients, setMissingIngredients] = useState<Array<{
    name: string;
    required: string;
    unit: string;
  }>>([]);
  const [newMissingIngredient, setNewMissingIngredient] = useState({
    name: "",
    required: "",
    unit: "kg"
  });
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isPreviewingPDF, setIsPreviewingPDF] = useState(false);
  const [isSubmittingFormula, setIsSubmittingFormula] = useState(false);

  // =============================================
  // Datos de fórmulas (definido antes del bloque PDF)
  // =============================================
  const currentFormulas = [...formulasData].sort((a, b) => Number(a.lote_code || a.id) - Number(b.lote_code || b.id));

  // =============================================
  // PDF: Lotes Incompletos
  // =============================================

  const buildPDFContent = (pdf: jsPDF, lotes: any[], _isPreview = false) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const now = new Date();
    const fechaImpresion = format(now, "dd/MM/yyyy HH:mm");

    // ─── HEADER ───────────────────────────────────────────────
    pdf.setFillColor(2, 63, 134); // #023F86
    pdf.rect(0, 0, pageWidth, 28, "F");

    pdf.setTextColor(247, 166, 0); // #F7A600 dorado
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("CONTROL DE PRODUCCIÓN", 14, 11);

    pdf.setTextColor(200, 220, 255);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text("Control de Producción — Planta Florencio Varela", 14, 18);

    pdf.setTextColor(180, 200, 235);
    pdf.setFontSize(8);
    pdf.text(`Impreso: ${fechaImpresion}`, pageWidth - 14, 18, { align: "right" });

    // ─── TÍTULO DEL REPORTE ──────────────────────────────────
    pdf.setTextColor(30, 30, 30);
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.text("Listado de Lotes con Materias Primas Faltantes", 14, 40);

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Total de lotes incompletos: ${lotes.length}`, 14, 47);

    // ─── TABLA RESUMEN ───────────────────────────────────────
    const tableRows = lotes.map((formula, index) => {
      const faltantes = formula.missingIngredients && formula.missingIngredients.length > 0
        ? formula.missingIngredients.map((ing: any) => `${ing.name} (${ing.required} ${ing.unit})`).join(" | ")
        : "Sin detalle registrado";

      return [
        (index + 1).toString(),
        formula.lote_code || formula.id,
        formula.name,
        `${formula.batchSize} kg`,
        formula.date ? format(parseISO(formula.date + "T00:00:00"), "dd/MM/yyyy") : "-",
        formula.destination,
        faltantes
      ];
    });

    autoTable(pdf, {
      startY: 52,
      head: [["", "Lote", "Producto", "Kilos", "Fecha", "Destino", "Materias Primas Faltantes"]],
      body: tableRows,
      theme: "striped",
      styles: {
        fontSize: 7,
        cellPadding: 3,
        overflow: "linebreak"
      },
      headStyles: {
        fillColor: [2, 63, 134],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
        halign: "center",
        valign: "middle"
      },
      bodyStyles: {
        textColor: [40, 40, 40],
        valign: "middle"
      },
      alternateRowStyles: {
        fillColor: [240, 246, 255]
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center", valign: "middle" },
        1: { cellWidth: 20 },
        2: { cellWidth: 40 },
        3: { cellWidth: 15, halign: "center" },
        4: { cellWidth: 22, halign: "center" },
        5: { cellWidth: 30 },
        6: { cellWidth: "auto" }
      },
      margin: { left: 20, right: 20 },
      didDrawPage: (data) => {
        // Footer en cada página
        pdf.setFontSize(7);
        pdf.setTextColor(160, 160, 160);
        pdf.text(
          `Página ${data.pageNumber} — Sistema de Gestión Planta Varela`,
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        );
      }
    });

    // ─── FIRMA / CIERRE ──────────────────────────────────────
    const finalY = (pdf as any).lastAutoTable?.finalY || 52;
    let cursorY = finalY + 12;

    if (cursorY + 20 > pageHeight - 20) {
      pdf.addPage();
      cursorY = 20;
    }
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(20, cursorY, pageWidth - 20, cursorY);
    cursorY += 6;

    pdf.setFontSize(8);
    pdf.setFont("helvetica", "italic");
    pdf.setTextColor(140, 140, 140);
    pdf.text("Este documento fue generado automáticamente por el Sistema de Control de Producción.", 20, cursorY);
  };

  // Calcular lotes incompletos actuales
  const getIncompleteFormulas = () =>
    currentFormulas.filter((f) => getFormulaStatus(f) === "incomplete");

  const handlePreviewPDF = () => {
    const lotes = getIncompleteFormulas();
    if (lotes.length === 0) {
      toast.info("No hay lotes incompletos para previsualizar.");
      return;
    }
    setIsPreviewingPDF(true);
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      buildPDFContent(pdf, lotes, true);
      const blobUrl = pdf.output("bloburl");
      window.open(blobUrl as unknown as string, "_blank");
    } finally {
      setIsPreviewingPDF(false);
    }
  };

  const handleExportPDF = () => {
    const lotes2 = getIncompleteFormulas();
    if (lotes2.length === 0) {
      toast.info("No hay lotes incompletos para exportar.");
      return;
    }
    setIsExportingPDF(true);
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      buildPDFContent(pdf, lotes2, false);
      const fecha = format(new Date(), "yyyy-MM-dd_HH-mm");
      pdf.save(`Lotes_Incompletos_${fecha}.pdf`);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // (currentFormulas ya está definido arriba)
  



  const getFormulaStatus = (formula: any) => {
    // Si la fórmula ya tiene un status definido y es válido, usarlo
    if (formula.status && (formula.status === "available" || formula.status === "incomplete")) {
      return formula.status;
    }
    
    // Si no tiene status válido, calcular basado en ingredientes faltantes
    if (formula.missingIngredients && formula.missingIngredients.length > 0) {
      return "incomplete";
    }
    
    return "available";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "available":
        return <CheckCircle className="h-6 w-6 text-white" />;
      case "incomplete":
        return <XCircle className="h-6 w-6 text-white" />;
      default:
        // Si no es un estado válido, tratar como incomplete
        return <XCircle className="h-6 w-6 text-white" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "available":
        return "✅ Terminada";
      case "incomplete":
        return "❌ Faltante de materia prima";
      default:
        // Si no es un estado válido, tratar como incomplete
        return "❌ Faltante de materia prima";
    }
  };

  const getCompletionPercentage = (formula: any) => {
    // Si no hay ingredientes faltantes, está 100% completa
    if (!formula.missingIngredients || formula.missingIngredients.length === 0) {
      return 100;
    }
    
    // Si hay ingredientes faltantes, está incompleta
    return 0;
  };

  // Filtrar fórmulas según el estado y destino seleccionado
  const filteredFormulas = currentFormulas.filter(formula => {
    const actualStatus = getFormulaStatus(formula);
    const statusMatch = showOnlyIncomplete ? actualStatus === "incomplete" : true;
    const destinationMatch = destinationFilter === "all" || formula.destination === destinationFilter;
    return statusMatch && destinationMatch;
  });

  // Función para actualizar automáticamente fórmulas incompletas sin faltantes
  const handleUpdateIncompleteFormulas = async () => {
    if (!isAdmin) return;
    if (!updateIncompleteFormulasStatus) return;
    
    try {
      setIsUpdatingStatus(true);
      const result = await updateIncompleteFormulasStatus();
      
      if (result.updated > 0) {
        setShowSuccessMessage(`✅ Se actualizaron ${result.updated} fórmulas a estado terminado`);
        setTimeout(() => setShowSuccessMessage(null), 5000);
      } else {
        setShowSuccessMessage("ℹ️ No hay fórmulas incompletas sin faltantes para actualizar");
        setTimeout(() => setShowSuccessMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error actualizando fórmulas:', error);
      setShowSuccessMessage("❌ Error al actualizar fórmulas");
      setTimeout(() => setShowSuccessMessage(null), 5000);
    } finally {
      setIsUpdatingStatus(false);
    }
  };



  const handleInputChange = (field: string, value: string) => {
    setNewFormula(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddMissingIngredient = () => {
    if (newMissingIngredient.name.trim() && newMissingIngredient.required.trim()) {
      setMissingIngredients(prev => [...prev, { ...newMissingIngredient }]);
      setNewMissingIngredient({ name: "", required: "", unit: "kg" });
    }
  };

  const handleRemoveMissingIngredient = (index: number) => {
    setMissingIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleMissingIngredientChange = (field: string, value: string) => {
    setNewMissingIngredient(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLoadFormula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCargarProducto) return;
    if (isSubmittingFormula) return; // Bloquear doble submit

    const createFunction = createProducto || createFormula;
    if (!createFunction) {
      console.error('No hay función createProducto disponible');
      return;
    }

    // Validar duplicado exacto: mismo lote Y mismo nombre
    const duplicadoExacto = formulasData.some(f =>
      f.lote_code?.toString().trim() === newFormula.lot?.toString().trim() &&
      f.name?.trim().toLowerCase() === newFormula.name?.trim().toLowerCase()
    );

    if (duplicadoExacto) {
      toast.error(
        `Ya existe un producto con el lote ${newFormula.lot} y el nombre "${newFormula.name}". ` +
        `No se puede cargar dos veces el mismo producto.`
      );
      return;
    }

    setIsSubmittingFormula(true);
    try {
      // Uso Interno queda en planta (Florencio Varela), el resto va a Villa Martelli
      const autoDestination = newFormula.type === 'uso_interno' ? 'Florencio Varela' : 'Villa Martelli';
      
      const batchSizeInKg = newFormula.batchUnit === 'g'
        ? parseFloat(newFormula.batchSize) / 1000
        : parseFloat(newFormula.batchSize);

      const formulaData = {
        name: newFormula.name,
        batchSize: batchSizeInKg,
        destination: autoDestination,
        date: newFormula.date,
        type: newFormula.type === 'cliente' ? 'client' : newFormula.type === 'uso_interno' ? 'stock' : 'stock',
        clientName: newFormula.type === 'cliente' ? newFormula.clientName : '',
        status: newFormula.status,
        missingIngredients: newFormula.status === 'incomplete' ? missingIngredients.map(ing => ({
          name: ing.name,
          required: parseFloat(ing.required),
          unit: ing.unit
        })) : [],
        id: newFormula.lot, // Usar el lote como ID (se usará como lote_code en el servicio)
        lote_code: newFormula.lot, // Pasar explícitamente el lote_code
        stock_actual: batchSizeInKg // Stock inicial igual a la producción (ya convertido a kg)
      };

      await createFunction(formulaData);
      
      // Si es incompleta y tiene ingredientes faltantes, agregarlos a Supabase
      if (newFormula.status === 'incomplete' && missingIngredients.length > 0) {
        for (const ingredient of missingIngredients) {
          const addFunction = addMissingIngredientReal || addMissingIngredient;
          if (addFunction) {
            await addFunction(newFormula.lot, {
              name: ingredient.name,
              required: parseFloat(ingredient.required),
              unit: ingredient.unit
            });
          }
        }
      }
      
      // Resetear el formulario
      setNewFormula({
        lot: "",
        name: "",
        batchSize: "",
        batchUnit: "kg",
        date: new Date().toLocaleDateString('en-CA'),
        status: "available",
        type: "stock",
        clientName: ""
      });
      setMissingIngredients([]);
      setNewMissingIngredient({ name: "", required: "", unit: "kg" });
      
      setIsLoadModalOpen(false);
      
      // Mostrar mensaje de éxito
      const statusMessage = formulaData.status === 'incomplete' ? 'incompleta' : 'terminada';
      setShowSuccessMessage(`¡Fórmula "${formulaData.name}" creada como ${statusMessage}! 🎉`);
      setTimeout(() => setShowSuccessMessage(null), 3000);

      await ActivityLogService.log({
        user_name: user?.user_name || 'desconocido',
        user_role: user?.role || 'user',
        accion: 'Creó producto',
        entidad: 'Productos',
        descripcion: `Creó el producto "${formulaData.name}" con lote ${formulaData.lote_code}`,
        color_tag: 'green'
      });
      
    } catch (error) {
      console.error('Error creating formula:', error);
      toast.error('Error al cargar el producto. Intentá de nuevo.');
    } finally {
      setIsSubmittingFormula(false);
    }
  };

  const handleEditFormula = (formula: any) => {
    setEditingFormula({ ...formula });
    setIsEditModalOpen(true);
  };

  const handleUpdateFormula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (editingFormula) {
      try {
        const success = await updateProducto(editingFormula.id, {
          name: editingFormula.name,
          lote_code: editingFormula.lote_code,
          batchSize: editingFormula.batchSize,
          destination: editingFormula.destination,
          date: editingFormula.date,
          type: editingFormula.type,
          clientName: editingFormula.clientName,
          status: editingFormula.status
        });
        
        if (success) {
          setShowSuccessMessage(`¡Producto "${editingFormula.name}" actualizado! ✅`);
          setIsEditModalOpen(false);
          
          await ActivityLogService.log({
            user_name: user?.user_name || 'desconocido',
            user_role: user?.role || 'user',
            accion: 'Editó producto',
            entidad: 'Productos',
            descripcion: `Editó el producto "${editingFormula.name}" (lote ${editingFormula.lote_code || editingFormula.id})`,
            color_tag: 'yellow'
          });

          setEditingFormula(null);
          setTimeout(() => setShowSuccessMessage(null), 3000);
        }
      } catch (error) {
        console.error('Error updating product:', error);
      }
    }
  };

  const handleDeleteFormula = async () => {
    if (!isAdmin) return;
    if (!productToDelete) return;
    
    const productData = formulas.find((f: any) => f.id === productToDelete);
    
    try {
      const success = await deleteProducto(productToDelete);
      if (success) {
        setShowSuccessMessage("Producto eliminado correctamente 🗑️");
        setIsDeleteConfirmOpen(false);
        setProductToDelete(null);
        setTimeout(() => setShowSuccessMessage(null), 3000);

        if (productData) {
          await ActivityLogService.log({
            user_name: user?.user_name || 'desconocido',
            user_role: user?.role || 'user',
            accion: 'Eliminó producto',
            entidad: 'Productos',
            descripcion: `Eliminó el producto "${productData.name}" (lote ${productData.lote_code || productData.id})`,
            color_tag: 'red'
          });
        }
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleEditIngredientChange = (index: number, field: string, value: string) => {
    if (editingFormula) {
      setEditingFormula(prev => ({
        ...prev,
        ingredients: prev.ingredients.map((ing, i) => 
          i === index ? { ...ing, [field]: value } : ing
        )
      }));
    }
  };

  const handleAddIngredient = (formula: any) => {
    setSelectedFormulaForIngredient(formula);
    setNewIngredient({
      name: "",
      required: "",
      unit: "kg"
    });
    setIsAddIngredientModalOpen(true);
  };

  const handleSubmitIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedFormulaForIngredient || !newIngredient.name.trim() || !newIngredient.required) {
      return;
    }

    try {
      setIsAddingIngredient(true);
      
      if (addMissingIngredient) {
        const success = await addMissingIngredient(
          selectedFormulaForIngredient.id,
          {
            name: newIngredient.name,
            required: parseFloat(newIngredient.required),
            unit: newIngredient.unit
          }
        );

        if (success) {
          // Cerrar modal y resetear - Realtime se encarga de actualizar la UI
          setIsAddIngredientModalOpen(false);
          setSelectedFormulaForIngredient(null);
          setNewIngredient({
            name: "",
            required: "",
            unit: "kg"
          });
        }
      } else {
        // Fallback al servicio directo si no hay función de Realtime
        const success = await ProductoService.addMissingIngredient(
          selectedFormulaForIngredient.id,
          {
            name: newIngredient.name,
            required: parseFloat(newIngredient.required),
            unit: newIngredient.unit
          }
        );

        if (success) {
          const updatedFormulas = await ProductoService.getProductos();
          setFormulas(updatedFormulas);
          
          setIsAddIngredientModalOpen(false);
          setSelectedFormulaForIngredient(null);
          setNewIngredient({
            name: "",
            required: "",
            unit: "kg"
          });
        }
      }
    } catch (error) {
      console.error('Error adding ingredient:', error);
    } finally {
      setIsAddingIngredient(false);
    }
  };

  const handleRemoveIngredient = async (formulaId: string, ingredientName: string) => {
    if (!isAdmin) return;
    try {
      console.log(`🗑️ Eliminando ingrediente: ${ingredientName} de fórmula: ${formulaId}`);
      
      // Obtener la fórmula actual para verificar el estado después de la eliminación
      const currentFormula = formulas.find(f => f.id === formulaId);
      const remainingIngredients = currentFormula?.missingIngredients?.filter(
        ing => ing.name !== ingredientName
      ) || [];
      
      // El estado se actualizará automáticamente via Realtime
      // Si no quedan ingredientes faltantes, cambiar el estado a "available"
      if (remainingIngredients.length === 0) {
        // Agregar animación de cambio de estado
        setStatusChangingFormulas(prev => new Set(prev).add(formulaId));
        
        // Mostrar mensaje de éxito
        setShowSuccessMessage(`¡Fórmula completada! Ahora está TERMINADA ✅`);
        
        // Quitar la animación y mensaje después de 3 segundos
        setTimeout(() => {
          setStatusChangingFormulas(prev => {
            const newSet = new Set(prev);
            newSet.delete(formulaId);
            return newSet;
          });
          setShowSuccessMessage(null);
        }, 3000);
      }

      // Ejecutar la eliminación en la base de datos
      if (removeMissingIngredient) {
        const success = await removeMissingIngredient(formulaId, ingredientName);
        if (success) {
          // Si no quedan ingredientes faltantes, cambiar el estado a "available"
          if (remainingIngredients.length === 0 && updateFormula) {
            await updateFormula(formulaId, { status: 'available' });
          }
        }
      } else {
        // Fallback al servicio directo si no hay función de Realtime
        const success = await ProductoService.removeMissingIngredient(formulaId, ingredientName);
        if (success) {
          if (remainingIngredients.length === 0) {
            await ProductoService.updateProducto(formulaId, { status: 'available' });
          }
        }
      }
    } catch (error) {
      console.error('❌ Error eliminando ingrediente:', error);
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
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h2 className="text-xl sm:text-2xl font-black text-[#023F86] uppercase tracking-tighter">
            {showOnlyIncomplete ? "Lotes Incompletos" : "Gestión de Productos"}
          </h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant={showOnlyIncomplete ? "default" : "outline"}
              size="sm"
              onClick={() => setShowOnlyIncomplete(!showOnlyIncomplete)}
              className={`flex items-center gap-2 font-bold px-4 h-9 rounded-xl ${
                showOnlyIncomplete 
                  ? "bg-[#F7A600] text-[#023F86] hover:bg-[#F7A600]/90 border-none" 
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Filter className="h-4 w-4" />
              {showOnlyIncomplete ? "Ver Historial Completo" : "Solo Incompletas"}
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUpdateIncompleteFormulas}
                disabled={isUpdatingStatus}
                className="flex items-center gap-2 h-9 px-4 rounded-xl border-[#023F86]/20 text-[#023F86] font-bold hover:bg-[#023F86]/5"
              >
                <CheckCircle className="h-4 w-4" />
                {isUpdatingStatus ? "Actualizando..." : "Completar Lotes"}
              </Button>
            )}
            {!showOnlyIncomplete && (
              <Select value={destinationFilter} onValueChange={setDestinationFilter}>
                <SelectTrigger className="w-[180px] h-9 rounded-xl border-slate-200">
                  <SelectValue placeholder="Filtrar por destino" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los destinos</SelectItem>
                  <SelectItem value="Villa Martelli">Villa Martelli</SelectItem>
                  <SelectItem value="Florencio Varela">Florencio Varela / Uso Interno</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        {canCargarProducto && (
          <Button 
            onClick={() => setIsLoadModalOpen(true)}
            className="bg-[#023F86] hover:bg-[#0555B1] text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-blue-500/20"
          >
            <Plus className="h-5 w-5 mr-2" />
            Cargar Producto
          </Button>
        )}
      </div>

      {/* Barra de acciones PDF — solo visible cuando hay lotes incompletos */}
      {showOnlyIncomplete && (
        <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mr-1">Imprimir lista:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviewPDF}
            disabled={isPreviewingPDF}
            className="flex items-center gap-2 h-8 px-3 rounded-lg border-slate-300 text-slate-600 hover:bg-white hover:text-[#023F86] hover:border-[#023F86] transition-all font-medium text-xs"
          >
            <Eye className="h-3.5 w-3.5" />
            {isPreviewingPDF ? "Generando..." : "Vista Previa"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-2 h-8 px-3 rounded-lg border-[#023F86]/30 text-[#023F86] hover:bg-[#023F86] hover:text-white transition-all font-medium text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            {isExportingPDF ? "Exportando..." : "Exportar PDF"}
          </Button>
        </div>
      )}

      {filteredFormulas.length === 0 ? (
        <div className="text-center py-12">
          <Beaker className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {showOnlyIncomplete ? "¡Excelente!" : "No hay productos"}
          </h3>
          <p className="text-muted-foreground">
            {showOnlyIncomplete 
              ? "Todas los productos tienen los materiales necesarios disponibles." 
              : "No se encontraron productos en el sistema."
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {filteredFormulas.map((formula) => {
          const actualStatus = getFormulaStatus(formula);
          const completion = getCompletionPercentage(formula);
          
          return (
            <Card 
              key={formula.id} 
              className={`card-elegant ${statusChangingFormulas.has(formula.id) ? 'status-change' : ''}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold flex items-center space-x-2 text-[#023F86]">
                      <Beaker className="h-6 w-6 text-[#F7A600]" />
                      <span>{formula.name}</span>
                    </CardTitle>
                    <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-tight">
                      Lote: {(formula as any).lote_code || (formula as any).lote || formula.id}
                    </p>
                    <div className="flex flex-col gap-1 mt-2">
                      <p className="text-sm text-slate-600">
                        <span className="font-medium text-[#023F86]">Producción:</span> {formula.batchSize} kg
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-bold border-[#F7A600] text-[#023F86] bg-[#F7A600]/10">
                          Stock planta: {(formula as any).stock_actual !== undefined ? (formula as any).stock_actual : formula.batchSize} kg
                        </Badge>
                      </div>
                    </div>
                    {!showOnlyIncomplete && (
                      <p className="text-base text-foreground dark:text-white font-medium mt-1">
                        Destino: {formula.destination}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground dark:text-white/80 mt-1">
                      Fecha: {formula.date ? format(parseISO(formula.date + 'T00:00:00'), 'dd/MM/yyyy') : 'No especificada'}
                    </p>
                    <p className="text-sm text-muted-foreground dark:text-white/80 mt-1">
                      Para: {formula.type === "client" ? `Cliente${formula.clientName ? ` - ${formula.clientName}` : ''}` : formula.destination === 'Florencio Varela' ? '🏭 Uso Interno (Planta)' : 'Stock'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    {getStatusIcon(actualStatus)}
                    <Badge 
                      variant={actualStatus === "available" ? "default" : "destructive"}
                      className={actualStatus === "available" ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg" : "font-bold rounded-lg"}
                    >
                      {getStatusText(actualStatus)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {actualStatus === "incomplete" && (
                  <div className="space-y-4">
                    {/* Header con contador de ingredientes faltantes */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-400" />
                        <h4 className="text-lg font-semibold text-foreground dark:text-white">
                          Materias Primas Faltantes
                        </h4>
                        {formula.missingIngredients && formula.missingIngredients.length > 0 && (
                          <Badge variant="destructive" className="ml-2">
                            {formula.missingIngredients.length} faltante{formula.missingIngredients.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      {isAdmin && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddIngredient(formula)}
                          className="flex items-center gap-2 text-[#023F86] border-[#023F86]/20 hover:bg-[#023F86]/5 transition-colors font-bold rounded-lg h-8"
                        >
                          <Plus className="h-4 w-4" />
                          Agregar
                        </Button>
                      )}
                    </div>
                    
                    {/* Lista de ingredientes faltantes */}
                    {formula.missingIngredients && formula.missingIngredients.length > 0 ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {formula.missingIngredients.map((ingredient: any, index: number) => (
                          <div key={`${formula.id}-${ingredient.name}-${ingredient.required}-${index}`} className="group flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Package className="h-4 w-4 text-red-600 flex-shrink-0" />
                                <p className="text-base font-bold text-red-900 dark:text-red-200 truncate" title={ingredient.name}>
                                  {ingredient.name}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                                <span className="font-semibold">Cantidad faltante:</span>
                                <span className="bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-md text-red-700 dark:text-red-200 font-bold font-mono">
                                  {ingredient.required} {ingredient.unit}
                                </span>
                              </div>
                            </div>
                            {isAdmin && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRemoveIngredient(formula.id, ingredient.name)}
                                className="ml-3 opacity-80 hover:opacity-100 transition-opacity flex-shrink-0 hover:bg-red-600 hover:scale-105"
                                title="Eliminar materia prima faltante"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        
                        {/* Indicador de scroll si hay muchos ingredientes */}
                        {formula.missingIngredients.length > 4 && (
                          <div className="text-center py-2">
                            <p className="text-xs text-muted-foreground dark:text-white/60">
                              ↑ Desplázate para ver todos los ingredientes ({formula.missingIngredients.length} total)
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-muted/50 dark:bg-white/5 rounded-lg border border-border dark:border-white/10">
                        <Package className="h-12 w-12 text-muted-foreground dark:text-white/40 mx-auto mb-3" />
                        <p className="text-foreground dark:text-white/80 text-base font-medium mb-2">
                          No hay materias primas faltantes registradas
                        </p>
                        <p className="text-muted-foreground dark:text-white/60 text-sm mb-4">
                          Esta fórmula está marcada como incompleta pero no tiene ingredientes faltantes registrados
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddIngredient(formula)}
                          className="text-foreground dark:text-white border-border dark:border-white hover:bg-muted dark:hover:bg-white hover:text-foreground dark:hover:text-black"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar Primera Materia Prima
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {actualStatus === "available" && (
                  <div className="text-center py-4">
                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-base text-foreground dark:text-white font-medium">
                      Terminada
                    </p>
                  </div>
                )}

                <div className="flex justify-end pt-2 gap-2">
                  {isAdmin && (
                    <>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleEditFormula(formula)}
                        className="h-9 w-9 text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-900/50"
                        title="Editar producto"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => {
                          setProductToDelete(formula.id);
                          setIsDeleteConfirmOpen(true);
                        }}
                        className="h-9 w-9 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900/50"
                        title="Eliminar producto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}


      {/* Modal para editar fórmula */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[95vh] overflow-y-auto mx-2 sm:mx-0">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-bold">Editar Producto</DialogTitle>
          </DialogHeader>
          
          {editingFormula && (
            <form onSubmit={handleUpdateFormula} className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-lot">Lote del Producto</Label>
                  <Input
                    id="edit-lot"
                    value={editingFormula.lote_code || editingFormula.id}
                    onChange={(e) => setEditingFormula(prev => ({ ...prev, lote_code: e.target.value }))}
                    placeholder="Ej: L-2024-089"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nombre del Producto</Label>
                  <Input
                    id="edit-name"
                    value={editingFormula.name}
                    onChange={(e) => setEditingFormula(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Lavanda Premium"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-batchSize">Cantidad en Kilogramos</Label>
                  <Input
                    id="edit-batchSize"
                    type="number"
                    value={editingFormula.batchSize}
                    onChange={(e) => setEditingFormula(prev => ({ ...prev, batchSize: parseInt(e.target.value) }))}
                    placeholder="50"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-destination">Destino</Label>
                  <Select 
                    value={editingFormula.destination} 
                    onValueChange={(value) => setEditingFormula(prev => ({ ...prev, destination: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar destino" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Florencio Varela">Florencio Varela (Uso Interno)</SelectItem>
                      <SelectItem value="Villa Martelli">Villa Martelli (Sucursal)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Fecha</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editingFormula.date || ""}
                    onChange={(e) => setEditingFormula(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Para</Label>
                  <Select 
                    value={editingFormula.type || "stock"} 
                    onValueChange={(value) => setEditingFormula(prev => ({ ...prev, type: value, clientName: value === "stock" ? "" : prev.clientName }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar para" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stock">Stock</SelectItem>
                      <SelectItem value="client">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-clientName">Nombre del Cliente</Label>
                  <Input
                    id="edit-clientName"
                    value={editingFormula.clientName || ""}
                    onChange={(e) => setEditingFormula(prev => ({ ...prev, clientName: e.target.value }))}
                    placeholder={editingFormula.type === "client" ? "Nombre del cliente" : "Solo para clientes"}
                    disabled={editingFormula.type === "stock"}
                    required={editingFormula.type === "client"}
                  />
                </div>
              </div>

              {/* Materias Primas Faltantes editables */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <Label className="text-sm sm:text-base font-semibold">Materias Primas Faltantes</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newIngredient = { name: "", required: 0, available: 0, unit: "kg" };
                      setEditingFormula(prev => ({
                        ...prev,
                        ingredients: [...prev.ingredients, newIngredient]
                      }));
                    }}
                    className="flex items-center gap-2 w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar Materia Prima
                  </Button>
                </div>
                
                {editingFormula.ingredients
                  .filter((ingredient: any) => ingredient.available < ingredient.required)
                  .map((ingredient: any, index: number) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 sm:p-4 border rounded-lg bg-red-50">
                    <div className="space-y-1">
                      <Label>Nombre de la Materia Prima</Label>
                      <Input
                        value={ingredient.name}
                        onChange={(e) => handleEditIngredientChange(index, "name", e.target.value)}
                        placeholder="Ej: Aceite de Rosa Búlgara"
                        required
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <Label>Cantidad Faltante</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={ingredient.required - ingredient.available}
                        onChange={(e) => {
                          const missing = parseFloat(e.target.value);
                          setEditingFormula(prev => ({
                            ...prev,
                            ingredients: prev.ingredients.map((ing, i) => 
                              i === index ? { ...ing, required: ing.available + missing } : ing
                            )
                          }));
                        }}
                        placeholder="5.2"
                        required
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <Label>Unidad</Label>
                      <Select 
                        value={ingredient.unit} 
                        onValueChange={(value) => handleEditIngredientChange(index, "unit", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Unidad" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="L">L</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                          <SelectItem value="g">g</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setEditingFormula(prev => ({
                          ...prev,
                          ingredients: prev.ingredients.filter((_, i) => i !== index)
                        }));
                      }}
                      className="mt-4 sm:mt-6 w-full sm:w-auto sm:col-span-3"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Eliminar
                    </Button>
                  </div>
                ))}
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-full sm:w-auto order-2 sm:order-1"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto order-1 sm:order-2"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para cargar fórmula */}
      <Dialog open={isLoadModalOpen} onOpenChange={setIsLoadModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[95vh] overflow-y-auto mx-2 sm:mx-0">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-bold">Cargar Nuevo Producto</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleLoadFormula} className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lot">Lote del Producto</Label>
                <Input
                  id="lot"
                  value={newFormula.lot}
                  onChange={(e) => handleInputChange("lot", e.target.value)}
                  placeholder="Ej: L-2024-089"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Producto</Label>
                <Input
                  id="name"
                  value={newFormula.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Ej: Lavanda Premium"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="batchSize">Cantidad</Label>
                <div className="flex gap-2">
                  <Input
                    id="batchSize"
                    type="number"
                    step="0.001"
                    min="0"
                    value={newFormula.batchSize}
                    onChange={(e) => handleInputChange("batchSize", e.target.value)}
                    placeholder={newFormula.batchUnit === 'g' ? "500" : "0.5"}
                    className="flex-1"
                    required
                  />
                  <Select
                    value={newFormula.batchUnit}
                    onValueChange={(value) => handleInputChange("batchUnit", value)}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newFormula.batchSize && (
                  <p className="text-xs text-muted-foreground">
                    equivale a {newFormula.batchUnit === 'g'
                      ? `${(parseFloat(newFormula.batchSize) / 1000).toFixed(3)} kg`
                      : `${(parseFloat(newFormula.batchSize) * 1000).toFixed(0)} g`
                    }
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  value={newFormula.date}
                  onChange={(e) => handleInputChange("date", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Estatus</Label>
                <Select value={newFormula.status} onValueChange={(value) => handleInputChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estatus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Terminada</SelectItem>
                    <SelectItem value="incomplete">Incompleta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Producto</Label>
                <Select value={newFormula.type} onValueChange={(value) => handleInputChange("type", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock">📦 Stock (Villa Martelli)</SelectItem>
                    <SelectItem value="cliente">🤝 Cliente (Villa Martelli)</SelectItem>
                    <SelectItem value="exportacion">🌍 Exportación (Villa Martelli)</SelectItem>
                    <SelectItem value="uso_interno">🏭 Uso Interno (Queda en Planta)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newFormula.type === 'cliente' && (
              <div className="space-y-2">
                <Label htmlFor="clientName">Nombre del Cliente</Label>
                <Input
                  id="clientName"
                  value={newFormula.clientName}
                  onChange={(e) => handleInputChange("clientName", e.target.value)}
                  placeholder="Nombre del cliente"
                  required
                />
              </div>
            )}

            {/* Sección de ingredientes faltantes - Solo para fórmulas incompletas */}
            {newFormula.status === 'incomplete' && (
              <div className="space-y-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-red-600" />
                  <h4 className="font-semibold text-red-800">Materias Primas Faltantes</h4>
                </div>
                
                {/* Formulario para agregar ingrediente faltante */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-2">
                    <Input
                      placeholder="Nombre de la materia prima"
                      value={newMissingIngredient.name}
                      onChange={(e) => handleMissingIngredientChange("name", e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder="Cantidad"
                      value={newMissingIngredient.required}
                      onChange={(e) => handleMissingIngredientChange("required", e.target.value)}
                    />
                  </div>
                  <div>
                    <Select 
                      value={newMissingIngredient.unit} 
                      onValueChange={(value) => handleMissingIngredientChange("unit", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="L">L</SelectItem>
                        <SelectItem value="ml">ml</SelectItem>
                        <SelectItem value="unidades">unidades</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddMissingIngredient}
                  disabled={!newMissingIngredient.name.trim() || !newMissingIngredient.required.trim()}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Materia Prima Faltante
                </Button>

                {/* Lista de ingredientes faltantes agregados */}
                {missingIngredients.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm text-red-700">Materias primas faltantes agregadas:</h5>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {missingIngredients.map((ingredient, index) => (
                        <div key={`${ingredient.name}-${ingredient.required}-${index}`} className="flex items-center justify-between p-2 bg-white border border-red-200 rounded">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium">{ingredient.name}</span>
                            <span className="text-sm text-gray-600">
                              {ingredient.required} {ingredient.unit}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveMissingIngredient(index)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className={`p-4 rounded-lg border ${newFormula.type === 'uso_interno' ? 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800' : 'bg-muted border-transparent'}`}>
              <h4 className="font-semibold text-sm mb-1">Destino:</h4>
              {newFormula.type === 'uso_interno' ? (
                <div className="flex items-start gap-2">
                  <span className="text-lg">🏭</span>
                  <div>
                    <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Uso Interno — Queda en Planta Varela</p>
                    <p className="text-xs text-orange-600 dark:text-orange-300 mt-0.5">Este producto <strong>no se suma al viaje</strong> a Villa Martelli. Se registra en estadísticas de producción.</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  📦 Villa Martelli (automático)
                </p>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLoadModalOpen(false)}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={isSubmittingFormula}
                className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingFormula ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                    Cargando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Cargar Producto
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal para agregar ingrediente faltante */}
      <Dialog open={isAddIngredientModalOpen} onOpenChange={setIsAddIngredientModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Package className="h-5 w-5" />
              Agregar Materia Prima Faltante
            </DialogTitle>
          </DialogHeader>
          
          {selectedFormulaForIngredient && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Producto: {selectedFormulaForIngredient.name}</p>
                <p className="text-xs text-muted-foreground">Lote: {selectedFormulaForIngredient.id}</p>
              </div>
              
              <form onSubmit={handleSubmitIngredient} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ingredient-name">Nombre de la Materia Prima</Label>
                  <Input
                    id="ingredient-name"
                    value={newIngredient.name}
                    onChange={(e) => setNewIngredient(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Aceite de Rosa Búlgara"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ingredient-required">Cantidad Faltante</Label>
                    <Input
                      id="ingredient-required"
                      type="number"
                      step="0.1"
                      value={newIngredient.required}
                      onChange={(e) => setNewIngredient(prev => ({ ...prev, required: e.target.value }))}
                      placeholder="5.2"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ingredient-unit">Unidad</Label>
                    <Select 
                      value={newIngredient.unit} 
                      onValueChange={(value) => setNewIngredient(prev => ({ ...prev, unit: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Unidad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="L">L</SelectItem>
                        <SelectItem value="ml">ml</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddIngredientModalOpen(false)}
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isAddingIngredient}
                    className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto order-1 sm:order-2"
                  >
                    {isAddingIngredient ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Agregando...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar Materia Prima
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de eliminación */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-red-600">
              <AlertCircle className="h-6 w-6" />
              Confirmar Eliminación
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-foreground">¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer y el stock se perderá permanentemente.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFormula}
            >
              Eliminar Permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};