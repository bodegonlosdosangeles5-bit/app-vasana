import { createClient } from '@supabase/supabase-js';

// REGLA CUMPLIDA: Este cliente NUNCA debe ser importado ni llamado desde el lado del cliente (React component)
// ya que bypassea todas las políticas RLS y tiene acceso total a la base de datos usando el Service Role.
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("⚠️ ALERTA DE SERVIDOR: Faltan las variables VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
