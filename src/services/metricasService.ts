import { supabase } from '@/integrations/supabase/client';

export interface MetricaComparativa {
  id: string;
  recorded_at: string;
  weekly_total: number;
  monthly_total: number;
  target_kilos: number;
  period_label: string;
  created_by?: string;
}

export interface ProductionViewData {
  fecha_produccion: string;
  total_kg: number;
  total_lotes: number;
  mes_nombre: string;
  semana_del_anio: number;
}

export interface ComparativaHoyAyer {
  hoy_total: number;
  ayer_total: number;
}

export class MetricasService {
  /**
   * Obtiene la comparativa de producción entre hoy y ayer
   */
  static async getComparativaHoyAyer(): Promise<ComparativaHoyAyer> {
    try {
      const { data, error } = await supabase
        .from('vista_comparativa_hoy_ayer' as any)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return (data as any) || { hoy_total: 0, ayer_total: 0 };
    } catch (error) {
      console.error('Error fetching vista_comparativa_hoy_ayer:', error);
      return { hoy_total: 0, ayer_total: 0 };
    }
  }

  /**
   * Obtiene el resumen de producción TOTAL desde la vista SQL (Remitos Cerrados + Producción Actual)
   */
  static async getProductionSummaryFromView(): Promise<ProductionViewData[]> {
    try {
      const { data, error } = await supabase
        .from('vista_metricas_produccion_total' as any)
        .select('*')
        .order('fecha_produccion', { ascending: true });

      if (error) throw error;
      return (data as any) || [];
    } catch (error) {
      console.error('Error fetching from vista_metricas_produccion_total:', error);
      return [];
    }
  }

  /**
   * Obtiene la producción semanal TOTAL (Remitos Cerrados + Producción Actual)
   */
  static async getWeeklyProductionTotal(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('get_weekly_production_total', { target_date: new Date().toISOString() });
      if (error) throw error;
      return Number(data) || 0;
    } catch (error) {
      console.error('Error fetching weekly production total:', error);
      return 0;
    }
  }

  /**
   * Obtiene la producción mensual TOTAL (Remitos Cerrados + Producción Actual)
   */
  static async getMonthlyProductionTotal(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('get_monthly_production_total', { target_date: new Date().toISOString() });
      if (error) throw error;
      return Number(data) || 0;
    } catch (error) {
      console.error('Error fetching monthly production total:', error);
      return 0;
    }
  }

  /**
   * Obtiene los kilos en producción actual (no enviados)
   */
  static async getCurrentProductionKilos(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('get_current_production_kilos');
      if (error) throw error;
      return Number(data) || 0;
    } catch (error) {
      console.error('Error fetching current production kilos:', error);
      return 0;
    }
  }

  /**
   * Obtiene la métrica más reciente
   */
  static async getLatestMetrica(): Promise<MetricaComparativa | null> {
    try {
      const { data, error } = await supabase
        .from('metricas_comparativas' as any)
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as any;
    } catch (error) {
      console.error('Error fetching latest metrica:', error);
      return null;
    }
  }

  /**
   * Registra un snapshot de las métricas actuales
   * Este método puede ser llamado manualmente por un administrador para "cerrar" un periodo
   */
  static async saveMetricaSnapshot(metrica: Omit<MetricaComparativa, 'id' | 'recorded_at'>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('metricas_comparativas' as any)
        .insert({
          weekly_total: metrica.weekly_total,
          monthly_total: metrica.monthly_total,
          target_kilos: metrica.target_kilos,
          period_label: metrica.period_label
        } as any);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving metrica snapshot:', error);
      return false;
    }
  }
}
