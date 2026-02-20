// POST /api/auth/reset-password
// Public endpoint: resets a user's password using a valid reset token
import bcrypt from 'bcryptjs';
import { validateToken, consumeToken, invalidateTokens } from '../../utils/tokens.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return new Response(JSON.stringify({ error: 'Token and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate the reset token
    const row = await validateToken(db, token, 'password_reset');

    if (!row) {
      return new Response(JSON.stringify({ error: 'Invalid or expired reset token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the user's password
    await db.prepare(
      'UPDATE users SET password = ? WHERE id = ?'
    ).bind(hashedPassword, row.user_id).run();

    // Consume this token (mark as used)
    await consumeToken(db, token);

    // Invalidate any other outstanding reset tokens for this user
    await invalidateTokens(db, { type: 'password_reset', userId: row.user_id });

    return new Response(JSON.stringify({ success: true, message: 'Password has been reset successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return new Response(JSON.stringify({ error: 'Failed to reset password' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
