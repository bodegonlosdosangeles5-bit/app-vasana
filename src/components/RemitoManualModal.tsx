import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Printer, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VistaPreviaRemitoManual, ManualRemitoItem } from "./VistaPreviaRemitoManual";
import { useAuth } from "@/components/Auth/AuthProvider";
import { ActivityLogService } from "@/services/activityLogService";

interface RemitoManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RemitoManualModal: React.FC<RemitoManualModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<ManualRemitoItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showPrintTemplate, setShowPrintTemplate] = useState(false);
  const [headerLines, setHeaderLines] = useState({
    linea1: 'VASANA SA',
    linea2: 'TALCAHUANO 279',
    linea3: 'VILLA MARTELLI'
  });

  useEffect(() => {
    if (isOpen) {
      setItems([]);
      setShowPrintTemplate(false);
      setIsSaving(false);
    }
  }, [isOpen]);

  const handleAddRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        lote: '',
        nombre_producto: '',
        cliente_o_stock: '',
        kilos_sumados: 0
      }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setItems((prev) => prev.filter(item => item.id !== id));
  };

  const handleChange = (id: string, field: keyof ManualRemitoItem, value: any) => {
    setItems((prev) => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handlePrint = () => {
    if (items.length === 0) {
      toast.error("Debe agregar al menos una fila para imprimir.");
      return;
    }
    const hasEmptyProduct = items.some(item => !item.nombre_producto.trim());
    if (hasEmptyProduct) {
      toast.error("El nombre del producto no puede estar vacío.");
      return;
    }
    setShowPrintTemplate(true);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error("Debe agregar al menos una fila para guardar.");
      return;
    }
    const hasEmptyProduct = items.some(item => !item.nombre_producto.trim());
    if (hasEmptyProduct) {
      toast.error("El nombre del producto no puede estar vacío.");
      return;
    }

    setIsSaving(true);
    try {
      const remitoId = `REM-MAN-${Date.now()}`;
      
      const [day, month, year] = new Date().toLocaleDateString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: '2-digit', month: '2-digit', year: 'numeric'
      }).split('/');
      const isoDate = `${year}-${month}-${day}`; 

      const totalKilos = items.reduce((acc, item) => acc + (Number(item.kilos_sumados) || 0), 0);

      const { error: remitoError } = await supabase.from('remitos').insert({
        id: remitoId,
        destino: 'Villa Martelli',
        fecha: isoDate,
        total_kilos: totalKilos,
        estado: 'abierto',
        observaciones: 'Remito Manual'
      });

      if (remitoError) throw remitoError;

      // Usar '00000000-0000-0000-0000-000000000000' en caso sea necesario UUID, sino crypto.randomUUID()
      const itemsToInsert = items.map((item, index) => ({
        id: `${remitoId}-${index + 1}`,
        remito_id: remitoId,
        producto_id: crypto.randomUUID(), 
        nombre_producto: item.nombre_producto,
        kilos_sumados: Number(item.kilos_sumados) || 0,
        cantidad_lotes: 1,
        lote: item.lote,
        cliente_o_stock: item.cliente_o_stock || 'STOCK',
        notas: 'Carga Manual'
      }));

      const { error: itemsError } = await supabase.from('remito_items').insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success("Remito manual guardado correctamente.");
      
      await ActivityLogService.log({
        user_name: user?.user_name || 'desconocido',
        user_role: user?.role || 'admin',
        accion: 'Generó remito manual',
        entidad: 'Remitos Manuales',
        descripcion: `Guardó remito manual ${remitoId} con ${items.length} productos y ${totalKilos}kg totales`,
        color_tag: 'green'
      });

      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(`Error al guardar: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl bg-background border-border text-foreground">
        <DialogHeader>
          <DialogTitle>Remito Manual</DialogTitle>
          <DialogDescription>Cargue las filas manualmente para imprimir y guardar.</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Encabezado del remito */}
          <div className="border border-border rounded-lg p-3 bg-muted/30 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Encabezado del remito</p>
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Línea 1 (ej: VASANA SA)"
                value={headerLines.linea1}
                onChange={(e) => setHeaderLines(prev => ({ ...prev, linea1: e.target.value }))}
                className="text-sm h-8"
              />
              <Input
                placeholder="Línea 2 (ej: TALCAHUANO 279)"
                value={headerLines.linea2}
                onChange={(e) => setHeaderLines(prev => ({ ...prev, linea2: e.target.value }))}
                className="text-sm h-8"
              />
              <Input
                placeholder="Línea 3 (ej: VILLA MARTELLI)"
                value={headerLines.linea3}
                onChange={(e) => setHeaderLines(prev => ({ ...prev, linea3: e.target.value }))}
                className="text-sm h-8"
              />
            </div>
          </div>

          {/* Tabla de items */}
          {items.map((item, index) => (
            <div key={item.id} className="flex gap-2 items-center">
              <span className="text-sm text-muted-foreground w-6 text-center">{index + 1}</span>
              <Input
                placeholder="Lote"
                value={item.lote}
                onChange={(e) => handleChange(item.id, 'lote', e.target.value)}
                className="w-1/4"
              />
              <Input
                placeholder="Producto"
                value={item.nombre_producto}
                onChange={(e) => handleChange(item.id, 'nombre_producto', e.target.value)}
                className="w-1/3"
              />
              <Input
                placeholder="Cliente / Destino"
                value={item.cliente_o_stock}
                onChange={(e) => handleChange(item.id, 'cliente_o_stock', e.target.value)}
                className="w-1/4"
              />
              <Input
                type="number"
                placeholder="Kilos"
                value={item.kilos_sumados === 0 ? '' : item.kilos_sumados}
                onChange={(e) => handleChange(item.id, 'kilos_sumados', parseFloat(e.target.value) || 0)}
                className="w-24 text-right"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveRow(item.id)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={handleAddRow} className="w-full border-dashed border-2 text-muted-foreground hover:text-foreground">
            <Plus className="h-4 w-4 mr-2" />
            Agregar fila
          </Button>
        </div>

        <DialogFooter className="mt-4 sm:justify-between items-center">
           <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancelar</Button>
           <div className="flex gap-2">
              <Button onClick={handlePrint} variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir A4
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Guardando..." : "Guardar en Supabase"}
              </Button>
           </div>
        </DialogFooter>
      </DialogContent>
      {showPrintTemplate && <VistaPreviaRemitoManual items={items} isOpen={showPrintTemplate} headerLines={headerLines} />}
    </Dialog>
  );
};
