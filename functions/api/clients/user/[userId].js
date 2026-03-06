// Client by user ID - GET and PUT
import { requireAuth } from '../../../utils/auth.js';

// Update client info (email, etc.)
export async function onRequestPut(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = parseInt(context.params.userId);

    // Only admin can update any client; clients can only update themselves
    if (auth.user.role !== 'admin' && auth.user.id !== userId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await context.request.json();
    const updates = [];
    const values = [];

    if (body.email !== undefined) { updates.push('email = ?'); values.push(body.email); }
    if (body.client_name !== undefined) { updates.push('client_name = ?'); values.push(body.client_name); }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    values.push(userId);
    await context.env.DB.prepare(
      `UPDATE clients SET ${updates.join(', ')} WHERE user_id = ?`
    ).bind(...values).run();

    const client = await context.env.DB.prepare(
      'SELECT * FROM clients WHERE user_id = ?'
    ).bind(userId).first();

    return new Response(JSON.stringify({ success: true, client }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Update client error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update client' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

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
