-- Rscript to recalculate Stock and fix Dates based on Historical Remitos
-- This handles the specific dates (03/02/2026, 06/02/2026) and any other historical data securely.
BEGIN;
-- 1. Recalculate Stock Actual for ALL products containing historical shipments.
-- This ensures that the Remitos from 03/02 and 06/02 are subtracted from the Stock.
WITH shipped_totals AS (
    SELECT ri.producto_id,
        SUM(ri.kilos_sumados) as total_shipped
    FROM remito_items ri
        JOIN remitos r ON ri.remito_id = r.id
    WHERE r.estado != 'cancelado' -- Only count valid shipments
    GROUP BY ri.producto_id
)
UPDATE productos p
SET stock_actual = GREATEST(0, p.batch_size - st.total_shipped)
FROM shipped_totals st
WHERE p.id = st.producto_id;
-- 2. "Rescue" Production Metrics (Date Fix)
-- If a product has no date (and thus doesn't appear in charts) but was shipped,
-- we infer the production date from the shipment date.
UPDATE productos p
SET date = r.fecha
FROM remito_items ri
    JOIN remitos r ON ri.remito_id = r.id
WHERE p.id = ri.producto_id
    AND p.date IS NULL;
-- 3. Ensure Status Consistency
-- If a product has 0 stock, it should intuitively be marked as 'entregado' or similar if business logic requires,
-- BUT for "Production Metrics", we usually filter by 'available'. 
-- IF existing logic filters by status='available' to show production, we must ensure these historical items 
-- are NOT hidden if they are just "Old Production". 
-- However, usually "Active Stock" view filters by Available. "Production Reports" should filter by ALL valid statuses.
-- We'll force status to 'available' if it's currently 'incomplete' but has been shipped (logic fix).
UPDATE productos
SET status = 'available'
WHERE id IN (
        SELECT producto_id
        FROM remito_items
    )
    AND status = 'incomplete';
COMMIT;
-- Verify results (Optional SELECT to show user what changed)
-- SELECT id, name, batch_size, stock_actual, date FROM productos WHERE id IN (SELECT producto_id FROM remito_items);