import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// ── Feriados nacionales Argentina 2026 ───────────────────────────
const FERIADOS_ARGENTINA_2026 = [
  { mes: 0,  dia: 1  }, // Año Nuevo
  { mes: 1,  dia: 16 }, // Carnaval
  { mes: 1,  dia: 17 }, // Carnaval
  { mes: 2,  dia: 23 }, // Día Nacional de la Memoria
  { mes: 2,  dia: 24 }, // Día Nacional de la Memoria
  { mes: 3,  dia: 2  }, // Malvinas
  { mes: 3,  dia: 3  }, // Viernes Santo
  { mes: 4,  dia: 1  }, // Día del Trabajador
  { mes: 4,  dia: 25 }, // Revolución de Mayo
  { mes: 5,  dia: 15 }, // Güemes
  { mes: 5,  dia: 20 }, // Belgrano
  { mes: 6,  dia: 9  }, // Independencia
  { mes: 7,  dia: 17 }, // San Martín
  { mes: 9,  dia: 12 }, // Diversidad Cultural
  { mes: 10, dia: 20 }, // Soberanía Nacional
  { mes: 10, dia: 23 }, // Soberanía (puente)
  { mes: 11, dia: 7  }, // Inmaculada Concepción
  { mes: 11, dia: 25 }, // Navidad
];

const esFeriado = (fecha: Date): boolean =>
  FERIADOS_ARGENTINA_2026.some(
    f => f.mes === fecha.getMonth() && f.dia === fecha.getDate()
  );

const DIAS_SEMANA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface CalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Helpers ──────────────────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Lunes = 0
}

function formatTodayBadge(d: Date): string {
  const day = d.getDate();
  const month = MESES[d.getMonth()].slice(0, 3).toLowerCase();
  return `Hoy · ${day} ${month}`;
}

// ── Component ────────────────────────────────────────────────────
export const CalendarModal: React.FC<CalendarModalProps> = ({ open, onOpenChange }) => {
  const today = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  if (!open) return null;

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  // Previous month fill
  const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
  const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  const prevDays: (number | null)[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    prevDays.push(-(daysInPrevMonth - i)); // negative = prev month
  }

  // Current month days
  const currentDays: number[] = [];
  for (let i = 1; i <= daysInMonth; i++) currentDays.push(i);

  // Next month fill
  const totalCells = prevDays.length + currentDays.length;
  const nextFill = totalCells <= 35 ? 35 - totalCells : 42 - totalCells;
  const nextDays: number[] = [];
  for (let i = 1; i <= nextFill; i++) nextDays.push(i);

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const yearSpaced = viewYear.toString().split('').join(' ');

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[9999]"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div
        className="fixed z-[10000] top-1/2 left-1/2 calendar-modal-container"
        style={{
          transform: 'translate(-50%, -50%)',
          width: 380,
          borderRadius: 24,
          overflow: 'hidden',
          animation: 'calFadeIn 0.25s ease-out',
        }}
      >
        {/* ── HEADER ─────────────────────────────── */}
        <div className="calendar-modal-header" style={{
          padding: '20px 24px 16px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Ornamento rosa */}
          <div style={{
            position: 'absolute', top: -30, right: -30,
            width: 100, height: 100, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(232,65,122,0.15), transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Calendar icon */}
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'linear-gradient(135deg, #e8417a 0%, #c2185b 100%)',
                boxShadow: '0 4px 12px rgba(232,65,122,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="3"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <circle cx="8" cy="14" r="1" fill="white" stroke="none"/>
                  <circle cx="12" cy="14" r="1" fill="white" stroke="none"/>
                  <circle cx="16" cy="14" r="1" fill="white" stroke="none"/>
                </svg>
              </div>
              <div>
                <div className="calendar-modal-title" style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 600, fontSize: 20, color: 'white', lineHeight: 1.2,
                }}>Calendario</div>
                <div style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 300, fontSize: 11, letterSpacing: 1, marginTop: 2,
                  color: 'rgba(255,255,255,0.4)',
                }}>Planta Varela · {viewYear}</div>
              </div>
            </div>

            {/* Close btn */}
            <button
              onClick={() => onOpenChange(false)}
              className="calendar-modal-close-btn"
              style={{
                width: 32, height: 32, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', border: 'none',
                transition: 'opacity 0.2s',
              }}
            >
              <X size={16} color="rgba(255,255,255,0.6)" />
            </button>
          </div>
        </div>

        {/* ── NAV ────────────────────────────────── */}
        <div className="calendar-modal-nav" style={{
          padding: '20px 28px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button onClick={goToPrevMonth} className="calendar-nav-btn" style={{
            width: 34, height: 34, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', background: 'transparent',
            transition: 'all 0.2s',
          }}>
            <ChevronLeft size={16} />
          </button>

          <div style={{ textAlign: 'center' }}>
            <div className="calendar-month-label" style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 600, fontSize: 22, lineHeight: 1.2,
            }}>{MESES[viewMonth]}</div>
            <div className="calendar-year-label" style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 400, fontSize: 11, letterSpacing: 3,
              marginTop: 2,
            }}>{yearSpaced}</div>
          </div>

          <button onClick={goToNextMonth} className="calendar-nav-btn" style={{
            width: 34, height: 34, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', background: 'transparent',
            transition: 'all 0.2s',
          }}>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* ── DAYS OF WEEK ───────────────────────── */}
        <div className="calendar-modal-body" style={{ padding: '0 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DIAS_SEMANA.map((d, i) => (
              <div
                key={d}
                className="calendar-weekday-label"
                style={{
                  textAlign: 'center',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  padding: '4px 0',
                  color: i >= 5 ? 'rgba(232,65,122,0.7)' : undefined,
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* ── DAY GRID ─────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {/* Prev month */}
            {prevDays.map((_, idx) => {
              const dayNum = daysInPrevMonth - (prevDays.length - 1 - idx);
              return (
                <div key={`prev-${idx}`} className="calendar-day calendar-day-outside" style={{
                  aspectRatio: '1', borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                }}>
                  {dayNum}
                </div>
              );
            })}

            {/* Current month */}
            {currentDays.map(day => {
              const date = new Date(viewYear, viewMonth, day);
              const dayOfWeek = date.getDay();
              const weekend = dayOfWeek === 0 || dayOfWeek === 6;
              const holiday = esFeriado(date);
              const todayFlag = isToday(day);

              let className = 'calendar-day';
              if (todayFlag) className += ' calendar-day-today';
              else if (holiday) className += ' calendar-day-holiday';
              else if (weekend) className += ' calendar-day-weekend';
              else className += ' calendar-day-normal';

              return (
                <div
                  key={day}
                  className={className}
                  style={{
                    aspectRatio: '1', borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                    position: 'relative',
                    cursor: 'default',
                    transition: 'all 0.15s',
                    ...(todayFlag ? {
                      background: 'linear-gradient(135deg, #e8417a 0%, #c2185b 100%)',
                      color: 'white',
                      fontWeight: 600,
                      boxShadow: '0 4px 12px rgba(232,65,122,0.25)',
                    } : {}),
                  }}
                >
                  {day}
                  {holiday && !todayFlag && (
                    <span style={{
                      position: 'absolute', bottom: 4, left: '50%',
                      transform: 'translateX(-50%)',
                      width: 4, height: 4, borderRadius: '50%',
                      background: '#f59e0b',
                    }} />
                  )}
                </div>
              );
            })}

            {/* Next month */}
            {nextDays.map((day, idx) => (
              <div key={`next-${idx}`} className="calendar-day calendar-day-outside" style={{
                aspectRatio: '1', borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontFamily: "'DM Sans', sans-serif",
              }}>
                {day}
              </div>
            ))}
          </div>
        </div>

        {/* ── SEPARATOR ──────────────────────────── */}
        <div style={{
          height: 1, margin: '16px 28px',
          background: 'linear-gradient(90deg, transparent, rgba(30,41,59,0.08), transparent)',
        }} className="calendar-separator" />

        {/* ── FOOTER ─────────────────────────────── */}
        <div className="calendar-modal-footer" style={{
          padding: '0 28px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#f59e0b',
              display: 'inline-block',
            }} />
            <span className="calendar-legend-text" style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
            }}>Feriado nacional</span>
          </div>
          <div style={{
            background: 'rgba(232,65,122,0.12)',
            color: '#e8417a',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11, fontWeight: 500,
            padding: '5px 12px', borderRadius: 20,
            border: '1px solid rgba(232,65,122,0.2)',
          }}>
            {formatTodayBadge(today)}
          </div>
        </div>
      </div>
    </>
  );
};
