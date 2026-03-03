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
  const { data, error } = await supabase.from('productos').select('*');
  console.log("Error:", error);
  console.log("Total products:", data ? data.length : 0);
  
  // Filter products for today 2026-03-02
  const today = data.filter(p => p.date && p.date.includes('2026-03'));
  console.log("Today's products:", today.map(p => ({
    name: p.name,
    batchSize: p.batch_size,
    stock: p.stock_actual,
    status: p.status,
    destination: p.destination,
    date: p.date
  })));
}

runTest().catch(console.error);
