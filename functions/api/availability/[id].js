import { requireAdmin } from '../../utils/auth.js';

export async function onRequestPut(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const id = context.params.id;
    const { day_of_week, start_time, end_time, slot_duration_minutes, is_active } = await context.request.json();

    const slot = await context.env.DB.prepare(`
      UPDATE availability_slots
      SET day_of_week = COALESCE(?, day_of_week),
          start_time = COALESCE(?, start_time),
          end_time = COALESCE(?, end_time),
          slot_duration_minutes = COALESCE(?, slot_duration_minutes),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
      RETURNING *
    `).bind(
      day_of_week ?? null, start_time ?? null, end_time ?? null,
      slot_duration_minutes ?? null, is_active ?? null, id
    ).first();

    if (!slot) {
      return new Response(JSON.stringify({ error: 'Slot not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, slot }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Update availability error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update slot' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestDelete(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const id = context.params.id;
    await context.env.DB.prepare('DELETE FROM availability_slots WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Delete availability error:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete slot' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
