// Register endpoint for Cloudflare Pages Function
import bcrypt from 'bcryptjs';

// Helper to verify JWT
async function verifyToken(token, secret) {
  try {
    const [header, payload, signature] = token.split('.');
    const data = JSON.parse(atob(payload));

    // Check expiration
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export async function onRequestPost(context) {
  try {
    // Get auth token
    const authHeader = context.request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token, context.env.JWT_SECRET || 'your-secret-key');

    if (!user || user.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { username, password, role = 'client' } = await context.request.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: 'Username and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user exists
    const existing = await context.env.DB.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind(username).first();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Username already exists' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const result = await context.env.DB.prepare(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?) RETURNING id, username, role'
    ).bind(username, hashedPassword, role).first();

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: result.id,
          username: result.username,
          role: result.role,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return new Response(
      JSON.stringify({ error: 'Registration failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
