import { supabaseAdmin } from '../lib/supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  try {
    // Configuración segura CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
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
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    if (!req.body) {
      return res.status(400).json({ success: false, error: 'Missing request body' });
    }

    const { userId, action } = req.body;

    // REGLA DE SEGURIDAD ABSOLUTA: Si no hay UID proveniente del payload de localStorage, pateamos la petición.
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Acceso denegado: Usuario no autenticado' });
    }

    let data;
    
    // Switch de enrutamiento basado en la acción requerida por el Dashboard de frontend
    switch (action) {
      case 'vista_metricas_produccion_total': {
        const result = await supabaseAdmin.from('vista_metricas_produccion_total').select('*').order('fecha_produccion', { ascending: true });
        if (result.error) throw result.error;
        data = result.data;
        break;
      }
      case 'vista_comparativa_hoy_ayer': {
        const result = await supabaseAdmin.from('vista_comparativa_hoy_ayer').select('*').maybeSingle();
        if (result.error) throw result.error;
        data = result.data || { hoy_total: 0, ayer_total: 0 };
        break;
      }
      case 'get_weekly_production_total': {
        const result = await supabaseAdmin.rpc('get_weekly_production_total', { target_date: new Date().toISOString() });
        if (result.error) throw result.error;
        data = Number(result.data) || 0;
        break;
      }
      case 'get_monthly_production_total': {
        const result = await supabaseAdmin.rpc('get_monthly_production_total', { target_date: new Date().toISOString() });
        if (result.error) throw result.error;
        data = Number(result.data) || 0;
        break;
      }
      case 'get_current_production_kilos': {
        const result = await supabaseAdmin.rpc('get_current_production_kilos');
        if (result.error) throw result.error;
        data = Number(result.data) || 0;
        break;
      }
      default:
        return res.status(400).json({ success: false, error: 'Acción de métrica no válida' });
    }

    // Éxito: Soltamos los datos hacia tu dashboard
    return res.status(200).json({ success: true, data });

  } catch (error: any) {
    console.error(`Error crítico en API /get-metrics:`, error);
    // Siempe devolver JSON en caso de error 500
    return res.status(500).json({ success: false, error: error.message || 'Error interno del servidor al obtener métricas' });
  }
}
