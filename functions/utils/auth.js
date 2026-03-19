// Shared authentication utilities for Cloudflare Pages Functions

export async function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;

    // Cryptographically verify the signature using HMAC-SHA256
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Decode the base64 signature to bytes
    const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    const dataBytes = new TextEncoder().encode(`${header}.${payload}`);

    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, dataBytes);
    if (!valid) return null;

    // Only parse payload after signature is verified
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

export async function requireAuth(context) {
  const authHeader = context.request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: 'Authentication required',
      status: 401,
    };
  }

  const token = authHeader.substring(7);
  const user = await verifyToken(token, context.env.JWT_SECRET || 'your-secret-key');

  if (!user) {
    return {
      error: 'Invalid token',
      status: 401,
    };
  }

  return { user };
}

export async function requireAdmin(context) {
  const auth = await requireAuth(context);

  if (auth.error) {
    return auth;
  }

  if (auth.user.role !== 'admin') {
    return {
      error: 'Admin access required',
      status: 403,
    };
  }

  return auth;
}
