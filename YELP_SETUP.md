# Yelp Reviews Integration Setup

Your website now has Yelp testimonials integration! Currently showing static reviews, but you can enable **live reviews** from Yelp.

## Current Status
✅ **Static reviews** - Working now (placeholder testimonials)
✅ **Review us on Yelp button** - Links to your Yelp page
⏳ **Live Yelp API reviews** - Requires setup (optional)

---

## How to Enable Live Yelp Reviews (FREE)

### Step 1: Find Your Yelp Business Page
1. Go to https://www.yelp.com and search for "K9 Vision"
2. Copy the URL of your public business page
3. Example: `https://www.yelp.com/biz/k9-vision-san-diego`

### Step 2: Get Free Yelp API Key
1. Go to https://www.yelp.com/developers/v3/manage_app
2. Sign in with your Yelp business account
3. Click **"Create New App"**
4. Fill in the form:
   - App Name: `K9 Vision Website`
   - Industry: `Pet Services`
   - Contact Email: Your email
   - Description: `Display reviews on K9 Vision website`
5. Agree to terms and click **"Create New App"**
6. Copy your **API Key** (looks like: `xxxxxxxxxxxxxxxxxxxxxxxxxxx`)

### Step 3: Get Your Yelp Business ID
From your Yelp business page URL, extract the business alias:
- URL: `https://www.yelp.com/biz/k9-vision-san-diego`
- Business ID: `k9-vision-san-diego` (everything after `/biz/`)

### Step 4: Add to Cloudflare (wrangler.toml)
1. Open `wrangler.toml` file
2. Add these lines in the `[vars]` section:
```toml
[vars]
JWT_SECRET = "your-secret-key-change-this-in-production"
YELP_API_KEY = "YOUR_YELP_API_KEY_HERE"
YELP_BUSINESS_ID = "k9-vision-san-diego"  # Replace with your actual business ID
```

### Step 5: Deploy
```bash
# Push to GitHub
git add .
git commit -m "Add Yelp API credentials"
git push

# Or deploy directly to Cloudflare Pages
wrangler pages deploy
```

---

## Alternative: Update Static Reviews

If you prefer not to use the API, you can update the static reviews in `index.html`:

1. Find the section with `id="reviews-container"`
2. Edit the review text, names, and star ratings
3. Add your actual customer testimonials

---

## How It Works

- **Without API key**: Shows static testimonials (current state)
- **With API key**: Automatically fetches and displays latest 3 reviews from Yelp
- **Fallback**: If API fails, static reviews remain visible

---

## Update Yelp Review Link

Currently, the "Review Us on Yelp" button uses your business dashboard ID.

To update it:
1. Find your public Yelp page URL
2. In `index.html`, search for: `writeareview/biz/EQ0-Z3EPhDjkDcTWeibv_Q`
3. Replace with: `writeareview/biz/YOUR-BUSINESS-ID`

Example:
```html
<a href="https://www.yelp.com/writeareview/biz/k9-vision-san-diego" ...>
```

---

## Questions?

- **Yelp API is free** with limits: 5,000 calls/day (more than enough!)
- **Reviews update**: Cached for 1 hour for better performance
- **No API needed**: Static reviews work great without any setup
