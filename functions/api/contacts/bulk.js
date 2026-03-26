// Bulk contact import — batch create contacts from CSV
import { requireAdmin } from '../../utils/auth.js';

export async function onRequestPost(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    }

    const { contacts } = await context.request.json();
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return new Response(JSON.stringify({ error: 'contacts array is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (contacts.length > 500) {
      return new Response(JSON.stringify({ error: 'Maximum 500 contacts per import' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const errors = [];
    const valid = [];

    contacts.forEach((c, i) => {
      if (!c.name || !c.name.trim()) {
        errors.push({ row: i + 1, error: 'Name is required' });
      } else {
        valid.push({
          name: c.name.trim(),
          email: (c.email || '').trim() || null,
          phone: (c.phone || '').trim() || null,
          dog_name: (c.dog_name || '').trim() || null,
          source: (c.source || 'csv_import').trim(),
          notes: (c.notes || '').trim() || null
        });
      }
    });

    if (valid.length === 0) {
      return new Response(JSON.stringify({ success: false, imported: 0, errors }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Batch insert using D1 batch API
    const statements = valid.map(c =>
      context.env.DB.prepare(
        'INSERT INTO contacts (name, email, phone, dog_name, source, notes) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(c.name, c.email, c.phone, c.dog_name, c.source, c.notes)
    );
    await context.env.DB.batch(statements);

    return new Response(JSON.stringify({
      success: true,
      imported: valid.length,
      errors
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Bulk contact import error:', error);
    return new Response(JSON.stringify({ error: 'Failed to import contacts' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
