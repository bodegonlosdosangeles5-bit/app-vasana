-- FIX PERMISSIONS AND FUNCTIONS for Precise Metrics
-- Ensures the RPC functions are actually executable and handle user permissions
BEGIN;
-- 1. Drop existing functions to cleanly recreate
DROP FUNCTION IF EXISTS get_weekly_production(date);
DROP FUNCTION IF EXISTS get_monthly_production(date);
-- 2. Weekly Production Function (Calendar week Monday-Sunday)
-- Added 'SECURITY DEFINER' to ensure it can read 'remitos' even if RLS is tricky
CREATE OR REPLACE FUNCTION get_weekly_production(target_date date DEFAULT CURRENT_DATE) RETURNS numeric AS $$ BEGIN RETURN (
        SELECT COALESCE(SUM(total_kilos), 0)
        FROM remitos
        WHERE estado = 'cerrado' -- Using date_trunc for Monday start week
            AND fecha >= date_trunc('week', target_date)::date
            AND fecha <= (
                date_trunc('week', target_date) + interval '6 days'
            )::date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 3. Monthly Production Function (Calendar Month)
CREATE OR REPLACE FUNCTION get_monthly_production(target_date date DEFAULT CURRENT_DATE) RETURNS numeric AS $$ BEGIN RETURN (
        SELECT COALESCE(SUM(total_kilos), 0)
        FROM remitos
        WHERE estado = 'cerrado'
            AND fecha >= date_trunc('month', target_date)::date
            AND fecha <= (
                date_trunc('month', target_date) + interval '1 month - 1 day'
            )::date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 4. Grant execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_weekly_production(date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_production(date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_weekly_production(date) TO service_role;
GRANT EXECUTE ON FUNCTION get_monthly_production(date) TO service_role;
-- 5. Re-create the View with correct permissions
CREATE OR REPLACE VIEW vista_metricas_produccion AS
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
    5;
GRANT SELECT ON vista_metricas_produccion TO authenticated;
GRANT SELECT ON vista_metricas_produccion TO service_role;
COMMIT;