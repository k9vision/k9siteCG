import { requireAdmin } from '../../utils/auth.js';

export async function onRequestPost(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    await context.env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Mark all read error:', error);
    return new Response(JSON.stringify({ error: 'Failed to mark all as read' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
