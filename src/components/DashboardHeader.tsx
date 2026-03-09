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
            <DialogContent className="max-w-[380px] p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl bg-white dark:bg-slate-900">
              <div className="px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <DialogTitle className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">
                  📅 Calendario
                </DialogTitle>
              </div>
              <Calendar 
                mode="single" 
                className="p-5"
                classNames={{
                  months: "flex flex-col space-y-4",
                  month: "space-y-4",
                  caption: "flex justify-center pt-1 relative items-center mb-2",
                  caption_label: "text-base font-bold text-slate-800 dark:text-slate-200 tracking-wide",
                  nav: "space-x-1 flex items-center",
                  nav_button: "inline-flex items-center justify-center h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors opacity-80 hover:opacity-100",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse",
                  head_row: "flex mb-1",
                  head_cell: "text-slate-600 dark:text-slate-400 w-11 font-bold text-xs uppercase tracking-wider",
                  row: "flex w-full mt-1",
                  cell: "h-11 w-11 text-center text-sm p-0 relative",
                  day: "h-10 w-10 p-0 font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-800 dark:text-slate-200 mx-auto flex items-center justify-center",
                  day_range_end: "day-range-end",
                  day_selected: "bg-blue-600 text-white font-bold shadow-md hover:bg-blue-700 focus:bg-blue-600 rounded-xl",
                  day_today: "ring-2 ring-blue-400 dark:ring-blue-500 font-bold text-blue-600 dark:text-blue-400",
                  day_outside: "!text-slate-400 dark:!text-slate-600 opacity-60",
                  day_disabled: "!text-slate-300 dark:!text-slate-600 opacity-40",
                  day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                  day_hidden: "invisible",
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
