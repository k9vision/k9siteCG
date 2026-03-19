import { requireAuth } from '../../utils/auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const milestoneId = params.id;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  const auth = await requireAuth(context);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const milestone = await env.DB.prepare('SELECT * FROM training_milestones WHERE id = ?').bind(milestoneId).first();
    if (!milestone) {
      return new Response(JSON.stringify({ error: 'Milestone not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Ownership check for clients
    if (auth.user.role === 'client') {
      const client = await env.DB.prepare('SELECT id FROM clients WHERE user_id = ?').bind(auth.user.id).first();
      if (!client || milestone.client_id !== client.id) {
        return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (request.method === 'GET') {
      return new Response(JSON.stringify({ success: true, milestone }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Only admin can update/delete milestones
    if (auth.user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    if (request.method === 'PUT') {
      const { title, description, status } = await request.json();

      const updates = [];
      const values = [];

      if (title !== undefined) { updates.push('title = ?'); values.push(title); }
      if (description !== undefined) { updates.push('description = ?'); values.push(description); }
      if (status !== undefined) {
        updates.push('status = ?');
        values.push(status);
        if (status === 'completed') {
          updates.push('completed_at = CURRENT_TIMESTAMP');
        } else {
          updates.push('completed_at = NULL');
        }
      }

      if (updates.length === 0) {
        return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      values.push(milestoneId);
      await env.DB.prepare(`UPDATE training_milestones SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

      const updated = await env.DB.prepare('SELECT * FROM training_milestones WHERE id = ?').bind(milestoneId).first();
      return new Response(JSON.stringify({ success: true, milestone: updated }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM training_milestones WHERE id = ?').bind(milestoneId).run();
      return new Response(JSON.stringify({ success: true, message: 'Milestone deleted' }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Milestone API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
