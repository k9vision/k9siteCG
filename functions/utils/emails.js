// Centralized email sending and HTML templates

const SITE_URL = 'https://k9visiontx.com';
const FROM_EMAIL = 'trainercg@k9visiontx.com';

// Send an email via Resend API
export async function sendEmail(env, { to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html })
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
