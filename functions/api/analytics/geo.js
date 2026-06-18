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

    const { results: states } = await db.prepare(
      `SELECT region, region_code, country, COUNT(*) as views
       FROM page_views
       WHERE region IS NOT NULL AND region != ''
       GROUP BY region, country
       ORDER BY views DESC
       LIMIT 100`
    ).all();

    const { results: cities } = await db.prepare(
      `SELECT city, region, region_code, postal_code, country, COUNT(*) as views
       FROM page_views
       WHERE city IS NOT NULL AND city != ''
       GROUP BY city, region
       ORDER BY views DESC
       LIMIT 100`
    ).all();

    const { results: countries } = await db.prepare(
      `SELECT country, COUNT(*) as views
       FROM page_views
       WHERE country IS NOT NULL AND country != ''
       GROUP BY country
       ORDER BY views DESC
       LIMIT 50`
    ).all();

    return new Response(JSON.stringify({
      success: true,
      total: totalRow?.count || 0,
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
