// Fun facts management (admin only)
import { requireAdmin } from '../../utils/auth.js';

// Create a new fun fact
export async function onRequestPost(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { client_id, fact, additional_email } = await context.request.json();

    if (!client_id || !fact) {
      return new Response(
        JSON.stringify({ error: 'Client ID and fact are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await context.env.DB.prepare(`
      INSERT INTO fun_facts (client_id, fact)
      VALUES (?, ?)
      RETURNING *
    `).bind(client_id, fact).first();

    // Notify client via email
    try {
      const clientInfo = await context.env.DB.prepare(
        'SELECT c.client_name, c.dog_name, c.email, u.username FROM clients c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?'
      ).bind(client_id).first();

      const clientEmail = clientInfo?.email || clientInfo?.username;
      if (clientEmail && clientEmail.includes('@')) {
        const { sendEmail, funFactAddedHtml } = await import('../../utils/emails.js');
        await sendEmail(context.env, {
          to: clientEmail,
          subject: `New Fun Fact About ${clientInfo?.dog_name || 'Your Dog'}!`,
          html: funFactAddedHtml(
            clientInfo?.client_name || 'Valued Client',
            clientInfo?.dog_name || 'your dog',
            fact
          )
        });
      }
    } catch (emailErr) {
      console.error('Failed to send fun fact notification email:', emailErr);
    }

    // Send to additional email if provided
    if (additional_email && additional_email.includes('@')) {
      try {
        const { sendEmail, funFactAddedHtml } = await import('../../utils/emails.js');
        await sendEmail(context.env, {
          to: additional_email,
          subject: 'New Fun Fact - K9 Vision',
          html: funFactAddedHtml('Valued Client', 'your dog', fact)
        });
      } catch (e) { console.error('Additional email error:', e); }
    }

    return new Response(
      JSON.stringify({ success: true, fact: result }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create fun fact error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create fun fact' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
