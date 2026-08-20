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
      const { error } = await (supabase as any).from('activity_log').insert({
        user_name: params.user_name,
        user_role: params.user_role,
        accion: params.accion,
        entidad: params.entidad,
        descripcion: params.descripcion,
        color_tag: params.color_tag,
      });
      
      if (error) {
        console.error('Supabase error inserting activity log:', error);
      }
    } catch (error) {
      // El log nunca debe interrumpir el flujo principal
      console.error('Error registrando actividad (catch):', error);
    }
  }

  static async getLogs(
    userRole: string,
    filters?: {
      desde?: string;
      hasta?: string;
      entidad?: string;
      color_tag?: ColorTag;
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ logs: ActivityLogEntry[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (filters?.desde)      params.append('desde', filters.desde);
      if (filters?.hasta)      params.append('hasta', filters.hasta);
      if (filters?.entidad && filters.entidad !== 'todas')
                               params.append('entidad', filters.entidad);
      if (filters?.color_tag)  params.append('color_tag', filters.color_tag);
      params.append('page', String(filters?.page ?? 1));
      params.append('pageSize', String(filters?.pageSize ?? 20));

      const response = await fetch(`/api/activity-log?${params.toString()}`, {
        headers: { 'x-user-role': userRole },
      });

      if (!response.ok) return { logs: [], total: 0 };
      const result = await response.json();
      return { logs: (result.logs ?? []) as ActivityLogEntry[], total: result.total ?? 0 };
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      return { logs: [], total: 0 };
    }
  }
}
