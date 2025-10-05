// Delete a fun fact (admin only)
import { requireAdmin } from '../../utils/auth.js';

export async function onRequestDelete(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const factId = context.params.id;

    await context.env.DB.prepare(`
      DELETE FROM fun_facts WHERE id = ?
    `).bind(factId).run();

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete fun fact error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete fun fact' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
