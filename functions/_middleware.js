// Shared middleware for all Pages Functions

exports.onRequest = async function(context) {
  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
};
