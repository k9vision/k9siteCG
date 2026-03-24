import { requireAdmin } from '../../utils/auth.js';
import { sendEmail, appointmentReminderHtml } from '../../utils/emails.js';

export async function onRequestPost(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    // Find appointments tomorrow that haven't been reminded
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { results: appointments } = await context.env.DB.prepare(
      `SELECT a.id, a.appointment_date, a.start_time, a.service_name,
              c.client_name, c.email, d.dog_name
       FROM appointments a
       JOIN clients c ON a.client_id = c.id
       LEFT JOIN dogs d ON d.client_id = c.id AND d.is_primary = 1
       WHERE a.appointment_date = ?
         AND a.status IN ('pending', 'confirmed')
         AND (a.reminder_sent IS NULL OR a.reminder_sent = 0)`
    ).bind(tomorrowStr).all();

    if (!appointments || appointments.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'No reminders to send' }), { headers: { 'Content-Type': 'application/json' } });
    }

    let sent = 0;
    let failed = 0;

    for (const appt of appointments) {
      if (!appt.email) { failed++; continue; }

      try {
        const html = appointmentReminderHtml(
          appt.client_name || 'Valued Client',
          appt.dog_name || 'your dog',
          appt.appointment_date,
          appt.start_time || 'TBD',
          appt.service_name
        );

        await sendEmail(context.env, {
          to: appt.email,
          subject: `Reminder: Appointment Tomorrow - ${appt.service_name || 'K9 Vision Training'}`,
          html
        });

        await context.env.DB.prepare(
          'UPDATE appointments SET reminder_sent = 1 WHERE id = ?'
        ).bind(appt.id).run();

        sent++;
      } catch (emailErr) {
        console.error(`Failed to send reminder for appointment ${appt.id}:`, emailErr);
        failed++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sent,
      failed,
      total: appointments.length,
      date: tomorrowStr
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Send reminders error:', error);
    return new Response(JSON.stringify({ error: 'Failed to send reminders' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
