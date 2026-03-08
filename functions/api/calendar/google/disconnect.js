import { requireAuth } from '../../../utils/auth.js';

export async function onRequestDelete(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const tokenRow = await context.env.DB.prepare(
      'SELECT access_token FROM google_calendar_tokens WHERE user_id = ?'
    ).bind(auth.user.id).first();

    // Revoke token at Google (fire-and-forget)
    if (tokenRow) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${tokenRow.access_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }).catch(err => console.error('Token revoke error:', err));
    }

    await context.env.DB.prepare('DELETE FROM google_calendar_tokens WHERE user_id = ?').bind(auth.user.id).run();
    await context.env.DB.prepare('DELETE FROM calendar_event_sync WHERE user_id = ?').bind(auth.user.id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Google disconnect error:', error);
    return new Response(JSON.stringify({ error: 'Failed to disconnect' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
