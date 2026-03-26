import { verifyToken } from '../../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      return Response.redirect('https://k9visiontx.com/admin-dashboard.html?gcal=error', 302);
    }

    // Verify the JWT from state to identify the user
    const user = await verifyToken(state, context.env.JWT_SECRET);
    if (!user) {
      return Response.redirect('https://k9visiontx.com/admin-dashboard.html?gcal=error', 302);
    }

    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: context.env.GOOGLE_CLIENT_ID,
        client_secret: context.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: 'https://k9visiontx.com/api/calendar/google/callback',
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      console.error('Token exchange failed:', await tokenRes.text());
      return Response.redirect('https://k9visiontx.com/admin-dashboard.html?gcal=error', 302);
    }

    const tokens = await tokenRes.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await context.env.DB.prepare(`
      INSERT OR REPLACE INTO google_calendar_tokens (user_id, access_token, refresh_token, token_expires_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(user.id, tokens.access_token, tokens.refresh_token, expiresAt).run();

    const dashboard = user.role === 'admin' ? 'admin-dashboard.html' : 'client-dashboard.html';
    return Response.redirect(`https://k9visiontx.com/${dashboard}?gcal=connected`, 302);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return Response.redirect('https://k9visiontx.com/admin-dashboard.html?gcal=error', 302);
  }
}
