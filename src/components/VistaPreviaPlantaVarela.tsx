import React, { useEffect, useState } from 'react';
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

  const sortedItems = (() => {
    if (!remito) return [];

    return [...remito.items].sort((a, b) => {
      const loteA = a.lote || '';
      const loteB = b.lote || '';
      return loteA.localeCompare(loteB, undefined, { numeric: true, sensitivity: 'base' });
    });
  })();

  if (!remito || !mounted) return null;

  // Cálculo de totales
  const totalKilos = sortedItems.reduce((acc, item) => acc + (item.kilos_sumados || 0), 0);
  
  let dateFormatted = new Date().toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Paginación Manual Segura (React JS Chunking)
  const ITEMS_PER_PAGE = 25;
  const pages = [];
  for (let i = 0; i < sortedItems.length; i += ITEMS_PER_PAGE) {
    pages.push(sortedItems.slice(i, i + ITEMS_PER_PAGE));
  }

  return createPortal(
    <>
      <style>
        {`
          @media print {
            @page {
              size: A4;
              margin: 0;
            }

            body {
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            body > *:not(#print-root) {
              display: none !important;
            }

            #print-root {
              display: block !important;
              width: 210mm;
            }

            .print-page {
              width: 210mm;
              height: 297mm;
              box-sizing: border-box;
              page-break-after: always;
              break-after: page;
              overflow: hidden;
              display: flex;
              flex-direction: column;
            }

            .print-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }

            /* Bloque superior: 8cm fijos */
            .page-header-space {
              flex: 0 0 8cm;
              width: 100%;
              position: relative;
              box-sizing: border-box;
            }

            /* Bloque inferior: 6cm fijos */
            .page-footer-space {
              flex: 0 0 6cm;
              width: 100%;
              box-sizing: border-box;
            }

            .page-content {
              flex: 1;
              display: flex;
              flex-direction: column;
              width: 86%;
              margin-left: 7%;
              margin-right: 7%;
              box-sizing: border-box;
              overflow: hidden;
              padding: 0;
            }

            /* Contenedor de la tabla empuja el resto hacia abajo */
            .items-container {
              width: 100%;
              height: max-content;
            }

            /* Info de la empresa alineada con la fecha (top: 6cm) y en horizontal con "nombre_producto" */
            .company-info-block {
              position: absolute;
              top: calc(6cm - 12pt); /* Sube una línea (10pt * 1.2) para que TALCAHUANO quede a 6cm */
              left: calc(19.9% + 2pt); /* Alineado a la columna Producto */
              font-family: Arial, sans-serif;
              font-size: 10pt;
              font-weight: 600;
              text-align: left;
              color: #000;
              line-height: 1.2;
            }

            /* Fecha a 6cm desde el borde superior de la hoja */
            .date-position {
              position: absolute;
              top: 6cm;
              right: 2cm;
              font-family: Arial, sans-serif;
              font-size: 10pt;
              font-weight: 600;
              color: #000;
            }

            /* Estilos generales de tabla */
            .content-table, .total-table {
              width: 100%;
              height: max-content !important;
              border-collapse: collapse;
              font-family: Arial, sans-serif;
              font-size: 10pt;
              margin: 0 !important;
              padding: 0 !important;
            }

            .content-table tr {
              height: 14pt !important;
              max-height: 14pt !important;
              overflow: hidden !important;
            }

            .content-table td {
              padding: 1pt 2pt !important;
              font-size: 10pt !important;
              line-height: 12pt !important;
              height: 14pt !important;
              max-height: 14pt !important;
              color: #000;
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
              border: none !important;
              vertical-align: middle !important;
            }

            /* Anchos estrictos para alineación idéntica */
            .col-lote    { width: 15%; text-align: center; }
            .col-prod    { width: 40%; text-align: left; }
            .col-cliente { width: 30%; text-align: left; }
            .col-kilos   { width: 15%; text-align: right; }

            /* Contenedor de totales que se fondea al final del page-content */
            .total-container {
              width: 100%;
              margin-top: auto;
              padding-top: 5pt;
            }

            .total-table td {
              font-weight: 900 !important;
              color: #000 !important;
              border: none !important;
              padding-top: 4pt;
              padding-bottom: 4pt;
            }
          }

          @media screen {
            #print-root { display: none !important; }
          }
        `}
      </style>

      <div id="print-root">
        {pages.map((pageItems, pageIndex) => {
          const isLastPage = pageIndex === pages.length - 1;
          return (
            <div key={pageIndex} className="print-page">
              
              {/* BLOQUE DE 8cm: Header superior físico */}
              <div className="page-header-space">
                <div className="company-info-block">
                  <div>VASANA SA</div>
                  <div>TALCAHUANO 279</div>
                  <div>VILLA MARTELLI</div>
                </div>
                <div className="date-position">{dateFormatted}</div>
              </div>

              {/* BLOQUE CENTRAL: Contenido flexible */}
              <div className="page-content">
                <div className="items-container">
                  <table className="content-table">
                    <tbody>
                      {pageItems.map((item: any, index: number) => (
                        <tr key={item.id || index}>
                          <td className="col-lote">{item.lote || '-'}</td>
                          <td className="col-prod">{item.nombre_producto}</td>
                          <td className="col-cliente">{item.cliente_o_stock || 'STOCK'}</td>
                          <td className="col-kilos">{item.kilos_sumados} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Aparece SOLO en la última página, fondeado al fondo gracias a margin-top: auto */}
                {isLastPage && (
                  <div className="total-container">
                    <table className="total-table">
                      <tbody>
                        <tr>
                          <td className="col-lote" style={{ textAlign: 'center' }}>Total</td>
                          <td className="col-prod">{sortedItems.length}</td>
                          <td className="col-cliente"></td>
                          <td className="col-kilos" style={{ textAlign: 'right' }}>Kilos {totalKilos}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* BLOQUE DE 6cm: Margen inferior físico vacío */}
              <div className="page-footer-space"></div>
            </div>
          );
        })}
      </div>
    </>,
    document.body
  );
};
