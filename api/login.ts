import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import bcrypt from 'bcryptjs';

const loginAttempts = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutos
  const maxAttempts = 10; // máximo 10 intentos por IP

  const current = loginAttempts.get(ip);

  if (!current || now > current.resetTime) {
    loginAttempts.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxAttempts) {
    return false;
  }

  current.count++;
  return true;
}

export default async function handler(req: any, res: any) {
  // CORS configuration (soporta Vercel deploy cruzado entre frontend dinámico y backend)
  res.setHeader('Access-Control-Allow-Credentials', true);
  const allowedOrigins = [
    'https://new-app-gold-one.vercel.app',
    'http://localhost:8080',
    'http://localhost:5173'
  ];
  const origin = req.headers.origin || '';
  const allowedOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const clientIP = req.headers['x-forwarded-for'] ||
                   req.socket?.remoteAddress ||
                   'unknown';
  const ip = Array.isArray(clientIP) ? clientIP[0] : clientIP;

  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      success: false,
      error: 'Demasiados intentos. Esperá 15 minutos.'
    });
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

    // Solo bcrypt — todas las contraseñas están hasheadas en producción
    if (!userRaw.password?.startsWith('$2b$') && !userRaw.password?.startsWith('$2a$')) {
      console.error('SEGURIDAD: Contraseña sin hashear detectada para usuario:', username);
      return res.status(500).json({ success: false, error: 'Error de configuración. Contactá al administrador.' });
    }
    isAuthenticated = await bcrypt.compare(password, userRaw.password);

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
