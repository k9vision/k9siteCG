import { requireAdmin } from '../../utils/auth.js';

export async function onRequestPut(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const id = context.params.id;
    await context.env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update notification' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestDelete(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const id = context.params.id;
    await context.env.DB.prepare('DELETE FROM notifications WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Delete notification error:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete notification' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
