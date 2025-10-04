// Login endpoint for Cloudflare Pages Function
const bcrypt = require('bcryptjs');

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

exports.onRequestPost = async function(context) {
  try {
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
      context.env.JWT_SECRET || 'your-secret-key'
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
};
