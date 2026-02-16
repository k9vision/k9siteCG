// Services API - List all services and create new service
import { requireAdmin } from '../../utils/auth';

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    if (request.method === 'GET') {
      // List all services (active only for non-admin)
      const { results } = await env.DB.prepare(
        'SELECT * FROM services WHERE active = 1 ORDER BY name ASC'
      ).all();

      return new Response(JSON.stringify({
        success: true,
        services: results
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      // Create new service (admin only)
      const auth = await requireAdmin(context);
      if (!auth.success) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: auth.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { name, description, price, active } = await request.json();

      if (!name || price === undefined) {
        return new Response(JSON.stringify({
          error: 'Name and price are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await env.DB.prepare(
        'INSERT INTO services (name, description, price, active) VALUES (?, ?, ?, ?)'
      ).bind(name, description || null, price, active !== undefined ? active : 1).run();

      const service = await env.DB.prepare(
        'SELECT * FROM services WHERE id = ?'
      ).bind(result.meta.last_row_id).first();

      return new Response(JSON.stringify({
        success: true,
        service
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Services API error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
