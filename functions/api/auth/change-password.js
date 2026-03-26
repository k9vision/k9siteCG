import bcrypt from 'bcryptjs';
import { requireAuth } from '../../utils/auth.js';

export async function onRequestPost(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    // Rate limiting: 5 password change attempts per minute per IP
    const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
    try {
      const { checkRateLimit } = await import('../../utils/rate-limit.js');
      const limit = await checkRateLimit(context.env.DB, { ip, action: 'change-password', maxAttempts: 5, windowSeconds: 60 });
      if (!limit.allowed) {
        return new Response(JSON.stringify({ error: 'Too many attempts. Please try again shortly.' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfter) } });
      }
    } catch (e) { /* rate limit table may not exist yet, continue */ }

    const { current_password, new_password } = await context.request.json();

    if (!current_password || !new_password) {
      return new Response(JSON.stringify({ error: 'Current password and new password are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (new_password.length < 8) {
      return new Response(JSON.stringify({ error: 'New password must be at least 8 characters' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const user = await context.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(auth.user.id).first();
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const isValid = await bcrypt.compare(current_password, user.password);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Current password is incorrect' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await context.env.DB.prepare('UPDATE users SET password = ? WHERE id = ?').bind(hashedPassword, auth.user.id).run();

    return new Response(JSON.stringify({ success: true, message: 'Password changed successfully' }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Change password error:', error);
    return new Response(JSON.stringify({ error: 'Failed to change password' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
