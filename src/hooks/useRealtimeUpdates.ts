import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeUpdate {
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  data: unknown;
}

export const useRealtimeUpdates = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<RealtimeUpdate | null>(null);

  useEffect(() => {
    // Solo suscribir tablas sin hook Realtime propio.
    // productos, missing_ingredients, available_ingredients e inventory_items
    // ya tienen hooks dedicados (useRealtimeProductos, useRealtimeInventory).
    const channels = [
      'users',
      'remitos',
      'remito_items',
      'envios'
    ];

    const subscriptions = channels.map(tableName => {
      try {
        const channelId = `${tableName}_changes_global_${Math.random().toString(36).substring(7)}`;
        const channel = supabase
          .channel(channelId)
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: tableName
            },
            (payload) => {
              const update: RealtimeUpdate = {
                table: tableName,
                event: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
                data: payload.new || payload.old
              };
              
              setLastUpdate(update);
              
              // Emitir evento personalizado para que otros componentes puedan escucharlo
              window.dispatchEvent(new CustomEvent('realtimeUpdate', { 
                detail: update 
              }));
            }
          )
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
            } else if (status === 'CHANNEL_ERROR') {
              // Ignorar error de canal por unmount en Strict Mode
            } else if (status === 'CLOSED') {
              // Ignorar cierre normal del canal
            }
          });

        return channel;
      } catch (error) {
        // Error al configurar suscripción
        return null;
      }
    }).filter(channel => channel !== null);

    // Cleanup al desmontar
    return () => {
      setTimeout(() => {
        subscriptions.forEach(channel => {
          try {
            if (channel) {
              supabase.removeChannel(channel);
            }
          } catch (error) {
            console.warn('⚠️ Error al remover canal:', error);
          }
        });
      }, 500);
      setIsConnected(false);
    };
  }, []);

  return {
    isConnected,
    lastUpdate
  };
};
