// Invoices API - List all invoices and create new invoice
import { requireAuth, requireAdmin } from '../../utils/auth';

// Generate invoice number: YY + DD + Client(2) + Dog(2)
function generateInvoiceNumber(clientName, dogName) {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const day = now.getDate().toString().padStart(2, '0');
  const clientInitials = (clientName || 'XX').substring(0, 2).toUpperCase();
  const dogInitials = (dogName || 'XX').substring(0, 2).toUpperCase();

  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${year}${day}${clientInitials}${dogInitials}-${rand}`;
}

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    if (request.method === 'GET') {
      // Allow both admin and client to fetch invoices
      const auth = await requireAuth(context);
      if (auth.error) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: auth.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      let results;
      if (auth.user.role === 'admin') {
        const data = await env.DB.prepare(`
          SELECT invoices.*,
            COALESCE(invoices.recipient_name, clients.client_name) as client_name,
            COALESCE(invoices.recipient_email, clients.email) as client_email,
            clients.dog_name, clients.dog_breed
          FROM invoices LEFT JOIN clients ON invoices.client_id = clients.id
          ORDER BY invoices.created_at DESC
        `).all();
        results = data.results;
      } else {
        // Client: look up their client record and return only their invoices
        const client = await env.DB.prepare('SELECT id FROM clients WHERE user_id = ?').bind(auth.user.id).first();
        if (!client) {
          return new Response(JSON.stringify({ success: true, invoices: [] }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        const data = await env.DB.prepare(`
          SELECT invoices.*,
            COALESCE(invoices.recipient_name, clients.client_name) as client_name,
            COALESCE(invoices.recipient_email, clients.email) as client_email,
            clients.dog_name, clients.dog_breed
          FROM invoices LEFT JOIN clients ON invoices.client_id = clients.id
          WHERE invoices.client_id = ?
          ORDER BY invoices.created_at DESC
        `).bind(client.id).all();
        results = data.results;

        // Also fetch invoice items for each invoice
        for (const inv of results) {
          const items = await env.DB.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').bind(inv.id).all();
          inv.items = items.results;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        invoices: results
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      // Require admin for creating invoices
      const auth = await requireAdmin(context);
      if (auth.error) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: auth.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      // Create new invoice
      const {
        client_id,
        recipient_email,
        recipient_name,
        trainer_name,
        date,
        due_date,
        tax_rate,
        items,
        notes
      } = await request.json();

      if ((!client_id || client_id === 0) && !recipient_email) {
        return new Response(JSON.stringify({
          error: 'Either a client or recipient email is required'
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (!trainer_name || !date || !items || items.length === 0) {
        return new Response(JSON.stringify({
          error: 'Trainer name, date, and at least one item are required'
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // Get client info for invoice number generation (or use recipient name)
      let clientName = recipient_name || 'GUEST';
      let dogName = 'XX';
      let client = null;
      if (client_id && client_id !== 0) {
        client = await env.DB.prepare(
          'SELECT client_name, dog_name FROM clients WHERE id = ?'
        ).bind(client_id).first();
        if (!client) {
          return new Response(JSON.stringify({ error: 'Client not found' }), {
            status: 404, headers: { 'Content-Type': 'application/json' }
          });
        }
        clientName = client.client_name;
        dogName = client.dog_name;
      }

      // Generate invoice number
      const invoice_number = generateInvoiceNumber(clientName, dogName);

      // Calculate totals
      let subtotal = 0;
      items.forEach(item => {
        subtotal += (item.price * item.quantity);
      });

      const tax_amount = subtotal * (tax_rate / 100);
      const total = subtotal + tax_amount;

      // Create invoice
      const invoiceResult = await env.DB.prepare(
        `INSERT INTO invoices
         (invoice_number, client_id, trainer_name, date, due_date, subtotal, tax_rate, tax_amount, total, notes, recipient_email, recipient_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        invoice_number,
        (client_id && client_id !== 0) ? client_id : 0,
        trainer_name,
        date,
        due_date || null,
        subtotal,
        tax_rate,
        tax_amount,
        total,
        notes || null,
        recipient_email || null,
        recipient_name || null
      ).run();

      const invoice_id = invoiceResult.meta.last_row_id;

      // Create invoice items
      for (const item of items) {
        await env.DB.prepare(
          `INSERT INTO invoice_items
           (invoice_id, service_id, service_name, quantity, price, total)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          invoice_id,
          item.service_id || null,
          item.service_name,
          item.quantity,
          item.price,
          item.price * item.quantity
        ).run();
      }

      // Fetch complete invoice with items
      const invoice = await env.DB.prepare(`
        SELECT
          invoices.*,
          COALESCE(invoices.recipient_name, clients.client_name) as client_name,
          COALESCE(invoices.recipient_email, clients.email) as client_email,
          clients.dog_name,
          clients.dog_breed
        FROM invoices
        LEFT JOIN clients ON invoices.client_id = clients.id
        WHERE invoices.id = ?
      `).bind(invoice_id).first();

      const invoiceItems = await env.DB.prepare(
        'SELECT * FROM invoice_items WHERE invoice_id = ?'
      ).bind(invoice_id).all();

      // Auto-send invoice email if recipient has a valid email
      let email_sent = false;
      let email_error = null;
      // Ensure null-safe fields for non-client invoices
      invoice.client_name = invoice.client_name || invoice.recipient_name || 'Valued Client';
      invoice.dog_name = invoice.dog_name || '';
      invoice.dog_breed = invoice.dog_breed || '';
      const emailTo = invoice.client_email;
      if (emailTo && emailTo.includes('@')) {
        try {
          const { sendEmail, invoiceEmailHtml } = await import('../../utils/emails.js');
          const { generateInvoicePDF } = await import('../../utils/invoice-pdf.js');

          const html = invoiceEmailHtml(invoice, invoiceItems.results);
          const pdfBytes = await generateInvoicePDF(invoice, invoiceItems.results);
          let binary = '';
          for (let i = 0; i < pdfBytes.length; i++) {
            binary += String.fromCharCode(pdfBytes[i]);
          }
          const pdfBase64 = btoa(binary);

          await sendEmail(env, {
            to: emailTo,
            subject: `K9 Vision Invoice #${invoice.invoice_number}`,
            html,
            attachments: [{
              filename: `K9Vision_Invoice_${invoice.invoice_number}.pdf`,
              content: pdfBase64
            }]
          });
          email_sent = true;
        } catch (emailErr) {
          console.error('Auto-send invoice email failed:', emailErr);
          email_error = emailErr.message;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        invoice: {
          ...invoice,
          items: invoiceItems.results,
          email_sent,
          email_error
        }
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Invoices API error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
