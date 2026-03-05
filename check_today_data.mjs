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

async function checkTodayData() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`Checking data for today: ${today}`);

  console.log("\n--- REMITOS ---");
  const { data: remitos, error: rError } = await supabase
    .from('remitos')
    .select('id, destino, fecha, estado, created_at')
    .gte('created_at', today + 'T00:00:00Z')
    .order('created_at', { ascending: false });
  
  if (rError) console.error(rError);
  else console.table(remitos);

  console.log("\n--- ENVIOS ---");
  const { data: envios, error: eError } = await supabase
    .from('envios')
    .select('id, numero_envio, destino, fecha_creacion, estado, created_at')
    .gte('created_at', today + 'T00:00:00Z')
    .order('created_at', { ascending: false });

  if (eError) console.error(eError);
  else console.table(envios);

  console.log("\n--- ENVIOS_REMITOS ---");
  const { data: er, error: erError } = await supabase
    .from('envios_remitos')
    .select('*')
    .gte('created_at', today + 'T00:00:00Z');

  if (erError) console.error(erError);
  else console.table(er);
}

checkTodayData();
