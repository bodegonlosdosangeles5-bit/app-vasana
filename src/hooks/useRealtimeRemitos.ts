import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RemitoService, RemitoWithItems, ProductionItem } from '@/services/remitoService';
import { RealtimeChannel } from '@supabase/supabase-js';

export const useRealtimeRemitos = () => {
  const [remitos, setRemitos] = useState<RemitoWithItems[]>([]);
  const [currentRemito, setCurrentRemito] = useState<RemitoWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Cargar remitos iniciales
  const loadRemitos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Cargando remitos desde Supabase...');
      const data = await RemitoService.getAllRemitos();
      console.log('📊 Remitos cargados:', data);
      setRemitos(data);
    } catch (err) {
      setError('Error al cargar los remitos');
      console.error('❌ Error cargando remitos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar remito abierto del día
  const loadCurrentRemito = useCallback(async () => {
    try {
      setError(null);
      console.log('🔄 Cargando remito abierto del día...');
      const data = await RemitoService.getOpenRemitoForToday();
      console.log('📊 Remito actual cargado:', data);
      setCurrentRemito(data);
    } catch (err) {
      setError('Error al cargar el remito actual');
      console.error('❌ Error cargando remito actual:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar datos al montar el componente
  // Nota: loadRemitos() (todos los remitos + items, con N+1 queries) no se llama
  // automáticamente porque ningún consumidor actual usa el array `remitos` — solo
  // `currentRemito`. Sigue disponible para quien lo necesite invocar manualmente.
  useEffect(() => {
    loadCurrentRemito();
  }, [loadCurrentRemito]);

  // Configurar polling como fallback si Realtime falla
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    console.log('🔄 Iniciando polling como fallback...');
    setIsPolling(true);
    const interval = setInterval(() => {
      loadCurrentRemito();
    }, 5000); // Polling cada 5 segundos
    pollingIntervalRef.current = interval;
  }, [loadCurrentRemito]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('🛑 Deteniendo polling...');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      setIsPolling(false);
    }
  }, []);

  // Configurar Realtime para remitos
  useEffect(() => {
    console.log('🔌 Configurando Realtime para remitos...');
    
    let remitosChannel: RealtimeChannel | null = null;
    
    try {
      const channelId = `remitos_changes_${Math.random().toString(36).substring(7)}`;
      remitosChannel = supabase
        .channel(channelId, {
          config: {
            broadcast: { self: false },
            presence: { key: 'remitos' }
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'remitos'
          },
          (payload) => {
            console.log('📡 Cambio detectado en remitos:', payload);
            loadCurrentRemito();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'remito_items'
          },
          (payload) => {
            console.log('📡 Cambio detectado en remito_items:', payload);
            loadCurrentRemito();
          }
        )
        .subscribe((status, err) => {
          if (err) {
            // Error ignorado en consolas limpias
          }
          
          if (status === 'SUBSCRIBED') {
            setError(null); // Limpiar errores previos
            setRealtimeError(false);
            stopPolling(); // Detener polling si Realtime funciona
          } else if (status === 'CHANNEL_ERROR') {
            setError(`Error de conexión en tiempo real: ${err?.message || 'Error desconocido'}`);
            setRealtimeError(true);
            startPolling(); // Iniciar polling como fallback
          } else if (status === 'TIMED_OUT') {
            setError('Timeout en la conexión de tiempo real');
            setRealtimeError(true);
            startPolling(); // Iniciar polling como fallback
          } else if (status === 'CLOSED') {
            setRealtimeError(true);
            startPolling(); // Iniciar polling como fallback
          }
        });
    } catch (error) {
      console.error('❌ Error configurando Realtime:', error);
      setError('Error configurando conexión en tiempo real');
      setRealtimeError(true);
      startPolling(); // Iniciar polling como fallback
    }

    // Cleanup al desmontar
    return () => {
      if (remitosChannel) {
        setTimeout(() => {
          supabase.removeChannel(remitosChannel!);
        }, 500);
      }
      stopPolling();
    };
  }, [loadCurrentRemito, startPolling, stopPolling]);

  // Generar remito para Villa Martelli
  const generateRemitoForVillaMartelli = async (productionItems: ProductionItem[]) => {
    try {
      setError(null);
      console.log('🔄 Generando remito para Villa Martelli...');
      const remito = await RemitoService.generateRemitoForVillaMartelli(productionItems);
      
      if (remito) {
        console.log('✅ Remito generado exitosamente:', remito);
        // Recargar datos después de generar
        await loadRemitos();
        await loadCurrentRemito();
      }
      
      return remito;
    } catch (err) {
      setError('Error al generar el remito');
      console.error('❌ Error generando remito:', err);
      throw err;
    }
  };

  // Cerrar remito
  const closeRemito = async (remitoId: string) => {
    try {
      setError(null);
      console.log('🔄 Cerrando remito en hook...', remitoId);
      
      // Validar que el ID existe
      if (!remitoId || remitoId.trim() === '') {
        console.error('❌ ID de remito inválido:', remitoId);
        setError('ID de remito inválido');
        return false;
      }
      
      const success = await RemitoService.closeRemito(remitoId);
      console.log('✅ Resultado del servicio:', success);
      
      if (success) {
        console.log('✅ Remito cerrado exitosamente en hook');
        // Recargar datos después de cerrar
        console.log('🔄 Recargando datos...');
        try {
          await loadRemitos();
          await loadCurrentRemito();
          console.log('✅ Datos recargados exitosamente');
        } catch (reloadError) {
          console.error('❌ Error recargando datos:', reloadError);
          // No fallar el cierre por error de recarga
        }
      } else {
        console.error('❌ El servicio retornó false');
        setError('No se pudo cerrar el remito');
      }
      
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al cerrar el remito: ${errorMessage}`);
      console.error('❌ Error cerrando remito en hook:', err);
      return false;
    }
  };

  // Obtener remito por ID
  const getRemitoById = async (remitoId: string) => {
    try {
      setError(null);
      const remito = await RemitoService.getRemitoById(remitoId);
      return remito;
    } catch (err) {
      setError('Error al obtener el remito');
      console.error('❌ Error obteniendo remito:', err);
      throw err;
    }
  };

  return {
    remitos,
    currentRemito,
    loading,
    error,
    realtimeError,
    isPolling,
    loadRemitos,
    loadCurrentRemito,
    generateRemitoForVillaMartelli,
    closeRemito,
    getRemitoById
  };
};
