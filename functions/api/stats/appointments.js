// Appointment analytics — busiest days, cancellation rates, no-show tracking
import { requireAdmin } from '../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const url = new URL(context.request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Build date filter clause
    let dateFilter = '';
    const dateBinds = [];
    if (startDate || endDate) {
      dateFilter = ' AND appointment_date >= ? AND appointment_date <= ?';
      dateBinds.push(startDate || '2000-01-01', endDate || '2099-12-31');
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const [busiestDays, statusBreakdown, busiestHours, monthlyVolume, totalStats] = await Promise.all([
      // Busiest days of week
      context.env.DB.prepare(
        `SELECT CAST(strftime('%w', appointment_date) AS INTEGER) as dow, COUNT(*) as count
         FROM appointments WHERE status IN ('confirmed','completed')${dateFilter}
         GROUP BY dow ORDER BY count DESC`
      ).bind(...dateBinds).all(),

      // Status breakdown
      context.env.DB.prepare(
        `SELECT status, COUNT(*) as count FROM appointments WHERE 1=1${dateFilter} GROUP BY status`
      ).bind(...dateBinds).all(),

      // Busiest hours (top 5)
      context.env.DB.prepare(
        `SELECT start_time, COUNT(*) as count FROM appointments
         WHERE status IN ('confirmed','completed')${dateFilter}
         GROUP BY start_time ORDER BY count DESC LIMIT 5`
      ).bind(...dateBinds).all(),

      // Monthly appointment volume (last 12 months or filtered)
      startDate || endDate
        ? context.env.DB.prepare(
            `SELECT strftime('%Y-%m', appointment_date) as month, COUNT(*) as count
             FROM appointments WHERE appointment_date >= ? AND appointment_date <= ?
             GROUP BY month ORDER BY month ASC`
          ).bind(startDate || '2000-01-01', endDate || '2099-12-31').all()
        : context.env.DB.prepare(
            `SELECT strftime('%Y-%m', appointment_date) as month, COUNT(*) as count
             FROM appointments WHERE appointment_date >= date('now', '-12 months')
             GROUP BY month ORDER BY month ASC`
          ).all(),

      // Aggregate stats for rates
      context.env.DB.prepare(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
           SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as no_show
         FROM appointments WHERE 1=1${dateFilter}`
      ).bind(...dateBinds).first()
    ]);

    // Add day names to busiest days
    const busiestDaysNamed = (busiestDays.results || []).map(d => ({
      ...d,
      day_name: dayNames[d.dow] || 'Unknown'
    }));

    const total = totalStats?.total || 0;
    const completionRate = total > 0 ? Math.round(((totalStats?.completed || 0) / total) * 1000) / 10 : 0;
    const cancellationRate = total > 0 ? Math.round(((totalStats?.cancelled || 0) / total) * 1000) / 10 : 0;
    const noShowRate = total > 0 ? Math.round(((totalStats?.no_show || 0) / total) * 1000) / 10 : 0;

    return new Response(JSON.stringify({
      success: true,
      busiestDays: busiestDaysNamed,
      statusBreakdown: statusBreakdown.results || [],
      busiestHours: busiestHours.results || [],
      monthlyVolume: monthlyVolume.results || [],
      rates: {
        total,
        completed: totalStats?.completed || 0,
        cancelled: totalStats?.cancelled || 0,
        noShow: totalStats?.no_show || 0,
        completionRate,
        cancellationRate,
        noShowRate
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Appointment stats error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load appointment analytics' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
