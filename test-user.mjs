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
  const userId = 'cd9355c6-f759-4663-b9e4-bd96318d4f48';
  console.log("Fetching test_user_3000 by id:", userId);
  const userRes = await supabase.rpc('get_user_by_id', { user_id_param: userId });
  console.log("Get user result:", userRes.data, userRes.error);
}

runTest().catch(console.error);
