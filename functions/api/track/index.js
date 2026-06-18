// Public page-view beacon — records coarse visitor geography from Cloudflare's
// request.cf object (city / state / ZIP / country). No IP or PII is stored.
// Mirrors the public, unauthenticated shape of /api/contact.
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const cf = request.cf || {};
    // Body is optional/best-effort — never fail the beacon over a bad body.
    const body = await request.json().catch(() => ({}));
    const pageUrl = typeof body.page_url === 'string' ? body.page_url.slice(0, 512) : null;
    const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 512) : null;

    await env.DB.prepare(
      `INSERT INTO page_views (page_url, referrer, city, region, region_code, postal_code, country)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      pageUrl,
      referrer,
      cf.city || null,
      cf.region || null,
      cf.regionCode || null,
      cf.postalCode || null,
      cf.country || null
    ).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Non-blocking: a tracking failure must never affect the visitor.
    console.error('Page-view beacon error (non-blocking):', error);
    return new Response(JSON.stringify({ success: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
