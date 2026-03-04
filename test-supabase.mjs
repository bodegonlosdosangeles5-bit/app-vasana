import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xfkgrcygkqfusfsjvdly.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhma2dyY3lna3FmdXNmc2p2ZGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMDE3MzcsImV4cCI6MjA3NDY3NzczN30.dHLljphdMn3hg1u22E3snWI-p-IbpsW6y44q-Ldr4qI'
);

async function run() {
  const { data, error } = await supabase
    .from('productos')
    .select('id, name, date, batch_size, stock_actual, destination, status')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

run();
