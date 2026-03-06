import { requireAuth, requireAdmin } from '../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const { results } = await context.env.DB.prepare(
      'SELECT * FROM availability_slots ORDER BY day_of_week, start_time'
    ).all();

    return new Response(JSON.stringify({ success: true, slots: results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('List availability error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load availability' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestPost(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const { day_of_week, start_time, end_time, slot_duration_minutes } = await context.request.json();

    if (day_of_week === undefined || !start_time || !end_time) {
      return new Response(JSON.stringify({ error: 'day_of_week, start_time, and end_time are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const slot = await context.env.DB.prepare(`
      INSERT INTO availability_slots (day_of_week, start_time, end_time, slot_duration_minutes)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `).bind(day_of_week, start_time, end_time, slot_duration_minutes || 60).first();

    return new Response(JSON.stringify({ success: true, slot }), {
      status: 201, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Create availability error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create availability slot' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
