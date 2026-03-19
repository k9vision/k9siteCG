// Send invoice via email with PDF attachment using Resend
import { requireAdmin } from '../../../utils/auth';
import { sendEmail, invoiceEmailHtml } from '../../../utils/emails';
import { generateInvoicePDF } from '../../../utils/invoice-pdf';

export async function onRequest(context) {
  const { request, env, params } = context;
  const invoiceId = params.id;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  // Require admin
  const auth = await requireAdmin(context);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get invoice with all details
    const invoice = await env.DB.prepare(`
      SELECT
        invoices.*,
        clients.client_name,
        clients.email as client_email,
        clients.dog_name,
        clients.dog_breed
      FROM invoices
      JOIN clients ON invoices.client_id = clients.id
      WHERE invoices.id = ?
    `).bind(invoiceId).first();

    if (!invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate client email exists
    if (!invoice.client_email || !invoice.client_email.includes('@')) {
      return new Response(JSON.stringify({
        error: 'Client does not have a valid email address. Please update their profile first.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get invoice items
    const items = await env.DB.prepare(
      'SELECT * FROM invoice_items WHERE invoice_id = ?'
    ).bind(invoiceId).all();

    // Generate email HTML
    const html = invoiceEmailHtml(invoice, items.results);

    // Generate PDF attachment
    const pdfBytes = await generateInvoicePDF(invoice, items.results);
    // Convert Uint8Array to base64 for Resend attachment
    let binary = '';
    for (let i = 0; i < pdfBytes.length; i++) {
      binary += String.fromCharCode(pdfBytes[i]);
    }
    const pdfBase64 = btoa(binary);

    // Send email with PDF attachment
    const result = await sendEmail(env, {
      to: invoice.client_email,
      subject: `K9 Vision Invoice #${invoice.invoice_number}`,
      html,
      attachments: [{
        filename: `K9Vision_Invoice_${invoice.invoice_number}.pdf`,
        content: pdfBase64
      }]
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Invoice sent successfully',
      emailId: result.id
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Email invoice error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to send invoice'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
