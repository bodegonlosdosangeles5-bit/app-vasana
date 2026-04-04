import { supabase } from '@/integrations/supabase/client';

export type ColorTag = 'green' | 'yellow' | 'red';

export interface ActivityLogEntry {
  id: string;
  user_name: string;
  user_role: string;
  accion: string;
  entidad: string;
  descripcion: string;
  color_tag: ColorTag;
  created_at: string;
}

export interface LogParams {
  user_name: string;
  user_role: string;
  accion: string;
  entidad: string;
  descripcion: string;
  color_tag: ColorTag;
}

export class ActivityLogService {

  static async log(params: LogParams): Promise<void> {
    try {
      await (supabase as any).from('activity_log').insert({
        user_name: params.user_name,
        user_role: params.user_role,
        accion: params.accion,
        entidad: params.entidad,
        descripcion: params.descripcion,
        color_tag: params.color_tag,
      });
    } catch (error) {
      // El log nunca debe interrumpir el flujo principal
      console.error('Error registrando actividad:', error);
    }
  }

  static async getLogs(filters?: {
    desde?: string;
    hasta?: string;
    entidad?: string;
    color_tag?: ColorTag;
  }): Promise<ActivityLogEntry[]> {
    try {
      let query = (supabase as any)
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.desde) {
        query = query.gte('created_at', filters.desde);
      }
      if (filters?.hasta) {
        query = query.lte('created_at', filters.hasta + 'T23:59:59');
      }
      if (filters?.entidad && filters.entidad !== 'todas') {
        query = query.eq('entidad', filters.entidad);
      }
      if (filters?.color_tag && filters.color_tag !== undefined) {
        query = query.eq('color_tag', filters.color_tag);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ActivityLogEntry[];
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      return [];
    }
  }
}
