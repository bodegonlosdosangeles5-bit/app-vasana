import React from 'react';

interface UbicacionProps {
  rack: number;
  lugarStr: string;
  nivel: number;
  nombreInsumo?: string;
}

const MapaUbicacionRacks: React.FC<UbicacionProps> = ({ 
  rack, lugarStr, nivel, nombreInsumo 
}) => {
  // Mejora 1: filtrar valores inválidos
  const lugaresArr = lugarStr.toString()
    .split('-')
    .map(Number)
    .filter(n => !isNaN(n) && n >= 1 && n <= 6);

  const rackWidth = 120;
  const rackHeight = 250;
  const nivelHeight = rackHeight / 5;
  const gap = 20;

  const calcX = (lugar: number) => {
    const lugarWidth = (rackWidth - 16) / 6;
    return 8 + (6 - lugar) * lugarWidth + lugarWidth / 2;
  };

  const renderTamboresDecorativos = () => {
    return [1, 2, 3, 4, 5, 6].map((pos) => (
      <circle 
        key={pos} 
        cx={calcX(pos)} 
        cy={nivelHeight / 2} 
        r="6" 
        fill="#2d3748" 
        fillOpacity="0.3" 
      />
    ));
  };

  return (
    <div className="flex flex-col items-center bg-[#0f172a] p-6 rounded-xl border border-slate-700 shadow-2xl">
      <div className="mb-4 text-center">
        <h3 className="text-slate-400 text-xs uppercase tracking-widest font-bold">
          Ubicación en Almacén
        </h3>
        <p className="text-white text-lg font-semibold">
          {nombreInsumo || 'Materia Prima'}
        </p>
        <span className="inline-block px-3 py-1 mt-2 rounded-full bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20">
          RACK {rack} • NIVEL {nivel} • LUGAR {lugarStr}
        </span>
      </div>

      {/* Mejora 2: mostrar aviso si no hay datos válidos */}
      {(rack < 1 || rack > 6 || lugaresArr.length === 0 || nivel < 1 || nivel > 5) ? (
        <div className="w-full py-8 text-center text-slate-500 text-sm">
          Ubicación no especificada o inválida
        </div>
      ) : (
        <svg viewBox="0 0 850 350" className="w-full h-auto drop-shadow-lg">
          {/* LEYENDA DE PASILLOS */}
          <text x="730" y="330" fill="#64748b" fontSize="12" fontWeight="bold">
            PASILLO 1
          </text>
          <text x="425" y="330" fill="#64748b" fontSize="12" fontWeight="bold">
            PASILLO 2
          </text>
          <text x="120" y="330" fill="#64748b" fontSize="12" fontWeight="bold">
            PASILLO 3
          </text>

          {/* RACKS: Rack 1 a la derecha (muro), Rack 6 a la izquierda */}
          {[1, 2, 3, 4, 5, 6].map((r) => {
            const xPos = 850 - (r * (rackWidth + gap));
            const esRackActivo = r === rack;

            return (
              <g key={r} transform={`translate(${xPos}, 40)`}>
                <text 
                  x={rackWidth / 2} 
                  y="-15" 
                  textAnchor="middle" 
                  fill={esRackActivo ? "#60a5fa" : "#475569"} 
                  fontSize="11" 
                  fontWeight="bold"
                >
                  RACK {r} {r === 1 ? '(MURO)' : ''}
                </text>

                <rect 
                  width={rackWidth} 
                  height={rackHeight} 
                  rx="4" 
                  fill="#1e293b" 
                  stroke={esRackActivo ? "#3b82f6" : "#334155"} 
                  strokeWidth="2" 
                />

                {r === 1 && (
                  <rect 
                    x={rackWidth} y="0" 
                    width="8" height={rackHeight} 
                    fill="#0f172a" stroke="#334155" 
                  />
                )}

                {[1, 2, 3, 4, 5].map((n) => {
                  const yNivel = rackHeight - (n * nivelHeight);
                  const esNivelActivo = esRackActivo && n === nivel;

                  return (
                    <g key={n} transform={`translate(0, ${yNivel})`}>
                      <line 
                        x1="0" y1={nivelHeight} 
                        x2={rackWidth} y2={nivelHeight} 
                        stroke="#334155" strokeWidth="1" 
                      />

                      {!esNivelActivo && renderTamboresDecorativos()}

                      {esNivelActivo && lugaresArr.map((l) => (
                        <g key={l} className="animate-pulse">
                          <circle 
                            cx={calcX(l)} cy={nivelHeight / 2} 
                            r="10" fill="#ef4444" fillOpacity="0.3" 
                          />
                          <circle 
                            cx={calcX(l)} cy={nivelHeight / 2} 
                            r="5" fill="#ef4444" 
                            stroke="#fca5a5" strokeWidth="1" 
                          />
                          <text 
                            x={calcX(l)} y={nivelHeight / 2 + 15} 
                            fontSize="6" fill="white" textAnchor="middle"
                          >
                            {l}
                          </text>
                        </g>
                      ))}

                      {r === 6 && (
                        <text 
                          x="-40" y={nivelHeight / 2 + 5} 
                          fill="#64748b" fontSize="10"
                        >
                          N{n}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      )}

      <div className="mt-4 flex gap-6 text-[10px] text-slate-500 border-t border-slate-800 pt-4 w-full justify-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-700"></div>
          Espacio Libre
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
          Materia Prima Seleccionada
        </div>
      </div>
    </div>
  );
};

export default MapaUbicacionRacks;
