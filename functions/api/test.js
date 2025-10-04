exports.onRequestGet = async function() {
  return new Response(JSON.stringify({ message: 'Test successful' }), {
    headers: { 'Content-Type': 'application/json' }
  });
};

exports.onRequestPost = async function(context) {
  const body = await context.request.json();
  return new Response(JSON.stringify({ received: body }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
