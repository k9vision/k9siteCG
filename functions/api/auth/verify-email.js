// POST /api/auth/verify-email
// Public endpoint: verifies a user's email address using a verification token
import { validateToken, consumeToken } from '../../utils/tokens.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { token } = await request.json();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate the email_verification token
    const row = await validateToken(db, token, 'email_verification');

    if (!row) {
      return new Response(JSON.stringify({ error: 'Invalid or expired verification token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Activate the user account
    await db.prepare(
      `UPDATE users SET status = 'active' WHERE id = ?`
    ).bind(row.user_id).run();

    // Consume the token (single-use)
    await consumeToken(db, token);

    return new Response(JSON.stringify({ success: true, message: 'Email verified successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Verify email error:', error);
    return new Response(JSON.stringify({ error: 'Failed to verify email' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
