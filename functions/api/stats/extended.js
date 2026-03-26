import { requireAdmin } from '../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const url = new URL(context.request.url);
    const startDate = url.searchParams.get('startDate') || null;
    const endDate = url.searchParams.get('endDate') || null;

    const [revenueByMonth, servicePopularity, clientGrowth, invoiceStatus, outstandingBalance] = await Promise.all([
      // Revenue by month (filtered by date range)
      startDate || endDate
        ? context.env.DB.prepare(
            `SELECT strftime('%Y-%m', date) as month, SUM(total) as revenue, COUNT(*) as count
             FROM invoices WHERE status = 'paid' AND date >= ? AND date <= ?
             GROUP BY month ORDER BY month ASC`
          ).bind(startDate || '2000-01-01', endDate || '2099-12-31').all()
        : context.env.DB.prepare(
            `SELECT strftime('%Y-%m', date) as month, SUM(total) as revenue, COUNT(*) as count
             FROM invoices WHERE status = 'paid' AND date >= date('now', '-12 months')
             GROUP BY month ORDER BY month ASC`
          ).all(),

      // Service popularity (filtered by date range if provided)
      startDate || endDate
        ? context.env.DB.prepare(
            `SELECT ii.service_name, COUNT(*) as count, SUM(ii.total) as revenue
             FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id
             WHERE i.date >= ? AND i.date <= ?
             GROUP BY ii.service_name ORDER BY count DESC LIMIT 10`
          ).bind(startDate || '2000-01-01', endDate || '2099-12-31').all()
        : context.env.DB.prepare(
            `SELECT service_name, COUNT(*) as count, SUM(total) as revenue
             FROM invoice_items GROUP BY service_name ORDER BY count DESC LIMIT 10`
          ).all(),

      // Client growth by month (filtered by date range)
      startDate || endDate
        ? context.env.DB.prepare(
            `SELECT strftime('%Y-%m', c.created_at) as month, COUNT(*) as new_clients
             FROM clients c LEFT JOIN users u ON c.user_id = u.id
             WHERE (u.deleted_at IS NULL OR u.id IS NULL) AND c.created_at >= ? AND c.created_at <= ?
             GROUP BY month ORDER BY month ASC`
          ).bind(startDate || '2000-01-01', endDate || '2099-12-31').all()
        : context.env.DB.prepare(
            `SELECT strftime('%Y-%m', c.created_at) as month, COUNT(*) as new_clients
             FROM clients c LEFT JOIN users u ON c.user_id = u.id
             WHERE (u.deleted_at IS NULL OR u.id IS NULL) AND c.created_at >= date('now', '-12 months')
             GROUP BY month ORDER BY month ASC`
          ).all(),

      // Invoice status breakdown (filtered by date range if provided)
      startDate || endDate
        ? context.env.DB.prepare(
            `SELECT status, COUNT(*) as count, SUM(total) as total FROM invoices WHERE date >= ? AND date <= ? GROUP BY status`
          ).bind(startDate || '2000-01-01', endDate || '2099-12-31').all()
        : context.env.DB.prepare(
            `SELECT status, COUNT(*) as count, SUM(total) as total FROM invoices GROUP BY status`
          ).all(),

      // Outstanding balance
      context.env.DB.prepare(
        `SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status IN ('pending', 'overdue')`
      ).first()
    ]);

    return new Response(JSON.stringify({
      success: true,
      revenueByMonth: revenueByMonth.results || [],
      servicePopularity: servicePopularity.results || [],
      clientGrowth: clientGrowth.results || [],
      invoiceStatus: invoiceStatus.results || [],
      outstandingBalance: outstandingBalance?.total || 0
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Extended stats error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load extended stats' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
