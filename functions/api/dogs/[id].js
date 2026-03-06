// Dogs API - Get, Update, Delete individual dog
import { requireAuth } from '../../utils/auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const dogId = params.id;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  const auth = await requireAuth(context);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get the dog to check ownership
    const dog = await env.DB.prepare('SELECT * FROM dogs WHERE id = ?').bind(dogId).first();
    if (!dog) {
      return new Response(JSON.stringify({ error: 'Dog not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Non-admin can only modify their own dogs
    if (auth.user.role !== 'admin') {
      const client = await env.DB.prepare(
        'SELECT id FROM clients WHERE user_id = ? AND id = ?'
      ).bind(auth.user.id, dog.client_id).first();
      if (!client) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403, headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (request.method === 'GET') {
      return new Response(JSON.stringify({ success: true, dog }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'PUT') {
      const { dog_name, breed, age, photo_url } = await request.json();

      const updates = [];
      const values = [];

      if (dog_name !== undefined) { updates.push('dog_name = ?'); values.push(dog_name); }
      if (breed !== undefined) { updates.push('breed = ?'); values.push(breed); }
      if (age !== undefined) { updates.push('age = ?'); values.push(age); }
      if (photo_url !== undefined) { updates.push('photo_url = ?'); values.push(photo_url); }

      if (updates.length === 0) {
        return new Response(JSON.stringify({ error: 'No fields to update' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }

      values.push(dogId);
      await env.DB.prepare(
        `UPDATE dogs SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...values).run();

      const updated = await env.DB.prepare('SELECT * FROM dogs WHERE id = ?').bind(dogId).first();

      return new Response(JSON.stringify({ success: true, dog: updated }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM dogs WHERE id = ?').bind(dogId).run();

      return new Response(JSON.stringify({ success: true, message: 'Dog removed' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Dog API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
