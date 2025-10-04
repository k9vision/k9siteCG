// Get client by user ID
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

    const userId = parseInt(context.params.userId);

    // Users can only view their own data unless they're admin
    if (auth.user.role !== 'admin' && auth.user.id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = await context.env.DB.prepare(
      'SELECT * FROM clients WHERE user_id = ?'
    ).bind(userId).first();

    if (!client) {
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, client }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get client error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch client' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
