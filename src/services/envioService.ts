import { supabase } from '@/integrations/supabase/client';

export interface Envio {
  id: string;
  numero_envio: string;
  fecha_creacion: string | null;
  fecha_envio?: string | null;
  destino: string;
  estado: string;
  observaciones?: string | null;
  total_kilos: number | null;
  total_remitos: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface EnvioRemito {
  id: string;
  envio_id: string;
  remito_id: string;
  created_at: string;
}

export interface EnvioConRemitos extends Envio {
  remitos: Array<{
    id: string;
    destino: string;
    fecha: string;
    total_kilos: number;
    estado: string;
    observaciones?: string;
    items: Array<{
      id: string;
      producto_id: string;
      nombre_producto: string;
      kilos_sumados: number;
      cantidad_lotes: number;
      lote?: string;
      cliente_o_stock?: string;
      notas?: string;
    }>;
  }>;
}

export class EnvioService {
  // Obtener todos los envíos
  static async getEnvios(): Promise<Envio[]> {
    try {
      const { data: envios, error } = await supabase
        .from('envios')
        .select('*')
        .order('fecha_creacion', { ascending: false });

      if (error) throw error;
      return envios || [];
    } catch (error) {
      console.error('Error obteniendo envíos:', error);
      return [];
    }
  }

  // Obtener envío con remitos asociados
  static async getEnvioConRemitos(envioId: string): Promise<EnvioConRemitos | null> {
    try {
      // Obtener datos del envío
      const { data: envio, error: envioError } = await supabase
        .from('envios')
        .select('*')
        .eq('id', envioId)
        .single();

      if (envioError) throw envioError;
      if (!envio) return null;

      // Obtener remitos asociados
      const { data: enviosRemitos, error: enviosRemitosError } = await supabase
        .from('envios_remitos')
        .select(`
          remito_id,
          remitos (
            id,
            destino,
            fecha,
            total_kilos,
            estado,
            observaciones,
            remito_items (
              id,
              producto_id,
              nombre_producto,
              kilos_sumados,
              cantidad_lotes,
              lote,
              cliente_o_stock,
              notas
            )
          )
        `)
        .eq('envio_id', envioId);

      if (enviosRemitosError) throw enviosRemitosError;

      // Formatear los datos
      const remitos = (enviosRemitos || []).map((er: unknown) => {
        const item = er as { remitos: { id: string, destino: string, fecha: string, total_kilos: number, estado: string, observaciones: string | null, remito_items: unknown[] } };
        return {
          id: item.remitos.id,
          destino: item.remitos.destino,
          fecha: item.remitos.fecha,
          total_kilos: item.remitos.total_kilos,
          estado: item.remitos.estado,
          observaciones: item.remitos.observaciones,
          items: item.remitos.remito_items || []
        };
      });

      return {
        ...envio,
        remitos: remitos as EnvioConRemitos['remitos']
      } as EnvioConRemitos;
    } catch (error) {
      console.error('Error obteniendo envío con remitos:', error);
      return null;
    }
  }

  // Obtener remitos pendientes (no asignados a ningún envío)
  static async getRemitosPendientes(): Promise<Array<unknown>> {
    try {
      const { data: remitos, error } = await supabase
        .from('remitos')
        .select(`
          *,
          remito_items (
            id,
            producto_id,
            nombre_producto,
            kilos_sumados,
            cantidad_lotes,
            lote,
            cliente_o_stock,
            notas
          )
        `)
        .eq('estado', 'abierto')
        .order('fecha', { ascending: false });

      if (error) throw error;

      // Filtrar remitos que no están asignados a ningún envío
      const { data: remitosAsignados, error: asignadosError } = await supabase
        .from('envios_remitos')
        .select('remito_id');

      if (asignadosError) throw asignadosError;

      const remitosAsignadosIds = new Set((remitosAsignados || []).map(ra => ra.remito_id));
      
      return (remitos || []).filter(remito => !remitosAsignadosIds.has(remito.id));
    } catch (error) {
      console.error('Error obteniendo remitos pendientes:', error);
      return [];
    }
  }

  // Crear nuevo envío con un remito específico
  static async crearEnvioConRemitoEspecifico(
    remitoId: string,
    destino: string,
    fecha?: string,
    observaciones?: string,
    estado: string = 'pendiente'
  ): Promise<Envio | null> {
    try {
      // Obtener el remito específico
      const { data: remito, error: remitoError } = await supabase
        .from('remitos')
        .select('*')
        .eq('id', remitoId)
        .single();

      if (remitoError) throw remitoError;
      if (!remito) {
        throw new Error('Remito no encontrado');
      }

      // Verificar que el remito no esté ya asignado a un envío
      const { data: remitoAsignado, error: asignadoError } = await supabase
        .from('envios_remitos')
        .select('id')
        .eq('remito_id', remitoId)
        .single();

      if (asignadoError && asignadoError.code !== 'PGRST116') throw asignadoError;
      if (remitoAsignado) {
        throw new Error('El remito ya está asignado a un envío');
      }

      // Generar número de envío
      const numeroEnvio = `ENV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}-${String(Date.now()).slice(-4)}`;

      // Crear el envío
      const { data: nuevoEnvio, error: envioError } = await supabase
        .from('envios')
        .insert({
          numero_envio: numeroEnvio,
          destino,
          fecha_creacion: fecha ? new Date(fecha).toISOString() : new Date().toISOString(),
          observaciones,
          total_kilos: remito.total_kilos,
          total_remitos: 1,
          estado: estado
        })
        .select()
        .single();

      if (envioError) throw envioError;

      // Asociar el remito al envío
      const { error: enviosRemitosError } = await supabase
        .from('envios_remitos')
        .insert({
          envio_id: nuevoEnvio.id,
          remito_id: remitoId
        });

      if (enviosRemitosError) throw enviosRemitosError;

      // Cerrar el remito (cambiar estado a 'cerrado')
      const { error: cerrarRemitoError } = await supabase
        .from('remitos')
        .update({ estado: 'cerrado' })
        .eq('id', remitoId);

      if (cerrarRemitoError) throw cerrarRemitoError;

      console.log(`✅ Envío creado: ${numeroEnvio} con remito ${remitoId}`);
      return nuevoEnvio;
    } catch (error) {
      console.error('Error creando envío con remito específico:', error);
      return null;
    }
  }

  // Crear nuevo envío con remitos pendientes
  static async crearEnvioConRemitosPendientes(
    destino: string,
    observaciones?: string
  ): Promise<Envio | null> {
    try {
      // Obtener remitos pendientes
      const remitosPendientes = await this.getRemitosPendientes() as Array<{ id: string, total_kilos: number }>;
      
      if (remitosPendientes.length === 0) {
        throw new Error('No hay remitos pendientes para crear el envío');
      }

      // Calcular totales
      const totalKilos = remitosPendientes.reduce((sum, remito) => sum + (remito.total_kilos || 0), 0);
      const totalRemitos = remitosPendientes.length;

      // Generar número de envío
      const numeroEnvio = `ENV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}-${String(Date.now()).slice(-4)}`;

      // Crear el envío
      const { data: nuevoEnvio, error: envioError } = await supabase
        .from('envios')
        .insert({
          numero_envio: numeroEnvio,
          destino,
          observaciones,
          total_kilos: totalKilos,
          total_remitos: totalRemitos,
          estado: 'pendiente'
        })
        .select()
        .single();

      if (envioError) throw envioError;

      // Asociar remitos al envío
      const enviosRemitos = remitosPendientes.map(remito => ({
        envio_id: nuevoEnvio.id,
        remito_id: remito.id
      }));

      const { error: enviosRemitosError } = await supabase
        .from('envios_remitos')
        .insert(enviosRemitos);

      if (enviosRemitosError) throw enviosRemitosError;

      // Cerrar los remitos (cambiar estado a 'cerrado')
      const remitoIds = remitosPendientes.map(r => r.id);
      const { error: cerrarRemitosError } = await supabase
        .from('remitos')
        .update({ estado: 'cerrado' })
        .in('id', remitoIds);

      if (cerrarRemitosError) throw cerrarRemitosError;

      console.log(`✅ Envío creado: ${numeroEnvio} con ${totalRemitos} remitos`);
      return nuevoEnvio;
    } catch (error) {
      console.error('Error creando envío:', error);
      return null;
    }
  }


  // Eliminar envío
  static async eliminarEnvio(envioId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('envios')
        .delete()
        .eq('id', envioId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error eliminando envío:', error);
      return false;
    }
  }
}
