// Admin-only visitor geography report — aggregates page_views by state and city.
// Guarded by requireAdmin (same pattern as /api/stats).
import { requireAdmin } from '../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = context.env.DB;

    const totalRow = await db.prepare('SELECT COUNT(*) as count FROM page_views').first();

    // Where each view came from. 'proxied' is a REAL person (e.g. arriving via
    // Facebook's in-app browser) whose IP resolves to the provider's data center,
    // so the visit counts but the location is unusable — it is excluded from the
    // maps below rather than dropped. 'internal' is our own sessions.
    const { results: breakdownRows } = await db.prepare(
      `SELECT COALESCE(traffic_type, 'visitor') as traffic_type, COUNT(*) as views
       FROM page_views
       GROUP BY COALESCE(traffic_type, 'visitor')`
    ).all();

    const breakdown = { visitor: 0, internal: 0, bot: 0, proxied: 0 };
    for (const row of breakdownRows || []) {
      if (row.traffic_type in breakdown) breakdown[row.traffic_type] = row.views;
    }

    // Only mappable, genuinely external traffic feeds the geography tables.
    const MAPPABLE = `COALESCE(traffic_type, 'visitor') = 'visitor'`;

    const { results: states } = await db.prepare(
      `SELECT region, region_code, country, COUNT(*) as views
       FROM page_views
       WHERE ${MAPPABLE} AND region IS NOT NULL AND region != ''
       GROUP BY region, country
       ORDER BY views DESC
       LIMIT 100`
    ).all();

    const { results: cities } = await db.prepare(
      `SELECT city, region, region_code, postal_code, country, COUNT(*) as views
       FROM page_views
       WHERE ${MAPPABLE} AND city IS NOT NULL AND city != ''
       GROUP BY city, region
       ORDER BY views DESC
       LIMIT 100`
    ).all();

    const { results: countries } = await db.prepare(
      `SELECT country, COUNT(*) as views
       FROM page_views
       WHERE ${MAPPABLE} AND country IS NOT NULL AND country != ''
       GROUP BY country
       ORDER BY views DESC
       LIMIT 50`
    ).all();

    return new Response(JSON.stringify({
      success: true,
      total: totalRow?.count || 0,
      // Real audience = external people, whether or not we can place them on a map.
      audience: breakdown.visitor + breakdown.proxied,
      mapped: breakdown.visitor,
      excluded: {
        internal: breakdown.internal,
        bot: breakdown.bot,
        proxied: breakdown.proxied
      },
      states: states || [],
      cities: cities || [],
      countries: countries || []
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Geo analytics API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load visitor geography' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
