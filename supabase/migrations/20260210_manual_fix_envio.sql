DO $$
DECLARE -- Identificadores para el nuevo registro
    v_remito_id text := 'R-HIST-20260210-MANUAL';
v_envio_id uuid;
v_prod1_id text;
v_prod2_id text;
-- Datos del envío manual
v_fecha timestamp with time zone := '2026-02-10 12:00:00-03';
BEGIN -- 1. IDENTIFICAR PRODUCTOS POR LOTE
-- Buscamos el ID del producto Taski (Lote 76902)
SELECT id INTO v_prod1_id
FROM productos
WHERE lote_code = '76902'
LIMIT 1;
-- Buscamos el ID del producto Bouquet (Lote 76903)
SELECT id INTO v_prod2_id
FROM productos
WHERE lote_code = '76903'
LIMIT 1;
-- Fallback: Si no se encuentran por lote exacto, buscar por nombre aproximado
IF v_prod1_id IS NULL THEN RAISE NOTICE '⚠️ Producto Taski (Lote 76902) no encontrado por código. Buscando por nombre...';
SELECT id INTO v_prod1_id
FROM productos
WHERE name ILIKE '%Taski%35047%'
LIMIT 1;
END IF;
IF v_prod2_id IS NULL THEN RAISE NOTICE '⚠️ Producto Bouquet (Lote 76903) no encontrado por código. Buscando por nombre...';
SELECT id INTO v_prod2_id
FROM productos
WHERE name ILIKE '%Bouquet%41740%'
LIMIT 1;
END IF;
-- Validación final
IF v_prod1_id IS NULL
OR v_prod2_id IS NULL THEN RAISE EXCEPTION '❌ Error Crítico: No se encontraron los productos. Asegúrese de que existen en la tabla `productos` con los lotes 76902 y 76903.';
END IF;
RAISE NOTICE '✅ Productos encontrados. Taski ID: %, Bouquet ID: %',
v_prod1_id,
v_prod2_id;
-- 2. CREAR REMITO HISTÓRICO
-- Insertamos el remito con estado 'cerrado' porque ya se entregó
INSERT INTO remitos (
        id,
        fecha,
        destino,
        total_kilos,
        estado,
        created_at,
        updated_at
    )
VALUES (
        v_remito_id,
        v_fecha,
        'Villa Martelli',
        180,
        -- 90 + 90
        'cerrado',
        v_fecha,
        v_fecha
    ) ON CONFLICT (id) DO NOTHING;
-- 3. CREAR ITEMS DEL REMITO
-- Vinculamos los productos encontrados al remito
-- Item 1: Taski
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
        'RI-' || v_remito_id || '-1',
        v_remito_id,
        v_prod1_id,
        'Taski 35047',
        90,
        1,
        '76902',
        'Stock'
    ) ON CONFLICT (id) DO NOTHING;
-- Item 2: Bouquet
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
        'RI-' || v_remito_id || '-2',
        v_remito_id,
        v_prod2_id,
        'Bouquet p 41740',
        90,
        1,
        '76903',
        'Stock'
    ) ON CONFLICT (id) DO NOTHING;
-- 4. CREAR ENVÍO EN LA TABLA `envios`
-- Generamos un número de envío manual ENV-HIST-...
INSERT INTO envios (
        numero_envio,
        destino,
        fecha_creacion,
        fecha_envio,
        observaciones,
        total_kilos,
        total_remitos,
        estado,
        created_at,
        updated_at
    )
VALUES (
        'ENV-HIST-2026-02-10',
        'Villa Martelli',
        v_fecha,
        v_fecha,
        'Carga manual de envío histórico (10/02/2026)',
        180,
        1,
        'entregado',
        v_fecha,
        v_fecha
    )
RETURNING id INTO v_envio_id;
-- 5. VINCULAR ENVÍO Y REMITO
INSERT INTO envios_remitos (envio_id, remito_id)
VALUES (v_envio_id, v_remito_id);
RAISE NOTICE '✅ Proceso completado. Se creó Envío ID: % y Remito ID: %',
v_envio_id,
v_remito_id;
END $$;