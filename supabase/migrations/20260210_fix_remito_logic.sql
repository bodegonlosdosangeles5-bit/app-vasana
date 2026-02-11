-- 1. Función RPC Transaccional para crear remito y descontar stock
CREATE OR REPLACE FUNCTION procesar_envio_remito(
        p_destino text,
        p_fecha timestamp with time zone,
        p_items jsonb -- Array de objetos {producto_id, cantidad, nombre, lote, tipo, cliente, stock_actual}
    ) RETURNS jsonb AS $$
DECLARE v_remito_id text;
v_total_kilos numeric := 0;
v_item jsonb;
v_new_stock numeric;
v_current_stock numeric;
v_batch_size numeric;
BEGIN -- Calcular total kilos del remito
SELECT COALESCE(SUM((item->>'cantidad')::numeric), 0) INTO v_total_kilos
FROM jsonb_array_elements(p_items) as item;
-- Generar ID de remito
v_remito_id := 'R-' || extract(
    epoch
    from now()
)::text;
-- Insertar Remito
INSERT INTO remitos (id, fecha, destino, total_kilos, estado)
VALUES (
        v_remito_id,
        p_fecha,
        p_destino,
        v_total_kilos,
        'abierto'
    );
-- Procesar cada item
FOR v_item IN
SELECT *
FROM jsonb_array_elements(p_items) LOOP -- Insertar Item de Remito
INSERT INTO remito_items (
        id,
        remito_id,
        producto_id,
        nombre_producto,
        kilos_sumados,
        cantidad_lotes,
        lote,
        cliente_o_stock
    )
VALUES (
        'RI-' || extract(
            epoch
            from now()
        )::text || '-' || floor(random() * 1000)::text,
        v_remito_id,
        v_item->>'producto_id',
        v_item->>'nombre',
        (v_item->>'cantidad')::numeric,
        1,
        v_item->>'lote',
        v_item->>'cliente' -- 'Stock' or Client Name
    );
-- Descontar Stock (Atomic Update)
-- Obtenemos el stock actual directamente de la DB para evitar race conditions
SELECT stock_actual,
    batch_size INTO v_current_stock,
    v_batch_size
FROM productos
WHERE id = (v_item->>'producto_id');
-- Si stock_actual es null (legacy), usamos batch_size
IF v_current_stock IS NULL THEN v_current_stock := v_batch_size;
END IF;
-- Calcular nuevo stock
v_new_stock := GREATEST(
    0,
    v_current_stock - (v_item->>'cantidad')::numeric
);
-- Actualizar producto
UPDATE productos
SET stock_actual = v_new_stock,
    updated_at = now() -- NO cambiamos el status a 'entregado/shipped' para no romper la integridad referencial si se usa para métricas.
    -- Simplemente el stock llega a 0.
    -- El dashboard filtrará items con stock > 0.
WHERE id = (v_item->>'producto_id');
END LOOP;
RETURN jsonb_build_object('success', true, 'remito_id', v_remito_id);
EXCEPTION
WHEN OTHERS THEN RAISE EXCEPTION 'Error procesando remito: %',
SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 2. Redefinir métricas históricas para basarse en PRODUCCIÓN (batch_size) y no en Envíos + Stock
-- Esto cumple el requisito: "Las métricas... deben seguir acumulando todos los kilos fabricados... independientemente de si ya se enviaron"
-- Función Semanal
CREATE OR REPLACE FUNCTION get_weekly_production_total(target_date date DEFAULT CURRENT_DATE) RETURNS numeric AS $$ BEGIN RETURN (
        SELECT COALESCE(SUM(batch_size), 0)
        FROM productos
        WHERE date >= date_trunc('week', target_date)::date
            AND date <= (
                date_trunc('week', target_date) + interval '6 days'
            )::date
            AND destination = 'Villa Martelli' -- Asumiendo que solo contamos VM o filtrar según necesidad
            -- O quitar el filtro de destination si es producción global
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Función Mensual
CREATE OR REPLACE FUNCTION get_monthly_production_total(target_date date DEFAULT CURRENT_DATE) RETURNS numeric AS $$ BEGIN RETURN (
        SELECT COALESCE(SUM(batch_size), 0)
        FROM productos
        WHERE date >= date_trunc('month', target_date)::date
            AND date <= (
                date_trunc('month', target_date) + interval '1 month - 1 day'
            )::date
            AND destination = 'Villa Martelli'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 3. Actualizar la Vista para gráficos
-- PRIMERO ELIMINAMOS LA VISTA ANTIGUA para evitar errores de cambio de tipo de columna (numeric vs bigint)
DROP VIEW IF EXISTS vista_metricas_produccion_total;
CREATE OR REPLACE VIEW vista_metricas_produccion_total AS
SELECT date as fecha_produccion,
    SUM(batch_size)::numeric as total_kg,
    -- Explicit cast to numeric to match established types
    COUNT(*) as total_lotes,
    -- Usamos total lotes en lugar de remitos, ya que estamos viendo producción
    to_char(date, 'TMMonth') as mes_nombre,
    extract(
        week
        from date
    ) as semana_del_anio
FROM productos
WHERE destination = 'Villa Martelli'
GROUP BY 1,
    4,
    5;
-- Grant permissions
GRANT EXECUTE ON FUNCTION procesar_envio_remito(text, timestamp with time zone, jsonb) TO authenticated,
    service_role;
GRANT EXECUTE ON FUNCTION get_weekly_production_total(date) TO authenticated,
    service_role;
GRANT EXECUTE ON FUNCTION get_monthly_production_total(date) TO authenticated,
    service_role;
GRANT SELECT ON vista_metricas_produccion_total TO authenticated,
    service_role;