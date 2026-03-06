// Dog photo upload endpoint
import { requireAuth } from '../../../utils/auth.js';

export async function onRequestPost(context) {
  const { env, params } = context;
  const dogId = params.id;

  const auth = await requireAuth(context);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const dog = await env.DB.prepare('SELECT * FROM dogs WHERE id = ?').bind(dogId).first();
    if (!dog) {
      return new Response(JSON.stringify({ error: 'Dog not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Non-admin can only update their own dogs
    if (auth.user.role !== 'admin') {
      const client = await env.DB.prepare(
        'SELECT id FROM clients WHERE user_id = ? AND id = ?'
      ).bind(auth.user.id, dog.client_id).first();
      if (!client) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403, headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const formData = await context.request.formData();
    const file = formData.get('file');
    if (!file) {
      return new Response(JSON.stringify({ error: 'File is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const filename = `dog-photos/${dogId}-${Date.now()}.${fileExt}`;

    // Upload to R2
    await env.MEDIA_BUCKET.put(filename, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    const photoUrl = `/media/${filename}`;

    // Update dog record
    await env.DB.prepare('UPDATE dogs SET photo_url = ? WHERE id = ?')
      .bind(photoUrl, dogId).run();

    return new Response(JSON.stringify({ success: true, photo_url: photoUrl }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Dog photo upload error:', error);
    return new Response(JSON.stringify({ error: 'Failed to upload photo' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
