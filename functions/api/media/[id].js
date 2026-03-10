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
    const { caption } = await context.request.json();

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

    const result = await context.env.DB.prepare(
      'UPDATE media SET caption = ? WHERE id = ? RETURNING *'
    ).bind(caption || '', id).first();

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

// Delete media (admin only)
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

    // Get media info to delete from R2
    const media = await context.env.DB.prepare(
      'SELECT filename FROM media WHERE id = ?'
    ).bind(id).first();

    if (media) {
      // Delete from R2
      await context.env.MEDIA_BUCKET.delete(media.filename);
    }

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
