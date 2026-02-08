-- Create or Replace view for Production Summary
-- Ensures it aggregates ALL production regardless of current status, using correct date field.
CREATE OR REPLACE VIEW vista_resumen_produccion_diaria AS
SELECT date(date) as fecha_produccion,
    to_char(date(date), 'TMMonth') as mes_nombre,
    extract(
        week
        from date(date)
    ) as semana_del_anio,
    COUNT(*) as total_lotes,
    SUM(batch_size) as total_kg
FROM productos
WHERE destination = 'Villa Martelli' -- Ensure we only count production for VM
    -- AND status = 'available' -- REMOVING this filter to include shipped items in history!
GROUP BY date(date),
    to_char(date(date), 'TMMonth'),
    extract(
        week
        from date(date)
    );