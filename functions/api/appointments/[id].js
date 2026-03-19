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
    const { status, notes, appointment_date, start_time, end_time } = await context.request.json();

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

    // Handle rescheduling if date/time fields are provided
    let newDate = existing.appointment_date;
    let newStart = existing.start_time;
    let newEnd = existing.end_time;

    if (appointment_date || start_time || end_time) {
      // Only allow reschedule on pending or confirmed appointments
      if (!['pending', 'confirmed'].includes(existing.status)) {
        return new Response(JSON.stringify({ error: 'Can only reschedule pending or confirmed appointments' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      newDate = appointment_date || existing.appointment_date;
      newStart = start_time || existing.start_time;
      newEnd = end_time || existing.end_time;

      // Validate time format (HH:MM)
      const timeRegex = /^\d{2}:\d{2}$/;
      if (start_time && !timeRegex.test(start_time)) {
        return new Response(JSON.stringify({ error: 'start_time must be in HH:MM format' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (end_time && !timeRegex.test(end_time)) {
        return new Response(JSON.stringify({ error: 'end_time must be in HH:MM format' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // Validate end_time is after start_time
      if (newEnd <= newStart) {
        return new Response(JSON.stringify({ error: 'end_time must be after start_time' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // Check availability
      const dateObj = new Date(newDate + 'T00:00:00');
      const dayOfWeek = dateObj.getDay();

      const { results: slots } = await context.env.DB.prepare(`
        SELECT * FROM availability_slots WHERE is_active = 1 AND (
          specific_date = ?
          OR (specific_date IS NULL AND day_of_week = ?
              AND (recurring_start_date IS NULL OR recurring_start_date <= ?)
              AND (recurring_end_date IS NULL OR recurring_end_date >= ?))
        )
      `).bind(newDate, dayOfWeek, newDate, newDate).all();

      if (slots.length === 0) {
        return new Response(JSON.stringify({ error: 'No availability set for this day' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      const timeInSlot = slots.some(s => newStart >= s.start_time && newEnd <= s.end_time);
      if (!timeInSlot) {
        return new Response(JSON.stringify({ error: 'Requested time is outside available hours' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // Check blocked dates
      const blocked = await context.env.DB.prepare(
        'SELECT * FROM blocked_dates WHERE blocked_date = ?'
      ).bind(newDate).first();

      if (blocked) {
        if (blocked.all_day) {
          return new Response(JSON.stringify({ error: 'This date is blocked' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        if (blocked.start_time && blocked.end_time) {
          if (newStart < blocked.end_time && newEnd > blocked.start_time) {
            return new Response(JSON.stringify({ error: 'This time slot is blocked' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
        }
      }

      // Check double-booking (exclude current appointment)
      const doubleBooked = await context.env.DB.prepare(`
        SELECT id FROM appointments
        WHERE appointment_date = ? AND start_time = ? AND status IN ('pending', 'confirmed') AND id != ?
      `).bind(newDate, newStart, id).first();

      if (doubleBooked) {
        return new Response(JSON.stringify({ error: 'This time slot is already booked' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      }
    }

    const appointment = await context.env.DB.prepare(`
      UPDATE appointments
      SET status = COALESCE(?, status),
          notes = COALESCE(?, notes),
          appointment_date = ?,
          start_time = ?,
          end_time = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *
    `).bind(status || null, notes || null, newDate, newStart, newEnd, id).first();

    // Send confirmation email to client
    if (status === 'confirmed') {
      try {
        const client = await context.env.DB.prepare(`
          SELECT c.client_name, c.dog_name, c.email, u.username
          FROM clients c
          LEFT JOIN users u ON c.user_id = u.id
          WHERE c.id = ?
        `).bind(existing.client_id).first();
        const clientEmail = client?.email || client?.username;
        if (clientEmail && clientEmail.includes('@')) {
          const { sendEmail, appointmentConfirmedHtml } = await import('../../utils/emails.js');
          await sendEmail(context.env, {
            to: clientEmail,
            subject: `Appointment Confirmed - ${existing.appointment_date}`,
            html: appointmentConfirmedHtml(
              client?.client_name || 'Valued Client',
              client?.dog_name || 'your dog',
              existing.appointment_date,
              existing.start_time,
              existing.service_name || 'General',
              existing.end_time
            )
          });
        }
      } catch (emailErr) {
        console.error('Failed to send confirmation email:', emailErr);
      }
    }

    // Send completion email to client
    if (status === 'completed') {
      try {
        const client = await context.env.DB.prepare(`
          SELECT c.client_name, c.dog_name, c.email, u.username
          FROM clients c LEFT JOIN users u ON c.user_id = u.id
          WHERE c.id = ?
        `).bind(existing.client_id).first();
        const clientEmail = client?.email || client?.username;
        if (clientEmail && clientEmail.includes('@')) {
          const { sendEmail, appointmentCompletedHtml } = await import('../../utils/emails.js');
          await sendEmail(context.env, {
            to: clientEmail,
            subject: `Training Session Complete - ${existing.appointment_date}`,
            html: appointmentCompletedHtml(
              client?.client_name || 'Valued Client',
              client?.dog_name || 'your dog',
              existing.appointment_date
            )
          });
        }
      } catch (emailErr) {
        console.error('Failed to send completion email:', emailErr);
      }
    }

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

    // Remove synced Google Calendar events on cancellation
    if (status === 'cancelled') {
      try {
        const { removeSyncedEvents } = await import('../../utils/gcal.js');
        await removeSyncedEvents(context.env.DB, context.env, 'appointment', parseInt(id));
      } catch (syncErr) {
        console.error('Google Calendar remove error:', syncErr);
      }
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

    // Remove synced Google Calendar events
    try {
      const { removeSyncedEvents } = await import('../../utils/gcal.js');
      await removeSyncedEvents(context.env.DB, context.env, 'appointment', parseInt(id));
    } catch (syncErr) {
      console.error('Google Calendar remove error:', syncErr);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Delete appointment error:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete appointment' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
