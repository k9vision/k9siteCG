// Public contact form endpoint — sends consultation requests via Resend
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { name, phone, email, dogName, message } = await request.json();

    if (!name || !name.trim()) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!phone?.trim() && !email?.trim()) {
      return new Response(JSON.stringify({
        error: 'Please provide either a phone number or email address'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const htmlBody = generateContactEmail({
      name: name.trim(),
      phone: phone?.trim() || 'Not provided',
      email: email?.trim() || 'Not provided',
      dogName: dogName?.trim() || 'Not provided',
      message: message?.trim() || 'No message provided'
    });

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'trainercg@k9visiontx.com',
        to: 'k9vision@yahoo.com',
        subject: `New Consultation Request from ${name.trim()}`,
        html: htmlBody
      })
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      throw new Error(`Resend API error: ${error}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Contact form error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to send message. Please try again or call us directly.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function generateContactEmail({ name, phone, email, dogName, message }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Consultation Request</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #3B82F6; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <img src="https://k9visiontx.com/k9visionlogo.jpeg" alt="K9 Vision Logo" style="max-width: 120px; height: auto; display: block; margin: 0 auto 15px auto; border-radius: 8px;" />
        <h1 style="margin: 0; font-size: 28px;">New Consultation Request</h1>
      </div>

      <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 140px; color: #1F2937;">Name</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #1F2937;">Phone</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${phone}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #1F2937;">Email</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #1F2937;">Dog's Name & Breed</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${dogName}</td>
          </tr>
        </table>

        <div style="margin-top: 24px; padding: 20px; background: #f9fafb; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0; color: #1F2937;">Message</h3>
          <p style="margin: 0; white-space: pre-wrap;">${message}</p>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 13px;">
          <p style="margin: 0;">Sent from the K9 Vision website contact form</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
