import { requireAuth } from '../../utils/auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const contactId = params.id;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

  const auth = await requireAuth(context);
  if (auth.error) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
  if (auth.user.role !== 'admin') return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });

  try {
    if (request.method === 'GET') {
      const contact = await env.DB.prepare('SELECT * FROM contacts WHERE id = ?').bind(contactId).first();
      if (!contact) return new Response(JSON.stringify({ error: 'Contact not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: true, contact }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (request.method === 'PUT') {
      const { name, email, phone, dog_name, notes } = await request.json();
      const updates = [];
      const values = [];
      if (name !== undefined) { updates.push('name = ?'); values.push(name); }
      if (email !== undefined) { updates.push('email = ?'); values.push(email); }
      if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
      if (dog_name !== undefined) { updates.push('dog_name = ?'); values.push(dog_name); }
      if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
      if (updates.length === 0) return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(contactId);
      await env.DB.prepare(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
      const updated = await env.DB.prepare('SELECT * FROM contacts WHERE id = ?').bind(contactId).first();
      return new Response(JSON.stringify({ success: true, contact: updated }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM contacts WHERE id = ?').bind(contactId).run();
      return new Response(JSON.stringify({ success: true, message: 'Contact deleted' }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Contact API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
