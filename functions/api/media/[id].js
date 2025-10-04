// Delete media (admin only)
import { requireAdmin } from '../../utils/auth.js';

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
