// Upload media for a client using Cloudflare R2
import { requireAuth } from '../../utils/auth.js';
import { createNotification } from '../../utils/notify.js';

export async function onRequestPost(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const formData = await context.request.formData();
    const file = formData.get('file');
    const caption = formData.get('caption') || '';

    // Resolve clientId based on role
    let clientId;
    if (auth.user.role === 'client') {
      const client = await context.env.DB.prepare('SELECT id FROM clients WHERE user_id = ?').bind(auth.user.id).first();
      if (!client) {
        return new Response(
          JSON.stringify({ error: 'Client profile not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      clientId = client.id;
    } else {
      clientId = formData.get('clientId');
    }

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

    // Notify admin when client uploads media
    if (auth.user.role === 'client') {
      try {
        const clientInfo = await context.env.DB.prepare('SELECT client_name, dog_name FROM clients WHERE id = ?').bind(parseInt(clientId)).first();
        await createNotification(context.env.DB, {
          type: 'client_media_upload',
          title: 'New Media Upload',
          message: `${clientInfo?.client_name || 'A client'} uploaded a ${type} for ${clientInfo?.dog_name || 'their dog'}`,
          client_id: parseInt(clientId),
          reference_id: media.id,
          reference_type: 'media'
        });

        const { sendEmail, mediaUploadNotificationHtml } = await import('../../utils/emails.js');
        await sendEmail(context.env, {
          to: 'trainercg@k9visiontx.com',
          subject: `New ${type} upload from ${clientInfo?.client_name || 'a client'}`,
          html: mediaUploadNotificationHtml(
            clientInfo?.client_name || 'A client',
            clientInfo?.dog_name || 'their dog',
            type
          )
        });
      } catch (notifyErr) {
        console.error('Failed to send upload notification:', notifyErr);
      }
    }

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
