// POST /api/auth/validate-token
// Public endpoint: checks if a token is valid and returns associated data
import { validateToken } from '../../utils/tokens.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { token, type } = await request.json();

    if (!token || !type) {
      return new Response(JSON.stringify({ error: 'Token and type are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const row = await validateToken(db, token, type);

    if (!row) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build response data -- include client info for invite tokens
    const data = {};
    if (row.client_name) data.client_name = row.client_name;
    if (row.dog_name) data.dog_name = row.dog_name;
    if (row.client_email) data.email = row.client_email;
    if (row.email) data.email = row.email;

    return new Response(JSON.stringify({ valid: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Validate token error:', error);
    return new Response(JSON.stringify({ error: 'Failed to validate token' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
