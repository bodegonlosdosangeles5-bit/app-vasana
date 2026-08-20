import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { InventoryService, InventoryItem } from '@/services/inventoryService';

interface UseRealtimeInventoryOptions {
  // Si se pasan page + pageSize, la carga se hace paginada del lado del servidor
  // (ordenada alfabéticamente y filtrada por búsqueda). Sin estos parámetros
  // se mantiene el comportamiento original: trae todas las materias primas.
  page?: number;
  pageSize?: number;
  search?: string;
}

export const useRealtimeInventory = (options: UseRealtimeInventoryOptions = {}) => {
  const { page, pageSize, search } = options;
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar materias primas (todas, o la página actual si se pidió paginación)
  const loadInventoryItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (page && pageSize) {
        const { items, total } = await InventoryService.getInventoryItemsPage({ page, pageSize, search });
        setInventoryItems(items);
        setTotalCount(total);
      } else {
        const data = await InventoryService.getInventoryItems();
        setInventoryItems(data);
        setTotalCount(data.length);
      }
    } catch (err) {
      setError('Error al cargar las materias primas');
      console.error('Error cargando materias primas:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  // Cargar materias primas al montar el componente (y cuando cambia página/búsqueda)
  useEffect(() => {
    loadInventoryItems();
  }, [loadInventoryItems]);

  // Configurar Realtime para materias primas
  useEffect(() => {
    const channelId = `inventory_changes_${Math.random().toString(36).substring(7)}`;
    const inventoryChannel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_items'
        },
        (_payload) => {
          // Recargar todas las materias primas cuando hay cambios
          loadInventoryItems();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Suscrito
        } else if (status === 'CHANNEL_ERROR') {
          setError('Error de conexión en tiempo real');
        }
      });

    // Cleanup al desmontar
    return () => {
      // En React Strict Mode, esto puede causar un cierre abrupto del WebSocket si se llama inmediatamente.
      // Un pequeño timeout evita el warning de "WebSocket is closed before the connection is established"
      setTimeout(() => {
        supabase.removeChannel(inventoryChannel);
      }, 500);
    };
  }, [loadInventoryItems]);

  // Funciones CRUD que actualizan automáticamente via Realtime
  const createInventoryItem = async (item: Omit<InventoryItem, 'id' | 'lastUpdate' | 'status'>) => {
    try {
      setError(null);
      const newItem = await InventoryService.createInventoryItem(item);
      await loadInventoryItems();
      return newItem;
    } catch (err) {
      setError('Error al crear la materia prima');
      console.error('Error creando materia prima:', err);
      throw err;
    }
  };

  const updateInventoryItem = async (id: string, updates: Partial<InventoryItem>) => {
    try {
      setError(null);
      const updatedItem = await InventoryService.updateInventoryItem(id, updates);
      await loadInventoryItems();
      return updatedItem;
    } catch (err) {
      setError('Error al actualizar la materia prima');
      console.error('Error actualizando materia prima:', err);
      throw err;
    }
  };

  const deleteInventoryItem = async (id: string) => {
    try {
      setError(null);
      const success = await InventoryService.deleteInventoryItem(id);
      await loadInventoryItems();
      return success;
    } catch (err) {
      setError('Error al eliminar la materia prima');
      console.error('Error eliminando materia prima:', err);
      throw err;
    }
  };

  return {
    inventoryItems,
    totalCount,
    loading,
    error,
    loadInventoryItems,
    createInventoryItem,
    updateInventoryItem,
    deleteInventoryItem
  };
};
