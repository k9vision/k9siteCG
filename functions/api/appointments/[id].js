import { requireAuth } from '../../utils/auth.js';
import { createNotification } from '../../utils/notify.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const id = context.params.id;
    const appointment = await context.env.DB.prepare(`
      SELECT a.*, c.client_name, c.dog_name
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE a.id = ?
    `).bind(id).first();

    if (!appointment) {
      return new Response(JSON.stringify({ error: 'Appointment not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Ownership check for clients
    if (auth.user.role === 'client') {
      const client = await context.env.DB.prepare('SELECT id FROM clients WHERE user_id = ?').bind(auth.user.id).first();
      if (!client || appointment.client_id !== client.id) {
        return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
    }

    return new Response(JSON.stringify({ success: true, appointment }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Get appointment error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load appointment' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestPut(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const id = context.params.id;
    const { status, notes } = await context.request.json();

    const existing = await context.env.DB.prepare('SELECT * FROM appointments WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Appointment not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Clients can only cancel their own appointments
    if (auth.user.role === 'client') {
      const client = await context.env.DB.prepare('SELECT id FROM clients WHERE user_id = ?').bind(auth.user.id).first();
      if (!client || existing.client_id !== client.id) {
        return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
      if (status && status !== 'cancelled') {
        return new Response(JSON.stringify({ error: 'Clients can only cancel appointments' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
    }

    const appointment = await context.env.DB.prepare(`
      UPDATE appointments
      SET status = COALESCE(?, status),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *
    `).bind(status || null, notes || null, id).first();

    // Create notification for cancellations
    if (status === 'cancelled') {
      const client = await context.env.DB.prepare('SELECT client_name, dog_name FROM clients WHERE id = ?').bind(existing.client_id).first();
      await createNotification(context.env.DB, {
        type: 'booking_cancelled',
        title: 'Appointment Cancelled',
        message: `${client?.client_name || 'A client'} cancelled their appointment on ${existing.appointment_date} at ${existing.start_time}`,
        client_id: existing.client_id,
        reference_id: parseInt(id),
        reference_type: 'appointment'
      });
    }

    return new Response(JSON.stringify({ success: true, appointment }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Update appointment error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update appointment' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestDelete(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const id = context.params.id;

    // Only admin can delete
    if (auth.user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    await context.env.DB.prepare('DELETE FROM appointments WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Delete appointment error:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete appointment' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
