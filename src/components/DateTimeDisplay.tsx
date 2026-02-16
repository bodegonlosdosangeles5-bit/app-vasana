import React, { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';

interface DateTimeDisplayProps {
  className?: string;
  showDate?: boolean;
  showTime?: boolean;
  format?: 'full' | 'compact' | 'minimal';
}

export const DateTimeDisplay: React.FC<DateTimeDisplayProps> = ({
  className = '',
  showDate = true,
  showTime = true,
  format = 'compact'
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };

    if (format === 'compact') {
      options.weekday = 'short';
      options.month = 'short';
    } else if (format === 'minimal') {
      options.weekday = undefined;
      options.year = undefined;
    }

    return date.toLocaleDateString('es-ES', options);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: format === 'full' ? '2-digit' : undefined
    });
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  if (format === 'minimal') {
    return (
      <div className={`flex items-center space-x-2 text-sm text-muted-foreground ${className}`}>
        {showDate && (
          <div className="flex items-center space-x-1">
            <Calendar className="h-3 w-3" />
            <span className="text-xs">
              {currentTime.toLocaleDateString('es-ES', { 
                day: '2-digit', 
                month: '2-digit' 
              })}
            </span>
          </div>
        )}
        {showTime && (
          <div className="flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span className="text-xs font-mono">
              {formatTime(currentTime)}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col space-y-1.5 ${className}`}>
      {/* Saludo */}
      <div className="text-[10px] text-pink-500 font-black uppercase tracking-[0.2em]">
        {getGreeting()}
      </div>
      
      {/* Fecha y Hora */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        {showDate && (
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {formatDate(currentTime)}
            </span>
          </div>
        )}
        
        {showTime && (
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
              {formatTime(currentTime)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
