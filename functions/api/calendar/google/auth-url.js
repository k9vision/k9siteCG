import { requireAuth } from '../../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const token = context.request.headers.get('Authorization').substring(7);

    const params = new URLSearchParams({
      client_id: context.env.GOOGLE_CLIENT_ID,
      redirect_uri: 'https://k9visiontx.com/api/calendar/google/callback',
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      access_type: 'offline',
      prompt: 'consent',
      state: token,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return new Response(JSON.stringify({ success: true, url }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Google auth URL error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate auth URL' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
