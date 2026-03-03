require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function runTest() {
  console.log("Creating user test_user_2000...");
  const createRes = await supabase.rpc('create_user', {
    username_param: 'test_user_2000',
    password_param: 'my_password',
    role_param: 'user'
  });
  console.log("Create result:", createRes.data, createRes.error);

  console.log("Authenticating user test_user_2000...");
  const authRes = await supabase.rpc('authenticate_user', {
    username_param: 'test_user_2000',
    password_param: 'my_password'
  });
  console.log("Auth result:", authRes.data, authRes.error);
  
  // also check if role is affecting it.
  console.log("Fetching test_user_2000...");
  const usersRes = await supabase.rpc('get_all_users');
  console.log("All users result:", usersRes.data ? usersRes.data.filter(u => u.user_name === 'test_user_2000') : null);
}

runTest().catch(console.error);
