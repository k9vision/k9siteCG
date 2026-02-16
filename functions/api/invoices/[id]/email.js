// Send invoice via email using Resend
import { requireAdmin } from '../../../utils/auth';

export async function onRequest(context) {
  const { request, env, params } = context;
  const invoiceId = params.id;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  // Require admin
  const auth = await requireAdmin(context);
  if (!auth.success) {
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

    // Get invoice items
    const items = await env.DB.prepare(
      'SELECT * FROM invoice_items WHERE invoice_id = ?'
    ).bind(invoiceId).all();

    // Generate HTML email
    const invoiceHTML = generateInvoiceHTML(invoice, items.results);

    // Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'trainercg@k9visiontx.com',
        to: invoice.client_email,
        subject: `K9 Vision Invoice #${invoice.invoice_number}`,
        html: invoiceHTML
      })
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      throw new Error(`Resend API error: ${error}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Invoice sent successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Email invoice error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to send invoice',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function generateInvoiceHTML(invoice, items) {
  const itemsHTML = items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.service_name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.price.toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.total.toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice #${invoice.invoice_number}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: #3B82F6; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 32px;">K9 Vision</h1>
        <p style="margin: 10px 0 0 0; font-size: 18px;">Dog Training Services</p>
      </div>

      <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <div style="margin-bottom: 30px;">
          <h2 style="color: #3B82F6; margin-bottom: 10px;">Invoice #${invoice.invoice_number}</h2>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(invoice.date).toLocaleDateString()}</p>
          ${invoice.due_date ? `<p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Trainer:</strong> ${invoice.trainer_name}</p>
        </div>

        <div style="margin-bottom: 30px;">
          <h3 style="color: #1F2937; margin-bottom: 10px;">Bill To:</h3>
          <p style="margin: 5px 0;"><strong>${invoice.client_name}</strong></p>
          <p style="margin: 5px 0;">Dog: ${invoice.dog_name}${invoice.dog_breed ? ` (${invoice.dog_breed})` : ''}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Service</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Price</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <div style="text-align: right; margin-top: 30px;">
          <p style="margin: 8px 0; font-size: 16px;"><strong>Subtotal:</strong> $${invoice.subtotal.toFixed(2)}</p>
          <p style="margin: 8px 0; font-size: 16px;"><strong>Tax (${invoice.tax_rate}%):</strong> $${invoice.tax_amount.toFixed(2)}</p>
          <p style="margin: 8px 0; font-size: 24px; color: #3B82F6;"><strong>Total:</strong> $${invoice.total.toFixed(2)}</p>
        </div>

        ${invoice.notes ? `
          <div style="margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 8px;">
            <p style="margin: 0;"><strong>Notes:</strong></p>
            <p style="margin: 10px 0 0 0;">${invoice.notes}</p>
          </div>
        ` : ''}

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280;">
          <p style="margin: 5px 0;">Thank you for choosing K9 Vision!</p>
          <p style="margin: 5px 0;">For questions, contact us at trainercg@k9visiontx.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
