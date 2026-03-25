// Delete client by user ID (admin only)
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

    const userId = parseInt(context.params.userId);

    // Soft-delete user and their client record
    await context.env.DB.prepare(
      'UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(userId).run();
    await context.env.DB.prepare(
      'UPDATE clients SET deleted_at = CURRENT_TIMESTAMP WHERE user_id = ?'
    ).bind(userId).run();

    return new Response(
      JSON.stringify({ success: true, message: 'Client deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete client error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete client' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
