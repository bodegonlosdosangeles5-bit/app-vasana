import React, { useState } from 'react';
import { DateTimeDisplay } from '@/components/DateTimeDisplay';
import { RealtimeIndicator } from '@/components/RealtimeIndicator';
import { CalendarModal } from '@/components/CalendarModal';

interface DashboardHeaderProps {
  className?: string;
  /**
   * Cuando es true, al hacer clic en el DateTimeDisplay se abre un modal con calendario.
   * Útil para habilitarlo sólo en la pantalla de inicio.
   */
  enableDateDialog?: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ 
  className = '',
  enableDateDialog = false
}) => {
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <div className={`flex flex-col md:flex-row md:items-end justify-between gap-6 ${className}`}>
      {/* Welcome Message */}
      <div className="space-y-1">
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-800 dark:text-white tracking-tight">
          Control de <span className="text-pink-600">Producción</span>
        </h1>
        <p className="text-sm lg:text-base text-slate-500 dark:text-slate-400 font-medium tracking-wide">
          <span className="text-slate-900 dark:text-slate-200">Planta Varela</span>
        </p>
      </div>
      
      {/* Date and Time Display with Realtime Indicator */}
      <div className="flex flex-col items-start md:items-end gap-3 bg-white dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
        {enableDateDialog ? (
          <>
            <button 
              className="text-left hover:opacity-90 transition-opacity"
              onClick={() => setCalendarOpen(true)}
            >
              <DateTimeDisplay format="full" className="scale-105" />
            </button>
            <CalendarModal open={calendarOpen} onOpenChange={setCalendarOpen} />
          </>
        ) : (
          <DateTimeDisplay format="full" />
        )}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Status</span>
          <RealtimeIndicator />
        </div>
      </div>
    </div>
  );
};
