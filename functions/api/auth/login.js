// Login endpoint for Cloudflare Pages Function
import bcrypt from 'bcryptjs';

// Helper function to generate JWT (simplified for edge runtime)
async function generateToken(payload, secret) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const signature = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    new TextEncoder().encode(`${header}.${body}`)
  );
  return `${header}.${body}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

export async function onRequestPost(context) {
  try {
    // Rate limiting: 5 login attempts per minute per IP
    const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
    try {
      const { checkRateLimit } = await import('../../utils/rate-limit.js');
      const limit = await checkRateLimit(context.env.DB, { ip, action: 'login', maxAttempts: 5, windowSeconds: 60 });
      if (!limit.allowed) {
        return new Response(JSON.stringify({ error: 'Too many login attempts. Please try again in a minute.' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfter) } });
      }
    } catch (e) { /* rate limit table may not exist yet, continue */ }

    const { username, password } = await context.request.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: 'Username and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Query user from D1 database
    const result = await context.env.DB.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).bind(username).first();

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Block soft-deleted accounts (don't reveal account was deleted)
    if (result.deleted_at) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Block unverified accounts
    if (result.status === 'pending_verification') {
      return new Response(
        JSON.stringify({ error: 'Please verify your email before logging in. Check your inbox for the verification link.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, result.password);

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate JWT token
    const token = await generateToken(
      {
        id: result.id,
        username: result.username,
        role: result.role,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
      },
      context.env.JWT_SECRET
    );

    return new Response(
      JSON.stringify({
        success: true,
        token,
        user: {
          id: result.id,
          username: result.username,
          role: result.role,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ error: 'Login failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
