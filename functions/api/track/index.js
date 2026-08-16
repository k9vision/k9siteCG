// Public page-view beacon — records coarse visitor geography from Cloudflare's
// request.cf object (city / state / ZIP / country). No IP or PII is stored.
// Mirrors the public, unauthenticated shape of /api/contact.
//
// Each view is classified so the admin report can show real prospects rather than
// our own testing, crawlers, or visitors whose IP geolocates to a proxy network.
// OPTIONS preflight is answered by functions/_middleware.js before we run.

// Private, robots-disallowed paths — a hit here is us, not a prospect.
// Keep in sync with robots.txt.
const INTERNAL_PATHS = [
  '/portal', '/admin-dashboard', '/client-dashboard', '/setup-account',
  '/reset-password', '/forgot-password', '/verify-email', '/register'
];

// Defensive only. Meta's crawler does not execute JavaScript and this beacon is
// JS-only + consent-gated, so simple crawlers cannot reach it — but Googlebot and
// other headless agents do render JS, and they are cheap to exclude.
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|meta-external|bingpreview|headless|phantomjs|puppeteer|playwright|lighthouse|curl|wget|python-requests|axios|scrapy|monitoring|uptime/i;

// Networks that carry real people but destroy the geography: the request egresses
// from the provider's data center, not the visitor's city. Facebook/Instagram's
// in-app browser is the one actually seen in this data (Prineville OR, Forest City NC).
const PROXY_AS_ORG = /facebook|meta platforms|instagram|tiktok|bytedance|snap inc|amazon|google cloud|microsoft azure|digitalocean|linode|hetzner|ovh|oracle cloud/i;
const PROXY_ASNS = [32934, 63293, 54115]; // Meta / Facebook

// Rate limiting keys off a one-way hash of the IP, never the IP itself. The shared
// rate_limits table stores its `ip` column verbatim, which is fine for login/contact
// (a few rows, tied to auth abuse) but not for a beacon that fires on every page load
// by every visitor — that would contradict both the header above and the privacy
// policy's "we do not store your raw IP address". The salt matters: an unsalted
// SHA-256 of an IPv4 is brute-forceable in seconds, since there are only ~4 billion.
// Exported for tests.
export async function hashIp(ip, secret) {
  const data = new TextEncoder().encode(`${secret || 'k9-track-fallback-salt'}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Exported for tests. Pages routes only the onRequest* exports, so this is inert at runtime.
export function classify({ pageUrl, userAgent, asOrg, asn, internalHint }) {
  if (userAgent && BOT_UA.test(userAgent)) return 'bot';
  // Client-supplied hint: set when an auth token is present, so the trainer browsing
  // their own public pages is not counted. Reporting label only — carries no
  // security weight, and a visitor faking it can only exclude themselves.
  if (internalHint === true) return 'internal';
  if (pageUrl && INTERNAL_PATHS.some((p) => pageUrl.startsWith(p))) return 'internal';
  if (asOrg && PROXY_AS_ORG.test(asOrg)) return 'proxied';
  if (asn && PROXY_ASNS.includes(asn)) return 'proxied';
  return 'visitor';
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Throttle floods. 30/minute is far above real browsing but stops anyone from
  // spamming the endpoint to pollute the geography report or grow the table.
  // Fails open (same pattern as /api/contact) so a missing rate_limits table or a
  // hashing error can never cost a legitimate page view.
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const hashedIp = await hashIp(ip, env.JWT_SECRET);
    const { checkRateLimit } = await import('../../utils/rate-limit.js');
    const limit = await checkRateLimit(env.DB, {
      ip: hashedIp, action: 'track', maxAttempts: 30, windowSeconds: 60
    });
    if (!limit.allowed) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfter) }
      });
    }
  } catch (e) { /* rate limit unavailable — record the view anyway */ }

  try {
    const cf = request.cf || {};
    // Body is optional/best-effort — never fail the beacon over a bad body.
    const body = await request.json().catch(() => ({}));
    const pageUrl = typeof body.page_url === 'string' ? body.page_url.slice(0, 512) : null;
    const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 512) : null;
    const userAgent = (request.headers.get('User-Agent') || '').slice(0, 512) || null;
    const asn = typeof cf.asn === 'number' ? cf.asn : null;
    const asOrg = typeof cf.asOrganization === 'string' ? cf.asOrganization.slice(0, 128) : null;

    const trafficType = classify({
      pageUrl,
      userAgent,
      asOrg,
      asn,
      internalHint: body.internal === true
    });

    await env.DB.prepare(
      `INSERT INTO page_views
         (page_url, referrer, city, region, region_code, postal_code, country,
          user_agent, asn, as_org, traffic_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      pageUrl,
      referrer,
      cf.city || null,
      cf.region || null,
      cf.regionCode || null,
      cf.postalCode || null,
      cf.country || null,
      userAgent,
      asn,
      asOrg,
      trafficType
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
