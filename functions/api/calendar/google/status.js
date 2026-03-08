import { requireAuth } from '../../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const row = await context.env.DB.prepare(
      'SELECT calendar_id FROM google_calendar_tokens WHERE user_id = ?'
    ).bind(auth.user.id).first();

    return new Response(JSON.stringify({
      success: true,
      connected: !!row,
      calendar_id: row?.calendar_id || null,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Google calendar status error:', error);
    return new Response(JSON.stringify({ error: 'Failed to check status' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
