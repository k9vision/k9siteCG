// Upload media for a client (admin only) using Cloudflare R2
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

    const formData = await context.request.formData();
    const file = formData.get('file');
    const clientId = formData.get('clientId');
    const caption = formData.get('caption') || '';

    if (!clientId || !file) {
      return new Response(
        JSON.stringify({ error: 'Client ID and file are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Upload to R2
    await context.env.MEDIA_BUCKET.put(filename, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Determine media type
    const type = file.type.startsWith('video/') ? 'video' : 'photo';

    // Save to database
    const media = await context.env.DB.prepare(`
      INSERT INTO media (client_id, type, filename, original_name, url, caption)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      parseInt(clientId),
      type,
      filename,
      file.name,
      `/media/${filename}`,
      caption
    ).first();

    return new Response(
      JSON.stringify({ success: true, media }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Upload media error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to upload media' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
