import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('development', process.cwd(), '');
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: remitos } = await supabase.from('remitos').select('*').order('created_at', { ascending: false }).limit(5);
  const { data: envios } = await supabase.from('envios').select('*').order('created_at', { ascending: false }).limit(5);
  const { data: envios_remitos } = await supabase.from('envios_remitos').select('*').order('created_at', { ascending: false }).limit(5);

  console.log('REMITOS:');
  remitos.forEach(r => console.log(r.id, r.fecha, r.estado));

  console.log('\nENVIOS:');
  envios.forEach(e => console.log(e.id, e.numero_envio, e.estado));

  console.log('\nENVIOS_REMITOS:');
  envios_remitos.forEach(er => console.log(er.envio_id, er.remito_id));
}

run().catch(console.error);
