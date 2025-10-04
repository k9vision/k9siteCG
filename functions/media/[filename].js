// Serve media files from R2 bucket

export async function onRequestGet(context) {
  try {
    const filename = context.params.filename;

    const object = await context.env.MEDIA_BUCKET.get(filename);

    if (!object) {
      return new Response('File not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('cache-control', 'public, max-age=31536000');

    return new Response(object.body, {
      headers,
    });
  } catch (error) {
    console.error('Serve media error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
