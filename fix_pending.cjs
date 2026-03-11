const fs = require('fs');
const https = require('https');

let envContent = '';
try { envContent = fs.readFileSync('.env', 'utf16le'); } catch(e) {}
if(!envContent || !envContent.includes('VITE_SUPABASE_URL')) {
  try { envContent = fs.readFileSync('.env', 'utf8'); } catch(e) {}
}

let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  const t = line.trim();
  if(t.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = t.split('=')[1].replace(/"/g, '').trim();
  if(t.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = t.split('=')[1].replace(/"/g, '').trim();
});

if(!supabaseUrl || !supabaseKey) {
  console.error("Missing keys");
  process.exit(1);
}

const getRemitosPendientes = () => new Promise((resolve, reject) => {
  https.get(`${supabaseUrl}/rest/v1/remitos?estado=eq.abierto&select=*`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  }, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject);
});

const getEnviosRemitos = () => new Promise((resolve, reject) => {
  https.get(`${supabaseUrl}/rest/v1/envios_remitos?select=remito_id`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  }, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject);
});

const insertEnvio = (envio) => new Promise((resolve, reject) => {
  const body = JSON.stringify(envio);
  const req = https.request(`${supabaseUrl}/rest/v1/envios?select=id`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  }, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => resolve(JSON.parse(data)));
  });
  req.write(body);
  req.end();
});

const insertEnviosRemitos = (rel) => new Promise((resolve, reject) => {
  const body = JSON.stringify(rel);
  const req = https.request(`${supabaseUrl}/rest/v1/envios_remitos`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    }
  }, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => resolve());
  });
  req.write(body);
  req.end();
});

const updateRemitoCerrado = (id) => new Promise((resolve, reject) => {
  const body = JSON.stringify({estado: 'cerrado'});
  const req = https.request(`${supabaseUrl}/rest/v1/remitos?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    }
  }, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => resolve());
  });
  req.write(body);
  req.end();
});

async function run() {
  const remitos = await getRemitosPendientes();
  const enviosRemitos = await getEnviosRemitos();
  const assigned = new Set(enviosRemitos.map(er => er.remito_id));
  
  const pending = remitos.filter(r => !assigned.has(r.id));
  console.log("Found pending remitos:", pending.length);
  
  for(let rem of pending) {
    if(!rem.id) continue;
    console.log("Fixing remito:", rem.id);
    const numeroEnvio = `ENV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}-${String(Date.now()).slice(-4)}`;
    const nuevoEnvio = {
      numero_envio: numeroEnvio,
      destino: rem.destino || 'Villa Martelli',
      fecha_creacion: new Date().toISOString(),
      observaciones: 'Envío automático generado con el remito (RECOVERED)',
      total_kilos: rem.total_kilos,
      total_remitos: 1,
      estado: 'entregado'
    };
    const savedEnvio = await insertEnvio(nuevoEnvio);
    console.log("Created envio:", savedEnvio[0].id);
    await insertEnviosRemitos({ envio_id: savedEnvio[0].id, remito_id: rem.id });
    await updateRemitoCerrado(rem.id);
    console.log("Linked and closed remito.");
  }
}
run().catch(console.error);
