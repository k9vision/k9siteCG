// Create client with auto-generated or manual password and email credentials
import { requireAdmin } from '../../utils/auth';
import bcrypt from 'bcryptjs';

// Generate random password
function generatePassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Generate username from client name
function generateUsername(clientName) {
  const base = clientName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const random = Math.floor(Math.random() * 1000);
  return `${base}${random}`;
}

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  // Require admin
  const auth = await requireAdmin(context);
  if (!auth.success) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const {
      client_name,
      email,
      dog_name,
      breed,
      age,
      username,
      password,
      auto_generate_password,
      send_email
    } = await request.json();

    if (!client_name || !email || !dog_name) {
      return new Response(JSON.stringify({
        error: 'Client name, email, and dog name are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate or use provided credentials
    const finalUsername = username || generateUsername(client_name);
    const plainPassword = auto_generate_password ? generatePassword() : password;

    if (!plainPassword) {
      return new Response(JSON.stringify({
        error: 'Password is required (or enable auto-generate)'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if username already exists
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind(finalUsername).first();

    if (existingUser) {
      return new Response(JSON.stringify({
        error: 'Username already exists. Please try a different one.'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // Create user
    const userResult = await env.DB.prepare(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)'
    ).bind(finalUsername, hashedPassword, 'client').run();

    const userId = userResult.meta.last_row_id;

    // Create client profile
    const clientResult = await env.DB.prepare(
      `INSERT INTO clients (user_id, client_name, email, dog_name, dog_breed, dog_age)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(userId, client_name, email, dog_name, breed || null, age || null).run();

    const clientId = clientResult.meta.last_row_id;

    // Send welcome email if requested
    if (send_email && env.RESEND_API_KEY) {
      const emailHTML = generateWelcomeEmail(client_name, dog_name, finalUsername, plainPassword);

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: 'trainercg@k9visiontx.com',
          to: email,
          subject: 'Welcome to K9 Vision - Your Login Credentials',
          html: emailHTML
        })
      });
    }

    return new Response(JSON.stringify({
      success: true,
      client: {
        id: clientId,
        user_id: userId,
        client_name,
        email,
        dog_name,
        breed,
        age
      },
      credentials: {
        username: finalUsername,
        password: plainPassword
      },
      email_sent: send_email
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Create client error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create client',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function generateWelcomeEmail(clientName, dogName, username, password) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to K9 Vision</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #3B82F6; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 32px;">Welcome to K9 Vision!</h1>
        <p style="margin: 10px 0 0 0; font-size: 18px;">Dog Training Services</p>
      </div>

      <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #3B82F6; margin-bottom: 20px;">Hi ${clientName}!</h2>

        <p>We're excited to have you and ${dogName} join the K9 Vision family! Your client portal is now ready.</p>

        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 25px 0;">
          <h3 style="margin-top: 0; color: #1F2937;">Your Login Credentials</h3>
          <p style="margin: 10px 0;"><strong>Username:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${username}</code></p>
          <p style="margin: 10px 0;"><strong>Password:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${password}</code></p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://k9sitecg.pages.dev/portal.html"
             style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Access Your Portal
          </a>
        </div>

        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>⚠️ Important:</strong> Please save these credentials in a secure place. For your security, we recommend changing your password after your first login.</p>
        </div>

        <h3 style="color: #1F2937; margin-top: 30px;">What's Next?</h3>
        <ul style="color: #4b5563;">
          <li>Log in to your portal using the credentials above</li>
          <li>View ${dogName}'s training progress and photos</li>
          <li>Access training notes and updates</li>
          <li>Communicate directly with your trainer</li>
        </ul>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280;">
          <p style="margin: 5px 0;">Questions? Contact us at trainercg@k9visiontx.com</p>
          <p style="margin: 5px 0;">We look forward to working with you and ${dogName}!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
