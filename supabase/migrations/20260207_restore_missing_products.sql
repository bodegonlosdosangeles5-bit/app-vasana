-- BACKFILL SCRIPT: Create 'Ghost' Production records from Orphans Remitos
-- Only runs if the Production Record is missing from 'productos' table.
INSERT INTO productos (
        id,
        name,
        batch_size,
        status,
        destination,
        date,
        type,
        created_at,
        lote_code,
        stock_actual
    )
SELECT -- Recover ID if valid, else generate new UUID
    COALESCE(
        NULLIF(ri.producto_id, ''),
        gen_random_uuid()::text
    ),
    -- Name from Remito Item
    ri.nombre_producto,
    -- Total Kilos from Remito Item
    ri.kilos_sumados,
    -- Status 'entregado' because it is in a Remito
    'entregado',
    -- Destination from Remito (Usually 'Villa Martelli')
    r.destino,
    -- Date from Remito (Crucial for History!)
    r.fecha,
    -- Type default
    'stock',
    -- Created At
    r.fecha,
    -- Lote Code (Very import for tracing)
    ri.lote,
    -- Stock Actual must be 0 because it was shipped in this Remito
    0
FROM remito_items ri
    JOIN remitos r ON ri.remito_id = r.id
WHERE -- Only for valid shipments
    r.estado != 'cancelado' -- AND Only if the Product does NOT exist in 'productos' table
    AND NOT EXISTS (
        SELECT 1
        FROM productos p
        WHERE p.id = ri.producto_id
    );
-- FINAL VIEW FIX: Ensure the view catches these new 'entregado' items
CREATE OR REPLACE VIEW vista_resumen_produccion_diaria AS
SELECT date(date) as fecha_produccion,
    SUM(batch_size) as total_kg,
    COUNT(*) as total_lotes,
    to_char(date(date), 'TMMonth') as mes_nombre,
    extract(
        year
        from date(date)
    ) as anio,
    extract(
        week
        from date(date)
    ) as semana_del_anio
FROM productos
WHERE destination ILIKE '%Martelli%'
GROUP BY 1,
    4,
    5,
    6;