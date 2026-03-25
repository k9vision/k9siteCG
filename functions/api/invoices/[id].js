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
      const { status, notes, new_items, trainer_name, date, due_date, tax_rate, discount_type, discount_value } = await request.json();

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

      if (tax_rate !== undefined || discount_type !== undefined || discount_value !== undefined) {
        // Recalculate totals with tax and discount
        const current = await env.DB.prepare(
          'SELECT subtotal, tax_rate, discount_type, discount_value FROM invoices WHERE id = ?'
        ).bind(invoiceId).first();
        const subtotal = current.subtotal || 0;
        const newTaxRate = tax_rate !== undefined ? tax_rate : (current.tax_rate || 0);
        const newDiscountType = discount_type !== undefined ? discount_type : current.discount_type;
        const newDiscountValue = discount_value !== undefined ? discount_value : (current.discount_value || 0);
        let discountAmount = 0;
        if (newDiscountType === 'percentage' && newDiscountValue > 0) {
          discountAmount = subtotal * (newDiscountValue / 100);
        } else if (newDiscountType === 'fixed' && newDiscountValue > 0) {
          discountAmount = Math.min(newDiscountValue, subtotal);
        }
        const taxable = subtotal - discountAmount;
        const taxAmount = taxable * (newTaxRate / 100);
        const total = taxable + taxAmount;
        await env.DB.prepare(
          'UPDATE invoices SET tax_rate = ?, tax_amount = ?, total = ?, discount_type = ?, discount_value = ?, discount_amount = ? WHERE id = ?'
        ).bind(newTaxRate, taxAmount, total, newDiscountType || null, newDiscountValue, discountAmount, invoiceId).run();
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
          'SELECT tax_rate, discount_type, discount_value FROM invoices WHERE id = ?'
        ).bind(invoiceId).first();

        const subtotal = allItems.subtotal || 0;
        let discAmt = 0;
        if (currentInvoice.discount_type === 'percentage' && currentInvoice.discount_value > 0) {
          discAmt = subtotal * (currentInvoice.discount_value / 100);
        } else if (currentInvoice.discount_type === 'fixed' && currentInvoice.discount_value > 0) {
          discAmt = Math.min(currentInvoice.discount_value, subtotal);
        }
        const taxableAmt = subtotal - discAmt;
        const taxAmount = taxableAmt * (currentInvoice.tax_rate / 100);
        const total = taxableAmt + taxAmount;

        await env.DB.prepare(
          'UPDATE invoices SET subtotal = ?, tax_amount = ?, total = ?, discount_amount = ? WHERE id = ?'
        ).bind(subtotal, taxAmount, total, discAmt, invoiceId).run();
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
