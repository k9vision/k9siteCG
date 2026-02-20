// POST /api/auth/self-register
// Public endpoint: client self-registration with email verification
import bcrypt from 'bcryptjs';
import { createToken } from '../../utils/tokens.js';
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

    // Check if email is already in use by an active user or linked client
    const emailInUse = await db.prepare(
      `SELECT id FROM users WHERE email = ?
       UNION
       SELECT user_id AS id FROM clients WHERE email = ? AND user_id IS NOT NULL`
    ).bind(email, email).first();

    if (emailInUse) {
      return new Response(JSON.stringify({ error: 'An account with this email already exists' }), {
        status: 409,
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

    // Create user with pending_verification status
    const userResult = await db.prepare(
      `INSERT INTO users (username, password, role, status, email) VALUES (?, ?, 'client', 'pending_verification', ?)`
    ).bind(username, hashedPassword, email).run();

    const userId = userResult.meta.last_row_id;

    // Create client profile
    await db.prepare(
      'INSERT INTO clients (user_id, client_name, email, dog_name, breed, age) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userId, client_name, email, dog_name, breed || null, age || null).run();

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
