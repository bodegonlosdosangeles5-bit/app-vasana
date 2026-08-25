import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EnvioService, Envio, EnvioConRemitos } from '@/services/envioService';

export const useRealtimeEnvios = () => {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar envíos
  const loadEnvios = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const enviosData = await EnvioService.getEnvios();
      setEnvios(enviosData);
    } catch (err) {
      console.error('Error cargando envíos:', err);
      setError('Error al cargar envíos');
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar envíos al montar el componente
  useEffect(() => {
    loadEnvios();
  }, [loadEnvios]);

  // Configurar suscripción en tiempo real
  useEffect(() => {
    // Agrupa varios cambios casi simultáneos en una sola recarga.
    const reloadTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null };
    const scheduleReload = () => {
      if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
      reloadTimeoutRef.current = setTimeout(() => {
        reloadTimeoutRef.current = null;
        loadEnvios();
      }, 600);
    };

    const channelId = `envios_changes_${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'envios'
        },
        (payload) => {
          console.log('🔄 Cambio en envíos:', payload);
          scheduleReload();
        }
      )
      .subscribe();

    return () => {
      if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
      setTimeout(() => {
        supabase.removeChannel(channel);
      }, 500);
    };
  }, [loadEnvios]);

  // Crear envío con remito específico
  const crearEnvioConRemitoEspecifico = useCallback(async (
    remitoId: string,
    destino: string,
    fecha?: string,
    observaciones?: string
  ) => {
    try {
      setError(null);
      const nuevoEnvio = await EnvioService.crearEnvioConRemitoEspecifico(remitoId, destino, fecha, observaciones);
      
      if (nuevoEnvio) {
        // Recargar envíos para mostrar el nuevo
        await loadEnvios();
        return nuevoEnvio;
      } else {
        throw new Error('No se pudo crear el envío');
      }
    } catch (err) {
      console.error('Error creando envío:', err);
      setError(err instanceof Error ? err.message : 'Error al crear envío');
      return null;
    }
  }, [loadEnvios]);

  // Crear envío con remitos pendientes
  const crearEnvioConRemitosPendientes = useCallback(async (
    destino: string,
    observaciones?: string
  ) => {
    try {
      setError(null);
      const nuevoEnvio = await EnvioService.crearEnvioConRemitosPendientes(destino, observaciones);
      
      if (nuevoEnvio) {
        // Recargar envíos para mostrar el nuevo
        await loadEnvios();
        return nuevoEnvio;
      } else {
        throw new Error('No se pudo crear el envío');
      }
    } catch (err) {
      console.error('Error creando envío:', err);
      setError(err instanceof Error ? err.message : 'Error al crear envío');
      return null;
    }
  }, [loadEnvios]);

  // Obtener envío con remitos
  const getEnvioConRemitos = useCallback(async (envioId: string): Promise<EnvioConRemitos | null> => {
    try {
      setError(null);
      return await EnvioService.getEnvioConRemitos(envioId);
    } catch (err) {
      console.error('Error obteniendo envío con remitos:', err);
      setError('Error al obtener detalles del envío');
      return null;
    }
  }, []);

  // Obtener remitos pendientes
  const getRemitosPendientes = useCallback(async () => {
    try {
      setError(null);
      return await EnvioService.getRemitosPendientes();
    } catch (err) {
      console.error('Error obteniendo remitos pendientes:', err);
      setError('Error al obtener remitos pendientes');
      return [];
    }
  }, []);


  // Eliminar envío
  const eliminarEnvio = useCallback(async (envioId: string) => {
    try {
      setError(null);
      const success = await EnvioService.eliminarEnvio(envioId);
      
      if (success) {
        // Recargar envíos para reflejar el cambio
        await loadEnvios();
      }
      
      return success;
    } catch (err) {
      console.error('Error eliminando envío:', err);
      setError('Error al eliminar envío');
      return false;
    }
  }, [loadEnvios]);

  return {
    envios,
    loading,
    error,
    loadEnvios,
    crearEnvioConRemitoEspecifico,
    crearEnvioConRemitosPendientes,
    getEnvioConRemitos,
    getRemitosPendientes,
    eliminarEnvio
  };
};
