-- Comprehensive SQL to Recover History, Metrics, and UI Visibility
-- Handles: Missing Products, Zero Stock Logic, and Envio Wrapper Creation
BEGIN;
-- 1. RESTORE MISSING PRODUCTS (For Metrics)
-- Recreates historical products from Remitos if they are missing.
-- Sets 'stock_actual' to 0 so they DO NOT sum to 'Kilos Disponibles'.
-- Sets 'status' to 'entregado' and 'date' to Remito date.
INSERT INTO productos (
        id,
        lOTE_CODE,
        name,
        batch_size,
        stock_actual,
        status,
        destination,
        date,
        type
    )
SELECT DISTINCT ON (ri.producto_id) ri.producto_id,
    -- ID from Remito Item
    ri.producto_id,
    -- Lote Code
    ri.nombre_producto,
    (ri.kilos_sumados / NULLIF(ri.cantidad_lotes, 0)),
    -- Batch Size
    0,
    -- Stock 0 (Correct!)
    'entregado',
    r.destino,
    r.fecha,
    'stock'
FROM remito_items ri
    JOIN remitos r ON ri.remito_id = r.id
WHERE r.estado != 'cancelado'
    AND NOT EXISTS (
        SELECT 1
        FROM productos p
        WHERE p.id = ri.producto_id
    );
-- 2. CREATE MISSING ENVIOS (For UI Visibility in 'Envíos' tab)
-- Wraps orphan Remitos into new Envios so they appear in the UI list.
INSERT INTO envios (
        id,
        numero_envio,
        fecha_creacion,
        destino,
        total_kilos,
        total_remitos,
        estado
    )
SELECT 'ENV-' || r.id,
    -- Generate Envio ID based on Remito ID
    'ENV-' || to_char(r.fecha, 'YYYYMMDD') || '-' || r.id,
    -- Human readable number
    r.fecha,
    r.destino,
    r.total_kilos,
    1,
    -- 1 Remito per Envio wrapper
    r.estado
FROM remitos r
WHERE NOT EXISTS (
        SELECT 1
        FROM envios_remitos er
        WHERE er.remito_id = r.id
    );
-- 3. LINK REMITOS TO NEW ENVIOS
-- Creates the Many-to-Many link
INSERT INTO envios_remitos (id, envio_id, remito_id)
SELECT uuid_generate_v4(),
    -- Random ID for link
    'ENV-' || r.id,
    -- The Envio ID we just created
    r.id -- The Remito ID
FROM remitos r
WHERE NOT EXISTS (
        SELECT 1
        FROM envios_remitos er
        WHERE er.remito_id = r.id
    );
-- 4. FIX VIEW (For Charts)
-- Ensures the view sees everything regardless of status
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