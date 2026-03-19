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
