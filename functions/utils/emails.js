// Centralized email sending and HTML templates

const SITE_URL = 'https://k9visiontx.com';
const FROM_EMAIL = 'K9 Vision <trainercg@k9visiontx.com>';

// Send an email via Resend API
// attachments: optional array of { filename, content (base64 string) }
export async function sendEmail(env, { to, subject, html, attachments }) {
  if (!to || !to.includes('@')) {
    throw new Error('Invalid or missing recipient email address');
  }

  const payload = { from: FROM_EMAIL, to, subject, html };
  if (attachments && attachments.length > 0) {
    payload.attachments = attachments;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Email send failed: ${error}`);
  }

  return res.json();
}

// Shared email wrapper (header + footer)
function emailWrapper(content) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #3B82F6; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <img src="https://k9visiontx.com/k9visionlogo.jpeg" alt="K9 Vision Logo" style="max-width: 120px; height: auto; display: block; margin: 0 auto 15px auto; border-radius: 8px;" />
    <h1 style="margin: 0; font-size: 32px;">K9 Vision</h1>
    <p style="margin: 10px 0 0 0; font-size: 18px;">Dog Training Services</p>
  </div>
  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    ${content}
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280;">
      <img src="https://k9visiontx.com/k9visionlogo.jpeg" alt="K9 Vision" style="max-width: 80px; height: auto; display: block; margin: 0 auto 10px auto; border-radius: 6px; opacity: 0.85;" />
      <p style="margin: 5px 0;">Questions? Contact us at trainercg@k9visiontx.com</p>
    </div>
  </div>
</body>
</html>`;
}

// Invite email: admin invites client to set up their account
export function inviteEmailHtml(clientName, dogName, setupUrl) {
  return emailWrapper(`
    <h2 style="color: #3B82F6; margin-bottom: 20px;">You're Invited!</h2>
    <p>Hello ${clientName},</p>
    <p>Welcome to the K9VISIONTX family! I'm so glad you're here.</p>
    <p>As your Expert Trainer, I'm dedicated to helping you and ${dogName} reach your goals. To get started, could you please take a quick moment to set up your account?</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${setupUrl}" style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Click here to set up your account
      </a>
    </div>
    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">This invite link expires in 7 days. If it has expired, please contact your trainer to send a new one.</p>
    </div>
    <p>Thank you again for joining us. I can't wait to get started!</p>
    <p style="margin-top: 20px;">Warmly,<br/>Your Expert Trainer Charles</p>
  `);
}

// Verification email: client self-registered, needs to verify email
export function verificationEmailHtml(clientName, verifyUrl) {
  return emailWrapper(`
    <h2 style="color: #3B82F6; margin-bottom: 20px;">Verify Your Email</h2>
    <p>Hello ${clientName},</p>
    <p>Welcome to the K9VISIONTX family! I'm so glad you're here.</p>
    <p>As your Expert Trainer, I'm dedicated to helping you reach your goals. To make sure we have a clear line of communication, could you please take a quick moment to verify your email address?</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyUrl}" style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Click here to verify your email
      </a>
    </div>
    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
    </div>
    <p>Thank you again for joining us. I can't wait to get started!</p>
    <p style="margin-top: 20px;">Warmly,<br/>Your Expert Trainer Charles</p>
  `);
}

// Admin notification: client uploaded media
export function mediaUploadNotificationHtml(clientName, dogName, mediaType) {
  return emailWrapper(`
    <h2 style="color: #3B82F6; margin-bottom: 20px;">New ${mediaType === 'video' ? 'Video' : 'Photo'} Upload</h2>
    <p>${clientName} just uploaded a new ${mediaType} for <strong>${dogName}</strong>.</p>
    <p>Log in to your admin dashboard to view the upload.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${SITE_URL}/admin-dashboard.html" style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View in Dashboard
      </a>
    </div>
  `);
}

// Client notification: appointment confirmed by admin
export function appointmentConfirmedHtml(clientName, dogName, date, time, serviceName) {
  return emailWrapper(`
    <h2 style="color: #10B981; margin-bottom: 20px;">Appointment Confirmed!</h2>
    <p>Hello ${clientName},</p>
    <p>Great news! Your appointment for <strong>${dogName}</strong> has been confirmed.</p>
    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
      <p style="margin: 5px 0;"><strong>Date:</strong> ${date}</p>
      <p style="margin: 5px 0;"><strong>Time:</strong> ${time}</p>
      <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName || 'General'}</p>
    </div>
    <p>We look forward to seeing you and ${dogName}! If you need to make any changes, please log in to your dashboard or contact us.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${SITE_URL}/client-dashboard.html" style="background: #10B981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View My Appointments
      </a>
    </div>
    <p style="margin-top: 20px;">Warmly,<br/>Your Expert Trainer Charles</p>
  `);
}

// Admin notification: client booked an appointment
export function appointmentBookedNotificationHtml(clientName, dogName, date, time, serviceName) {
  return emailWrapper(`
    <h2 style="color: #3B82F6; margin-bottom: 20px;">New Appointment Booking</h2>
    <p><strong>${clientName}</strong> has booked an appointment for <strong>${dogName}</strong>.</p>
    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Date:</strong> ${date}</p>
      <p style="margin: 5px 0;"><strong>Time:</strong> ${time}</p>
      <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName || 'General'}</p>
    </div>
    <p>Please confirm or manage this appointment from your dashboard.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${SITE_URL}/admin-dashboard.html" style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View in Dashboard
      </a>
    </div>
  `);
}

// Admin notification: client added a new dog
export function newDogNotificationHtml(clientName, dogName, breed, age) {
  return emailWrapper(`
    <h2 style="color: #3B82F6; margin-bottom: 20px;">New Dog Added</h2>
    <p><strong>${clientName}</strong> has added a new dog to their profile.</p>
    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Dog Name:</strong> ${dogName}</p>
      ${breed ? `<p style="margin: 5px 0;"><strong>Breed:</strong> ${breed}</p>` : ''}
      ${age ? `<p style="margin: 5px 0;"><strong>Age:</strong> ${age} years</p>` : ''}
    </div>
    <p>Log in to your admin dashboard to view the updated client profile.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${SITE_URL}/admin-dashboard.html" style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View in Dashboard
      </a>
    </div>
  `);
}

// Invoice email: professional invoice sent to client
export function invoiceEmailHtml(invoice, items) {
  const itemsHTML = items.map(item => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${item.service_name}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.price.toFixed(2)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.total.toFixed(2)}</td>
    </tr>
  `).join('');

  return emailWrapper(`
    <h2 style="color: #3B82F6; margin-bottom: 20px;">Invoice #${invoice.invoice_number}</h2>
    <p>Hello ${invoice.client_name},</p>
    <p>Thank you so much for trusting me with ${invoice.dog_name}'s training journey. It's truly a privilege to work with you both, and I'm grateful for every session we share together.</p>
    <p>Please find the details of your invoice below:</p>

    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Invoice #:</strong> ${invoice.invoice_number}</p>
      <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(invoice.date).toLocaleDateString()}</p>
      ${invoice.due_date ? `<p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>` : ''}
      <p style="margin: 5px 0;"><strong>Trainer:</strong> ${invoice.trainer_name}</p>
    </div>

    <div style="margin-bottom: 15px;">
      <p style="margin: 5px 0;"><strong>Bill To:</strong> ${invoice.client_name}</p>
      <p style="margin: 5px 0;"><strong>Dog:</strong> ${invoice.dog_name}${invoice.dog_breed ? ` (${invoice.dog_breed})` : ''}</p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 10px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Service</th>
          <th style="padding: 10px 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
          <th style="padding: 10px 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Price</th>
          <th style="padding: 10px 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <div style="text-align: right; margin-bottom: 20px;">
      <p style="margin: 6px 0; font-size: 15px;"><strong>Subtotal:</strong> $${invoice.subtotal.toFixed(2)}</p>
      <p style="margin: 6px 0; font-size: 15px;"><strong>Tax (${invoice.tax_rate}%):</strong> $${invoice.tax_amount.toFixed(2)}</p>
      <p style="margin: 6px 0; font-size: 20px; color: #3B82F6;"><strong>Total: $${invoice.total.toFixed(2)}</strong></p>
    </div>

    ${invoice.notes ? `
      <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <p style="margin: 0;"><strong>Notes:</strong></p>
        <p style="margin: 8px 0 0 0;">${invoice.notes}</p>
      </div>
    ` : ''}

    <div style="background: #eff6ff; border-left: 4px solid #3B82F6; padding: 12px 15px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 14px;">A PDF copy of this invoice is attached for your records.</p>
    </div>

    <p>Thank you again for being part of the K9 Vision family. I truly appreciate you!</p>
    <p style="margin-top: 20px;">Warmly,<br/>Your Expert Trainer Charles</p>
  `);
}

// Admin notification: client sent a note/message
export function clientNoteNotificationHtml(clientName, dogName, noteTitle, noteContent) {
  return emailWrapper(`
    <h2 style="color: #3B82F6; margin-bottom: 20px;">New Client Message</h2>
    <p><strong>${clientName}</strong>${dogName ? ` (${dogName}'s owner)` : ''} sent you a message.</p>
    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Subject:</strong> ${noteTitle}</p>
      <p style="margin: 0; white-space: pre-wrap;">${noteContent}</p>
    </div>
    <p>Log in to your admin dashboard to view and reply.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${SITE_URL}/admin-dashboard.html" style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View in Dashboard
      </a>
    </div>
  `);
}

// Admin notification: new availability slot set
export function availabilitySetNotificationHtml(dayName, startTime, endTime, specificDate) {
  const when = specificDate
    ? `<p style="margin: 5px 0;"><strong>Date:</strong> ${specificDate}</p>`
    : `<p style="margin: 5px 0;"><strong>Day:</strong> ${dayName}</p>`;

  return emailWrapper(`
    <h2 style="color: #3B82F6; margin-bottom: 20px;">New Availability Set</h2>
    <p>A new availability slot has been added to your schedule.</p>
    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
      ${when}
      <p style="margin: 5px 0;"><strong>Start:</strong> ${startTime}</p>
      <p style="margin: 5px 0;"><strong>End:</strong> ${endTime}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${SITE_URL}/admin-dashboard.html" style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View in Dashboard
      </a>
    </div>
  `);
}

// Admin notification: date blocked
export function blockedDateNotificationHtml(blockedDate, reason, allDay, startTime, endTime) {
  const timeInfo = allDay || (!startTime && !endTime)
    ? '<p style="margin: 5px 0;"><strong>Duration:</strong> All Day</p>'
    : `<p style="margin: 5px 0;"><strong>Time:</strong> ${startTime} - ${endTime}</p>`;

  return emailWrapper(`
    <h2 style="color: #EF4444; margin-bottom: 20px;">Date Blocked</h2>
    <p>A date has been blocked on your schedule.</p>
    <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Date:</strong> ${blockedDate}</p>
      ${reason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
      ${timeInfo}
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${SITE_URL}/admin-dashboard.html" style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View in Dashboard
      </a>
    </div>
  `);
}

// Password reset email
export function resetEmailHtml(resetUrl, adminTriggered = false) {
  const intro = adminTriggered
    ? 'Your trainer has initiated a password reset for your K9 Vision account.'
    : 'We received a request to reset your K9 Vision password.';

  return emailWrapper(`
    <h2 style="color: #3B82F6; margin-bottom: 20px;">Reset Your Password</h2>
    <p>${intro}</p>
    <p>Click the button below to set a new password.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Reset Password
      </a>
    </div>
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px;"><strong>This link expires in 1 hour.</strong> If you didn't request this reset, you can safely ignore this email.</p>
    </div>
  `);
}
