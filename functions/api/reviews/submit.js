// Public endpoint: submit a review using a token

export async function onRequestPost(context) {
  try {
    const { token, reviewer_name, rating, content } = await context.request.json();

    if (!token || !reviewer_name || !content) {
      return new Response(JSON.stringify({ error: 'Token, name, and review content are required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: 'Rating must be between 1 and 5' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate token
    const tokenRecord = await context.env.DB.prepare(
      'SELECT * FROM review_tokens WHERE token = ? AND used = 0 AND expires_at > datetime(\'now\')'
    ).bind(token).first();

    if (!tokenRecord) {
      return new Response(JSON.stringify({ error: 'Invalid or expired review link. Please request a new one from your trainer.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create the review
    const review = await context.env.DB.prepare(
      'INSERT INTO reviews (client_id, reviewer_name, reviewer_email, rating, content) VALUES (?, ?, ?, ?, ?) RETURNING *'
    ).bind(tokenRecord.client_id, reviewer_name, tokenRecord.email, rating, content).first();

    // Mark token as used
    await context.env.DB.prepare('UPDATE review_tokens SET used = 1 WHERE id = ?').bind(tokenRecord.id).run();

    return new Response(JSON.stringify({ success: true, message: 'Thank you for your review!' }), {
      status: 201, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Review submit error:', error);
    return new Response(JSON.stringify({ error: 'Failed to submit review' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
