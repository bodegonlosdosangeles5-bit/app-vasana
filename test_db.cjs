const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: './.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    const { data: remitos } = await supabase.from('remitos').select('*').order('created_at', {ascending: false}).limit(5);
    const { data: envios } = await supabase.from('envios').select('*').order('created_at', {ascending: false}).limit(5);
    const { data: envios_remitos } = await supabase.from('envios_remitos').select('*').order('created_at', {ascending: false}).limit(5);
    
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
