// Reviews API: GET (public for approved, admin for all) + PUT (admin status update)
import { requireAuth, requireAdmin } from '../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const status = url.searchParams.get('status');

    // Public access: only approved reviews
    if (status === 'approved') {
      const { results } = await context.env.DB.prepare(
        'SELECT id, reviewer_name, rating, content, created_at FROM reviews WHERE status = ? ORDER BY created_at DESC'
      ).bind('approved').all();
      return new Response(JSON.stringify({ success: true, reviews: results }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Admin access: all reviews
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { 'Content-Type': 'application/json' }
      });
    }

    let query = 'SELECT * FROM reviews ORDER BY created_at DESC';
    let params = [];
    if (status) {
      query = 'SELECT * FROM reviews WHERE status = ? ORDER BY created_at DESC';
      params = [status];
    }

    const { results } = await context.env.DB.prepare(query).bind(...params).all();
    return new Response(JSON.stringify({ success: true, reviews: results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Reviews GET error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load reviews' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPut(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { 'Content-Type': 'application/json' }
      });
    }

    const { id, status } = await context.request.json();

    if (!id || !['approved', 'rejected', 'pending'].includes(status)) {
      return new Response(JSON.stringify({ error: 'Review ID and valid status (approved/rejected/pending) required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    await context.env.DB.prepare('UPDATE reviews SET status = ? WHERE id = ?').bind(status, id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Reviews PUT error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update review' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
