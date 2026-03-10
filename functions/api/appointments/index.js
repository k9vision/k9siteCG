import { requireAuth } from '../../utils/auth.js';
import { createNotification } from '../../utils/notify.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    let query, params;

    if (auth.user.role === 'admin') {
      query = `SELECT a.*, c.client_name, c.dog_name
               FROM appointments a
               LEFT JOIN clients c ON a.client_id = c.id
               ORDER BY a.appointment_date, a.start_time`;
      params = [];
    } else {
      const client = await context.env.DB.prepare('SELECT id FROM clients WHERE user_id = ?').bind(auth.user.id).first();
      if (!client) {
        return new Response(JSON.stringify({ success: true, appointments: [] }), { headers: { 'Content-Type': 'application/json' } });
      }
      query = `SELECT a.*, c.client_name, c.dog_name
               FROM appointments a
               LEFT JOIN clients c ON a.client_id = c.id
               WHERE a.client_id = ?
               ORDER BY a.appointment_date, a.start_time`;
      params = [client.id];
    }

    const { results } = await context.env.DB.prepare(query).bind(...params).all();

    return new Response(JSON.stringify({ success: true, appointments: results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('List appointments error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load appointments' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestPost(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const { appointment_date, start_time, end_time, service_id, service_name, notes } = await context.request.json();

    if (!appointment_date || !start_time || !end_time) {
      return new Response(JSON.stringify({ error: 'appointment_date, start_time, and end_time are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Resolve client_id
    let clientId;
    if (auth.user.role === 'client') {
      const client = await context.env.DB.prepare('SELECT id FROM clients WHERE user_id = ?').bind(auth.user.id).first();
      if (!client) {
        return new Response(JSON.stringify({ error: 'Client profile not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      clientId = client.id;
    } else {
      const body = await context.request.clone().json().catch(() => ({}));
      clientId = body.client_id;
      if (!clientId) {
        return new Response(JSON.stringify({ error: 'client_id is required for admin bookings' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Check availability: recurring (day_of_week) OR specific_date matches
    const dateObj = new Date(appointment_date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();

    const { results: slots } = await context.env.DB.prepare(`
      SELECT * FROM availability_slots WHERE is_active = 1 AND (
        specific_date = ?
        OR (specific_date IS NULL AND day_of_week = ?
            AND (recurring_start_date IS NULL OR recurring_start_date <= ?)
            AND (recurring_end_date IS NULL OR recurring_end_date >= ?))
      )
    `).bind(appointment_date, dayOfWeek, appointment_date, appointment_date).all();

    if (slots.length === 0) {
      return new Response(JSON.stringify({ error: 'No availability set for this day' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Check the requested time falls within an available slot
    const timeInSlot = slots.some(s => start_time >= s.start_time && end_time <= s.end_time);
    if (!timeInSlot) {
      return new Response(JSON.stringify({ error: 'Requested time is outside available hours' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Check blocked dates
    const blocked = await context.env.DB.prepare(
      'SELECT * FROM blocked_dates WHERE blocked_date = ?'
    ).bind(appointment_date).first();

    if (blocked) {
      if (blocked.all_day) {
        return new Response(JSON.stringify({ error: 'This date is blocked' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (blocked.start_time && blocked.end_time) {
        if (start_time < blocked.end_time && end_time > blocked.start_time) {
          return new Response(JSON.stringify({ error: 'This time slot is blocked' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
      }
    }

    // Check double-booking
    const existing = await context.env.DB.prepare(`
      SELECT id FROM appointments
      WHERE appointment_date = ? AND start_time = ? AND status IN ('pending', 'confirmed')
    `).bind(appointment_date, start_time).first();

    if (existing) {
      return new Response(JSON.stringify({ error: 'This time slot is already booked' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    const appointment = await context.env.DB.prepare(`
      INSERT INTO appointments (client_id, appointment_date, start_time, end_time, service_id, service_name, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(clientId, appointment_date, start_time, end_time, service_id || null, service_name || null, notes || null).first();

    // Sync to Google Calendar (fire-and-forget)
    try {
      const { syncAppointmentToGoogle } = await import('../../utils/gcal.js');
      await syncAppointmentToGoogle(context.env.DB, context.env, appointment, clientId);
    } catch (syncErr) {
      console.error('Google Calendar sync error:', syncErr);
    }

    // Get client info for notification
    const client = await context.env.DB.prepare('SELECT client_name, dog_name FROM clients WHERE id = ?').bind(clientId).first();

    await createNotification(context.env.DB, {
      type: 'new_booking',
      title: 'New Appointment Booking',
      message: `${client?.client_name || 'A client'} booked an appointment for ${appointment_date} at ${start_time}`,
      client_id: clientId,
      reference_id: appointment.id,
      reference_type: 'appointment'
    });

    // Send admin email notification
    try {
      const { sendEmail, appointmentBookedNotificationHtml } = await import('../../utils/emails.js');
      const adminEmail = 'trainercg@k9visiontx.com';
      await sendEmail(context.env, {
        to: adminEmail,
        subject: `New Booking: ${client?.client_name || 'Client'} - ${appointment_date}`,
        html: appointmentBookedNotificationHtml(
          client?.client_name || 'A client',
          client?.dog_name || 'their dog',
          appointment_date,
          start_time,
          service_name || 'General'
        )
      });
    } catch (emailErr) {
      console.error('Failed to send booking notification email:', emailErr);
    }

    return new Response(JSON.stringify({ success: true, appointment }), {
      status: 201, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Create appointment error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create appointment' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
