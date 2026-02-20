// POST /api/clients/invite
// Admin-only endpoint: creates a client profile and sends an invite email
import { requireAdmin } from '../../utils/auth.js';
import { createToken } from '../../utils/tokens.js';
import { sendEmail, inviteEmailHtml } from '../../utils/emails.js';

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  // Require admin auth
  const auth = await requireAdmin(context);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const db = env.DB;

  try {
    const { client_name, email, dog_name, breed, age } = await request.json();

    if (!client_name || !email || !dog_name) {
      return new Response(JSON.stringify({ error: 'Client name, email, and dog name are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if a client with this email already exists
    const existing = await db.prepare(
      'SELECT id FROM clients WHERE email = ?'
    ).bind(email).first();

    if (existing) {
      return new Response(JSON.stringify({ error: 'A client with this email already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create client profile with user_id = NULL (not yet linked to a user account)
    const result = await db.prepare(
      'INSERT INTO clients (user_id, client_name, email, dog_name, breed, age) VALUES (NULL, ?, ?, ?, ?, ?)'
    ).bind(client_name, email, dog_name, breed || null, age || null).run();

    const clientId = result.meta.last_row_id;

    // Create invite token (7-day expiry) linked to new client
    const token = await createToken(db, {
      type: 'invite',
      clientId,
      email
    });

    // Send invite email
    const setupUrl = `https://k9visiontx.com/setup-account?token=${token}`;
    await sendEmail(env, {
      to: email,
      subject: 'A warm welcome from K9VISION (Action Required)',
      html: inviteEmailHtml(client_name, dog_name, setupUrl)
    });

    return new Response(JSON.stringify({
      success: true,
      client_id: clientId,
      invite_sent: true
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Client invite error:', error);
    return new Response(JSON.stringify({ error: 'Failed to invite client' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
