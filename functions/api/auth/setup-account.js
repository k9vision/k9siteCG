// POST /api/auth/setup-account
// Public endpoint: client creates their login credentials using an invite token
import bcrypt from 'bcryptjs';
import { validateToken, consumeToken } from '../../utils/tokens.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { token, username, password } = await request.json();

    if (!token || !username || !password) {
      return new Response(JSON.stringify({ error: 'Token, username, and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (username.length < 3) {
      return new Response(JSON.stringify({ error: 'Username must be at least 3 characters' }), {
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

    // Validate the invite token
    const row = await validateToken(db, token, 'invite');

    if (!row) {
      return new Response(JSON.stringify({ error: 'Invalid or expired invite token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check username uniqueness
    const existingUser = await db.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind(username).first();

    if (existingUser) {
      return new Response(JSON.stringify({ error: 'Username already taken' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get the email from the token row (client_email from JOIN or token email)
    const email = row.client_email || row.email;

    // Create the user account
    const userResult = await db.prepare(
      `INSERT INTO users (username, password, role, status, email) VALUES (?, ?, 'client', 'active', ?)`
    ).bind(username, hashedPassword, email).run();

    const userId = userResult.meta.last_row_id;

    // Link the client profile to this new user
    await db.prepare(
      'UPDATE clients SET user_id = ? WHERE id = ?'
    ).bind(userId, row.client_id).run();

    // Consume the invite token (single-use)
    await consumeToken(db, token);

    return new Response(JSON.stringify({ success: true, message: 'Account created successfully' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Setup account error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create account' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
