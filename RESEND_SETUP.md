# Resend Email Service Setup Guide

This guide will help you configure Resend for sending client credentials and invoices.

## Step 1: Create Resend Account

1. Go to https://resend.com/
2. Sign up for a free account (100 emails/day free)
3. Verify your email address

## Step 2: Get API Key

1. Go to https://resend.com/api-keys
2. Click "Create API Key"
3. Name it "K9 Vision Production"
4. Select "Sending access"
5. Copy the API key (starts with `re_`)

## Step 3: Add Domain (Optional but Recommended)

For production, you should verify your domain:

1. Go to https://resend.com/domains
2. Click "Add Domain"
3. Enter your domain: `k9visiontx.com`
4. Follow DNS configuration instructions
5. Wait for verification

**Note:** Until domain is verified, you can only send TO your verified email address. After verification, you can send to any email.

## Step 4: Configure Cloudflare Environment Variable

### Option A: Via Wrangler CLI (Recommended)

```bash
# Set the Resend API key
echo "YOUR_RESEND_API_KEY" | wrangler pages secret put RESEND_API_KEY --project-name=k9sitecg
```

### Option B: Via Cloudflare Dashboard

1. Go to https://dash.cloudflare.com
2. Select "Workers & Pages"
3. Click on "k9sitecg"
4. Go to "Settings" → "Environment variables"
5. Click "Add variable"
   - Name: `RESEND_API_KEY`
   - Value: `re_your_actual_key_here`
6. Click "Save"

## Step 5: Update wrangler.toml (Optional)

You can add it to `wrangler.toml` for local development only:

```toml
[vars]
# Existing vars...
RESEND_API_KEY = "re_your_key_for_local_testing"
```

**⚠️ Important:** Don't commit real API keys to git! Use Cloudflare secrets for production.

## Step 6: Test Email Sending

After deployment, test the email functionality:

### Test 1: Create Client with Email

1. Log in to admin dashboard
2. Click "Create Client"
3. Fill in client details
4. Check "Email credentials to client"
5. Use YOUR email address for testing
6. Submit
7. Check your inbox for welcome email

### Test 2: Send Invoice

1. Create an invoice
2. Click "Email" button
3. Invoice should be sent to client's email

## Troubleshooting

### "Domain not verified" Error

- If you get this error, you can only send TO your verified Resend account email
- Either verify your domain (Step 3) or use your Resend account email for testing

### Emails Not Arriving

1. Check spam/junk folder
2. Verify RESEND_API_KEY is set correctly
3. Check Cloudflare Pages logs
4. Verify domain is configured correctly in Resend

### Error: "Invalid API Key"

- Make sure the API key starts with `re_`
- Regenerate the key if needed
- Update the secret in Cloudflare

## Current Configuration

**From Email:** trainercg@k9visiontx.com

**Email Types:**
1. **Welcome Email** - Sent when creating new clients
   - Contains username and password
   - Link to client portal

2. **Invoice Email** - Professional HTML invoice
   - All invoice details
   - Formatted line items
   - Payment instructions

## Rate Limits

**Free Plan:**
- 100 emails per day
- 3,000 emails per month

**Pro Plan** ($20/month):
- 50,000 emails per month
- Priority support

## Next Steps

1. Create Resend account
2. Get API key
3. Set Cloudflare secret
4. Deploy application
5. Test with your email
6. (Optional) Verify domain for production

---

**Need Help?**
- Resend Docs: https://resend.com/docs
- Resend Support: https://resend.com/support
