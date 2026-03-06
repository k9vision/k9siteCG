import { requireAuth, requireAdmin } from '../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const { results } = await context.env.DB.prepare(
      'SELECT * FROM blocked_dates ORDER BY blocked_date'
    ).all();

    return new Response(JSON.stringify({ success: true, blocked_dates: results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('List blocked dates error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load blocked dates' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestPost(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const { blocked_date, reason, all_day, start_time, end_time } = await context.request.json();

    if (!blocked_date) {
      return new Response(JSON.stringify({ error: 'blocked_date is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await context.env.DB.prepare(`
      INSERT INTO blocked_dates (blocked_date, reason, all_day, start_time, end_time)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `).bind(blocked_date, reason || null, all_day !== undefined ? (all_day ? 1 : 0) : 1, start_time || null, end_time || null).first();

    return new Response(JSON.stringify({ success: true, blocked_date: result }), {
      status: 201, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Block date error:', error);
    return new Response(JSON.stringify({ error: 'Failed to block date' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
