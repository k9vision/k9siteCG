// POST /api/auth/forgot-password
// Public endpoint: initiates password reset flow by sending a reset email
import { invalidateTokens, createToken } from '../../utils/tokens.js';
import { sendEmail, resetEmailHtml } from '../../utils/emails.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { email } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Always return the same message to prevent email enumeration
    const successMsg = { success: true, message: 'If an account with that email exists, a reset link has been sent.' };

    // Look up active user by email
    const user = await db.prepare(
      `SELECT u.id, u.email FROM users u WHERE u.email = ? AND u.status = 'active'`
    ).bind(email).first();

    if (!user) {
      return new Response(JSON.stringify(successMsg), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Invalidate any existing reset tokens for this user
    await invalidateTokens(db, { type: 'password_reset', userId: user.id, email });

    // Create a new password_reset token (1h expiry)
    const token = await createToken(db, {
      type: 'password_reset',
      userId: user.id,
      email
    });

    // Send reset email
    const resetUrl = `https://k9visiontx.com/reset-password?token=${token}`;
    await sendEmail(env, {
      to: email,
      subject: 'K9 Vision - Reset Your Password',
      html: resetEmailHtml(resetUrl)
    });

    return new Response(JSON.stringify(successMsg), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process password reset request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
