// POST /api/auth/self-register
// Public endpoint: client self-registration with email verification
import bcrypt from 'bcryptjs';
import { createToken, invalidateTokens } from '../../utils/tokens.js';
import { sendEmail, verificationEmailHtml } from '../../utils/emails.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { client_name, email, dog_name, breed, age, username, password } = await request.json();

    // Validate required fields
    if (!client_name || !email || !dog_name || !username || !password) {
      return new Response(JSON.stringify({ error: 'Client name, email, dog name, username, and password are all required' }), {
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

    // Check if email is already in use by a fully active (verified) user
    const activeUser = await db.prepare(
      `SELECT u.id, u.status FROM users u WHERE u.email = ? AND u.status = 'active'`
    ).bind(email).first();

    if (activeUser) {
      return new Response(JSON.stringify({ error: 'An account with this email already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Also check clients table for email linked to an active user
    const activeClient = await db.prepare(
      `SELECT c.user_id FROM clients c JOIN users u ON c.user_id = u.id WHERE c.email = ? AND u.status = 'active'`
    ).bind(email).first();

    if (activeClient) {
      return new Response(JSON.stringify({ error: 'An account with this email already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if there's an incomplete (pending_verification) registration for this email
    // If so, update it instead of creating a new one (handles retry after email failure)
    const pendingUser = await db.prepare(
      `SELECT id, username FROM users WHERE email = ? AND status = 'pending_verification'`
    ).bind(email).first();

    const hashedPassword = await bcrypt.hash(password, 10);
    let userId;

    if (pendingUser) {
      // Check if the new username conflicts with a different user
      const usernameConflict = await db.prepare(
        'SELECT id FROM users WHERE username = ? AND id != ?'
      ).bind(username, pendingUser.id).first();

      if (usernameConflict) {
        return new Response(JSON.stringify({ error: 'Username already taken' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      userId = pendingUser.id;

      // Update the existing pending user with new credentials
      await db.prepare(
        `UPDATE users SET username = ?, password = ? WHERE id = ?`
      ).bind(username, hashedPassword, userId).run();

      // Update client profile
      await db.prepare(
        `UPDATE clients SET client_name = ?, dog_name = ?, breed = ?, age = ? WHERE user_id = ?`
      ).bind(client_name, dog_name, breed || null, age || null, userId).run();

      // Invalidate any old verification tokens
      await invalidateTokens(db, { type: 'email_verification', userId, email });

    } else {
      // New registration — check username uniqueness
      const existingUser = await db.prepare(
        'SELECT id FROM users WHERE username = ?'
      ).bind(username).first();

      if (existingUser) {
        return new Response(JSON.stringify({ error: 'Username already taken' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Create user with pending_verification status
      const userResult = await db.prepare(
        `INSERT INTO users (username, password, role, status, email) VALUES (?, ?, 'client', 'pending_verification', ?)`
      ).bind(username, hashedPassword, email).run();

      userId = userResult.meta.last_row_id;

      // Create client profile
      await db.prepare(
        'INSERT INTO clients (user_id, client_name, email, dog_name, breed, age) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(userId, client_name, email, dog_name, breed || null, age || null).run();
    }

    // Create email_verification token (24h expiry)
    const token = await createToken(db, {
      type: 'email_verification',
      userId,
      email
    });

    // Send verification email
    const verifyUrl = `https://k9visiontx.com/verify-email?token=${token}`;
    await sendEmail(env, {
      to: email,
      subject: 'A warm welcome from K9VISION (Action Required)',
      html: verificationEmailHtml(client_name, verifyUrl)
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Self-register error:', error);
    return new Response(JSON.stringify({ error: 'Failed to register account' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
