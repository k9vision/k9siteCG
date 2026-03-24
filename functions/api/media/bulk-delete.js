import { requireAuth } from '../../utils/auth.js';

export async function onRequestPost(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const { ids } = await context.request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: 'ids array is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (ids.length > 50) {
      return new Response(JSON.stringify({ error: 'Maximum 50 items per bulk delete' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Get all media items
    const placeholders = ids.map(() => '?').join(',');
    const { results: mediaItems } = await context.env.DB.prepare(
      `SELECT id, filename, client_id FROM media WHERE id IN (${placeholders})`
    ).bind(...ids.map(id => parseInt(id))).all();

    if (!mediaItems || mediaItems.length === 0) {
      return new Response(JSON.stringify({ error: 'No media found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Ownership check for non-admin users
    if (auth.user.role !== 'admin') {
      const clientIds = [...new Set(mediaItems.map(m => m.client_id))];
      for (const clientId of clientIds) {
        const ownership = await context.env.DB.prepare(
          'SELECT id FROM clients WHERE id = ? AND user_id = ?'
        ).bind(clientId, auth.user.id).first();
        if (!ownership) {
          return new Response(JSON.stringify({ error: 'Not authorized to delete some of these items' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }
      }
    }

    let deleted = 0;
    for (const item of mediaItems) {
      try {
        await context.env.MEDIA_BUCKET.delete(item.filename);
        await context.env.DB.prepare('DELETE FROM media WHERE id = ?').bind(item.id).run();
        deleted++;
      } catch (e) {
        console.error(`Failed to delete media ${item.id}:`, e);
      }
    }

    return new Response(JSON.stringify({ success: true, deleted, total: mediaItems.length }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Bulk delete media error:', error);
    return new Response(JSON.stringify({ error: 'Failed to bulk delete media' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
