// Public country lookup — used ONLY by consent.js to decide the DEFAULT checked
// state of the "Analytics & Location" box in the cookie banner (pre-checked in the
// US, which is an opt-out regime; unchecked everywhere else, per GDPR/UK ePrivacy).
//
// This never grants consent and never starts tracking — the visitor still has to
// click Accept or Save. Returns the country and nothing else: no city, region,
// postal code, or IP. Needs no D1 binding, so unlike /api/track it also works on
// preview deployments and in local `wrangler pages dev`.
// OPTIONS preflight is answered by the global CORS handler in functions/_middleware.js
// before it ever reaches here, so this only needs to cover GET (and HEAD, which
// health checks and `curl -I` use).
export async function onRequest(context) {
  const { request } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // request.cf is absent under some local wrangler modes — fall back to unknown.
  const cf = request.cf || {};
  const raw = cf.country;

  // 'XX' (unknown) and 'T1' (Tor exit node) carry no usable location, so they are
  // reported as unknown, which fails closed to an unchecked box on the client.
  const country = (typeof raw === 'string' && /^[A-Z]{2}$/.test(raw) && raw !== 'XX' && raw !== 'T1')
    ? raw
    : null;

  return new Response(JSON.stringify({ country }), {
    headers: {
      'Content-Type': 'application/json',
      // Per-visitor data: a shared cache replaying one visitor's country to
      // another would silently pre-check the box for EU visitors. CDN-Cache-Control
      // additionally defends against a future Cache Rule being added over /api/*.
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'CDN-Cache-Control': 'no-store'
    }
  });
}
