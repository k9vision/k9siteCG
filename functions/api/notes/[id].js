// Update and delete notes (admin only)
import { requireAdmin } from '../../utils/auth.js';

export async function onRequestPut(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const id = parseInt(context.params.id);
    const { content } = await context.request.json();

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Content is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const note = await context.env.DB.prepare(`
      UPDATE notes
      SET content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *
    `).bind(content, id).first();

    if (!note) {
      return new Response(
        JSON.stringify({ error: 'Note not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, note }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Update note error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update note' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function onRequestDelete(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const id = parseInt(context.params.id);

    await context.env.DB.prepare(
      'DELETE FROM notes WHERE id = ?'
    ).bind(id).run();

    return new Response(
      JSON.stringify({ success: true, message: 'Note deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete note error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete note' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
