// Get fun facts for a specific client
import { requireAuth } from '../../../utils/auth.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const clientId = context.params.clientId;

    // Get all fun facts for this client
    const facts = await context.env.DB.prepare(`
      SELECT * FROM fun_facts
      WHERE client_id = ?
      ORDER BY created_at DESC
    `).bind(clientId).all();

    return new Response(
      JSON.stringify({ success: true, facts: facts.results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get fun facts error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch fun facts' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
