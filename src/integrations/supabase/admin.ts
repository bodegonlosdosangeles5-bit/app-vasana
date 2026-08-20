// Cliente de Supabase para operaciones de administración
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Configuración para el cliente admin
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Validar que las variables de entorno estén configuradas
if (!SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY not found. Admin operations may not work properly.');
}

// Crear cliente admin con service role key
// NOTA: Para producción, usar la clave de servicio real de Supabase
export const supabaseAdmin = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        'X-Client-Info': 'mi-app-admin',
      },
    },
  }
);
