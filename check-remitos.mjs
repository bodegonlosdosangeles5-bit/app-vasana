import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf-16le');
let supUrl = '';
let supKey = '';
for (const line of envFile.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) supUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supKey = line.split('=')[1].trim();
}

const supabase = createClient(supUrl, supKey);

async function runTest() {
  const { data, error } = await supabase.from('remitos').select('*').gte('fecha', '2026-03-01').order('fecha', { ascending: false });
  console.log("Remitos:", data);
  
  const { data: items } = await supabase.from('remito_items').select('*').in('remito_id', data.map(r => r.id));
  console.log("Remito items today:", items);
}

runTest().catch(console.error);
