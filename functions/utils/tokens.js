// Token utilities for invite, verification, and password reset flows

// Token expiry durations in seconds
const TOKEN_EXPIRY = {
  invite: 7 * 24 * 60 * 60,           // 7 days
  email_verification: 24 * 60 * 60,    // 24 hours
  password_reset: 60 * 60,             // 1 hour
};

// Generate a cryptographically secure token (48 bytes, base64url encoded)
export function generateSecureToken() {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  // base64url encode
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Create a new token in the database
export async function createToken(db, { type, userId, clientId, email }) {
  const token = generateSecureToken();
  const expirySecs = TOKEN_EXPIRY[type];
  if (!expirySecs) throw new Error(`Unknown token type: ${type}`);

  await db.prepare(`
    INSERT INTO account_tokens (token, type, user_id, client_id, email, expires_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '+' || ? || ' seconds'))
  `).bind(token, type, userId || null, clientId || null, email || null, expirySecs).run();

  return token;
}

// Validate a token: checks existence, type match, not used, not expired
export async function validateToken(db, tokenString, expectedType) {
  const row = await db.prepare(`
    SELECT at.*, c.client_name, c.dog_name, c.email as client_email
    FROM account_tokens at
    LEFT JOIN clients c ON at.client_id = c.id
    WHERE at.token = ? AND at.type = ? AND at.used_at IS NULL AND at.expires_at > datetime('now')
  `).bind(tokenString, expectedType).first();

  return row || null;
}

// Consume a token (mark as used, single-use)
export async function consumeToken(db, tokenString) {
  await db.prepare(`
    UPDATE account_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = ?
  `).bind(tokenString).run();
}

// Invalidate all unused tokens of a type for a user/email
export async function invalidateTokens(db, { type, userId, email }) {
  if (userId) {
    await db.prepare(`
      UPDATE account_tokens SET used_at = CURRENT_TIMESTAMP
      WHERE type = ? AND user_id = ? AND used_at IS NULL
    `).bind(type, userId).run();
  }
  if (email) {
    await db.prepare(`
      UPDATE account_tokens SET used_at = CURRENT_TIMESTAMP
      WHERE type = ? AND email = ? AND used_at IS NULL
    `).bind(type, email).run();
  }
}
