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

async function fixAllDates() {
  console.log("Buscando productos con desfase de fecha...");
  
  // Obtenemos los últimos 100 productos
  const { data, error } = await supabase
    .from('productos')
    .select('id, date, created_at, name')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error consultando productos:", error);
    return;
  }

  let fixedCount = 0;

  for (const p of data) {
    // created_at es UTC. Si es Argentina, restamos 3 horas.
    const createdDate = new Date(p.created_at);
    createdDate.setHours(createdDate.getHours() - 3); // Ajuste manual a GMT-3
    const createdDateStr = createdDate.toISOString().split('T')[0];

    if (p.date !== createdDateStr) {
      console.log(`Corrigiendo ${p.name}: ${p.date} -> ${createdDateStr}`);
      const { error: updateError } = await supabase
        .from('productos')
        .update({ date: createdDateStr })
        .eq('id', p.id);
      
      if (updateError) {
        console.error(`Error corrigiendo ${p.id}:`, updateError);
      } else {
        fixedCount++;
      }
    }
  }

  console.log(`Finalizado. Se corrigieron ${fixedCount} productos.`);
}

fixAllDates();
