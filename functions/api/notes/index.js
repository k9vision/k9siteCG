// Create a note for a client (admin only)
import { requireAdmin } from '../../utils/auth.js';

export async function onRequestPost(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { clientId, content, title } = await context.request.json();

    if (!clientId || !content) {
      return new Response(
        JSON.stringify({ error: 'Client ID and content are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const note = await context.env.DB.prepare(`
      INSERT INTO notes (client_id, content, title)
      VALUES (?, ?, ?)
      RETURNING *
    `).bind(parseInt(clientId), content, title || 'Note').first();

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
