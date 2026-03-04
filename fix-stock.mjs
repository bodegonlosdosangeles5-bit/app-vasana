import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xfkgrcygkqfusfsjvdly.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhma2dyY3lna3FmdXNmc2p2ZGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMDE3MzcsImV4cCI6MjA3NDY3NzczN30.dHLljphdMn3hg1u22E3snWI-p-IbpsW6y44q-Ldr4qI'
);

async function run() {
  console.log("Restaurando stock_actual y eliminando remitos de prueba...");
  
  // 1. Restaurar stock de los productos del 02-03-2026
  const { data: productos, error: errProd } = await supabase
    .from('productos')
    .select('id, batch_size')
    .eq('date', '2026-03-02')
    .eq('stock_actual', 0);
    
  if (errProd) {
    console.error("Error fetching productos:", errProd);
    return;
  }
  
  console.log(`Encontrados ${productos.length} productos para restaurar.`);
  
  for (const p of productos) {
    await supabase
      .from('productos')
      .update({ stock_actual: p.batch_size })
      .eq('id', p.id);
  }
  
  // 2. Eliminar items de remitos de ayer para que se puedan borrar los remitos
  const remitoIds = [
    "R-1772478379.393685",
    "R-1772478369.618968",
    "R-1772470518.973037"
  ];
  
  for (const rid of remitoIds) {
    await supabase.from('remito_items').delete().eq('remito_id', rid);
    await supabase.from('remitos').delete().eq('id', rid);
    console.log(`Borrados items y remito ${rid}`);
  }
  
  console.log("Terminado.");
}

run();
