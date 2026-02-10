import { supabase } from '@/integrations/supabase/client';

export interface TestRecord {
  id: number;
  name: string;
  message: string;
  created_at: string;
}

export class TestService {
  // Obtener todos los registros de prueba
  static async getTestRecords(): Promise<TestRecord[]> {
    try {
      const { data, error } = await supabase
        .from('test_connection')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching test records:', error);
      return [];
    }
  }

  // Crear un nuevo registro de prueba
  static async createTestRecord(name: string, message: string): Promise<TestRecord | null> {
    try {
      const { data, error } = await supabase
        .from('test_connection')
        .insert({ name, message })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating test record:', error);
      return null;
    }
  }

  // Eliminar un registro de prueba
  static async deleteTestRecord(id: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('test_connection')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting test record:', error);
      return false;
    }
  }

  // Probar la conexión
  static async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('test_connection')
        .select('count')
        .limit(1);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}