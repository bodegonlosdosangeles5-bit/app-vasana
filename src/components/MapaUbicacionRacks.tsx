import React, { useState } from 'react';

interface InventarioItemSimple {
  id: string;
  name: string;
  rack: string;
  place: string;
  level: string;
  currentStock: number;
  certificate: string;
  status: string;
  unit: string;
  minStock: number;
}

interface UbicacionProps {
  rack: number;
  lugarStr: string;
  nivel: number;
  nombreInsumo?: string;
  allItems?: InventarioItemSimple[];
}

const MapaUbicacionRacks: React.FC<UbicacionProps> = ({ 
  rack, lugarStr, nivel, nombreInsumo, allItems = []
}) => {
  // Mejora 1: filtrar valores inválidos
  const lugaresArr = lugarStr.toString()
    .split('-')
    .map(Number)
    .filter(n => !isNaN(n) && n >= 1 && n <= 6)
    .sort();

  const isValid = rack >= 1 && rack <= 6 && lugaresArr.length > 0 && nivel >= 1 && nivel <= 5;

  // Nuevas dimensiones más grandes y legibles
  const rackWidth = 160;
  const rackHeight = 320;
  const nivelHeight = rackHeight / 5; // 64
  const gap = 50; 
  const canvasWidth = 1450;
  const canvasHeight = 550;
  
  // Cálculo de X relativo al rack (con un padding interno para que las celdas respiren)
  const calcX = (lugar: number) => {
    const internalWidth = rackWidth - 24;
    const lugarWidth = internalWidth / 6;
    return 12 + (6 - lugar) * lugarWidth + lugarWidth / 2;
  };

  const renderSlots = (esActivo: boolean, rNum: number, nNum: number) => {
    return [1, 2, 3, 4, 5, 6].map((lugar) => {
      const esSeleccionado = 
        slotSeleccionado?.r === rNum && 
        slotSeleccionado?.l === lugar && 
        slotSeleccionado?.n === nNum;

      return (
        <g key={lugar} onClick={() => handleClickSlot(rNum, lugar, nNum)}
          style={{ cursor: 'pointer' }}>
          <circle 
            cx={calcX(lugar)} 
            cy={nivelHeight / 2} 
            r="11" 
            fill={esSeleccionado ? "#FEE2E2" : esActivo ? "#F1F5F9" : "#ffffff"} 
            stroke={esSeleccionado ? "#EF4444" : "#000000"}
            strokeWidth={esSeleccionado ? "2.5" : "1.5"}
            className="transition-all hover:fill-slate-100"
          />
          {esSeleccionado && (
            <circle
              cx={calcX(lugar)}
              cy={nivelHeight / 2}
              r="5"
              fill="#EF4444"
              className="pointer-events-none"
            />
          )}
        </g>
      );
    });
  };

  const [slotSeleccionado, setSlotSeleccionado] = useState<{ r: number; l: number; n: number } | null>(null);
  const [panelItem, setPanelItem] = useState<InventarioItemSimple | null>(null);
  const [panelVacio, setPanelVacio] = useState<{ rack: number; lugar: number; nivel: number } | null>(null);

  const getItemEnPosicion = (rNum: number, lNum: number, nNum: number): InventarioItemSimple | null => {
    if (!allItems.length) return null;
    return allItems.find(item => {
      const itemRack = parseInt(item.rack);
      const itemNivel = parseInt(item.level);
      const itemLugares = item.place.toString()
        .split('-').map(Number)
        .filter(n => !isNaN(n));
      return itemRack === rNum && 
             itemNivel === nNum && 
             itemLugares.includes(lNum);
    }) || null;
  };

  const handleClickSlot = (rNum: number, lNum: number, nNum: number) => {
    // Si hace clic en el mismo slot, deseleccionar
    if (
      slotSeleccionado?.r === rNum && 
      slotSeleccionado?.l === lNum && 
      slotSeleccionado?.n === nNum
    ) {
      setSlotSeleccionado(null);
      setPanelItem(null);
      setPanelVacio(null);
      return;
    }
    setSlotSeleccionado({ r: rNum, l: lNum, n: nNum });
    const found = getItemEnPosicion(rNum, lNum, nNum);
    if (found) {
      setPanelItem(found);
      setPanelVacio(null);
    } else {
      setPanelItem(null);
      setPanelVacio({ rack: rNum, lugar: lNum, nivel: nNum });
    }
  };

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
      {/* Contenedor flex: mapa + panel lateral */}
      <div className="flex gap-0">
        
        {/* Mapa (lado izquierdo) */}
        <div className={`flex flex-col items-center p-8 transition-all duration-300 ${panelItem || panelVacio ? 'w-4/5' : 'w-full'}`}>
          
          {/* Cabecera del modal del Mapa */}
          <div className="mb-8 w-full flex flex-col items-end">
            <h3 className="text-slate-500 text-xs uppercase tracking-widest font-bold">
              Detalle de Materia Prima
            </h3>
            <p className="text-slate-900 text-2xl font-black mt-1">
              {nombreInsumo ? nombreInsumo.toUpperCase() : 'ÍTEM'}
            </p>
          </div>

      {!isValid ? (
        <div className="w-full py-16 text-center text-slate-500 text-sm font-medium bg-slate-50 rounded-xl border border-slate-100">
          Ubicación no especificada o inválida. Revise los datos.
        </div>
      ) : (
        <svg viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} className="w-full h-auto drop-shadow-sm font-sans">
          
          {/* EJES Y (Niveles) en la izquierda */}
          <g transform="translate(60, 120)">
            {[1, 2, 3, 4, 5].map((n) => {
               const yCenter = rackHeight - (n * nivelHeight) + (nivelHeight / 2);
               return (
                 <text key={`nivel-lbl-${n}`} x="0" y={yCenter + 5} fill="#64748B" fontSize="16" fontWeight="bold" textAnchor="end">
                   N{n}
                 </text>
               );
            })}
            <line x1="15" y1="0" x2="15" y2={rackHeight} stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 4" />
          </g>

          {/* RACKS: Iteramos para dibujar los 6 Racks */}
          {[1, 2, 3, 4, 5, 6].map((r) => {
            // Rack 1 a la derecha, Rack 6 a la izquierda
            const xPos = canvasWidth - 100 - (r * (rackWidth + gap));
            const esRackActivo = r === rack;

            return (
              <g key={r} transform={`translate(${xPos}, 120)`}>
                
                {/* Título del Rack */}
                {esRackActivo && (
                  <rect 
                    x={(rackWidth / 2) - 60} 
                    y="-45" 
                    width="120" 
                    height="30" 
                    rx="15" 
                    fill="#2563EB" 
                  />
                )}
                <text 
                  x={rackWidth / 2} 
                  y={esRackActivo ? "-25" : "-30"} 
                  textAnchor="middle" 
                  fill={esRackActivo ? "#FFFFFF" : "#64748B"} 
                  fontSize={esRackActivo ? "14" : "13"} 
                  fontWeight="bold"
                >
                  RACK {r} {r === 1 ? '(MURO)' : ''}
                </text>

                {/* Estructura Principal del Rack */}
                <rect 
                  width={rackWidth} 
                  height={rackHeight} 
                  rx="8" 
                  fill={esRackActivo ? "#F8FAFC" : "#ffffff"} 
                  stroke={esRackActivo ? "#2563EB" : "#94A3B8"} 
                  strokeWidth={esRackActivo ? "4" : "2"}
                  className="transition-colors duration-300 drop-shadow-sm"
                />

                {/* El Muro físico (solo a la derecha de R1) */}
                {r === 1 && (
                  <g transform={`translate(${rackWidth + 15}, 0)`}>
                    <rect 
                      width="16" height={rackHeight} 
                      rx="4"
                      fill="#E2E8F0" 
                      stroke="#CBD5E1" 
                      strokeWidth="2"
                    />
                    {/* Patrón decorativo del muro */}
                    <line x1="0" y1="20" x2="16" y2="36" stroke="#CBD5E1" strokeWidth="2" />
                    <line x1="0" y1="60" x2="16" y2="76" stroke="#CBD5E1" strokeWidth="2" />
                    <line x1="0" y1="100" x2="16" y2="116" stroke="#CBD5E1" strokeWidth="2" />
                  </g>
                )}

                {/* EJE X: Números de Lugares debajo de cada columna */}
                {[1, 2, 3, 4, 5, 6].map((lugar) => (
                  <text 
                    key={`lugar-lbl-${lugar}`}
                    x={calcX(lugar)} 
                    y={rackHeight + 28} 
                    fill={esRackActivo ? "#475569" : "#94A3B8"} 
                    fontSize="13" 
                    fontWeight="bold" 
                    textAnchor="middle"
                  >
                    {lugar}
                  </text>
                ))}

                {/* Niveles (filas) y sus ranuras */}
                {[1, 2, 3, 4, 5].map((n) => {
                  const yNivel = rackHeight - (n * nivelHeight);
                  const isNivelActivo = esRackActivo && n === nivel;

                  return (
                    <g key={n} transform={`translate(0, ${yNivel})`}>
                      {/* Línea de piso del nivel (evitamos la tapa superior n=6) */}
                      {n > 1 && (
                        <line 
                          x1="0" y1={nivelHeight} 
                          x2={rackWidth} y2={nivelHeight} 
                          stroke={esRackActivo ? "#BFDBFE" : "#E2E8F0"} 
                          strokeWidth="2" 
                        />
                      )}

                      {/* Dibujar celdas base */}
                      {renderSlots(esRackActivo, r, n)}

                      {/* Renderizar marcas actvas (si es el rack y nivel correcto) */}
                      {isNivelActivo && lugaresArr.map((lugar) => {
                        const xLugar = calcX(lugar);
                        const yLugarCent = nivelHeight / 2;
                        return (
                          <g key={`active-${lugar}`} className="cursor-pointer group" onClick={() => handleClickSlot(r, lugar, n)}>
                             {/* Efecto Pulso Constante */}
                             <circle 
                               cx={xLugar} cy={yLugarCent} 
                               r="24" fill="#EF4444" fillOpacity="0.15" className="animate-pulse" 
                             />
                             {/* Glow Effect */}
                             <circle 
                               cx={xLugar} cy={yLugarCent} 
                               r="20" fill="#EF4444" fillOpacity="0.25" 
                             />
                             {/* Punto Principal Grande */}
                             <circle 
                               cx={xLugar} cy={yLugarCent} 
                               r="15" fill="#EF4444" 
                               stroke="#FFFFFF" strokeWidth="2.5"
                               className="shadow-[0_0_20px_rgba(239,68,68,0.8)] drop-shadow-lg transition-transform group-hover:scale-110"
                             />
                             {/* Etiqueta del número sobre el punto */}
                             <text 
                               x={xLugar} y={yLugarCent + 4} 
                               fontSize="12" fill="white" fontWeight="bold" textAnchor="middle" className="pointer-events-none"
                             >
                               {lugar}
                             </text>
                          </g>
                        );
                      })}

                    </g>
                  );
                })}

                {/* Tooltip Dinámico y Líneas Conectoras (Solo rack activo) */}
                {esRackActivo && (
                  <g>
                    {/* Líneas para conectar la etiqueta flotante superior con cada punto */}
                    {lugaresArr.map(lugar => (
                       <path 
                         key={`conn-${lugar}`}
                         d={`M ${rackWidth/2} -80 L ${calcX(lugar)} ${rackHeight - (nivel * nivelHeight) + (nivelHeight / 2) - 20}`}
                         stroke="#1E293B" 
                         strokeWidth="2" 
                         strokeDasharray="4 6"
                         fill="none"
                         opacity="0.4"
                       />
                    ))}
                    
                    {/* Etiqueta Flotante */}
                    <rect 
                      x={(rackWidth/2) - 160} 
                      y="-120" 
                      width="320" 
                      height="40" 
                      rx="8" 
                      fill="#1E293B" 
                      className="drop-shadow-xl shadow-red-500/30"
                    />
                    <text 
                      x={rackWidth/2} y="-95" 
                      fill="#FFFFFF" 
                      fontSize="14" 
                      fontWeight="bold" 
                      textAnchor="middle"
                    >
                      ESTÁ AQUÍ: {nombreInsumo ? nombreInsumo.toUpperCase() : 'ÍTEM'} ({rack}-{lugaresArr.join('-')}-{nivel})
                    </text>
                  </g>
                )}

              </g>
            );
          })}
        </svg>
      )}

        </div>

        {/* Panel lateral (lado derecho) */}
        {(panelItem || panelVacio) && (
          <div className="w-1/5 border-l border-slate-200 
            bg-slate-50 p-3 flex flex-col gap-3
            animate-in slide-in-from-right duration-200
            overflow-y-auto">
            
            {/* Botón cerrar */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPanelItem(null);
                setPanelVacio(null);
                setSlotSeleccionado(null);
              }}
              className="self-end flex items-center 
                justify-center w-6 h-6 rounded-full 
                bg-slate-200 hover:bg-slate-300 
                text-slate-600 hover:text-slate-800 
                transition-all text-xs font-bold
                flex-shrink-0"
            >
              ✕
            </button>

            {panelItem ? (
              <>
                {/* Header */}
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-400 
                    uppercase tracking-wider font-bold">
                    Materia Prima
                  </p>
                  <p className="text-sm font-black 
                    text-slate-800 leading-tight">
                    {panelItem.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    CERT: {panelItem.certificate}
                  </p>
                </div>

                {/* Datos */}
                <div className="flex flex-col gap-2 mt-1">
                  {[
                    { 
                      label: "Stock actual", 
                      value: panelItem.currentStock >= 1000
                        ? `${(panelItem.currentStock/1000)
                            .toLocaleString()} kg`
                        : `${panelItem.currentStock
                            .toLocaleString()} g`
                    },
                    { 
                      label: "Stock mínimo", 
                      value: `${panelItem.minStock/1000} kg` 
                    },
                    { 
                      label: "Estado", 
                      value: panelItem.status === 'normal' 
                        ? '✅ Normal' 
                        : panelItem.status === 'low' 
                        ? '⚠️ Stock bajo' 
                        : '🔴 Crítico' 
                    },
                    { 
                      label: "Ubicación", 
                      value: `Rack ${panelItem.rack} • L${panelItem.place} • N${panelItem.level}` 
                    },
                  ].map(({ label, value }) => (
                    <div key={label} 
                      className="bg-white rounded-lg p-2 
                        border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-400 
                        uppercase tracking-wider mb-1">
                        {label}
                      </p>
                      <p className="text-xs font-semibold 
                        text-slate-700">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : panelVacio ? (
              <div className="flex flex-col items-center 
                justify-center h-full gap-2 text-center 
                mt-4">
                <span className="text-3xl">📦</span>
                <p className="text-[10px] text-slate-400 
                  font-medium leading-relaxed">
                  Rack {panelVacio.rack}{'\n'}
                  Lugar {panelVacio.lugar}{'\n'}
                  Nivel {panelVacio.nivel}
                </p>
                <p className="text-[10px] text-slate-300">
                  Sin datos
                </p>
              </div>
            ) : null}

          </div>
        )}
      </div>

      {/* Leyenda en el Footer */}
      <div className="mt-8 flex gap-10 text-[14px] font-semibold text-slate-600 border-t border-slate-200 pt-6 w-full justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-slate-50 border-2 border-black"></div>
          Lugar disponible
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-8 h-8 rounded-full bg-red-100 animate-pulse"></div>
            <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white shadow-[0_0_8px_rgba(239,68,68,0.6)] relative z-10"></div>
          </div>
          Materia Prima Seleccionada
        </div>
      </div>
    </div>
  );
};

export default MapaUbicacionRacks;
