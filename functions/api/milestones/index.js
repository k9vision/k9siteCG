import { requireAuth } from '../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    let clientId;
    if (auth.user.role === 'client') {
      const client = await context.env.DB.prepare('SELECT id FROM clients WHERE user_id = ?').bind(auth.user.id).first();
      if (!client) return new Response(JSON.stringify({ success: true, milestones: [] }), { headers: { 'Content-Type': 'application/json' } });
      clientId = client.id;
    } else {
      clientId = new URL(context.request.url).searchParams.get('client_id');
      if (!clientId) {
        return new Response(JSON.stringify({ error: 'client_id query parameter required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
    }

    const { results } = await context.env.DB.prepare(
      'SELECT * FROM training_milestones WHERE client_id = ? ORDER BY created_at ASC'
    ).bind(parseInt(clientId)).all();

    return new Response(JSON.stringify({ success: true, milestones: results }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('List milestones error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load milestones' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestPost(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    if (auth.user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const { client_id, dog_id, title, description, status } = await context.request.json();

    if (!client_id || !title) {
      return new Response(JSON.stringify({ error: 'client_id and title are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const milestone = await context.env.DB.prepare(
      `INSERT INTO training_milestones (client_id, dog_id, title, description, status)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`
    ).bind(parseInt(client_id), dog_id ? parseInt(dog_id) : null, title, description || null, status || 'not_started').first();

    return new Response(JSON.stringify({ success: true, milestone }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Create milestone error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create milestone' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
