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
  private static async fetchFromApi(action: string) {
    const userStr = localStorage.getItem('user');
    if (!userStr) throw new Error("Usuario no autenticado");
    const user = JSON.parse(userStr);

    const response = await fetch('/api/get-metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, action })
    });

    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'API Error');

    return result.data;
  }

  /**
   * Obtiene la comparativa de producción entre hoy y ayer
   */
  static async getComparativaHoyAyer(): Promise<ComparativaHoyAyer> {
    try {
      return (await this.fetchFromApi('vista_comparativa_hoy_ayer')) as ComparativaHoyAyer;
    } catch (error) {
      console.error('Error fetching vista_comparativa_hoy_ayer via API:', error);
      return { hoy_total: 0, ayer_total: 0 };
    }
  }

  /**
   * Obtiene el resumen de producción TOTAL desde la vista SQL (Remitos Cerrados + Producción Actual)
   */
  static async getProductionSummaryFromView(): Promise<ProductionViewData[]> {
    try {
      return (await this.fetchFromApi('vista_metricas_produccion_total')) as ProductionViewData[];
    } catch (error) {
      console.error('Error fetching from vista_metricas_produccion_total via API:', error);
      return [];
    }
  }

  /**
   * Obtiene la producción semanal TOTAL (Remitos Cerrados + Producción Actual)
   */
  static async getWeeklyProductionTotal(): Promise<number> {
    try {
      return Number(await this.fetchFromApi('get_weekly_production_total')) || 0;
    } catch (error) {
      console.error('Error fetching weekly production total via API:', error);
      return 0;
    }
  }

  /**
   * Obtiene la producción mensual TOTAL (Remitos Cerrados + Producción Actual)
   */
  static async getMonthlyProductionTotal(): Promise<number> {
    try {
      return Number(await this.fetchFromApi('get_monthly_production_total')) || 0;
    } catch (error) {
      console.error('Error fetching monthly production total via API:', error);
      return 0;
    }
  }

  /**
   * Obtiene los kilos en producción actual (no enviados)
   */
  static async getCurrentProductionKilos(): Promise<number> {
    try {
      return Number(await this.fetchFromApi('get_current_production_kilos')) || 0;
    } catch (error) {
      console.error('Error fetching current production kilos via API:', error);
      return 0;
    }
  }

  /**
   * Obtiene la métrica más reciente
   */
  static async getLatestMetrica(): Promise<MetricaComparativa | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('metricas_comparativas' as any) as any)
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as MetricaComparativa;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('metricas_comparativas' as any) as any)
        .insert({
          weekly_total: metrica.weekly_total,
          monthly_total: metrica.monthly_total,
          target_kilos: metrica.target_kilos,
          period_label: metrica.period_label
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving metrica snapshot:', error);
      return false;
    }
  }
}
