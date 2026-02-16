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
  if (!auth.success) {
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
      // Update invoice status or notes
      const { status, notes } = await request.json();

      if (status) {
        await env.DB.prepare(
          'UPDATE invoices SET status = ? WHERE id = ?'
        ).bind(status, invoiceId).run();
      }

      if (notes !== undefined) {
        await env.DB.prepare(
          'UPDATE invoices SET notes = ? WHERE id = ?'
        ).bind(notes, invoiceId).run();
      }

      // Get updated invoice
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

      return new Response(JSON.stringify({
        success: true,
        invoice
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
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
