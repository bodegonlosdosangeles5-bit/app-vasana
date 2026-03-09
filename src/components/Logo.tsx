import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const vSizes = {
  sm: '32px',
  md: '38px',
  lg: '46px',
  xl: '54px'
};

const containerSizes = {
  sm: '36px',
  md: '44px',
  lg: '52px',
  xl: '60px'
};

const lineSizes = {
  sm: '20px',
  md: '24px',
  lg: '28px',
  xl: '32px'
};

const plantaSizes = {
  sm: '8px',
  md: '9px',
  lg: '11px',
  xl: '12px'
};

const varelaSizes = {
  sm: '14px',
  md: '18px',
  lg: '22px',
  xl: '26px'
};

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showText = true, 
  className = '' 
}) => {
  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      {/* Letra V sin contenedor */}
      <div 
        style={{ 
          position: 'relative', 
          width: containerSizes[size], 
          height: containerSizes[size], 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        <span 
          className="logo-v-letter"
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 700,
            fontSize: vSizes[size],
            lineHeight: 1,
            position: 'relative',
            zIndex: 2
          }}
        >
          V
        </span>
        {/* Línea decorativa */}
        <div 
          className="logo-v-line"
          style={{
            position: 'absolute',
            bottom: '4px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: lineSizes[size],
            height: '2px',
            borderRadius: '2px'
          }} 
        />
      </div>
      
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span 
            className="logo-planta-text"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 300,
              fontSize: plantaSizes[size],
              letterSpacing: '5px',
              textTransform: 'uppercase' as const
            }}
          >
            Planta
          </span>
          <span 
            className="logo-varela-text"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 600,
              fontSize: varelaSizes[size],
              letterSpacing: '2px',
              textTransform: 'uppercase' as const,
              marginTop: '-1px'
            }}
          >
            Varela
          </span>
        </div>
      )}
    </div>
  );
};
