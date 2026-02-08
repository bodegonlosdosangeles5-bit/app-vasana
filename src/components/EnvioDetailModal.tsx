import { X, Package, MapPin, Calendar, Clock, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EnvioConRemitos } from '@/services/envioService';
import { RemitoService, RemitoWithItems, RemitoItem } from '@/services/remitoService';
import { useAuth } from '@/components/Auth/AuthProvider';
import { toast } from 'sonner';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EnvioDetailModalProps {
  envio: EnvioConRemitos | null;
  isOpen: boolean;
  onClose: () => void;
  onRemitoUpdated?: () => void; // Callback para refrescar datos
}

export const EnvioDetailModal = ({ 
  envio, 
  isOpen, 
  onClose,
  onRemitoUpdated
}: EnvioDetailModalProps) => {
  const { user } = useAuth();
  const [editingRemito, setEditingRemito] = useState<RemitoWithItems | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedItems, setEditedItems] = useState<RemitoItem[]>([]);
  const [editForm, setEditForm] = useState({ observaciones: '' });
  const [isSaving, setIsSaving] = useState(false);

  if (!envio) return null;

  // Verificar si el usuario es administrador
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const handleEditRemito = (remito: EnvioConRemitos['remitos'][0]) => {
    setEditingRemito(remito as any);
    setEditedItems([...remito.items] as RemitoItem[]); // Cast para compatibilidad de tipos
    setEditForm({
      observaciones: remito.observaciones || ''
    });
    setIsEditModalOpen(true);
  };

  // Actualizar un item específico
  const handleUpdateItem = (index: number, field: keyof RemitoItem, value: any) => {
    const newItems = [...editedItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditedItems(newItems);
  };

  // Eliminar un item
  const handleDeleteItem = (index: number) => {
    const newItems = editedItems.filter((_, i) => i !== index);
    setEditedItems(newItems);
  };

  // Calcular total de kilos
  const calculateTotal = () => {
    return editedItems.reduce((sum, item) => sum + (item.kilos_sumados || 0), 0);
  };

  const handleSaveEdit = async () => {
    if (!editingRemito) return;

    if (editedItems.length === 0) {
      toast.error('El remito debe tener al menos un producto');
      return;
    }

    setIsSaving(true);
    try {
      const totalKilos = calculateTotal();

      // Primero actualizar el remito
      const result = await RemitoService.updateRemito(editingRemito.id, {
        total_kilos: totalKilos,
        observaciones: editForm.observaciones
      });

      if (!result.success) {
        toast.error(result.message);
        setIsSaving(false);
        return;
      }

      // Luego actualizar los items
      // Eliminar todos los items existentes
      const { error: deleteError } = await supabase
        .from('remito_items')
        .delete()
        .eq('remito_id', editingRemito.id);

      if (deleteError) {
        console.error('Error eliminando items:', deleteError);
        toast.error('Error al actualizar los productos');
        setIsSaving(false);
        return;
      }

      // Insertar los items actualizados
      const itemsToInsert = editedItems.map((item, index) => ({
        id: `${editingRemito.id}-${index + 1}`,
        remito_id: editingRemito.id,
        producto_id: item.producto_id,
        nombre_producto: item.nombre_producto,
        kilos_sumados: item.kilos_sumados,
        cantidad_lotes: item.cantidad_lotes,
        lote: item.lote,
        cliente_o_stock: item.cliente_o_stock,
        notas: item.notas
      }));

      const { error: insertError } = await supabase
        .from('remito_items')
        .insert(itemsToInsert);

      if (insertError) {
        console.error('Error insertando items:', insertError);
        toast.error('Error al guardar los productos actualizados');
        setIsSaving(false);
        return;
      }

      toast.success('Remito actualizado correctamente. Las métricas se ajustarán automáticamente.');
      setIsEditModalOpen(false);
      setEditingRemito(null);
      
      // Llamar al callback para refrescar los datos
      if (onRemitoUpdated) {
        onRemitoUpdated();
      }
    } catch (error) {
      console.error('Error actualizando remito:', error);
      toast.error('Error inesperado al actualizar el remito');
    } finally {
      setIsSaving(false);
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'en_transito':
        return 'bg-blue-100 text-blue-800';
      case 'entregado':
        return 'bg-green-100 text-green-800';
      case 'cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEstadoIcon = (estado: string) => {
    return <Clock className="h-4 w-4" />;
  };

  const getEstadoText = (estado: string) => {
    switch (estado) {
      case 'en_transito':
        return 'En Tránsito';
      case 'entregado':
        return 'Entregado';
      case 'cancelado':
        return 'Cancelado';
      default:
        return estado;
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-6 w-6" />
              Envío {envio.numero_envio}
            </DialogTitle>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Información general del envío */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Información del Envío</span>
                {envio.estado !== "pendiente" && (
                  <Badge className={`${getEstadoColor(envio.estado)} flex items-center gap-1`}>
                    {getEstadoIcon(envio.estado)}
                    {getEstadoText(envio.estado)}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Número de Remito</p>
                  <p className="text-lg font-semibold">{envio.numero_envio}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Destino</p>
                  <p className="text-lg font-semibold flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {envio.destino}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Total Kilos</p>
                  <p className="text-lg font-semibold">{envio.total_kilos} kg</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Total Remitos</p>
                  <p className="text-lg font-semibold">{envio.total_remitos}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Fecha de Creación</p>
                  <p className="text-sm flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(envio.fecha_creacion).toLocaleDateString()}
                  </p>
                </div>
                {envio.fecha_envio && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Fecha de Envío</p>
                    <p className="text-sm flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(envio.fecha_envio).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
              {envio.observaciones && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground">Observaciones</p>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-lg">{envio.observaciones}</p>
                </div>
              )}
            </CardContent>
          </Card>


          {/* Lista de remitos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Remitos Asociados ({envio.remitos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {envio.remitos.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No hay remitos asociados a este envío
                </p>
              ) : (
                <div className="space-y-4">
                  {envio.remitos.map((remito) => (
                    <Card key={remito.id} className="border-l-4 border-l-primary">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            Remito {remito.id}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditRemito(remito)}
                                className="gap-2"
                              >
                                <Pencil className="h-3 w-3" />
                                Editar
                              </Button>
                            )}
                            <Badge variant="outline">
                              {remito.total_kilos} kg
                            </Badge>
                            {remito.estado !== "abierto" && (
                              <Badge className={getEstadoColor(remito.estado)}>
                                {getEstadoText(remito.estado)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>Destino: {remito.destino}</p>
                          <p>Fecha: {new Date(remito.fecha).toLocaleDateString()}</p>
                          {remito.observaciones && (
                            <p>Observaciones: {remito.observaciones}</p>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Productos en el Remito:</h4>
                          {remito.items.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No hay productos en este remito</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Producto</TableHead>
                                  <TableHead className="text-xs">Lote</TableHead>
                                  <TableHead className="text-xs">Cliente/Stock</TableHead>
                                  <TableHead className="text-xs">Kilos</TableHead>
                                  <TableHead className="text-xs">Cant. Lotes</TableHead>
                                  <TableHead className="text-xs">Notas</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {remito.items.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell className="text-xs font-medium">
                                      {item.nombre_producto}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {item.lote || '-'}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {item.cliente_o_stock || '-'}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {item.kilos_sumados} kg
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {item.cantidad_lotes}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {item.notas || '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>

      {/* Modal de Edición */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar Remito {editingRemito?.id}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Tabla de Items Editables */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Productos del Remito</Label>
                <div className="text-sm text-muted-foreground">
                  Total: <span className="font-bold text-foreground">{calculateTotal().toFixed(2)} kg</span>
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[250px]">Producto</TableHead>
                      <TableHead className="w-[120px]">Lote</TableHead>
                      <TableHead className="w-[100px]">Kilos</TableHead>
                      <TableHead className="w-[100px]">Cant. Lotes</TableHead>
                      <TableHead className="w-[150px]">Cliente/Stock</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No hay productos en este remito
                        </TableCell>
                      </TableRow>
                    ) : (
                      editedItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {item.nombre_producto}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.lote || ''}
                              onChange={(e) => handleUpdateItem(index, 'lote', e.target.value)}
                              placeholder="Lote"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.kilos_sumados}
                              onChange={(e) => handleUpdateItem(index, 'kilos_sumados', parseFloat(e.target.value) || 0)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.cantidad_lotes}
                              onChange={(e) => handleUpdateItem(index, 'cantidad_lotes', parseInt(e.target.value) || 0)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.cliente_o_stock || ''}
                              onChange={(e) => handleUpdateItem(index, 'cliente_o_stock', e.target.value)}
                              placeholder="Cliente/Stock"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteItem(index)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Observaciones */}
            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={editForm.observaciones}
                onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })}
                placeholder="Notas o comentarios sobre la corrección..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving || editedItems.length === 0}
            >
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
