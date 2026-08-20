import { supabase } from '@/integrations/supabase/client';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  location: string;
  supplier?: string;
  lastUpdate: string;
  status: 'normal' | 'low' | 'critical';
  certificate: string;
  rack: string;
  place: string;
  level: string;
  observaciones?: string;
}

function mapInventoryItem(item: any): InventoryItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    currentStock: item.current_stock,
    minStock: item.min_stock,
    maxStock: item.max_stock,
    unit: item.unit,
    location: item.location,
    supplier: item.supplier || undefined,
    lastUpdate: item.last_update,
    status: item.status as 'normal' | 'low' | 'critical',
    certificate: item.certificate,
    rack: item.rack,
    place: item.place,
    level: item.level,
    observaciones: item.observaciones || undefined,
  };
}

export class InventoryService {
  // Obtener una página de materias primas, ordenadas alfabéticamente y filtradas en el servidor
  static async getInventoryItemsPage(params: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<{ items: InventoryItem[]; total: number }> {
    const { page, pageSize, search } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('inventory_items')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .range(from, to);

    const term = search?.trim().replace(/[,()%]/g, '');
    if (term) {
      query = query.or(`name.ilike.%${term}%,certificate.ilike.%${term}%,location.ilike.%${term}%`);
    }

    const { data: items, error, count } = await query;
    if (error) throw error;

    return {
      items: (items || []).map(mapInventoryItem),
      total: count || 0,
    };
  }

  // Obtener todas las materias primas
  static async getInventoryItems(): Promise<InventoryItem[]> {
    try {
      const { data: items, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!items || items.length === 0) {
        return [];
      }

      return items.map(mapInventoryItem);
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      return [];
    }
  }

  // Crear una nueva materia prima
  static async createInventoryItem(item: Omit<InventoryItem, 'id' | 'lastUpdate' | 'status'>): Promise<InventoryItem | null> {
    try {
      console.log('🔧 Creando materia prima con datos:', item);
      
      // Validar datos requeridos
      if (!item.name || !item.certificate || !item.rack || !item.place || !item.level) {
        throw new Error('Faltan campos requeridos');
      }
      
      if (item.currentStock <= 0 || item.minStock <= 0 || item.maxStock <= 0) {
        throw new Error('Los valores de stock deben ser mayores a 0');
      }
      
      // Generar ID único
      const id = `MP${Date.now()}`;
      console.log('🆔 ID usado:', id);
      
      // Determinar el estado basado en el stock
      let status: 'normal' | 'low' | 'critical' = 'normal';
      if (item.currentStock <= item.minStock * 0.5) {
        status = 'critical';
      } else if (item.currentStock <= item.minStock) {
        status = 'low';
      }

      const { data, error } = await supabase
        .from('inventory_items')
        .insert({
          id: id,
          name: item.name,
          category: item.category,
          current_stock: item.currentStock,
          min_stock: item.minStock,
          max_stock: item.maxStock,
          unit: item.unit,
          location: item.location,
          supplier: item.supplier || null,
          last_update: new Date().toISOString().split('T')[0],
          status: status,
          certificate: item.certificate,
          rack: item.rack,
          place: item.place,
          level: item.level,
        })
        .select()
        .single();

      console.log('📊 Respuesta de Supabase:', { data, error });

      if (error) {
        console.error('❌ Error de Supabase:', error);
        throw new Error(`Error de base de datos: ${error.message}`);
      }

      if (!data) {
        throw new Error('No se recibieron datos de la base de datos');
      }

      const result = {
        ...item,
        id: id,
        lastUpdate: new Date().toISOString().split('T')[0],
        status: status
      };
      
      console.log('✅ Materia prima creada exitosamente:', result);
      return result;
    } catch (error) {
      console.error('❌ Error creating inventory item:', error);
      throw error; // Re-lanzar el error para que se maneje en el componente
    }
  }

  // Actualizar una materia prima
  static async updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem | null> {
    try {
      // Determinar el estado basado en el stock si se actualiza
      let status = updates.status;
      if (updates.currentStock !== undefined && updates.minStock !== undefined) {
        if (updates.currentStock <= updates.minStock * 0.5) {
          status = 'critical';
        } else if (updates.currentStock <= updates.minStock) {
          status = 'low';
        } else {
          status = 'normal';
        }
      }

      const { data, error } = await supabase
        .from('inventory_items')
        .update({
          name: updates.name,
          category: updates.category,
          current_stock: updates.currentStock,
          min_stock: updates.minStock,
          max_stock: updates.maxStock,
          unit: updates.unit,
          location: updates.location,
          supplier: updates.supplier || null,
          last_update: new Date().toISOString().split('T')[0],
          status: status,
          certificate: updates.certificate,
          rack: updates.rack,
          place: updates.place,
          level: updates.level,
          observaciones: updates.observaciones || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        ...updates,
        id: id,
        lastUpdate: new Date().toISOString().split('T')[0],
        status: status || 'normal'
      } as InventoryItem;
    } catch (error) {
      console.error('Error updating inventory item:', error);
      return null;
    }
  }

  // Eliminar una materia prima
  static async deleteInventoryItem(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      return false;
    }
  }
}
