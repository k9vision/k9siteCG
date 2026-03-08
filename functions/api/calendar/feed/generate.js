// POST /api/calendar/feed/generate - Generate or retrieve iCal feed token
import { requireAuth } from '../../../utils/auth.js';
import { generateSecureToken } from '../../../utils/tokens.js';

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = context.env.DB;
  const userId = auth.user.id;

  // Check for existing feed token
  const existing = await db.prepare(
    'SELECT * FROM ical_feed_tokens WHERE user_id = ?'
  ).bind(userId).first();

  if (existing) {
    return new Response(JSON.stringify({
      success: true,
      feed_url: `https://k9visiontx.com/api/calendar/feed/${existing.feed_token}`,
      token: existing.feed_token,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Generate new token and insert
  const token = generateSecureToken();
  await db.prepare(
    'INSERT INTO ical_feed_tokens (user_id, feed_token) VALUES (?, ?)'
  ).bind(userId, token).run();

  return new Response(JSON.stringify({
    success: true,
    feed_url: `https://k9visiontx.com/api/calendar/feed/${token}`,
    token,
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}
