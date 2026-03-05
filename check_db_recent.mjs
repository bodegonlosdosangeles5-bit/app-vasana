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

if (!supabaseUrl || !supabaseKey) {
  console.error("No se pudieron leer las credenciales de Supabase");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentProducts() {
  console.log("Consultando productos recientes...");
  const { data, error } = await supabase
    .from('productos')
    .select('id, name, date, created_at, destination')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error("Error consultando productos:", error);
    return;
  }

  console.log("ID | Nombre | Fecha Guardada | Creado En | Destino");
  data.forEach(p => {
    console.log(`${p.id} | ${p.name.padEnd(20)} | ${p.date} | ${p.created_at} | ${p.destination}`);
  });
}

checkRecentProducts();
