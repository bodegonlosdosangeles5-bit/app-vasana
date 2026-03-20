import React, { useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RemitoWithItems } from '@/services/remitoService';

interface VistaPreviaPlantaVarelaProps {
  remito: RemitoWithItems | null;
}

export const VistaPreviaPlantaVarela: React.FC<VistaPreviaPlantaVarelaProps> = ({ remito }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filtrar y ordenar items cumpliendo estrictamente con el Orden ASC por Lote
  const sortedItems = useMemo(() => {
    if (!remito) return [];
    return [...remito.items].sort((a, b) => {
      const loteA = a.lote || '';
      const loteB = b.lote || '';
      return loteA.localeCompare(loteB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [remito]);

  if (!remito || !mounted) return null;

  // Cálculo de totales (Solo lectura visual)
  const totalKilos = sortedItems.reduce((acc, item) => acc + (item.kilos_sumados || 0), 0);
  const totalLotes = sortedItems.reduce((acc, item) => acc + (item.cantidad_lotes || 0), 0);
  
  // Format Date (Fecha del Remito obtenida del objeto)
  const dateFormatted = new Date(remito.fecha + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return createPortal(
    <>
      <style>
        {`
          @media print {
            @page {
              size: A4;
              margin: 0; /* Quitamos márgenes del navegador para garantizarlos internamente a medida */
            }
            body {
              background: white;
              margin: 0;
            }
            /* Ocultar TODO el resto de la interfaz al imprimir (incluido #root) */
            body > *:not(#print-root) {
              display: none !important;
            }
            #print-root {
              position: static;
              width: 100%;
              display: block !important;
            }


            /* Espaciadores para repetir en CADA hoja el layout de 8cm y 6cm */
            .page-header-space {
              height: 8cm;
            }
            .page-footer-space {
              height: 6cm;
            }

            /* Contenedor fijo en cada página impresa (permite que la fecha viva en esos 8cm) */
            .print-header {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 8cm;
            }
            .print-footer {
              position: fixed;
              bottom: 0;
              left: 0;
              width: 100%;
              height: 6cm;
            }

            /* La fecha exactamente a 5cm del borde y alineada a la derecha */
            .date-position {
              position: absolute;
              top: 5cm;
              right: 2cm;
              font-family: Arial, sans-serif;
              font-size: 13pt;
              font-weight: 600;
              color: #000;
            }

            /* Tabla centralizada a partir de los 8cm */
            .main-content {
              width: 100%;
            }
            .content-table {
              width: 70%; /* Ocupará espacio central en la hoja */
              margin: 0 auto;
              border-collapse: collapse;
              font-family: Arial, sans-serif;
              font-size: 11pt;
            }
            .content-table, .content-table tr, .content-table td, .content-table th {
              border: none !important;
              padding: 4px 8px; /* Apretamos el padding para ganar filas */
              color: #000;
              box-shadow: none !important;
              outline: none !important;
            }
            .text-center { text-align: center !important; }
            .text-right { text-align: right !important; }
          }
          
          /* Visualización en pantalla para la Vista Previa: Ocultar todo el remito en el navegador normal */
          @media screen {
            #print-root {
              display: none !important;
            }
          }
        `}
      </style>

      {/* Contenedor principal de impresión */}
      <div id="print-root" className="print-preview-wrapper">
        <div className="print-container">
          
          <div className="print-header">
            <div className="date-position">
              {dateFormatted}
            </div>
          </div>

          <table className="main-content">
            <thead>
              <tr>
                <td>
                  <div className="page-header-space"></div>
                </td>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>
                  <table className="content-table">
                    <colgroup>
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '40%' }} />
                      <col style={{ width: '30%' }} />
                      <col style={{ width: '15%' }} />
                    </colgroup>
                    <tbody>
                      {sortedItems.map((item, index) => (
                        <tr key={item.id || index}>
                          <td className="text-center font-medium">{item.lote || '-'}</td>
                          <td>{item.nombre_producto}</td>
                          <td>{item.cliente_o_stock || 'STOCK'}</td>
                          <td className="text-right">{item.kilos_sumados} kg</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} className="text-right font-bold text-slate-700" style={{ borderRight: 'none', paddingTop: '10px' }}>
                          TOTALES:
                        </td>
                        <td className="text-center font-bold" style={{ paddingTop: '10px' }}>
                          {totalLotes} LOTES
                        </td>
                        <td className="text-right font-bold" style={{ paddingTop: '10px' }}>
                          {totalKilos} kg
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </td>
              </tr>
            </tbody>

            <tfoot>
              <tr>
                <td>
                  <div className="page-footer-space"></div>
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="print-footer"></div>
        </div>
      </div>
    </>,
    document.body
  );
};
