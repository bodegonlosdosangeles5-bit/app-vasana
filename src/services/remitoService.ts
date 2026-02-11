import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

export interface Remito {
  id: string;
  destino: string;
  fecha: string;
  total_kilos: number;
  estado: 'abierto' | 'cerrado';
  observaciones?: string;
  created_at: string;
  updated_at: string;
}

export interface RemitoItem {
  id: string;
  remito_id: string;
  producto_id: string;
  nombre_producto: string;
  kilos_sumados: number;
  cantidad_lotes: number;
  lote?: string;
  cliente_o_stock?: string;
  notas?: string;
  created_at: string;
  updated_at: string;
}

export interface RemitoWithItems extends Remito {
  items: RemitoItem[];
}

export interface ProductionItem {
  id: string;
  lote_code?: string;
  name: string;
  batchSize: number;
  stock_actual?: number;
  destination: string;
  status: 'available' | 'incomplete' | 'procesado' | string; // Permitir otros status
  date?: string;
  type: 'stock' | 'client' | string; // Permitir otros tipos
  clientName?: string;
}

export class RemitoService {

  // Obtener remito con items
  static async getRemitoWithItems(remitoId: string): Promise<RemitoWithItems | null> {
    try {
      // Obtener datos del remito
      const { data: remito, error: remitoError } = await supabase
        .from('remitos')
        .select('*')
        .eq('id', remitoId)
        .single();

      if (remitoError) throw remitoError;
      if (!remito) return null;

      // Obtener items del remito
      const { data: items, error: itemsError } = await supabase
        .from('remito_items')
        .select('*')
        .eq('remito_id', remitoId)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      return {
        ...remito,
        estado: remito.estado as 'abierto' | 'cerrado',
        items: items || []
      } as RemitoWithItems;
    } catch (error) {
      console.error('Error obteniendo remito con items:', error);
      return null;
    }
  }

  // Generar o actualizar remito del día para Villa Martelli
  static async generateRemitoForVillaMartelli(productionItems: ProductionItem[]): Promise<RemitoWithItems | null> {
    try {
      console.log('🔄 Generando remito para Villa Martelli usando método atómico...');
      
      // Filtrar items de Villa Martelli que estén terminados
      const villaMartelliItems = productionItems.filter(item => {
        const normalizedStatus = item.status.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
        const normalizedDestination = item.destination.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
        
        const isTerminated = ['terminado', 'finalizado', 'completo', 'available'].includes(normalizedStatus);
        const isVillaMartelli = normalizedDestination === 'villamartelli';
        const hasStock = (item.stock_actual !== undefined ? item.stock_actual : item.batchSize) > 0;
        
        return isTerminated && isVillaMartelli && hasStock;
      });

      if (villaMartelliItems.length === 0) {
        console.log('⚠️ No hay items de Villa Martelli para generar remito');
        return null;
      }

      // Preparar items para el RPC
      const itemsForRpc = villaMartelliItems.map(item => ({
        producto_id: item.id,
        nombre: item.name,
        // El usuario dice "Si la cantidad enviada iguala al stock disponible...". 
        // Asumimos que enviamos todo el lote disponible.
        // Pero item.batchSize es la producción original. Deberíamos enviar item.stock_actual.
        // Sin embargo, la UI actual parece enviar batchSize.
        // Vamos a enviar batchSize, pero el RPC hace GREATEST(0, stock - qty).
        // Mejor enviar el stock actual si es menor al batchSize original (caso parcial).
        // Pero productionItems podrían tener stock_actual indefinido si son legacy.
        cantidad: item.stock_actual !== undefined ? item.stock_actual : item.batchSize,
        lote: item.lote_code || item.id,
        tipo: item.type,
        cliente: item.type === 'client' ? item.clientName : 'Stock'
      }));

      const totalKilos = itemsForRpc.reduce((sum, item) => sum + (item.cantidad || 0), 0);

      // Llamar al RPC transaccional
      const { data, error } = await (supabase.rpc as any)('procesar_envio_remito', {
        p_destino: 'Villa Martelli',
        p_fecha: new Date().toISOString(),
        p_items: itemsForRpc
      });

      if (error) {
        console.error('❌ Error en RPC procesar_envio_remito:', error);
        throw error;
      }

      console.log('✅ Remito generado exitosamente vía RPC:', data);

      // Obtener el remito creado
      const rpcResult = data as { success: boolean, remito_id: string };
      if (rpcResult && rpcResult.remito_id) {
        return await this.getRemitoById(rpcResult.remito_id);
      }
      
      return null;

    } catch (error) {
      console.error('❌ Error generando remito:', error);
      return null;
    }
  }

  // Fallback: generar remito usando operaciones individuales
  private static async generateRemitoFallback(productionItems: ProductionItem[], remitoItems: Array<{
    producto_id: string;
    nombre_producto: string;
    kilos_sumados: number;
    cantidad_lotes: number;
    lote: string;
    cliente_o_stock: string;
    items: ProductionItem[];
    notas: string | null;
  }>, totalKilos: number): Promise<RemitoWithItems | null> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const remitoId = `REM-${Date.now()}`;

      // 1. Buscar remito abierto existente para hoy
      const { data: existingRemito } = await supabase
        .from('remitos')
        .select('*')
        .eq('destino', 'Villa Martelli')
        .eq('fecha', today)
        .eq('estado', 'abierto')
        .single();

      let remito: Remito;
      
      if (existingRemito) {
        // Actualizar remito existente
        const { data: updatedRemito, error: updateError } = await supabase
          .from('remitos')
          .update({
            total_kilos: totalKilos,
            observaciones: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRemito.id)
          .select()
          .single();

        if (updateError) throw updateError;
        remito = {
          ...updatedRemito,
          estado: updatedRemito.estado as 'abierto' | 'cerrado'
        } as Remito;

        // Eliminar items existentes
        await supabase
          .from('remito_items')
          .delete()
          .eq('remito_id', existingRemito.id);
      } else {
        // Crear nuevo remito
        const { data: newRemito, error: createError } = await supabase
          .from('remitos')
          .insert({
            id: remitoId,
            destino: 'Villa Martelli',
            fecha: today,
            total_kilos: totalKilos,
            estado: 'abierto',
            observaciones: null
          })
          .select()
          .single();

        if (createError) throw createError;
        remito = {
          ...newRemito,
          estado: newRemito.estado as 'abierto' | 'cerrado'
        } as Remito;
      }

      // 2. Insertar items del remito
      const itemsToInsert = remitoItems.map((item, index) => ({
        id: `${remito.id}-${index + 1}`,
        remito_id: remito.id,
        producto_id: item.producto_id,
        nombre_producto: item.nombre_producto,
        kilos_sumados: item.kilos_sumados,
        cantidad_lotes: item.cantidad_lotes,
        lote: item.lote, // Lote individual
        cliente_o_stock: item.cliente_o_stock, // Cliente/Stock individual
        notas: `Generado desde ${item.items.length} lotes`
      }));

      const { error: itemsError } = await supabase
        .from('remito_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // 3. Obtener remito completo con items
      const remitoCompleto = await this.getRemitoById(remito.id);
      
      // Reiniciar la producción actual: cambiar status de las fórmulas incluidas
      if (remitoCompleto) {
        console.log('🔄 Iniciando reinicio de producción (fallback) después de crear remito...');
        console.log('📋 Items de producción a procesar:', productionItems.length);
        await this.resetProductionAfterRemito(productionItems);
        console.log('✅ Reinicio de producción (fallback) completado');
        
        // Crear automáticamente un envío con el remito generado
        console.log('🚚 Creando envío automático para el remito (fallback)...');
        await this.createAutoEnvioForRemito(remitoCompleto.id);
        console.log('✅ Envío automático creado (fallback)');
      } else {
        console.error('❌ No se pudo obtener el remito completo (fallback), no se reiniciará la producción');
      }
      
      return remitoCompleto;

    } catch (error) {
      console.error('❌ Error en fallback:', error);
      return null;
    }
  }

  // Eliminar productos de la producción después de crear un remito
  // DEPRECATED: Ya no eliminamos productos, solo se actualiza su stock a 0.
  // Mantenemos la función para compatibilidad pero no hace nada.
  private static async resetProductionAfterRemito(productionItems: ProductionItem[]): Promise<void> {
    console.log('ℹ️ resetProductionAfterRemito llamado - No se realizará ninguna acción de eliminación (Legacy)');
    return;
  }

  // Obtener remito por ID con sus items
  static async getRemitoById(remitoId: string): Promise<RemitoWithItems | null> {
    try {
      const { data: remito, error: remitoError } = await supabase
        .from('remitos')
        .select('*')
        .eq('id', remitoId)
        .single();

      if (remitoError) throw remitoError;

      const { data: items, error: itemsError } = await supabase
        .from('remito_items')
        .select('*')
        .eq('remito_id', remitoId)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      return {
        ...remito,
        estado: remito.estado as 'abierto' | 'cerrado',
        items: items || []
      } as RemitoWithItems;
    } catch (error) {
      console.error('❌ Error obteniendo remito:', error);
      return null;
    }
  }

  // Obtener remito abierto del día para Villa Martelli
  static async getOpenRemitoForToday(): Promise<RemitoWithItems | null> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: remito, error: remitoError } = await supabase
        .from('remitos')
        .select('*')
        .eq('destino', 'Villa Martelli')
        .eq('fecha', today)
        .eq('estado', 'abierto')
        .maybeSingle();

      if (remitoError && remitoError.code !== 'PGRST116') {
        console.error('❌ Error obteniendo remito abierto:', remitoError);
        // Si es un error 406, puede ser un problema de formato de fecha
        if (remitoError.message?.includes('406')) {
          console.log('⚠️ Error 406 detectado, verificando formato de fecha...');
          console.log('📅 Fecha utilizada:', today);
        }
        throw remitoError;
      }

      if (!remito) return null;

      const { data: items, error: itemsError } = await supabase
        .from('remito_items')
        .select('*')
        .eq('remito_id', remito.id)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      return {
        ...remito,
        estado: remito.estado as 'abierto' | 'cerrado',
        items: items || []
      } as RemitoWithItems;
    } catch (error) {
      console.error('❌ Error obteniendo remito abierto:', error);
      return null;
    }
  }

  // Cerrar remito
  static async closeRemito(remitoId: string): Promise<boolean> {
    try {
      console.log('🔄 Cerrando remito en servicio:', remitoId);
      
      // Validar que el ID existe
      if (!remitoId || remitoId.trim() === '') {
        console.error('❌ ID de remito inválido en servicio:', remitoId);
        return false;
      }
      
      // Verificar que el remito existe antes de cerrarlo
      const { data: existingRemito, error: checkError } = await supabase
        .from('remitos')
        .select('id, estado')
        .eq('id', remitoId)
        .single();

      if (checkError) {
        console.error('❌ Error verificando remito:', checkError);
        return false;
      }

      if (!existingRemito) {
        console.error('❌ Remito no encontrado:', remitoId);
        return false;
      }

      if (existingRemito.estado === 'cerrado') {
        console.log('⚠️ El remito ya está cerrado');
        return true; // Considerar como éxito si ya está cerrado
      }
      
      const { data, error } = await supabase
        .from('remitos')
        .update({
          estado: 'cerrado',
          updated_at: new Date().toISOString()
        })
        .eq('id', remitoId)
        .select();

      if (error) {
        console.error('❌ Error de Supabase al cerrar remito:', error);
        return false;
      }

      if (!data || data.length === 0) {
        console.error('❌ No se actualizó ningún registro');
        return false;
      }
      
      console.log('✅ Remito cerrado exitosamente en servicio:', data[0]);
      return true;
    } catch (error) {
      console.error('❌ Error cerrando remito:', error);
      return false;
    }
  }

  // Actualizar remito (solo para administradores)
  static async updateRemito(
    remitoId: string, 
    updates: { total_kilos?: number; observaciones?: string }
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔄 Actualizando remito:', remitoId, updates);

      // Validar que el ID existe
      if (!remitoId || remitoId.trim() === '') {
        return { success: false, message: 'ID de remito inválido' };
      }

      // Obtener el remito actual para comparar
      const { data: currentRemito, error: fetchError } = await supabase
        .from('remitos')
        .select('*')
        .eq('id', remitoId)
        .single();

      if (fetchError || !currentRemito) {
        console.error('❌ Error obteniendo remito:', fetchError);
        return { success: false, message: 'Remito no encontrado' };
      }

      // Preparar datos de actualización
      const updateData: Partial<Database['public']['Tables']['remitos']['Update']> = {
        updated_at: new Date().toISOString()
      };

      if (updates.total_kilos !== undefined) {
        updateData.total_kilos = updates.total_kilos;
      }

      if (updates.observaciones !== undefined) {
        updateData.observaciones = updates.observaciones;
      }

      // Actualizar el remito
      const { data, error } = await supabase
        .from('remitos')
        .update(updateData)
        .eq('id', remitoId)
        .select();

      if (error) {
        console.error('❌ Error actualizando remito:', error);
        return { success: false, message: 'Error al actualizar el remito' };
      }

      if (!data || data.length === 0) {
        return { success: false, message: 'No se actualizó ningún registro' };
      }

      console.log('✅ Remito actualizado exitosamente:', data[0]);
      
      // Las métricas se recalcularán automáticamente porque usan las funciones SQL
      // que consultan directamente la tabla remitos
      
      return { 
        success: true, 
        message: 'Remito actualizado correctamente. Las métricas se ajustarán automáticamente.' 
      };
    } catch (error) {
      console.error('❌ Error actualizando remito:', error);
      return { success: false, message: 'Error inesperado al actualizar' };
    }
  }

  // Obtener todos los remitos con sus items
  static async getAllRemitos(): Promise<RemitoWithItems[]> {
    try {
      const { data: remitos, error: remitosError } = await supabase
        .from('remitos')
        .select('*')
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });

      if (remitosError) throw remitosError;

      if (!remitos || remitos.length === 0) return [];

      // Obtener items para cada remito
      const remitosWithItems = await Promise.all(
        remitos.map(async (remito) => {
          const { data: items } = await supabase
            .from('remito_items')
            .select('*')
            .eq('remito_id', remito.id)
            .order('created_at', { ascending: true });

          return {
            ...remito,
            estado: remito.estado as 'abierto' | 'cerrado',
            items: items || []
          } as RemitoWithItems;
        })
      );

      return remitosWithItems;
    } catch (error) {
      console.error('❌ Error obteniendo remitos:', error);
      return [];
    }
  }

  // Crear automáticamente un envío con un remito específico
  private static async createAutoEnvioForRemito(remitoId: string): Promise<void> {
    try {
      // Importar el servicio de envíos dinámicamente para evitar dependencias circulares
      const { EnvioService } = await import('./envioService');
      
      // Crear envío automático con destino Villa Martelli
      const envio = await EnvioService.crearEnvioConRemitoEspecifico(
        remitoId,
        'Villa Martelli',
        'Envío automático generado con el remito'
      );

      if (envio) {
        // Actualizar el envío a estado "entregado" inmediatamente
        const { error } = await supabase
          .from('envios')
          .update({ 
            estado: 'entregado',
            fecha_envio: new Date().toISOString()
          })
          .eq('id', envio.id);

        if (error) {
          console.error('❌ Error actualizando estado del envío automático:', error);
        } else {
          console.log('✅ Envío automático creado y marcado como entregado');
        }
      } else {
        console.error('❌ No se pudo crear el envío automático');
      }
    } catch (error) {
      console.error('❌ Error creando envío automático:', error);
    }
  }
}
