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
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px;"><strong>Security Tip:</strong> Please choose a unique password that is not associated with any other accounts.</p>
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

// Helper: convert date (YYYY-MM-DD) + time (HH:MM) to calendar-friendly formats
function toCalendarDateTime(date, time) {
  const [y, m, d] = date.split('-');
  const [h, min] = (time || '00:00').split(':');
  return `${y}${m}${d}T${h}${min}00`;
}

function buildCalendarLinks(date, startTime, endTime, serviceName, dogName) {
  const title = `K9 Vision: ${serviceName || 'Training'} - ${dogName}`;
  const location = 'Houston, TX';
  const description = `Dog training session for ${dogName} with K9 Vision.`;
  const start = toCalendarDateTime(date, startTime);
  // Default to 1 hour after start if no end time
  const end = endTime ? toCalendarDateTime(date, endTime) : toCalendarDateTime(date, (() => {
    const [h, min] = (startTime || '00:00').split(':');
    return `${String(parseInt(h) + 1).padStart(2, '0')}:${min}`;
  })());

  // Google Calendar
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;

  // Outlook.com
  const [sy, sm, sd] = date.split('-');
  const outlookStart = `${sy}-${sm}-${sd}T${(startTime || '00:00')}:00`;
  const outlookEndTime = endTime || (() => {
    const [h, min] = (startTime || '00:00').split(':');
    return `${String(parseInt(h) + 1).padStart(2, '0')}:${min}`;
  })();
  const outlookEnd = `${sy}-${sm}-${sd}T${outlookEndTime}:00`;
  const outlookUrl = `https://outlook.live.com/calendar/0/action/compose?subject=${encodeURIComponent(title)}&startdt=${encodeURIComponent(outlookStart)}&enddt=${encodeURIComponent(outlookEnd)}&body=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;

  // .ics file (data URI)
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//K9 Vision//Appointment//EN',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  const icsUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;

  return { googleUrl, outlookUrl, icsUrl };
}

// Client notification: appointment confirmed by admin
export function appointmentConfirmedHtml(clientName, dogName, date, time, serviceName, endTime) {
  const cal = buildCalendarLinks(date, time, endTime, serviceName, dogName);

  return emailWrapper(`
    <h2 style="color: #10B981; margin-bottom: 20px;">Appointment Confirmed!</h2>
    <p>Hello ${clientName},</p>
    <p>Great news! Your appointment for <strong>${dogName}</strong> has been confirmed.</p>
    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
      <p style="margin: 5px 0;"><strong>Date:</strong> ${date}</p>
      <p style="margin: 5px 0;"><strong>Time:</strong> ${time}</p>
      <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName || 'General'}</p>
    </div>
    <p style="margin-bottom: 10px; font-weight: bold; color: #374151;">Add to Your Calendar:</p>
    <div style="text-align: center; margin: 0 0 25px 0;">
      <a href="${cal.googleUrl}" target="_blank" style="background: #4285F4; color: white; padding: 10px 16px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 13px; margin: 4px;">
        Google Calendar
      </a>
      <a href="${cal.outlookUrl}" target="_blank" style="background: #0078D4; color: white; padding: 10px 16px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 13px; margin: 4px;">
        Outlook
      </a>
      <a href="${cal.icsUrl}" download="k9vision-appointment.ics" style="background: #6B7280; color: white; padding: 10px 16px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 13px; margin: 4px;">
        Download .ics
      </a>
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

// Client notification: admin booked an appointment, please confirm
export function appointmentPendingConfirmHtml(clientName, dogName, date, time, serviceName, endTime) {
  return emailWrapper(`
    <h2 style="color: #F59E0B; margin-bottom: 20px;">New Appointment Scheduled</h2>
    <p>Hello ${clientName},</p>
    <p>Your trainer has scheduled an appointment for <strong>${dogName}</strong>. Please log in to confirm.</p>
    <div style="background: #fffbeb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F59E0B;">
      <p style="margin: 5px 0;"><strong>Date:</strong> ${date}</p>
      <p style="margin: 5px 0;"><strong>Time:</strong> ${time}${endTime ? ' - ' + endTime : ''}</p>
      <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName || 'General Training'}</p>
      <p style="margin: 5px 0;"><strong>Status:</strong> Pending Your Confirmation</p>
    </div>
    <p>Please log in to your dashboard to <strong>confirm</strong> or <strong>reschedule</strong> this appointment.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${SITE_URL}/client-dashboard.html" style="background: #10B981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Confirm Appointment
      </a>
    </div>
    <p style="margin-top: 20px;">Warmly,<br/>Your Expert Trainer Charles</p>
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
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${Number(item.price).toFixed(2)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${Number(item.total).toFixed(2)}</td>
    </tr>
  `).join('');

  return emailWrapper(`
    <h2 style="color: #3B82F6; margin-bottom: 20px;">Invoice #${invoice.invoice_number}</h2>
    <p>Hello ${invoice.client_name},</p>
    <p>Thank you so much for trusting K9 Vision${invoice.dog_name ? ` with ${invoice.dog_name}'s training journey` : ''}. It's truly a privilege, and I'm grateful for every session we share together.</p>
    <p>Please find the details of your invoice below:</p>

    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Invoice #:</strong> ${invoice.invoice_number}</p>
      <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(invoice.date).toLocaleDateString()}</p>
      ${invoice.due_date ? `<p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>` : ''}
      <p style="margin: 5px 0;"><strong>Trainer:</strong> ${invoice.trainer_name}</p>
    </div>

    <div style="margin-bottom: 15px;">
      <p style="margin: 5px 0;"><strong>Bill To:</strong> ${invoice.client_name}</p>
      ${invoice.dog_name ? `<p style="margin: 5px 0;"><strong>Dog:</strong> ${invoice.dog_name}${invoice.dog_breed ? ` (${invoice.dog_breed})` : ''}</p>` : ''}
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
      <p style="margin: 6px 0; font-size: 15px;"><strong>Subtotal:</strong> $${Number(invoice.subtotal).toFixed(2)}</p>
      <p style="margin: 6px 0; font-size: 15px;"><strong>Tax (${invoice.tax_rate}%):</strong> $${Number(invoice.tax_amount).toFixed(2)}</p>
      <p style="margin: 6px 0; font-size: 20px; color: #3B82F6;"><strong>Total: $${Number(invoice.total).toFixed(2)}</strong></p>
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

// Client notification: trainer added a training note
export function trainerNoteNotificationHtml(clientName, noteTitle, noteContent) {
  const preview = noteContent ? (noteContent.length > 300 ? noteContent.substring(0, 300) + '...' : noteContent) : '';
  return emailWrapper(`
    <h2 style="color: #3B82F6; margin-bottom: 20px;">New Training Note</h2>
    <p>Hello ${clientName},</p>
    <p>Your trainer has added a new note for your dog's training.</p>
    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Subject:</strong> ${noteTitle}</p>
      ${preview ? `<p style="margin: 10px 0 5px 0; color: #4B5563;">${preview}</p>` : ''}
    </div>
    <p>Log in to your dashboard to read the full note and reply.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${SITE_URL}/client-dashboard.html" style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View Note
      </a>
    </div>
    <p style="margin-top: 20px;">Warmly,<br/>Your Expert Trainer Charles</p>
  `);
}

// Client notification: trainer uploaded media
export function mediaUploadClientNotificationHtml(clientName, mediaCount, mediaType, caption) {
  const typeLabel = mediaType === 'video' ? 'video' : 'photo';
  const countText = mediaCount > 1 ? `${mediaCount} new ${typeLabel}s` : `a new ${typeLabel}`;
  return emailWrapper(`
    <h2 style="color: #3B82F6; margin-bottom: 20px;">New Media Added</h2>
    <p>Hello ${clientName},</p>
    <p>Your trainer has uploaded ${countText} to your dog's training gallery.</p>
    ${caption ? `<div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;"><p style="margin: 5px 0;"><strong>Caption:</strong> ${caption}</p></div>` : ''}
    <p>Log in to your dashboard to view the new media.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${SITE_URL}/client-dashboard.html" style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View Gallery
      </a>
    </div>
    <p style="margin-top: 20px;">Warmly,<br/>Your Expert Trainer Charles</p>
  `);
}

// Client notification: trainer added a fun fact
export function funFactAddedHtml(clientName, dogName, factText) {
  return emailWrapper(`
    <h2 style="color: #F59E0B; margin-bottom: 20px;">New Fun Fact About ${dogName || 'Your Dog'}!</h2>
    <p>Hello ${clientName},</p>
    <p>Your trainer has added a fun fact about <strong>${dogName || 'your dog'}</strong>:</p>
    <div style="background: #fffbeb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F59E0B;">
      <p style="margin: 0; font-style: italic; color: #92400E; font-size: 16px;">"${factText}"</p>
    </div>
    <p>Log in to your dashboard to see all fun facts!</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${SITE_URL}/client-dashboard.html" style="background: #F59E0B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View Dashboard
      </a>
    </div>
    <p style="margin-top: 20px;">Warmly,<br/>Your Expert Trainer Charles</p>
  `);
}

// Client notification: invoice item status changed
export function invoiceItemStatusHtml(clientName, invoiceNumber, serviceName, newStatus) {
  const statusColor = newStatus === 'paid' ? '#10B981' : '#F59E0B';
  const statusLabel = newStatus === 'paid' ? 'Paid' : 'Pending';
  return emailWrapper(`
    <h2 style="color: ${statusColor}; margin-bottom: 20px;">Invoice Update</h2>
    <p>Hello ${clientName},</p>
    <p>A service on your invoice <strong>#${invoiceNumber}</strong> has been updated:</p>
    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName}</p>
      <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusLabel}</span></p>
    </div>
    <p>Log in to your dashboard to view your invoice details.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${SITE_URL}/client-dashboard.html" style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View Invoice
      </a>
    </div>
    <p style="margin-top: 20px;">Warmly,<br/>Your Expert Trainer Charles</p>
  `);
}

// Client notification: appointment completed
export function appointmentCompletedHtml(clientName, dogName, date) {
  return emailWrapper(`
    <h2 style="color: #10B981; margin-bottom: 20px;">Training Session Complete!</h2>
    <p>Hello ${clientName},</p>
    <p>Great news! <strong>${dogName}</strong>'s training session on <strong>${date}</strong> has been marked as completed.</p>
    <p>Check your dashboard for any new training notes or media from the session.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${SITE_URL}/client-dashboard.html" style="background: #10B981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View My Dashboard
      </a>
    </div>
    <p style="margin-top: 20px;">Warmly,<br/>Your Expert Trainer Charles</p>
  `);
}

// Appointment cancelled notification
export function appointmentCancelledHtml(clientName, dogName, date, time, cancelledBy) {
  const byText = cancelledBy === 'client' ? 'you' : 'your trainer';
  return emailWrapper(`
    <h2 style="color: #EF4444; margin-bottom: 20px;">Appointment Cancelled</h2>
    <p>Hello ${clientName},</p>
    <p>The following appointment for <strong>${dogName}</strong> has been cancelled by ${byText}:</p>
    <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #EF4444;">
      <p style="margin: 5px 0;"><strong>Date:</strong> ${date}</p>
      <p style="margin: 5px 0;"><strong>Time:</strong> ${time}</p>
      <p style="margin: 5px 0;"><strong>Status:</strong> Cancelled</p>
    </div>
    <p>If you'd like to reschedule, please log in to your dashboard or contact your trainer.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${SITE_URL}/client-dashboard.html" style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Book New Appointment
      </a>
    </div>
    <p style="margin-top: 20px;">Warmly,<br/>Your Expert Trainer Charles</p>
  `);
}

// Appointment rescheduled notification
export function appointmentRescheduledHtml(clientName, dogName, oldDate, oldTime, newDate, newTime, rescheduledBy) {
  const byText = rescheduledBy === 'client' ? 'you' : 'your trainer';
  return emailWrapper(`
    <h2 style="color: #F59E0B; margin-bottom: 20px;">Appointment Rescheduled</h2>
    <p>Hello ${clientName},</p>
    <p>The following appointment for <strong>${dogName}</strong> has been rescheduled by ${byText}:</p>
    <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #EF4444; text-decoration: line-through; color: #9CA3AF;">
      <p style="margin: 5px 0;"><strong>Old Date:</strong> ${oldDate}</p>
      <p style="margin: 5px 0;"><strong>Old Time:</strong> ${oldTime}</p>
    </div>
    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
      <p style="margin: 5px 0;"><strong>New Date:</strong> ${newDate}</p>
      <p style="margin: 5px 0;"><strong>New Time:</strong> ${newTime}</p>
    </div>
    <p>Please log in to your dashboard to view the updated appointment.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${SITE_URL}/client-dashboard.html" style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View My Appointments
      </a>
    </div>
    <p style="margin-top: 20px;">Warmly,<br/>Your Expert Trainer Charles</p>
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
    <p style="font-size: 14px; color: #4b5563;">When setting your new password, please choose one that is unique and not associated with any other accounts.</p>
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px;"><strong>This link expires in 1 hour.</strong> If you didn't request this reset, you can safely ignore this email.</p>
    </div>
  `);
}

// Review request email
// Generic content email for non-client communications
export function genericContentEmailHtml(contentType, title, body) {
  const typeLabels = {
    note: { heading: 'Training Note', color: '#3B82F6', icon: 'A training note has been shared with you:' },
    fun_fact: { heading: 'Fun Fact', color: '#F59E0B', icon: 'A fun fact has been shared with you:' },
    media: { heading: 'Media Shared', color: '#3B82F6', icon: 'New media has been shared with you:' },
    appointment: { heading: 'Appointment Scheduled', color: '#10B981', icon: 'An appointment has been scheduled for you:' },
    message: { heading: 'Message', color: '#3B82F6', icon: 'You have a new message:' }
  };
  const cfg = typeLabels[contentType] || typeLabels.message;
  const bodyHtml = body.replace(/\n/g, '<br>');
  let extra = '';
  if (contentType === 'appointment') {
    extra = `
    <div style="text-align: center; margin: 25px 0;">
      <p style="font-weight: bold; margin-bottom: 15px;">Please respond to this appointment:</p>
      <a href="mailto:trainercg@k9visiontx.com?subject=CONFIRM%20Appointment%20${encodeURIComponent(title)}" style="background: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; margin: 4px;">Confirm</a>
      <a href="mailto:trainercg@k9visiontx.com?subject=RESCHEDULE%20Appointment%20${encodeURIComponent(title)}" style="background: #F59E0B; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; margin: 4px;">Reschedule</a>
      <a href="mailto:trainercg@k9visiontx.com?subject=CANCEL%20Appointment%20${encodeURIComponent(title)}" style="background: #EF4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; margin: 4px;">Cancel</a>
    </div>`;
  }
  return emailWrapper(`
    <h2 style="color: ${cfg.color}; margin-bottom: 20px;">${cfg.heading}</h2>
    <p>${cfg.icon}</p>
    ${title ? `<div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${cfg.color};"><p style="margin: 0 0 5px 0;"><strong>${title}</strong></p><p style="margin: 0; color: #4B5563;">${bodyHtml}</p></div>` : `<div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${cfg.color};"><p style="margin: 0; color: #4B5563;">${bodyHtml}</p></div>`}
    ${extra}
    <p style="margin-top: 20px;">Warmly,<br/>Your Expert Trainer Charles<br/>K9 Vision Dog Training</p>
  `);
}

export function appointmentReminderHtml(clientName, dogName, date, time, serviceName) {
  return emailWrapper(`
    <h2 style="color: #F59E0B; margin-bottom: 20px;">Appointment Reminder</h2>
    <p>Hello ${clientName},</p>
    <p>This is a friendly reminder that you have an appointment scheduled for <strong>${dogName}</strong> tomorrow!</p>
    <div style="background: #fffbeb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F59E0B;">
      <p style="margin: 5px 0;"><strong>Date:</strong> ${date}</p>
      <p style="margin: 5px 0;"><strong>Time:</strong> ${time}</p>
      <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName || 'General Training'}</p>
    </div>
    <p>Please arrive 5 minutes early. If you need to reschedule or cancel, please let us know as soon as possible.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${SITE_URL}/client-dashboard.html" style="background: #F59E0B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View My Appointments
      </a>
    </div>
    <p style="margin-top: 20px;">See you tomorrow!<br/>Your Expert Trainer Charles<br/>K9 Vision Dog Training</p>
  `);
}

export function reviewRequestHtml(clientName, reviewUrl) {
  return emailWrapper(`
    <h2 style="color: #F59E0B; margin-bottom: 20px;">We'd Love Your Feedback!</h2>
    <p>Hello ${clientName},</p>
    <p>Thank you for choosing K9 Vision for your dog training needs! Your experience matters to us, and we'd really appreciate it if you could take a moment to share your feedback.</p>
    <p>Your review helps other dog owners find quality training and helps us continue to improve.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${reviewUrl}" style="background: #F59E0B; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
        Leave a Review
      </a>
    </div>
    <p style="font-size: 14px; color: #6b7280;">This link is valid for 30 days. It only takes a minute!</p>
    <p style="margin-top: 20px;">Warmly,<br/>Your Expert Trainer Charles</p>
  `);
}
