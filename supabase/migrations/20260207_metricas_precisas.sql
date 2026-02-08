-- Create precise aggregation functions for Metrics
-- 1. Weekly Production Function (Calendar week Monday-Sunday)
CREATE OR REPLACE FUNCTION get_weekly_production(target_date date DEFAULT CURRENT_DATE) RETURNS numeric AS $$ BEGIN RETURN (
        SELECT COALESCE(SUM(total_kilos), 0)
        FROM remitos
        WHERE estado = 'cerrado'
            AND fecha >= date_trunc('week', target_date)::date
            AND fecha <= (
                date_trunc('week', target_date) + interval '6 days'
            )::date
    );
END;
$$ LANGUAGE plpgsql;
-- 2. Monthly Production Function (Calendar Month)
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
$$ LANGUAGE plpgsql;
-- 3. Dynamic View for Charts (Using Remitos instead of Products for truth)
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