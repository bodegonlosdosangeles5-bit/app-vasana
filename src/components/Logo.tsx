import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-12',
  md: 'h-12 w-16',
  lg: 'h-16 w-20',
  xl: 'h-20 w-24'
};

const textSizeClasses = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-xl',
  xl: 'text-2xl'
};

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showText = true, 
  className = '' 
}) => {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Logo SVG con V estilizada - Versión Premium */}
      <div className="relative group">
        <svg 
          className={`${sizeClasses[size]} transition-transform duration-500 group-hover:scale-110`}
          viewBox="0 0 60 60" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gradiente de Identidad - Corporate Pink */}
            <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
            
            <filter id="logoShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#f43f5e" floodOpacity="0.2"/>
            </filter>
          </defs>
          
          {/* Fondo Circular Minimalista */}
          <circle 
            cx="30" cy="30" r="28" 
            fill="url(#brandGradient)"
            filter="url(#logoShadow)"
          />
          
          {/* Letra V estilizada - Moderna y Gruesa */}
          <path 
            d="M15 18 L30 46 L45 18 H38 L30 36 L22 18 H15Z" 
            fill="white"
            className="drop-shadow-sm"
          />
          
          {/* Detalle en la base de la V */}
          <path 
            d="M28 40 L30 44 L32 40" 
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.5"
          />
        </svg>
      </div>
      
      {showText && (
        <div className={`flex flex-col tracking-tighter ${textSizeClasses[size]}`}>
          <span className="font-black text-slate-800 dark:text-white leading-none">
            PLANTA
          </span>
          <span className="font-black text-pink-500 leading-normal uppercase">
            VARELA
          </span>
          <div className="h-1 w-6 bg-pink-500 rounded-full mt-1.5 opacity-50" />
        </div>
      )}
    </div>
  );
};
