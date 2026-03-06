import { requireAdmin } from '../../utils/auth.js';

export async function onRequestPost(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    await context.env.DB.prepare('DELETE FROM notifications').run();

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Clear notifications error:', error);
    return new Response(JSON.stringify({ error: 'Failed to clear notifications' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
