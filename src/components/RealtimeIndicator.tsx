import React from 'react';
import { Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';

export const RealtimeIndicator: React.FC = () => {
  const { isConnected, lastUpdate } = useRealtimeUpdates();

  return (
    <div className="flex items-center gap-2">
      {isConnected && (
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Live</span>
        </div>
      )}
      
      {lastUpdate && (
        <div className="px-2 py-0.5 bg-pink-500/10 border border-pink-500/20 rounded-full transition-all animate-bounce">
          <span className="text-[10px] font-black text-pink-600 dark:text-pink-400 uppercase tracking-widest">
            {lastUpdate.event === 'INSERT' && 'Nuevo'}
            {lastUpdate.event === 'UPDATE' && 'Actualizado'}
            {lastUpdate.event === 'DELETE' && 'Eliminado'}
          </span>
        </div>
      )}
    </div>
  );
};
