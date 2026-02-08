-- FORCE DATA FIX based on provided IDs
-- Using specific query to relink and restore data.
BEGIN;
-- 1. Ensure Data Integrity for historical items
-- We noticed in the screenshots that 'producto_id' are simple numbers like '76573', '76655'.
-- But new system uses UUIDs or 'P-TIMESTAMP'.
-- We need to check if these IDs exist in 'productos'. 
-- If they assume 'producto_id' is the LOTE NUMBER, we must treat it as 'lote_code'.
-- PLAN: Insert missing products, linking them correctly.
INSERT INTO productos (
        id,
        -- Use the ID from remito_items as the PRODUCT ID to maintain link
        lote_code,
        -- Also use it as Lote Code
        name,
        batch_size,
        stock_actual,
        status,
        destination,
        date,
        type
    )
SELECT DISTINCT ON (ri.producto_id) ri.producto_id,
    -- The ID is e.g. '76573'
    ri.producto_id,
    -- The Lote is likely same
    ri.nombre_producto,
    (ri.kilos_sumados / NULLIF(ri.cantidad_lotes, 0)),
    -- Attempt to normalize batch size per lot if aggregated
    0,
    -- Stock is 0 because it was shipped
    'entregado',
    -- Status to indicate it's done
    r.destino,
    r.fecha,
    -- Date from Remito
    'stock'
FROM remito_items ri
    JOIN remitos r ON ri.remito_id = r.id
WHERE r.estado != 'cancelado'
    AND NOT EXISTS (
        SELECT 1
        FROM productos p
        WHERE p.id = ri.producto_id
    );
-- 2. Update the View to catch everything
CREATE OR REPLACE VIEW vista_resumen_produccion_diaria AS
SELECT date(date) as fecha_produccion,
    SUM(batch_size) as total_kg,
    COUNT(*) as total_lotes,
    to_char(date(date), 'TMMonth') as mes_nombre,
    extract(
        week
        from date(date)
    ) as semana_del_anio
FROM productos
WHERE destination ILIKE '%Martelli%'
GROUP BY 1,
    4,
    5;
COMMIT;