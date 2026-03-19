// Invoices API - Get, Update, Delete individual invoice
import { requireAdmin } from '../../utils/auth';

export async function onRequest(context) {
  const { request, env, params } = context;
  const invoiceId = params.id;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  // Require admin for all invoice operations
  const auth = await requireAdmin(context);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    if (request.method === 'GET') {
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

      return new Response(JSON.stringify({
        success: true,
        invoice: {
          ...invoice,
          items: items.results
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'PUT') {
      const { status, notes, new_items, trainer_name, date, due_date, tax_rate } = await request.json();

      if (status) {
        // Invoice status state machine — validate transition
        const VALID_TRANSITIONS = {
          pending: ['paid', 'overdue', 'cancelled'],
          overdue: ['paid', 'cancelled'],
          paid: [],
          cancelled: []
        };

        const currentInvoiceStatus = await env.DB.prepare(
          'SELECT status FROM invoices WHERE id = ?'
        ).bind(invoiceId).first();

        if (!currentInvoiceStatus) {
          return new Response(JSON.stringify({ error: 'Invoice not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const currentStatus = currentInvoiceStatus.status;
        const allowed = VALID_TRANSITIONS[currentStatus] || [];

        if (!allowed.includes(status)) {
          return new Response(JSON.stringify({
            error: `Cannot change invoice status from '${currentStatus}' to '${status}'`
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        await env.DB.prepare(
          'UPDATE invoices SET status = ? WHERE id = ?'
        ).bind(status, invoiceId).run();
      }

      if (notes !== undefined) {
        await env.DB.prepare(
          'UPDATE invoices SET notes = ? WHERE id = ?'
        ).bind(notes, invoiceId).run();
      }

      if (trainer_name !== undefined) {
        await env.DB.prepare(
          'UPDATE invoices SET trainer_name = ? WHERE id = ?'
        ).bind(trainer_name, invoiceId).run();
      }

      if (date !== undefined) {
        await env.DB.prepare(
          'UPDATE invoices SET date = ? WHERE id = ?'
        ).bind(date, invoiceId).run();
      }

      if (due_date !== undefined) {
        await env.DB.prepare(
          'UPDATE invoices SET due_date = ? WHERE id = ?'
        ).bind(due_date, invoiceId).run();
      }

      if (tax_rate !== undefined) {
        // Update tax_rate and recalculate tax_amount and total from current subtotal
        const current = await env.DB.prepare(
          'SELECT subtotal FROM invoices WHERE id = ?'
        ).bind(invoiceId).first();
        const subtotal = current.subtotal || 0;
        const taxAmount = subtotal * (tax_rate / 100);
        const total = subtotal + taxAmount;
        await env.DB.prepare(
          'UPDATE invoices SET tax_rate = ?, tax_amount = ?, total = ? WHERE id = ?'
        ).bind(tax_rate, taxAmount, total, invoiceId).run();
      }

      // Add new line items and recalculate totals
      if (new_items && new_items.length > 0) {
        for (const item of new_items) {
          const itemTotal = item.quantity * item.price;
          await env.DB.prepare(
            'INSERT INTO invoice_items (invoice_id, service_id, service_name, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(invoiceId, item.service_id || null, item.service_name, item.quantity, item.price, itemTotal).run();
        }

        // Recalculate invoice totals
        const allItems = await env.DB.prepare(
          'SELECT SUM(total) as subtotal FROM invoice_items WHERE invoice_id = ?'
        ).bind(invoiceId).first();

        const currentInvoice = await env.DB.prepare(
          'SELECT tax_rate FROM invoices WHERE id = ?'
        ).bind(invoiceId).first();

        const subtotal = allItems.subtotal || 0;
        const taxAmount = subtotal * (currentInvoice.tax_rate / 100);
        const total = subtotal + taxAmount;

        await env.DB.prepare(
          'UPDATE invoices SET subtotal = ?, tax_amount = ?, total = ? WHERE id = ?'
        ).bind(subtotal, taxAmount, total, invoiceId).run();
      }

      // Get updated invoice with items
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

      const items = await env.DB.prepare(
        'SELECT * FROM invoice_items WHERE invoice_id = ?'
      ).bind(invoiceId).all();

      return new Response(JSON.stringify({
        success: true,
        invoice: { ...invoice, items: items.results }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'DELETE') {
      // Delete invoice (cascade will delete items)
      await env.DB.prepare(
        'DELETE FROM invoices WHERE id = ?'
      ).bind(invoiceId).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Invoice deleted successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Invoice API error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
