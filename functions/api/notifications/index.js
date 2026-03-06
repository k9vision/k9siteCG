import { requireAdmin } from '../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const url = new URL(context.request.url);
    const unreadOnly = url.searchParams.get('unread_only') === 'true';
    const limit = parseInt(url.searchParams.get('limit')) || 50;

    let query = 'SELECT n.*, c.client_name, c.dog_name FROM notifications n LEFT JOIN clients c ON n.client_id = c.id';
    const params = [];

    if (unreadOnly) {
      query += ' WHERE n.is_read = 0';
    }

    query += ' ORDER BY n.created_at DESC LIMIT ?';
    params.push(limit);

    const { results } = await context.env.DB.prepare(query).bind(...params).all();

    const unreadCount = (await context.env.DB.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').first()).count;

    return new Response(JSON.stringify({ success: true, notifications: results, unread_count: unreadCount }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('List notifications error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load notifications' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
