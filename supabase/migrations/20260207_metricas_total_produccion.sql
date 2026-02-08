-- ACTUALIZAR FUNCIONES DE MÉTRICAS PARA INCLUIR PRODUCCIÓN ACTUAL
-- Las métricas deben sumar: Remitos Cerrados + Productos en Producción Actual
BEGIN;
-- 1. Función para obtener producción actual (productos disponibles)
CREATE OR REPLACE FUNCTION get_current_production_kilos() RETURNS numeric AS $$ BEGIN RETURN (
        SELECT COALESCE(SUM(stock_actual), 0)
        FROM productos
        WHERE status = 'available'
            AND destination = 'Villa Martelli'
            AND stock_actual > 0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 2. Función Semanal TOTAL (Remitos + Producción Actual)
CREATE OR REPLACE FUNCTION get_weekly_production_total(target_date date DEFAULT CURRENT_DATE) RETURNS numeric AS $$
DECLARE remitos_kilos numeric;
current_kilos numeric;
BEGIN -- Kilos de remitos cerrados de la semana
SELECT COALESCE(SUM(total_kilos), 0) INTO remitos_kilos
FROM remitos
WHERE estado = 'cerrado'
    AND fecha >= date_trunc('week', target_date)::date
    AND fecha <= (
        date_trunc('week', target_date) + interval '6 days'
    )::date;
-- Kilos en producción actual
SELECT get_current_production_kilos() INTO current_kilos;
RETURN remitos_kilos + current_kilos;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 3. Función Mensual TOTAL (Remitos + Producción Actual)
CREATE OR REPLACE FUNCTION get_monthly_production_total(target_date date DEFAULT CURRENT_DATE) RETURNS numeric AS $$
DECLARE remitos_kilos numeric;
current_kilos numeric;
BEGIN -- Kilos de remitos cerrados del mes
SELECT COALESCE(SUM(total_kilos), 0) INTO remitos_kilos
FROM remitos
WHERE estado = 'cerrado'
    AND fecha >= date_trunc('month', target_date)::date
    AND fecha <= (
        date_trunc('month', target_date) + interval '1 month - 1 day'
    )::date;
-- Kilos en producción actual
SELECT get_current_production_kilos() INTO current_kilos;
RETURN remitos_kilos + current_kilos;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 4. Otorgar permisos
GRANT EXECUTE ON FUNCTION get_current_production_kilos() TO authenticated,
    service_role;
GRANT EXECUTE ON FUNCTION get_weekly_production_total(date) TO authenticated,
    service_role;
GRANT EXECUTE ON FUNCTION get_monthly_production_total(date) TO authenticated,
    service_role;
-- 5. Vista actualizada para gráficos (incluye producción actual del día de hoy)
CREATE OR REPLACE VIEW vista_metricas_produccion_total AS
SELECT fecha as fecha_produccion,
    SUM(total_kilos) as total_kg,
    COUNT(*) as total_remitos,
    to_char(fecha, 'TMMonth') as mes_nombre,
    extract(
        week
        from fecha
    ) as semana_del_anio
FROM remitos
WHERE estado = 'cerrado'
GROUP BY 1,
    4,
    5
UNION ALL
-- Agregar producción actual como entrada del día de hoy
SELECT CURRENT_DATE as fecha_produccion,
    get_current_production_kilos() as total_kg,
    0 as total_remitos,
    to_char(CURRENT_DATE, 'TMMonth') as mes_nombre,
    extract(
        week
        from CURRENT_DATE
    ) as semana_del_anio
WHERE get_current_production_kilos() > 0;
GRANT SELECT ON vista_metricas_produccion_total TO authenticated,
    service_role;
COMMIT;