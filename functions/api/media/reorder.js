// Reorder media items — update sort_order for drag-and-drop
import { requireAuth } from '../../utils/auth.js';

export async function onRequestPut(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const { items } = await context.request.json();
    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'items array is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (items.length > 200) {
      return new Response(JSON.stringify({ error: 'Maximum 200 items per reorder request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Ownership check for non-admin users
    if (auth.user.role !== 'admin') {
      const client = await context.env.DB.prepare('SELECT id FROM clients WHERE user_id = ?').bind(auth.user.id).first();
      if (!client) {
        return new Response(JSON.stringify({ error: 'Client profile not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      // Verify all media items belong to this client
      const ids = items.map(i => parseInt(i.id));
      const placeholders = ids.map(() => '?').join(',');
      const check = await context.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM media WHERE id IN (${placeholders}) AND client_id != ?`
      ).bind(...ids, client.id).first();
      if (check.cnt > 0) {
        return new Response(JSON.stringify({ error: 'Not authorized to reorder these items' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Batch update sort_order using D1 batch API
    const statements = items.map(item =>
      context.env.DB.prepare('UPDATE media SET sort_order = ? WHERE id = ?').bind(parseInt(item.sort_order), parseInt(item.id))
    );
    await context.env.DB.batch(statements);

    return new Response(JSON.stringify({ success: true, updated: items.length }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Media reorder error:', error);
    return new Response(JSON.stringify({ error: 'Failed to reorder media' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
