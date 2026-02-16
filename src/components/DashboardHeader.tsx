import React from 'react';
import { DateTimeDisplay } from '@/components/DateTimeDisplay';
import { RealtimeIndicator } from '@/components/RealtimeIndicator';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';

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
          <Dialog>
            <DialogTrigger asChild>
              <button className="text-left hover:opacity-90 transition-opacity">
                <DateTimeDisplay format="full" className="scale-105" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-fit p-0 overflow-hidden rounded-3xl border-0 shadow-2xl">
              <Calendar 
                mode="single" 
                className="p-4"
                classNames={{ 
                  nav_button_next: "absolute right-2", 
                  nav_button_previous: "absolute left-2",
                  day_selected: "bg-pink-500 text-white hover:bg-pink-600 focus:bg-pink-500"
                }}
              />
            </DialogContent>
          </Dialog>
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
