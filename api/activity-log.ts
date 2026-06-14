import { supabaseAdmin } from '../lib/supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  const allowedOrigins = [
    'https://new-app-gold-one.vercel.app',
    'http://localhost:8080',
    'http://localhost:5173',
  ];
  const origin = req.headers.origin || '';
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // Solo superadmin puede leer el historial
  const callerRole = req.headers['x-user-role'] as string;
  if (callerRole !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Acceso denegado' });
  }

  const { desde, hasta, entidad, color_tag } = req.query as Record<string, string>;

  try {
    let query = supabaseAdmin
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (desde)     query = query.gte('created_at', desde);
    if (hasta)     query = query.lte('created_at', hasta + 'T23:59:59');
    if (entidad && entidad !== 'todas') query = query.eq('entidad', entidad);
    if (color_tag) query = query.eq('color_tag', color_tag);

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({ success: true, logs: data ?? [] });
  } catch (error) {
    console.error('Error leyendo activity_log:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener historial' });
  }
}
