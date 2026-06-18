// IP-based rate limiting using D1 — tracks attempts per IP per action
// Uses a simple sliding window: max N attempts per window (in seconds)

export async function checkRateLimit(db, { ip, action, maxAttempts = 5, windowSeconds = 60 }) {
  // Count recent attempts within the window. Compare using SQLite datetime arithmetic so the
  // format matches the stored created_at (datetime('now') -> "YYYY-MM-DD HH:MM:SS"). A JS
  // toISOString() value ("...T...Z") sorts wrong vs the stored format and silently disables
  // rate limiting entirely (the bug this replaces).
  const result = await db.prepare(
    `SELECT COUNT(*) as count FROM rate_limits WHERE ip = ? AND action = ? AND created_at > datetime('now', ?)`
  ).bind(ip, action, `-${windowSeconds} seconds`).first();

  if (result.count >= maxAttempts) {
    return { allowed: false, retryAfter: windowSeconds };
  }

  // Log this attempt
  await db.prepare(
    `INSERT INTO rate_limits (ip, action, created_at) VALUES (?, ?, datetime('now'))`
  ).bind(ip, action).run();

  // Cleanup old entries (non-blocking, best effort)
  try {
    await db.prepare(`DELETE FROM rate_limits WHERE created_at < datetime('now', '-1 hour')`).run();
  } catch (e) { /* ignore cleanup errors */ }

  return { allowed: true };
}
