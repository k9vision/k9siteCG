import { requireAuth } from '../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    if (auth.user.role !== 'admin') return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });

    const url = new URL(context.request.url);
    const search = url.searchParams.get('search');
    const source = url.searchParams.get('source');

    let query = 'SELECT * FROM contacts';
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ? OR dog_name LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (source) {
      conditions.push('source = ?');
      params.push(source);
    }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';

    const { results } = await context.env.DB.prepare(query).bind(...params).all();
    return new Response(JSON.stringify({ success: true, contacts: results }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('List contacts error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load contacts' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestPost(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { 'Content-Type': 'application/json' } });
    if (auth.user.role !== 'admin') return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });

    const { name, email, phone, dog_name, source, notes } = await context.request.json();
    if (!name) return new Response(JSON.stringify({ error: 'Name is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const contact = await context.env.DB.prepare(
      `INSERT INTO contacts (name, email, phone, dog_name, source, notes) VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
    ).bind(name, email || null, phone || null, dog_name || null, source || 'manual', notes || null).first();

    return new Response(JSON.stringify({ success: true, contact }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Create contact error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create contact' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
