import { requireAdmin } from '../../../utils/auth.js';

export async function onRequestDelete(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const id = context.params.id;
    await context.env.DB.prepare('DELETE FROM blocked_dates WHERE id = ?').bind(id).run();

    try {
      const { removeSyncedEvents } = await import('../../utils/gcal.js');
      await removeSyncedEvents(context.env.DB, context.env, 'blocked_date', parseInt(id));
    } catch (syncErr) {
      console.error('Google Calendar remove error:', syncErr);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Unblock date error:', error);
    return new Response(JSON.stringify({ error: 'Failed to unblock date' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
