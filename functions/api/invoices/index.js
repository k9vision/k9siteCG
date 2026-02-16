// Invoices API - List all invoices and create new invoice
import { requireAdmin } from '../../utils/auth';

// Generate invoice number: YY + DD + Client(2) + Dog(2)
function generateInvoiceNumber(clientName, dogName) {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const day = now.getDate().toString().padStart(2, '0');
  const clientInitials = (clientName || 'XX').substring(0, 2).toUpperCase();
  const dogInitials = (dogName || 'XX').substring(0, 2).toUpperCase();

  return `${year}${day}${clientInitials}${dogInitials}`;
}

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  // Require admin for all invoice operations
  const auth = await requireAdmin(context);
  if (!auth.success) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    if (request.method === 'GET') {
      // List all invoices with client and dog info
      const { results } = await env.DB.prepare(`
        SELECT
          invoices.*,
          clients.client_name,
          clients.email as client_email,
          clients.dog_name,
          clients.dog_breed
        FROM invoices
        JOIN clients ON invoices.client_id = clients.id
        ORDER BY invoices.created_at DESC
      `).all();

      return new Response(JSON.stringify({
        success: true,
        invoices: results
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      // Create new invoice
      const {
        client_id,
        trainer_name,
        date,
        due_date,
        tax_rate,
        items,
        notes
      } = await request.json();

      if (!client_id || !trainer_name || !date || !items || items.length === 0) {
        return new Response(JSON.stringify({
          error: 'Client, trainer name, date, and at least one item are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get client info for invoice number generation
      const client = await env.DB.prepare(
        'SELECT client_name, dog_name FROM clients WHERE id = ?'
      ).bind(client_id).first();

      if (!client) {
        return new Response(JSON.stringify({ error: 'Client not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Generate invoice number
      const invoice_number = generateInvoiceNumber(client.client_name, client.dog_name);

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
         (invoice_number, client_id, trainer_name, date, due_date, subtotal, tax_rate, tax_amount, total, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        invoice_number,
        client_id,
        trainer_name,
        date,
        due_date || null,
        subtotal,
        tax_rate,
        tax_amount,
        total,
        notes || null
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
          clients.client_name,
          clients.email as client_email,
          clients.dog_name,
          clients.dog_breed
        FROM invoices
        JOIN clients ON invoices.client_id = clients.id
        WHERE invoices.id = ?
      `).bind(invoice_id).first();

      const invoiceItems = await env.DB.prepare(
        'SELECT * FROM invoice_items WHERE invoice_id = ?'
      ).bind(invoice_id).all();

      return new Response(JSON.stringify({
        success: true,
        invoice: {
          ...invoice,
          items: invoiceItems.results
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
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
