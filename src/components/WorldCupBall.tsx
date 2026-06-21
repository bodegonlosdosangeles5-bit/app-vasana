import { useEffect, useState, useRef } from 'react';

export const WorldCupBall = () => {
  const [visible, setVisible] = useState(false);
  const [key, setKey]         = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerNextCycle = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const nextDelay = 30000 + Math.random() * 20000;
    timerRef.current = setTimeout(() => {
      setVisible(true);
      setKey(k => k + 1);
    }, nextDelay);
  };

  useEffect(() => {
    const firstDelay = 8000 + Math.random() * 7000;
    timerRef.current = setTimeout(() => {
      setVisible(true);
      setKey(k => k + 1);
    }, firstDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleAnimationEnd = (e: React.AnimationEvent) => {
    if (e.animationName === 'wc-move-x') {
      setVisible(false);
      triggerNextCycle();
    }
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        .wc-container {
          --wc-scale: 1;
          --wc-start-x: -70px;
          --wc-end-x: calc(100vw + 70px);
          --wc-duration: 9s;
          --wc-height: 220px;
        }

        @media (max-width: 1024px) {
          .wc-container {
            --wc-scale: 0.8;
            --wc-start-x: -56px;
            --wc-end-x: calc(100vw + 56px);
            --wc-duration: 7s;
            --wc-height: 180px;
          }
        }

        @media (max-width: 480px) {
          .wc-container {
            --wc-scale: 0.6;
            --wc-start-x: -42px;
            --wc-end-x: calc(100vw + 42px);
            --wc-duration: 5.5s;
            --wc-height: 140px;
          }
        }

        /* ── Horizontal ── */
        @keyframes wc-move-x {
          from { left: var(--wc-start-x); }
          to   { left: var(--wc-end-x); }
        }

        /*
          ── Vertical con física real ──
          En cada aterrizaje → easeOut  (0,0,0.2,1):  sale rápido, frena al subir
          En cada pico       → easeIn   (0.8,0,1,1):  lento en el pico, acelera al caer
          Sin squash — el balón queda perfectamente redondo en todo momento.
        */
        @keyframes wc-move-y {
          /* aterrizaje → pico 1 (sale rápido) */
          0%   { transform: translateY(0);      animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
          /* pico 1 → aterrizaje (cae acelerado) */
          9%   { transform: translateY(-115px); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }

          /* aterrizaje → pico 2 */
          18%  { transform: translateY(0);      animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
          /* pico 2 → aterrizaje */
          27%  { transform: translateY(-78px);  animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }

          /* aterrizaje → pico 3 */
          36%  { transform: translateY(0);      animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
          /* pico 3 → aterrizaje */
          44%  { transform: translateY(-51px);  animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }

          /* aterrizaje → pico 4 */
          52%  { transform: translateY(0);      animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
          /* pico 4 → aterrizaje */
          58%  { transform: translateY(-28px);  animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }

          /* aterrizaje → pico 5 */
          64%  { transform: translateY(0);      animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
          /* pico 5 → aterrizaje */
          69%  { transform: translateY(-13px);  animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }

          /* rueda hasta salir */
          73%, 100% { transform: translateY(0); }
        }

        /* ── Rotación constante ── */
        @keyframes wc-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(1080deg); }
        }

        /* ── Sombra proyectada ── */
        @keyframes wc-shadow {
          0%        { transform: scaleX(1);    opacity: .40; filter: blur(3px); }
          9%        { transform: scaleX(.22);  opacity: .07; filter: blur(9px); }
          18%       { transform: scaleX(1);    opacity: .40; filter: blur(3px); }
          27%       { transform: scaleX(.32);  opacity: .11; filter: blur(8px); }
          36%       { transform: scaleX(1);    opacity: .40; filter: blur(3px); }
          44%       { transform: scaleX(.50);  opacity: .18; filter: blur(6px); }
          52%       { transform: scaleX(1);    opacity: .40; filter: blur(3px); }
          58%       { transform: scaleX(.65);  opacity: .24; filter: blur(5px); }
          64%       { transform: scaleX(1);    opacity: .40; filter: blur(3px); }
          69%       { transform: scaleX(.78);  opacity: .31; filter: blur(4px); }
          73%, 100% { transform: scaleX(1);    opacity: .40; filter: blur(3px); }
        }
      `}</style>

      <div
        key={key}
        className="wc-container"
        style={{
          position:      'fixed',
          bottom:        0,
          left:          0,
          right:         0,
          height:        'var(--wc-height)',
          overflow:      'hidden',
          pointerEvents: 'none',
          zIndex:        9999,
        }}
      >
        {/* ══ SOMBRA (eje X) ══ */}
        <div style={{
          position:  'absolute',
          bottom:    '4px',
          left:      'var(--wc-start-x)',
          width:     '56px',
          animation: 'wc-move-x var(--wc-duration) linear forwards',
          transform: 'scale(var(--wc-scale))',
          transformOrigin: 'bottom center',
        }}>
          <div style={{
            width:           '56px',
            height:          '11px',
            borderRadius:    '50%',
            background:      'rgba(0,0,0,0.36)',
            transformOrigin: 'center center',
            animation:       'wc-shadow var(--wc-duration) linear forwards',
          }} />
        </div>

        {/* ══ BALÓN: eje X ══ */}
        <div
          onAnimationEnd={handleAnimationEnd}
          style={{
            position:  'absolute',
            bottom:    '8px',
            left:      'var(--wc-start-x)',
            width:     '56px',
            animation: 'wc-move-x var(--wc-duration) linear forwards',
            transform: 'scale(var(--wc-scale))',
            transformOrigin: 'bottom center',
          }}
        >
          {/* ── Eje Y ── */}
          <div style={{
            width:     '56px',
            height:    '56px',
            animation: 'wc-move-y var(--wc-duration) linear forwards',
          }}>
            {/* ── Esfera giratoria ── */}
            <div style={{
              width:        '56px',
              height:       '56px',
              borderRadius: '50%',
              position:     'relative',
              overflow:     'hidden',
              animation:    'wc-spin var(--wc-duration) linear forwards',
              background:   `radial-gradient(circle at 37% 29%,
                #ffffff    0%,
                #f8f8f8   10%,
                #e6e6e6   24%,
                #cccccc   40%,
                #ababab   57%,
                #848484   74%,
                #595959   88%,
                #3a3a3a  100%
              )`,
              boxShadow: [
                'inset -9px -8px 16px rgba(0,0,0,.48)',
                'inset  5px  5px 10px rgba(255,255,255,.88)',
                'inset  2px  2px  4px rgba(255,255,255,.65)',
                'inset  0    0   22px rgba(0,0,0,.18)',
                '0 10px 28px rgba(0,0,0,.30)',
                '0  3px  7px rgba(0,0,0,.18)',
              ].join(', '),
            }}>
              {/* Parches negros */}
              {([
                { width:'18px', height:'14px', top:'6px',  left:'18px', borderRadius:'5px 4px 3px 4px', transform:'rotate(6deg)',   opacity:0.94 },
                { width:'14px', height:'13px', top:'21px', left:'2px',  borderRadius:'4px',              transform:'rotate(-28deg)', opacity:0.91 },
                { width:'14px', height:'13px', top:'21px', left:'38px', borderRadius:'4px',              transform:'rotate(28deg)',  opacity:0.91 },
                { width:'17px', height:'13px', top:'38px', left:'19px', borderRadius:'4px',              transform:'rotate(-4deg)',  opacity:0.93 },
                { width:'11px', height:'9px',  top:'7px',  left:'1px',  borderRadius:'3px',              transform:'rotate(-36deg)', opacity:0.73 },
                { width:'11px', height:'9px',  top:'7px',  left:'42px', borderRadius:'3px',              transform:'rotate(36deg)',  opacity:0.73 },
                { width:'10px', height:'8px',  top:'38px', left:'3px',  borderRadius:'3px',              transform:'rotate(22deg)',  opacity:0.61 },
                { width:'10px', height:'8px',  top:'38px', left:'41px', borderRadius:'3px',              transform:'rotate(-22deg)', opacity:0.61 },
              ] as const).map((s, i) => (
                <div key={i} style={{
                  position:  'absolute',
                  background:'linear-gradient(145deg,#212121 0%,#000 55%,#3a3a3a 100%)',
                  boxShadow: 'inset 0 1.5px 2.5px rgba(255,255,255,.14), inset 0 -1px 3px rgba(0,0,0,.6)',
                  ...s,
                }} />
              ))}

              {/* Sombra ambiental interior */}
              <div style={{
                position:'absolute', inset:0, borderRadius:'50%',
                background:'radial-gradient(ellipse at 64% 72%,rgba(0,0,0,.26) 0%,rgba(0,0,0,.09) 42%,transparent 70%)',
              }} />
              {/* Brillo difuso */}
              <div style={{
                position:'absolute', top:'6px', left:'9px',
                width:'20px', height:'14px', borderRadius:'50%',
                background:'radial-gradient(ellipse,rgba(255,255,255,.94) 0%,rgba(255,255,255,0) 100%)',
                transform:'rotate(-24deg)', filter:'blur(1.2px)',
              }} />
              {/* Brillo especular */}
              <div style={{
                position:'absolute', top:'4px', left:'7px',
                width:'8px', height:'5px', borderRadius:'50%',
                background:'rgba(255,255,255,.78)', transform:'rotate(-24deg)',
              }} />
              {/* Reflejo lateral */}
              <div style={{
                position:'absolute', top:'16px', left:'6px',
                width:'4px', height:'3px', borderRadius:'50%',
                background:'rgba(255,255,255,.42)',
              }} />
              {/* Rim */}
              <div style={{
                position:'absolute', inset:0, borderRadius:'50%',
                boxShadow:'inset 0 0 0 1px rgba(255,255,255,.09)',
              }} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
