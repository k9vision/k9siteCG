// Services API - Get, Update, Delete individual service
import { requireAdmin } from '../../utils/auth';

export async function onRequest(context) {
  const { request, env, params } = context;
  const serviceId = params.id;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    if (request.method === 'GET') {
      // Get single service
      const service = await env.DB.prepare(
        'SELECT * FROM services WHERE id = ?'
      ).bind(serviceId).first();

      if (!service) {
        return new Response(JSON.stringify({ error: 'Service not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        service
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update and delete require admin auth
    const auth = await requireAdmin(context);
    if (!auth.success) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'PUT') {
      // Update service
      const { name, description, price, active } = await request.json();

      if (!name || price === undefined) {
        return new Response(JSON.stringify({
          error: 'Name and price are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await env.DB.prepare(
        'UPDATE services SET name = ?, description = ?, price = ?, active = ? WHERE id = ?'
      ).bind(name, description || null, price, active !== undefined ? active : 1, serviceId).run();

      const service = await env.DB.prepare(
        'SELECT * FROM services WHERE id = ?'
      ).bind(serviceId).first();

      return new Response(JSON.stringify({
        success: true,
        service
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'DELETE') {
      // Soft delete - set active to 0
      await env.DB.prepare(
        'UPDATE services SET active = 0 WHERE id = ?'
      ).bind(serviceId).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Service deactivated successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Service API error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
