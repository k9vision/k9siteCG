// Email template preview — renders email HTML for admin preview
import { requireAdmin } from '../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const url = new URL(context.request.url);
    const template = url.searchParams.get('template');
    const paramsStr = url.searchParams.get('params');
    let params = {};
    try { if (paramsStr) params = JSON.parse(paramsStr); } catch (e) { /* use defaults */ }

    const emails = await import('../../utils/emails.js');

    // Whitelist of previewable templates with sample data
    const templates = {
      invoiceEmail: () => {
        const invoice = params.invoice || {
          invoice_number: 'SAMPLE-001', client_name: 'Jane Doe', dog_name: 'Buddy',
          trainer_name: 'Charles', date: '2026-03-25', due_date: '2026-04-25',
          subtotal: 200, tax_rate: 8.25, tax_amount: 16.50, total: 216.50, notes: 'Thank you!'
        };
        const items = params.items || [
          { service_name: 'Obedience Training', quantity: 1, price: 200, total: 200, due_date: '', amount_paid: 0 }
        ];
        return emails.invoiceEmailHtml(invoice, items);
      },
      appointmentConfirmed: () => emails.appointmentConfirmedHtml(
        params.clientName || 'Jane Doe', params.dogName || 'Buddy',
        params.date || '2026-03-25', params.time || '10:00',
        params.serviceName || 'Obedience Training', params.endTime || '11:00'
      ),
      appointmentReminder: () => emails.appointmentReminderHtml(
        params.clientName || 'Jane Doe', params.dogName || 'Buddy',
        params.date || 'March 26, 2026', params.time || '10:00 AM',
        params.serviceName || 'Obedience Training'
      ),
      appointmentCancelled: () => emails.appointmentCancelledHtml(
        params.clientName || 'Jane Doe', params.dogName || 'Buddy',
        params.date || 'March 25, 2026', params.time || '10:00 AM',
        params.cancelledBy || 'Admin'
      ),
      reviewRequest: () => emails.reviewRequestHtml(
        params.clientName || 'Jane Doe',
        params.reviewUrl || 'https://k9visiontx.com/review.html?token=sample-token'
      ),
      inviteEmail: () => emails.inviteEmailHtml(
        params.clientName || 'Jane Doe', params.dogName || 'Buddy',
        params.setupUrl || 'https://k9visiontx.com/portal.html'
      ),
      welcomeEmail: () => emails.inviteEmailHtml(
        params.clientName || 'Jane Doe', params.dogName || 'Buddy',
        params.setupUrl || 'https://k9visiontx.com/portal.html'
      ),
      funFactAdded: () => emails.funFactAddedHtml(
        params.clientName || 'Jane Doe', params.dogName || 'Buddy',
        params.factText || 'Dogs can smell about 1,000 times better than humans!'
      ),
      trainerNote: () => emails.trainerNoteNotificationHtml(
        params.clientName || 'Jane Doe',
        params.noteTitle || 'Training Session Update',
        params.noteContent || 'Great progress today! Buddy is responding well to the recall command.'
      ),
      genericContent: () => emails.genericContentEmailHtml(
        params.contentType || 'Training Update',
        params.title || 'Session Recap',
        params.body || 'Your dog did an amazing job today. Keep practicing the sit-stay command at home.'
      )
    };

    if (!template || !templates[template]) {
      return new Response(JSON.stringify({
        error: 'Invalid template',
        available: Object.keys(templates)
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const html = templates[template]();
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (error) {
    console.error('Email preview error:', error);
    return new Response(JSON.stringify({ error: 'Failed to render preview' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
