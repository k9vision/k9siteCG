// Invoice Items API - Delete individual invoice item and recalculate totals
import { requireAdmin } from '../../../utils/auth';

export async function onRequest(context) {
  const { request, env, params } = context;
  const itemId = params.id;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  const auth = await requireAdmin(context);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    if (request.method === 'DELETE') {
      // Get the invoice_id before deleting
      const item = await env.DB.prepare(
        'SELECT invoice_id FROM invoice_items WHERE id = ?'
      ).bind(itemId).first();

      if (!item) {
        return new Response(JSON.stringify({ error: 'Invoice item not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const invoiceId = item.invoice_id;

      // Delete the item
      await env.DB.prepare(
        'DELETE FROM invoice_items WHERE id = ?'
      ).bind(itemId).run();

      // Recalculate invoice totals (including discount)
      const allItems = await env.DB.prepare(
        'SELECT SUM(total) as subtotal FROM invoice_items WHERE invoice_id = ?'
      ).bind(invoiceId).first();

      const currentInvoice = await env.DB.prepare(
        'SELECT tax_rate, discount_type, discount_value FROM invoices WHERE id = ?'
      ).bind(invoiceId).first();

      const subtotal = allItems.subtotal || 0;
      let discountAmount = 0;
      if (currentInvoice.discount_type === 'percentage' && currentInvoice.discount_value > 0) {
        discountAmount = subtotal * (currentInvoice.discount_value / 100);
      } else if (currentInvoice.discount_type === 'fixed' && currentInvoice.discount_value > 0) {
        discountAmount = Math.min(currentInvoice.discount_value, subtotal);
      }
      const taxable = subtotal - discountAmount;
      const taxAmount = taxable * ((currentInvoice.tax_rate || 0) / 100);
      const total = taxable + taxAmount;

      await env.DB.prepare(
        'UPDATE invoices SET subtotal = ?, tax_amount = ?, total = ?, discount_amount = ? WHERE id = ?'
      ).bind(subtotal, taxAmount, total, discountAmount, invoiceId).run();

      return new Response(JSON.stringify({
        success: true,
        invoice_id: invoiceId,
        subtotal,
        tax_amount: taxAmount,
        total
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'PUT') {
      const { status, notify_client, due_date, amount_paid, quantity, price, upfront_pct } = await request.json();

      const item = await env.DB.prepare(
        'SELECT * FROM invoice_items WHERE id = ?'
      ).bind(itemId).first();

      if (!item) {
        return new Response(JSON.stringify({ error: 'Invoice item not found' }), {
          status: 404, headers: { 'Content-Type': 'application/json' }
        });
      }

      let needsInvoiceRecalc = false;

      // Update quantity and/or price if provided
      if (quantity !== undefined || price !== undefined) {
        const newQty = quantity !== undefined ? Number(quantity) : item.quantity;
        const newPrice = price !== undefined ? Number(price) : item.price;
        const newTotal = newQty * newPrice;
        await env.DB.prepare(
          'UPDATE invoice_items SET quantity = ?, price = ?, total = ? WHERE id = ?'
        ).bind(newQty, newPrice, newTotal, itemId).run();
        needsInvoiceRecalc = true;
      }

      // Update due_date and/or amount_paid if provided
      if (due_date !== undefined) {
        await env.DB.prepare('UPDATE invoice_items SET due_date = ? WHERE id = ?').bind(due_date || null, itemId).run();
      }
      if (amount_paid !== undefined) {
        await env.DB.prepare('UPDATE invoice_items SET amount_paid = ? WHERE id = ?').bind(Number(amount_paid) || 0, itemId).run();
      }
      if (upfront_pct !== undefined) {
        await env.DB.prepare('UPDATE invoice_items SET upfront_pct = ? WHERE id = ?').bind(Number(upfront_pct) || 0, itemId).run();
      }

      // Update status if provided
      if (status) {
        if (!['pending', 'paid'].includes(status)) {
          return new Response(JSON.stringify({ error: 'Status must be "pending" or "paid"' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
          });
        }
        await env.DB.prepare(
          'UPDATE invoice_items SET status = ? WHERE id = ?'
        ).bind(status, itemId).run();
      }

      // Recalculate invoice totals if quantity/price changed
      if (needsInvoiceRecalc) {
        const allItems = await env.DB.prepare(
          'SELECT SUM(total) as subtotal FROM invoice_items WHERE invoice_id = ?'
        ).bind(item.invoice_id).first();

        const currentInvoice = await env.DB.prepare(
          'SELECT tax_rate, discount_type, discount_value FROM invoices WHERE id = ?'
        ).bind(item.invoice_id).first();

        const subtotal = allItems.subtotal || 0;
        let discountAmount = 0;
        if (currentInvoice.discount_type === 'percentage' && currentInvoice.discount_value > 0) {
          discountAmount = subtotal * (currentInvoice.discount_value / 100);
        } else if (currentInvoice.discount_type === 'fixed' && currentInvoice.discount_value > 0) {
          discountAmount = Math.min(currentInvoice.discount_value, subtotal);
        }
        const taxable = subtotal - discountAmount;
        const taxAmount = taxable * ((currentInvoice.tax_rate || 0) / 100);
        const total = taxable + taxAmount;

        await env.DB.prepare(
          'UPDATE invoices SET subtotal = ?, tax_amount = ?, total = ?, discount_amount = ? WHERE id = ?'
        ).bind(subtotal, taxAmount, total, discountAmount, item.invoice_id).run();
      }

      // Send email notification if requested
      if (notify_client && status) {
        try {
          const invoice = await env.DB.prepare(`
            SELECT invoices.*,
              COALESCE(invoices.recipient_name, clients.client_name) as client_name,
              COALESCE(invoices.recipient_email, clients.email) as client_email
            FROM invoices LEFT JOIN clients ON invoices.client_id = clients.id
            WHERE invoices.id = ?
          `).bind(item.invoice_id).first();

          const emailTo = invoice?.client_email;
          if (emailTo && emailTo.includes('@')) {
            const { sendEmail, invoiceItemStatusHtml } = await import('../../../utils/emails.js');
            await sendEmail(env, {
              to: emailTo,
              subject: `Invoice #${invoice.invoice_number} - Service ${status === 'paid' ? 'Paid' : 'Updated'}`,
              html: invoiceItemStatusHtml(
                invoice.client_name || 'Valued Client',
                invoice.invoice_number,
                item.service_name,
                status
              )
            });
          }
        } catch (emailErr) {
          console.error('Failed to send item status notification:', emailErr);
        }
      }

      // Return updated item
      const updatedItem = await env.DB.prepare(
        'SELECT * FROM invoice_items WHERE id = ?'
      ).bind(itemId).first();

      return new Response(JSON.stringify({
        success: true,
        item: updatedItem
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Invoice item API error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
