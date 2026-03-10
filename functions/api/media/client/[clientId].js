// Get media for a client
import { requireAuth } from '../../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const clientId = parseInt(context.params.clientId);

    // Check if user has access to this client's data
    if (auth.user.role !== 'admin') {
      const client = await context.env.DB.prepare(
        'SELECT id FROM clients WHERE user_id = ?'
      ).bind(auth.user.id).first();

      if (!client || client.id !== clientId) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const media = await context.env.DB.prepare(
      'SELECT * FROM media WHERE client_id = ? ORDER BY created_at DESC'
    ).bind(clientId).all();

    return new Response(
      JSON.stringify({ success: true, media: media.results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get media error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch media' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
