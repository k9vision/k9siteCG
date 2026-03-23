// Generic content email endpoint - admin sends email to any address
import { requireAdmin } from '../../utils/auth.js';

export async function onRequestPost(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { 'Content-Type': 'application/json' }
      });
    }

    const { to, subject, content_type, content_body, title } = await context.request.json();

    if (!to || !to.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email address required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!content_body) {
      return new Response(JSON.stringify({ error: 'Content is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const { sendEmail, genericContentEmailHtml } = await import('../../utils/emails.js');

    await sendEmail(context.env, {
      to,
      subject: subject || 'Message from K9 Vision',
      html: genericContentEmailHtml(content_type || 'message', title || '', content_body)
    });

    return new Response(JSON.stringify({ success: true, message: 'Email sent' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Send content email error:', error);
    return new Response(JSON.stringify({ error: 'Failed to send email' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
