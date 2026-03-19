import { requireAdmin } from '../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { 'Content-Type': 'application/json' }
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = today.substring(0, 7) + '-01';

    // Total active clients (exclude soft-deleted users)
    const clientCount = await context.env.DB.prepare(
      `SELECT COUNT(*) as count FROM clients c LEFT JOIN users u ON c.user_id = u.id WHERE u.deleted_at IS NULL OR u.id IS NULL`
    ).first();

    // Active appointments today
    const todayAppts = await context.env.DB.prepare(
      `SELECT COUNT(*) as count FROM appointments WHERE appointment_date = ? AND status IN ('pending', 'confirmed')`
    ).bind(today).first();

    // Overdue invoices
    const overdueInv = await context.env.DB.prepare(
      `SELECT COUNT(*) as count FROM invoices WHERE status = 'overdue'`
    ).first();

    // Revenue this month (paid invoices)
    const revenue = await context.env.DB.prepare(
      `SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status = 'paid' AND date >= ?`
    ).bind(firstOfMonth).first();

    return new Response(JSON.stringify({
      success: true,
      stats: {
        totalClients: clientCount?.count || 0,
        activeAppointmentsToday: todayAppts?.count || 0,
        overdueInvoices: overdueInv?.count || 0,
        revenueThisMonth: revenue?.total || 0
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load stats' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
