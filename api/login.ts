import { supabaseAdmin } from '../lib/supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  // CORS configuration (soporta Vercel deploy cruzado entre frontend dinámico y backend)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Por favor completa todos los campos' });
  }

  try {
    // 1) Leer la tabla `users` DIRECTAMENTE con el cliente admin service_role. 
    // Como esto es un backend y usa SUPABASE_SERVICE_ROLE_KEY, NO depende de políticas (RLS bypassed).
    const { data: userRaw, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('user_name', username)
      .single();

    if (userError || !userRaw) {
      console.log('Login denegado, usuario no localizado en DB con service_role.');
      return res.status(401).json({ success: false, error: 'Usuario incorrecto' });
    }

    // 2) Validar la contraseña.
    let isAuthenticated = false;
    
    // Si guardaste las contraseñas sinencriptar en tu base de texto plano, la comprobamos directo:
    if (userRaw.password === password) {
       isAuthenticated = true; 
    } else {
       // Si guardas passwords encriptados, reusamos con permisos de ADMIN (service_role) 
       // tu RPC original que sabe desencriptar, que también está libre de bloqueos de RLS públicos:
       const { data: authData } = await supabaseAdmin.rpc('authenticate_user', {
          username_param: username,
          password_param: password
       });
       if (authData && authData.success) {
          isAuthenticated = true;
       }
    }

    if (!isAuthenticated) {
      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
    }
    
    // 3) Login exitoso: Devolvemos el JSON tal como react-context lo espera
    return res.status(200).json({
      success: true,
      userData: {
        id: userRaw.id,
        user_name: userRaw.user_name,
        role: userRaw.role,
        created_at: userRaw.created_at
      }
    });

  } catch (error) {
    console.error('Error no capturado en backend de login:', error);
    return res.status(500).json({ success: false, error: 'Error inesperado. Contacta al administrador.' });
  }
}
