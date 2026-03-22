// Create a note for a client (admin or client)
import { requireAuth } from '../../utils/auth.js';
import { createNotification } from '../../utils/notify.js';
import { sendEmail, clientNoteNotificationHtml } from '../../utils/emails.js';

export async function onRequestPost(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { client_id, content, title, media_id, media_ids } = await context.request.json();

    if (!client_id || !content) {
      return new Response(
        JSON.stringify({ error: 'Client ID and content are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // If client role, verify they can only create notes for their own record
    if (auth.user.role === 'client') {
      const client = await context.env.DB.prepare(
        'SELECT id FROM clients WHERE user_id = ?'
      ).bind(auth.user.id).first();

      if (!client || client.id !== parseInt(client_id)) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const author_role = auth.user.role === 'admin' ? 'admin' : 'client';

    const note = await context.env.DB.prepare(`
      INSERT INTO notes (client_id, content, title, author_role, media_id, media_ids)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      parseInt(client_id), content, title || 'Note', author_role,
      media_id ? parseInt(media_id) : null,
      media_ids && media_ids.length > 0 ? JSON.stringify(media_ids) : null
    ).first();

    // Notify admin when a client sends a note
    if (author_role === 'client') {
      try {
        const clientInfo = await context.env.DB.prepare(
          'SELECT client_name, dog_name FROM clients WHERE id = ?'
        ).bind(parseInt(client_id)).first();

        const clientName = clientInfo?.client_name || 'A client';
        const dogName = clientInfo?.dog_name || '';
        const noteTitle = title || 'Note';
        const truncatedContent = content.length > 200 ? content.substring(0, 200) + '...' : content;

        await createNotification(context.env.DB, {
          type: 'client_note',
          title: `New Message from ${clientName}`,
          message: truncatedContent,
          client_id: parseInt(client_id),
          reference_id: note.id,
          reference_type: 'note'
        });

        await sendEmail(context.env, {
          to: 'trainercg@k9visiontx.com',
          subject: `New Message from ${clientName}`,
          html: clientNoteNotificationHtml(clientName, dogName, noteTitle, truncatedContent)
        });
      } catch (notifyErr) {
        console.error('Notification/email error (note still saved):', notifyErr);
      }
    }

    // Notify client when admin adds a training note
    if (author_role === 'admin') {
      try {
        const clientInfo = await context.env.DB.prepare(
          'SELECT c.client_name, c.email, u.username FROM clients c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?'
        ).bind(parseInt(client_id)).first();

        const clientEmail = clientInfo?.email || clientInfo?.username;
        if (clientEmail && clientEmail.includes('@')) {
          const { trainerNoteNotificationHtml } = await import('../../utils/emails.js');
          await sendEmail(context.env, {
            to: clientEmail,
            subject: `New Training Note: ${title || 'Note'}`,
            html: trainerNoteNotificationHtml(clientInfo?.client_name || 'Valued Client', title || 'Note')
          });
        }
      } catch (notifyErr) {
        console.error('Failed to send trainer note notification:', notifyErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, note }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create note error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create note' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
