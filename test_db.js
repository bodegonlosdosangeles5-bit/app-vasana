import * as fs from 'fs';
import pkg from '@supabase/supabase-js';
const { createClient } = pkg;

// parse .env manually
let envContent = '';
try {
  envContent = fs.readFileSync('./.env', 'utf-8');
} catch (e) {
  try {
    envContent = fs.readFileSync('./.env.local', 'utf-8');
  } catch (e2) {
    console.error('No .env found');
  }
}
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    const { data: remitos } = await supabase.from('remitos').select('*').order('created_at', {ascending: false}).limit(10);
    const { data: envios } = await supabase.from('envios').select('*').order('created_at', {ascending: false}).limit(10);
    const { data: envios_remitos } = await supabase.from('envios_remitos').select('*').order('created_at', {ascending: false}).limit(10);
    
    console.log('--- RECENT REMITOS ---');
    console.log(JSON.stringify(remitos, null, 2));
    
    console.log('--- RECENT ENVIOS ---');
    console.log(JSON.stringify(envios, null, 2));
    
    console.log('--- RECENT ENVIOS_REMITOS ---');
    console.log(JSON.stringify(envios_remitos, null, 2));
  } catch (err) {
    console.error(err);
  }
}

main();
