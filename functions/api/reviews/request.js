// Send a review request email to a client or any email
import { requireAdmin } from '../../utils/auth.js';

export async function onRequestPost(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { 'Content-Type': 'application/json' }
      });
    }

    const { email, client_id } = await context.request.json();

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'A valid email address is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate unique token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    await context.env.DB.prepare(
      'INSERT INTO review_tokens (token, email, client_id, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(token, email, client_id || null, expiresAt).run();

    // Look up client name if client_id provided
    let clientName = 'Valued Client';
    if (client_id) {
      const client = await context.env.DB.prepare('SELECT client_name FROM clients WHERE id = ?').bind(client_id).first();
      if (client) clientName = client.client_name;
    }

    // Send email
    const reviewUrl = `https://k9visiontx.com/review?token=${token}`;
    const { sendEmail, reviewRequestHtml } = await import('../../utils/emails.js');
    await sendEmail(context.env, {
      to: email,
      subject: 'We\'d Love Your Feedback! - K9 Vision',
      html: reviewRequestHtml(clientName, reviewUrl)
    });

    return new Response(JSON.stringify({ success: true, message: 'Review request sent' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Review request error:', error);
    return new Response(JSON.stringify({ error: 'Failed to send review request' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
