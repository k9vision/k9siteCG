// Get all clients (admin only)
import { requireAdmin } from '../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get all clients with user info
    const clients = await context.env.DB.prepare(`
      SELECT
        c.*,
        u.username
      FROM clients c
      JOIN users u ON c.user_id = u.id
      WHERE u.role = 'client'
      ORDER BY c.created_at DESC
    `).all();

    return new Response(
      JSON.stringify({ success: true, clients: clients.results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get clients error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch clients' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Create or update client (admin only)
export async function onRequestPost(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { userId, dogName, dogBreed, dogAge, dogImage, clientName, notes } = await context.request.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if client exists
    const existing = await context.env.DB.prepare(
      'SELECT id FROM clients WHERE user_id = ?'
    ).bind(userId).first();

    let result;
    if (existing) {
      // Update existing client
      result = await context.env.DB.prepare(`
        UPDATE clients
        SET dog_name = ?, dog_breed = ?, dog_age = ?, dog_image = ?, client_name = ?, notes = ?
        WHERE user_id = ?
        RETURNING *
      `).bind(dogName, dogBreed, dogAge, dogImage, clientName, notes, userId).first();
    } else {
      // Create new client
      result = await context.env.DB.prepare(`
        INSERT INTO clients (user_id, dog_name, dog_breed, dog_age, dog_image, client_name, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `).bind(userId, dogName, dogBreed, dogAge, dogImage, clientName, notes).first();
    }

    return new Response(
      JSON.stringify({ success: true, client: result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create/update client error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to save client' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
