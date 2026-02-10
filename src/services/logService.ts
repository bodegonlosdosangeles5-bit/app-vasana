import { supabase } from '@/integrations/supabase/client';

export interface ActivityLog {
  id?: string;
  action: string;
  detail: string;
  user_name: string;
  user_email?: string;
  product_id?: string;
  created_at?: string;
}

export class LogService {
  static async saveLog(log: Omit<ActivityLog, 'id' | 'created_at'>): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('activity_logs' as any) as any).insert([{
        action: log.action,
        detail: log.detail,
        user_name: log.user_name,
        user_email: log.user_email,
        product_id: log.product_id
      }]);

      if (error) {
        console.error('Error saving activity log:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Exception in saveLog:', error);
      return false;
    }
  }

  static async getRecentLogs(limit: number = 5): Promise<ActivityLog[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('activity_logs' as any) as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching activity logs:', error);
        return [];
      }
      return (data as ActivityLog[]) || [];
    } catch (error) {
      console.error('Exception in getRecentLogs:', error);
      return [];
    }
  }
}
