-- Add new columns to separate Production from Stock and allow clearer Lote handling
ALTER TABLE productos
ADD COLUMN IF NOT EXISTS lote_code text,
    ADD COLUMN IF NOT EXISTS stock_actual numeric DEFAULT 0;
-- Migrate existing data
-- 1. Set lote_code to id (assuming id was holding the Lote Number)
UPDATE productos
SET lote_code = id
WHERE lote_code IS NULL;
-- 2. Initialize stock_actual with batch_size (assuming initially full stock)
-- NOTE: If you have a way to know current stock (e.g. by subtracting existing remitos), 
-- you might want to run a more complex update. 
-- For now, we set stock_actual = batch_size for simplicity, or 0 if status is not 'available'.
UPDATE productos
SET stock_actual = batch_size
WHERE stock_actual = 0
    AND status = 'available';
-- 3. Ensure we don't punish historical production.
-- If items were "Shipped", their stock might be 0, but their batch_size (Production) remains.
-- Create an index on lote_code for faster searching
CREATE INDEX IF NOT EXISTS idx_productos_lote_code ON productos(lote_code);