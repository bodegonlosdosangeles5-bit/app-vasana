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
  console.log("Creating user test_user_3000...");
  const createRes = await supabase.rpc('create_user', {
    username_param: 'test_user_3000',
    password_param: 'my_password',
    role_param: 'user'
  });
  console.log("Create result:", createRes.data, createRes.error);

  console.log("Authenticating user test_user_3000...");
  const authRes = await supabase.rpc('authenticate_user', {
    username_param: 'test_user_3000',
    password_param: 'my_password'
  });
  console.log("Auth result:", authRes.data, authRes.error);
  
}

runTest().catch(console.error);
