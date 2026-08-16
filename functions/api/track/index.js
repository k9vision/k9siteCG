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
