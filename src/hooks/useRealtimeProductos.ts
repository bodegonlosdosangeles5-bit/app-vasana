import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProductoService } from '@/services/productoService';

// Definir el tipo Producto localmente para evitar conflictos
export interface Producto {
  id: string;
  lote_code: string;
  name: string;
  batchSize: number;
  stock_actual: number;
  status: 'available' | 'incomplete';
  destination: string;
  date?: string;
  type: 'stock' | 'client';
  clientName?: string;
  missingIngredients?: Array<{
    name: string;
    required: number;
    unit: string;
  }>;
  ingredients?: Array<{
    name: string;
    required: number;
    unit: string;
  }>;
  created_at?: string;
}

export const useRealtimeProductos = () => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar productos
  const loadProductos = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const productosData = await ProductoService.getProductos();
      setProductos(productosData);
    } catch (err) {
      console.error('Error cargando productos:', err);
      setError('Error al cargar productos');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Cargar productos al montar el componente
  useEffect(() => {
    loadProductos();
  }, [loadProductos]);

  // Configurar suscripción en tiempo real
  useEffect(() => {
    const channelId = `productos_changes_${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'productos'
        },
        (payload) => {
          console.log('🔄 Cambio en productos:', payload);
          loadProductos(true); // Recargar productos silenciosamente
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'missing_ingredients'
        },
        (payload) => {
          console.log('🔄 Cambio en ingredientes faltantes:', payload);
          loadProductos(true); // Recargar productos silenciosamente
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'available_ingredients'
        },
        (payload) => {
          console.log('🔄 Cambio en ingredientes disponibles:', payload);
          loadProductos(true); // Recargar productos silenciosamente
        }
      )
      .subscribe();

    return () => {
      setTimeout(() => {
        supabase.removeChannel(channel);
      }, 500);
    };
  }, [loadProductos]);

  // Crear producto
  const createProducto = useCallback(async (producto: Omit<Producto, 'id'> & { id?: string }): Promise<Producto | null> => {
    try {
      setError(null);
      const newProducto = await ProductoService.createProducto(producto);
      
      if (newProducto) {
        // Recargar productos para mostrar el nuevo
        await loadProductos();
        return newProducto;
      } else {
        throw new Error('No se pudo crear el producto');
      }
    } catch (err) {
      console.error('Error creando producto:', err);
      setError(err instanceof Error ? err.message : 'Error al crear producto');
      return null;
    }
  }, [loadProductos]);

  // Actualizar producto
  const updateProducto = useCallback(async (id: string, updates: Partial<Producto>): Promise<Producto | null> => {
    try {
      setError(null);
      const updatedProducto = await ProductoService.updateProducto(id, updates);
      
      if (updatedProducto) {
        // Recargar productos para mostrar los cambios
        await loadProductos();
        return updatedProducto;
      } else {
        throw new Error('No se pudo actualizar el producto');
      }
    } catch (err) {
      console.error('Error actualizando producto:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar producto');
      return null;
    }
  }, [loadProductos]);

  // Eliminar producto
  const deleteProducto = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);
      const success = await ProductoService.deleteProducto(id);
      
      if (success) {
        // Recargar productos para reflejar el cambio
        await loadProductos();
      }
      
      return success;
    } catch (err) {
      console.error('Error eliminando producto:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar producto');
      return false;
    }
  }, [loadProductos]);

  // Agregar ingrediente faltante
  const addMissingIngredient = useCallback(async (productoId: string, ingredient: {
    name: string;
    required: number;
    unit: string;
  }): Promise<boolean> => {
    try {
      setError(null);
      const success = await ProductoService.addMissingIngredient(productoId, ingredient);
      
      if (success) {
        // Recargar productos para mostrar los cambios
        await loadProductos();
      }
      
      return success;
    } catch (err) {
      console.error('Error agregando ingrediente faltante:', err);
      setError(err instanceof Error ? err.message : 'Error al agregar ingrediente faltante');
      return false;
    }
  }, [loadProductos]);

  // Eliminar ingrediente faltante
  const removeMissingIngredient = useCallback(async (productoId: string, ingredientName: string): Promise<boolean> => {
    try {
      setError(null);
      const success = await ProductoService.removeMissingIngredient(productoId, ingredientName);
      
      if (success) {
        // Recargar productos para mostrar los cambios
        await loadProductos();
      }
      
      return success;
    } catch (err) {
      console.error('Error eliminando ingrediente faltante:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar ingrediente faltante');
      return false;
    }
  }, [loadProductos]);

  // Actualizar estado de productos incompletos
  const updateIncompleteProductosStatus = useCallback(async (): Promise<{ updated: number; productos: Producto[] }> => {
    try {
      setError(null);
      const result = await ProductoService.updateIncompleteProductosStatus();
      
      if (result.updated > 0) {
        // Recargar productos para mostrar los cambios
        await loadProductos();
      }
      
      return result;
    } catch (err) {
      console.error('Error actualizando productos incompletos:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar productos incompletos');
      return { updated: 0, productos: [] };
    }
  }, [loadProductos]);

  return {
    productos,
    loading,
    error,
    loadProductos,
    createProducto,
    updateProducto,
    deleteProducto,
    addMissingIngredient,
    removeMissingIngredient,
    updateIncompleteProductosStatus
  };
};
