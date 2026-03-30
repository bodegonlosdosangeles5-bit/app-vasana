import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.VITE_SUPABASE_URL ||
  'https://xfkgrcygkqfusfsjvdly.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function migratePasswords() {
  console.log('🔄 Obteniendo usuarios...');
  const { data: users, error } = await supabase
    .from('users')
    .select('id, user_name, password');

  if (error) {
    console.error('Error obteniendo usuarios:', error);
    process.exit(1);
  }

  console.log(`📋 ${users.length} usuarios encontrados`);

  for (const user of users) {
    // Si ya está hasheado (empieza con $2b$ o $2a$), saltear
    if (user.password?.startsWith('$2b$') ||
        user.password?.startsWith('$2a$')) {
      console.log(`✅ ${user.user_name} ya tiene contraseña hasheada, saltando`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(user.password, 12);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', user.id);

    if (updateError) {
      console.error(`❌ Error actualizando ${user.user_name}:`, updateError);
    } else {
      console.log(`✅ ${user.user_name} → contraseña hasheada correctamente`);
    }
  }

  console.log('✅ Migración completada');
}

migratePasswords();
