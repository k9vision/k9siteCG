// POST /api/clients/reset-password
// Admin-only endpoint: reset a client's password (via email link or manual set)
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../../utils/auth.js';
import { createToken } from '../../utils/tokens.js';
import { sendEmail, resetEmailHtml } from '../../utils/emails.js';

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  // Require admin auth
  const auth = await requireAdmin(context);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const db = env.DB;

  try {
    const { client_id, mode, new_password } = await request.json();

    if (!client_id || !mode) {
      return new Response(JSON.stringify({ error: 'client_id and mode are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (mode !== 'email' && mode !== 'manual') {
      return new Response(JSON.stringify({ error: 'mode must be "email" or "manual"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Look up client and linked user
    const client = await db.prepare(
      `SELECT c.*, u.id AS uid, u.email AS user_email
       FROM clients c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`
    ).bind(client_id).first();

    if (!client) {
      return new Response(JSON.stringify({ error: 'Client not found or no linked user account' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (mode === 'email') {
      // Create a password_reset token linked to the client's user
      const token = await createToken(db, {
        type: 'password_reset',
        userId: client.uid,
        email: client.email || client.user_email
      });

      // Send reset email with adminTriggered flag
      const resetUrl = `https://k9visiontx.com/reset-password?token=${token}`;
      await sendEmail(env, {
        to: client.email || client.user_email,
        subject: 'K9 Vision - Reset Your Password',
        html: resetEmailHtml(resetUrl, true)
      });

      return new Response(JSON.stringify({ success: true, message: 'Reset email sent' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // mode === 'manual'
    if (!new_password || new_password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await db.prepare(
      'UPDATE users SET password = ? WHERE id = ?'
    ).bind(hashedPassword, client.uid).run();

    return new Response(JSON.stringify({ success: true, message: 'Password updated' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Admin reset password error:', error);
    return new Response(JSON.stringify({ error: 'Failed to reset password' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
