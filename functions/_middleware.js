// Shared middleware for all Pages Functions

const ALLOWED_ORIGINS = [
  'https://k9visiontx.com',
  'https://www.k9visiontx.com',
  'https://k9sitecg.pages.dev'
];

// Well-known vulnerability-scanner probe paths. Bots ignore robots.txt and hammer these;
// we short-circuit them with a cheap 403 so they never touch a Function or static lookup.
const SCANNER_PATHS = [
  /^\/wp-/i, /^\/wordpress/i, /^\/xmlrpc\.php/i,
  /^\/(?:phpmyadmin|phpMyAdmin|pma|myadmin|mysqladmin|dbadmin)/i,
  /^\/administrator/i, /^\/vendor\//i, /^\/cgi-bin\//i,
  /^\/\.(?:env|git|aws|ssh|svn|htaccess|DS_Store)/i,
  /\.(?:php|asp|aspx|jsp|cgi)(?:$|\/)/i
];

export async function onRequest(context) {
  // Block scanner probes early (before CORS / Functions / static lookup).
  const probePath = new URL(context.request.url).pathname;
  if (SCANNER_PATHS.some((re) => re.test(probePath))) {
    return new Response('Forbidden', { status: 403, headers: { 'Content-Type': 'text/plain' } });
  }

  const origin = context.request.headers.get('Origin');
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };

  // Handle preflight requests
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  // Continue to the next handler
  const response = await context.next();

  // Add CORS headers to response
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
