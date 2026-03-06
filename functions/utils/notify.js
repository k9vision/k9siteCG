// Notification helper for creating admin notifications

export async function createNotification(db, { type, title, message, client_id, reference_id, reference_type }) {
  return db.prepare(`
    INSERT INTO notifications (type, title, message, client_id, reference_id, reference_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(type, title, message, client_id || null, reference_id || null, reference_type || null).run();
}
