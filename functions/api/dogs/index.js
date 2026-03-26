// Dogs API - List and create dogs for a client
import { requireAuth } from '../../utils/auth.js';
import { createNotification } from '../../utils/notify.js';
import { sendEmail, newDogNotificationHtml } from '../../utils/emails.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(context.request.url);
    const clientId = url.searchParams.get('client_id');

    if (!clientId) {
      return new Response(JSON.stringify({ error: 'client_id is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Clients can only view their own dogs unless admin
    if (auth.user.role !== 'admin') {
      const client = await context.env.DB.prepare(
        'SELECT id FROM clients WHERE user_id = ? AND id = ?'
      ).bind(auth.user.id, clientId).first();
      if (!client) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403, headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const { results } = await context.env.DB.prepare(
      'SELECT * FROM dogs WHERE client_id = ? ORDER BY is_primary DESC, created_at ASC'
    ).bind(clientId).all();

    return new Response(JSON.stringify({ success: true, dogs: results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('List dogs error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch dogs' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  try {
    const auth = await requireAuth(context);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { 'Content-Type': 'application/json' }
      });
    }

    const { client_id, dog_name, breed, age, photo_url } = await context.request.json();

    if (!client_id || !dog_name) {
      return new Response(JSON.stringify({ error: 'client_id and dog_name are required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Clients can only add dogs to their own profile
    let client;
    if (auth.user.role !== 'admin') {
      client = await context.env.DB.prepare(
        'SELECT id, client_name FROM clients WHERE user_id = ? AND id = ?'
      ).bind(auth.user.id, client_id).first();
      if (!client) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403, headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      client = await context.env.DB.prepare(
        'SELECT id, client_name FROM clients WHERE id = ?'
      ).bind(client_id).first();
    }

    // Check if this is the first dog (make it primary)
    const existingCount = await context.env.DB.prepare(
      'SELECT COUNT(*) as count FROM dogs WHERE client_id = ?'
    ).bind(client_id).first();
    const isPrimary = existingCount.count === 0 ? 1 : 0;

    const result = await context.env.DB.prepare(
      'INSERT INTO dogs (client_id, dog_name, breed, age, photo_url, is_primary) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
    ).bind(client_id, dog_name, breed || null, age || null, photo_url || null, isPrimary).first();

    // If a client added the dog, notify admin + send email
    if (auth.user.role !== 'admin') {
      const clientName = client.client_name || 'A client';

      await createNotification(context.env.DB, {
        type: 'new_dog',
        title: 'New Dog Added',
        message: `${clientName} added a new dog: ${dog_name}${breed ? ' (' + breed + ')' : ''}`,
        client_id: client_id,
        reference_id: result.id,
        reference_type: 'dog'
      });

      // Send email to admin
      if (context.env.RESEND_API_KEY) {
        try {
          const adminEmail = context.env.ADMIN_NOTIFY_EMAIL || 'k9vision@yahoo.com';
          await sendEmail(context.env, {
            to: adminEmail,
            subject: `New Dog Added - ${dog_name} (${clientName})`,
            html: newDogNotificationHtml(clientName, dog_name, breed, age)
          });
        } catch (emailErr) {
          console.error('Failed to send new dog email:', emailErr);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, dog: result }), {
      status: 201, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Create dog error:', error);
    return new Response(JSON.stringify({ error: 'Failed to add dog' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
