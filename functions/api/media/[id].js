import { requireAdmin, requireAuth } from '../../utils/auth.js';

// Update media caption
export async function onRequestPut(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const id = parseInt(context.params.id);
    const body = await context.request.json();
    const caption = body.caption;
    const album = body.album;

    // If not admin, verify ownership
    if (auth.user.role !== 'admin') {
      const media = await context.env.DB.prepare(
        'SELECT m.id FROM media m JOIN clients c ON m.client_id = c.id WHERE m.id = ? AND c.user_id = ?'
      ).bind(id, auth.user.id).first();
      if (!media) {
        return new Response(
          JSON.stringify({ error: 'Not authorized' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Build dynamic update
    const updates = [];
    const values = [];
    if (caption !== undefined) { updates.push('caption = ?'); values.push(caption || ''); }
    if (album !== undefined) { updates.push('album = ?'); values.push(album || ''); }
    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    values.push(id);
    const result = await context.env.DB.prepare(
      `UPDATE media SET ${updates.join(', ')} WHERE id = ? RETURNING *`
    ).bind(...values).first();

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Media not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, media: result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Update media error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update media' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Delete media (authenticated users with ownership check)
export async function onRequestDelete(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const id = parseInt(context.params.id);

    // Get media info (also used for ownership check and R2 deletion)
    const media = await context.env.DB.prepare(
      'SELECT m.filename, m.client_id FROM media m WHERE m.id = ?'
    ).bind(id).first();

    if (!media) {
      return new Response(
        JSON.stringify({ error: 'Media not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // If not admin, verify ownership
    if (auth.user.role !== 'admin') {
      const ownership = await context.env.DB.prepare(
        'SELECT id FROM clients WHERE id = ? AND user_id = ?'
      ).bind(media.client_id, auth.user.id).first();
      if (!ownership) {
        return new Response(
          JSON.stringify({ error: 'Not authorized to delete this media' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Delete from R2
    await context.env.MEDIA_BUCKET.delete(media.filename);

    // Delete from database
    await context.env.DB.prepare(
      'DELETE FROM media WHERE id = ?'
    ).bind(id).run();

    return new Response(
      JSON.stringify({ success: true, message: 'Media deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete media error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete media' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
