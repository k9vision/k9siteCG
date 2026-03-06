// Create a note for a client (admin or client)
import { requireAuth } from '../../utils/auth.js';

export async function onRequestPost(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { client_id, content, title } = await context.request.json();

    if (!client_id || !content) {
      return new Response(
        JSON.stringify({ error: 'Client ID and content are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // If client role, verify they can only create notes for their own record
    if (auth.user.role === 'client') {
      const client = await context.env.DB.prepare(
        'SELECT id FROM clients WHERE user_id = ?'
      ).bind(auth.user.id).first();

      if (!client || client.id !== parseInt(client_id)) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const author_role = auth.user.role === 'admin' ? 'admin' : 'client';

    const note = await context.env.DB.prepare(`
      INSERT INTO notes (client_id, content, title, author_role)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `).bind(parseInt(client_id), content, title || 'Note', author_role).first();

    return new Response(
      JSON.stringify({ success: true, note }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create note error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create note' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
