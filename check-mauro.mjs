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
  console.log("Fetching mauro...");
  const usersRes = await supabase.rpc('get_all_users');
  console.log(usersRes.data.filter(u => u.user_name.toLowerCase().includes('mauro')));
  
  // also get test_user
  console.log(usersRes.data.filter(u => u.user_name.includes('test_user_3000')));
}

runTest().catch(console.error);
