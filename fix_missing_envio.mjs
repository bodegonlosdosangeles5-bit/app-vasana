import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envContent = fs.readFileSync('c:/Users/Usuario/Desktop/PROYECTOS/mi-app-new/.env', 'utf8');
if (envContent.includes('\u0000')) {
  envContent = fs.readFileSync('c:/Users/Usuario/Desktop/PROYECTOS/mi-app-new/.env', 'utf16le');
}

const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*([^\r\n]*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*([^\r\n]*)/);

const supabaseUrl = urlMatch?.[1]?.trim();
const supabaseKey = keyMatch?.[1]?.trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMissingEnvio() {
  const remitoId = 'R-1772730440.925075';
  console.log(`Fixing missing Envio for Remito: ${remitoId}`);

  // 1. Get remito data
  const { data: remito, error: rError } = await supabase
    .from('remitos')
    .select('*')
    .eq('id', remitoId)
    .single();

  if (rError) {
    console.error("Error fetching remito:", rError);
    return;
  }

  // 2. Generate Envio Number
  const numeroEnvio = `ENV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}-${String(Date.now()).slice(-4)}`;

  // 3. Create Envio
  const { data: nuevoEnvio, error: envioError } = await supabase
    .from('envios')
    .insert({
      numero_envio: numeroEnvio,
      destino: 'Villa Martelli',
      fecha_creacion: new Date().toISOString(),
      fecha_envio: new Date().toISOString(),
      total_kilos: remito.total_kilos,
      total_remitos: 1,
      estado: 'entregado',
      observaciones: 'Reparación manual: Envío faltante para remito de hoy'
    })
    .select()
    .single();

  if (envioError) {
    console.error("Error creating envio:", envioError);
    return;
  }

  console.log(`✅ Envío creado: ${nuevoEnvio.numero_envio}`);

  // 4. Associate Remito
  const { error: erError } = await supabase
    .from('envios_remitos')
    .insert({
      envio_id: nuevoEnvio.id,
      remito_id: remitoId
    });

  if (erError) {
    console.error("Error associating remito:", erError);
    return;
  }

  console.log(`✅ Remito asociado al envío`);

  // 5. Close Remito
  const { error: cError } = await supabase
    .from('remitos')
    .update({ estado: 'cerrado' })
    .eq('id', remitoId);

  if (cError) {
    console.error("Error closing remito:", cError);
    return;
  }

  console.log(`✅ Remito cerrado`);
}

fixMissingEnvio();
