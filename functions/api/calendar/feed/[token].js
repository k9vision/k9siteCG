// GET /api/calendar/feed/:token - Public iCal feed endpoint (token-based auth)
import { generateIcalFeed } from '../../../utils/ical.js';

export async function onRequestGet(context) {
  const feedToken = context.params.token;

  if (!feedToken) {
    return new Response('Not found', { status: 404 });
  }

  const db = context.env.DB;

  // Look up token and get user role
  const record = await db.prepare(`
    SELECT ift.*, u.role
    FROM ical_feed_tokens ift
    JOIN users u ON ift.user_id = u.id
    WHERE ift.feed_token = ?
  `).bind(feedToken).first();

  if (!record) {
    return new Response('Not found', { status: 404 });
  }

  const ical = await generateIcalFeed(db, record.user_id, record.role);

  return new Response(ical, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="k9vision-calendar.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
