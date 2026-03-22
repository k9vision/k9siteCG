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
      if (status && !['cancelled', 'confirmed'].includes(status)) {
        return new Response(JSON.stringify({ error: 'Clients can only confirm or cancel appointments' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
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

    // Helper: get client info for emails
    const getClientInfo = async () => {
      return await context.env.DB.prepare(`
        SELECT c.client_name, c.dog_name, c.email, u.username
        FROM clients c LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `).bind(existing.client_id).first();
    };
    const getClientEmail = (client) => {
      const email = client?.email || client?.username;
      return (email && email.includes('@')) ? email : null;
    };

    // --- RESCHEDULE NOTIFICATIONS ---
    const wasRescheduled = newDate !== existing.appointment_date || newStart !== existing.start_time || newEnd !== existing.end_time;
    if (wasRescheduled) {
      try {
        const client = await getClientInfo();
        const clientEmail = getClientEmail(client);
        const { sendEmail, appointmentRescheduledHtml } = await import('../../utils/emails.js');
        const rescheduledBy = auth.user.role === 'client' ? 'client' : 'trainer';

        // Email client about reschedule
        if (clientEmail) {
          await sendEmail(context.env, {
            to: clientEmail,
            subject: `Appointment Rescheduled - ${newDate}`,
            html: appointmentRescheduledHtml(
              client?.client_name || 'Valued Client', client?.dog_name || 'your dog',
              existing.appointment_date, existing.start_time,
              newDate, newStart, rescheduledBy
            )
          });
        }

        // Email admin when client reschedules
        if (auth.user.role === 'client') {
          await sendEmail(context.env, {
            to: 'trainercg@k9visiontx.com',
            subject: `Client Rescheduled: ${client?.client_name || 'Client'} - ${newDate}`,
            html: appointmentRescheduledHtml(
              client?.client_name || 'A client', client?.dog_name || 'their dog',
              existing.appointment_date, existing.start_time,
              newDate, newStart, 'client'
            )
          });
        }
      } catch (emailErr) {
        console.error('Failed to send reschedule email:', emailErr);
      }
    }

    // --- CONFIRMATION NOTIFICATIONS ---
    if (status === 'confirmed') {
      try {
        const client = await getClientInfo();
        const clientEmail = getClientEmail(client);
        const { sendEmail, appointmentConfirmedHtml } = await import('../../utils/emails.js');

        // Always send confirmation email to client (whether admin or client confirms)
        if (clientEmail) {
          await sendEmail(context.env, {
            to: clientEmail,
            subject: `Appointment Confirmed - ${existing.appointment_date}`,
            html: appointmentConfirmedHtml(
              client?.client_name || 'Valued Client', client?.dog_name || 'your dog',
              existing.appointment_date, existing.start_time,
              existing.service_name || 'General', existing.end_time
            )
          });
        }

        // Notify admin when client confirms
        if (auth.user.role === 'client') {
          await createNotification(context.env.DB, {
            type: 'booking_confirmed', title: 'Appointment Confirmed by Client',
            message: `${client?.client_name || 'A client'} confirmed their appointment on ${existing.appointment_date} at ${existing.start_time}`,
            client_id: existing.client_id, reference_id: parseInt(id), reference_type: 'appointment'
          });

          await sendEmail(context.env, {
            to: 'trainercg@k9visiontx.com',
            subject: `Client Confirmed: ${client?.client_name || 'Client'} - ${existing.appointment_date}`,
            html: `<p><strong>${client?.client_name || 'A client'}</strong> has confirmed their appointment on <strong>${existing.appointment_date}</strong> at <strong>${existing.start_time}</strong>.</p>`
          });
        }
      } catch (emailErr) {
        console.error('Failed to send confirmation email:', emailErr);
      }
    }

    // --- COMPLETION NOTIFICATIONS ---
    if (status === 'completed') {
      try {
        const client = await getClientInfo();
        const clientEmail = getClientEmail(client);
        if (clientEmail) {
          const { sendEmail, appointmentCompletedHtml } = await import('../../utils/emails.js');
          await sendEmail(context.env, {
            to: clientEmail,
            subject: `Training Session Complete - ${existing.appointment_date}`,
            html: appointmentCompletedHtml(
              client?.client_name || 'Valued Client', client?.dog_name || 'your dog',
              existing.appointment_date
            )
          });
        }
      } catch (emailErr) {
        console.error('Failed to send completion email:', emailErr);
      }
    }

    // --- CANCELLATION NOTIFICATIONS ---
    if (status === 'cancelled') {
      try {
        const client = await getClientInfo();
        const clientEmail = getClientEmail(client);
        const cancelledBy = auth.user.role === 'client' ? 'client' : 'trainer';

        await createNotification(context.env.DB, {
          type: 'booking_cancelled', title: 'Appointment Cancelled',
          message: `${client?.client_name || 'A client'} cancelled their appointment on ${existing.appointment_date} at ${existing.start_time}`,
          client_id: existing.client_id, reference_id: parseInt(id), reference_type: 'appointment'
        });

        const { sendEmail, appointmentCancelledHtml } = await import('../../utils/emails.js');

        // Email client about cancellation
        if (clientEmail) {
          await sendEmail(context.env, {
            to: clientEmail,
            subject: `Appointment Cancelled - ${existing.appointment_date}`,
            html: appointmentCancelledHtml(
              client?.client_name || 'Valued Client', client?.dog_name || 'your dog',
              existing.appointment_date, existing.start_time, cancelledBy
            )
          });
        }

        // Email admin when client cancels
        if (auth.user.role === 'client') {
          await sendEmail(context.env, {
            to: 'trainercg@k9visiontx.com',
            subject: `Client Cancelled: ${client?.client_name || 'Client'} - ${existing.appointment_date}`,
            html: appointmentCancelledHtml(
              client?.client_name || 'A client', client?.dog_name || 'their dog',
              existing.appointment_date, existing.start_time, 'client'
            )
          });
        }
      } catch (emailErr) {
        console.error('Failed to send cancellation email:', emailErr);
      }

      // Remove synced Google Calendar events
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

    // Look up appointment and client before deleting to send notification
    const appt = await context.env.DB.prepare('SELECT * FROM appointments WHERE id = ?').bind(id).first();
    if (appt) {
      try {
        const client = await context.env.DB.prepare(`
          SELECT c.client_name, c.dog_name, c.email, u.username
          FROM clients c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?
        `).bind(appt.client_id).first();
        const clientEmail = client?.email || client?.username;
        if (clientEmail && clientEmail.includes('@')) {
          const { sendEmail, appointmentCancelledHtml } = await import('../../utils/emails.js');
          await sendEmail(context.env, {
            to: clientEmail,
            subject: `Appointment Cancelled - ${appt.appointment_date}`,
            html: appointmentCancelledHtml(
              client?.client_name || 'Valued Client', client?.dog_name || 'your dog',
              appt.appointment_date, appt.start_time, 'trainer'
            )
          });
        }
      } catch (emailErr) {
        console.error('Failed to send deletion notification:', emailErr);
      }
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
