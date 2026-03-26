// IP-based rate limiting using D1 — tracks attempts per IP per action
// Uses a simple sliding window: max N attempts per window (in seconds)

export async function checkRateLimit(db, { ip, action, maxAttempts = 5, windowSeconds = 60 }) {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  // Count recent attempts
  const result = await db.prepare(
    `SELECT COUNT(*) as count FROM rate_limits WHERE ip = ? AND action = ? AND created_at > ?`
  ).bind(ip, action, windowStart).first();

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
