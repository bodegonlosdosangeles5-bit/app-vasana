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
  const { data, error } = await supabase.rpc('get_all_users'); // Just a test to see if we can do raw query? No, we can't easily query pg_trigger.
  // Instead, let's just insert a test product and see what comes back.
  const { data: insertData, error: insertError } = await supabase
    .from('productos')
    .insert({
      id: 'test-product-' + Date.now(),
      name: 'TEST PRODUCT',
      batch_size: 100,
      stock_actual: 100,
      status: 'available',
      destination: 'Villa Martelli',
      type: 'stock'
    })
    .select()
    .single();
    
    console.log("Insert result:", insertData, insertError);
}

runTest().catch(console.error);
