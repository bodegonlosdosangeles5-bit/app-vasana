-- Las columnas id de envios y envios_remitos quedaron sin valor por defecto
-- (mismo problema que missing_ingredients: se perdió al migrar de proyecto
-- de Supabase). Por eso "GENERAR ENVIO" descontaba el stock y creaba el
-- remito correctamente, pero el registro de envío para el historial fallaba
-- en silencio con "null value in column id violates not-null constraint" y
-- el envío nunca quedaba guardado para consulta.
ALTER TABLE envios ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE envios_remitos ALTER COLUMN id SET DEFAULT gen_random_uuid();
