// Fun facts management (admin only)
import { requireAdmin } from '../../utils/auth.js';

// Create a new fun fact
export async function onRequestPost(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { client_id, fact } = await context.request.json();

    if (!client_id || !fact) {
      return new Response(
        JSON.stringify({ error: 'Client ID and fact are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await context.env.DB.prepare(`
      INSERT INTO fun_facts (client_id, fact)
      VALUES (?, ?)
      RETURNING *
    `).bind(client_id, fact).first();

    return new Response(
      JSON.stringify({ success: true, fact: result }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create fun fact error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create fun fact' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
