# K9 Vision - Project Summary Part 3
Continued from PROJECT_SUMMARY_PART2.md
Session Start Date: 2026-03-25

---

## Session 9 — 8-Feature Build: Client Self-Service, Media Gallery, Contact-Invoice, Reports, Analytics, CSV Import, Email Preview, Multi-Dog Milestones
**Date:** March 25, 2026
**Time:** ~2:00 PM CDT
**Team Member:** Full Team Gee (Supervisor + Alex + Casey + Jordan + Morgan)
**Session Focus:** Implemented all 8 remaining backlog items (Features 8-15) in a single session across 3 phases
**Command:** "Team Gee please work on these features 8-15"

---

### What Was Said
User requested implementation of all 8 remaining backlog features:
- F8: Client Self-Service — Clients update own profile, add/edit dogs, manage preferences
- F9: Media Gallery Enhancements — Drag-and-drop reorder, album organization
- F10: Contact-to-Invoice Linking — Auto-populate non-client invoice from contact dropdown
- F11: Report Date Filtering — Date range picker for charts
- F12: Appointment Analytics — Busiest days, cancellation rates, no-show tracking
- F13: Bulk Contact Import — CSV upload for leads
- F14: Email Template Preview — Admin preview before sending
- F15: Multi-Dog Milestone Tracking — Per-dog vs per-client milestones

### What Was Done

#### Feature 8: Client Self-Service — Dog Edit UI
- Added edit (pencil) button to each dog card on client dashboard
- Created `#edit-dog-modal` with dog_name, breed, age fields
- JS functions: `openEditDogModal()`, `closeEditDogModal()`, `submitDogEdit()`
- Uses existing `PUT /api/dogs/[id]` endpoint (no backend changes needed)
- Stored `clientDogs` array for quick lookup

#### Feature 9: Media Gallery Enhancements
- **Migration 029:** Added `sort_order INTEGER DEFAULT 0` and `album TEXT DEFAULT ''` to media table with indexes
- **New endpoint:** `PUT /api/media/reorder` — batch update sort_order with D1 batch API, ownership checks
- **Modified:** `upload.js` accepts optional `album` field, `[id].js` PUT supports `album` update, `client/[clientId].js` orders by `sort_order ASC`
- **Client dashboard:** Added Sortable.js CDN, album filter dropdown, "Set Album" button in select mode, drag-and-drop reorder with auto-save, album badges on media items
- **Admin dashboard:** Added Sortable.js CDN, album filter/sort in client detail media section, drag-and-drop reorder toggle

#### Feature 10: Contact-to-Invoice Linking
- **Migration 027:** Added `contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL` to invoices table
- **Modified:** `invoices/index.js` — POST accepts `contact_id`, GET includes LEFT JOIN contacts for `contact_name`
- **Admin dashboard:** Contacts dropdown in non-client invoice form, auto-fills recipient_name/email on selection, `contact_id` sent in POST body

#### Feature 11: Report Date Filtering
- **Modified:** `stats/extended.js` — accepts `startDate` and `endDate` query params, applies to revenue, service popularity, client growth, and invoice status queries
- **Admin dashboard:** Date range picker UI (2 date inputs + Apply/Reset buttons) above charts, `loadReports()` passes date params

#### Feature 12: Appointment Analytics
- **Migration 028:** Recreated appointments table with `no_show` added to status CHECK constraint, preserved all data and indexes
- **New endpoint:** `GET /api/stats/appointments` — returns busiest days (with day names), status breakdown, busiest hours, monthly volume, completion/cancellation/no-show rates
- **Admin dashboard:** 3 rate summary cards, 2 new charts (appointment status doughnut, monthly volume bar), "No Show" action button on appointments, `markNoShow()` function

#### Feature 13: Bulk Contact Import (CSV)
- **New endpoint:** `POST /api/contacts/bulk` — accepts array of contacts, validates name required, D1 batch insert, max 500 per import
- **Admin dashboard:** "Import CSV" button next to Add Contact, CSV import modal with file input, inline CSV parser (handles quoted fields, BOM), auto-maps columns by header name, preview table (first 10 rows), import with results display

#### Feature 14: Email Template Preview
- **New endpoint:** `GET /api/email/preview` — whitelist of 10 template names mapped to functions with sample defaults, returns rendered HTML
- **Admin dashboard:** Email preview modal with iframe, `previewEmail()` function, "Preview" button next to invoice email actions, `previewInvoiceEmail()` helper

#### Feature 15: Multi-Dog Milestone Tracking
- **Modified:** `milestones/index.js` GET query JOINs dogs table, returns `dog_name` and `dog_photo` for each milestone, ordered by dog then creation date
- **Admin dashboard:** Dog dropdown in milestone creation form (populated from client's dogs), `dog_id` included in POST, milestones grouped by dog with headers and per-group progress
- **Client dashboard:** Milestones grouped by `dog_name` with per-dog progress bars, section headers

### How It Was Done
1. **3-phase approach:** Phase 1 (quick wins: F8, F11, F15), Phase 2 (medium: F10, F12, F14), Phase 3 (larger: F9, F13)
2. **Plan mode:** Full exploration with 2 parallel Explore agents, then Plan agent for detailed implementation strategy, approved before coding
3. **Backend-first:** All migrations, new endpoints, and API modifications completed before frontend changes
4. **Parallel frontend agents:** 2 concurrent frontend-lead agents worked on different feature sets of admin-dashboard.html
5. **Existing code reuse:** Leveraged existing dogs API, milestones API (already had dog_id), media ownership checks, Chart.js patterns, modal/toast patterns
6. **D1 batch API:** Used for media reorder and bulk contact import for efficiency

### Files Touched

**New files (7):**
- `migrations/027_invoice_contact_id.sql`
- `migrations/028_appointment_no_show.sql`
- `migrations/029_media_sort_album.sql`
- `functions/api/email/preview.js`
- `functions/api/stats/appointments.js`
- `functions/api/media/reorder.js`
- `functions/api/contacts/bulk.js`

**Modified files (8):**
- `functions/api/milestones/index.js` — GET query JOINs dogs table
- `functions/api/stats/extended.js` — date range filtering
- `functions/api/invoices/index.js` — contact_id support
- `functions/api/media/upload.js` — album field
- `functions/api/media/client/[clientId].js` — sort_order ordering
- `functions/api/media/[id].js` — album update support
- `client-dashboard.html` — dog edit modal, milestones grouping, media album/drag-drop
- `admin-dashboard.html` — all 8 features UI

### Tech Stack Updates
- Added: Sortable.js v1.15.0 (CDN) for drag-and-drop media reordering
- Database: 3 new migrations (027-029), schema now at 29 migrations

### Security Checklist
- Auth/RBAC: All new endpoints use requireAuth or requireAdmin appropriately. Media reorder has ownership check for non-admin. Bulk import is admin-only. Email preview is admin-only.
- Input validation: CSV import validates name required. Media reorder validates items array. Bulk import caps at 500. Contact_id is parseInt'd.
- SQL parameterization: All queries use prepared statements with bind().
- Secrets handling: No new secrets. Email preview uses existing Resend setup.
- CORS: Handled by existing _middleware.js.
- Data exposure: Email preview whitelist prevents arbitrary template execution.
- External services: No new integrations.
- Storage access: Media reorder uses existing R2 binding pattern.

### Next Steps
- Run migrations 027-029 on production D1
- Deploy to Cloudflare Pages
- Test all 8 features end-to-end in browser
- Set up Google Calendar credentials if not yet done (from Session 6 backlog)
- Consider Stripe/Payment integration (highest remaining priority)
- Consider SMS notifications via Twilio/Brevo

---

## Session 10 — Google Analytics Readiness, Marketability, First-Party Visitor Geography, Consent Banner & Global Compliance
**Date:** June 18, 2026
**Team Member:** Claude CLI (Supervisor + Frontend/Backend/Data/QA leads)
**Session Focus:** Make the site analytics-ready and more marketable; add self-hosted visitor geography (state/city/ZIP) without Google Analytics; add a strict opt-in cookie-consent banner that gates all tracking; harden global privacy compliance; remove the blocked Yelp footer link.
**Commands (user, paraphrased):**
- "Make sure the page is ready for Google Analytics and make the site more marketable."
- "Why does the Cloudflare traffic dashboard only show country, not state/city/ZIP?" → "Can I at least retrieve state and city?"
- "Add a floating disclaimer bar at the bottom with accept/deny, category selection, X, and a privacy policy link."
- "Make sure we are compliant globally; the Yelp reviews footer link is blocked — fix it or remove it."

---

### What Was Said
User wanted: (1) the site ready to drop in Google Analytics and more marketable; (2) to understand why Cloudflare's dashboard only shows country and to retrieve state/city themselves; (3) a persistent consent banner gating tracking; (4) global privacy compliance and removal of a blocked Yelp footer link.

### What Was Done

#### 1. Google Analytics 4 readiness + marketability (commit `a82e25e72`)
- **`analytics.js` (new):** single-source GA4 loader — Measurement ID set in ONE place (placeholder `G-XXXXXXXXXX`), installed on all 11 HTML pages; no-op until a real ID is set. Conversion events: `generate_lead` (contact form), `cta_click` (Book/CTA buttons via `data-ga`), `click_yelp` (outbound).
- **`index.html`:** AggregateRating + Review schema (star rich-snippets), FAQ section + FAQPage schema, hero social-proof trust bar, auto-updating footer year (was hardcoded 2024), contact-section benefit checklist, FAQ links in nav/footer, Yelp added to schema `sameAs`. "Book Consultation" wording (no "free").

#### 2. First-party visitor geography (commit `683f47773`)
- **`migrations/031_page_views.sql` + `schema.sql`:** `page_views` table — coarse geo only (city/region/region_code/postal_code/country), no IP/PII.
- **`functions/api/track/index.js` (new):** public POST beacon; reads Cloudflare `request.cf` and inserts a row; non-blocking.
- **`analytics.js`:** fires a `sendBeacon`/`fetch` to `/api/track` per page load.
- **`functions/api/analytics/geo.js` (new):** admin-only (`requireAdmin`) aggregation by state/city/country.
- **`admin-dashboard.html` + `admin-app.js`:** "🌎 Visitor Geography" Quick Action + section with Top States / Top Cities tables.
- **Verified live:** captured `Cypress, Texas (TX) 77429, US`; test rows then deleted. Migration 031 applied to remote D1.

#### 3. Strict opt-in cookie consent banner (commit `9178de64c`)
- **`consent.js` (new):** self-contained banner (own CSS, no Tailwind dep) on all 11 pages; Accept All / Reject All / Save Preferences / X; categories Strictly Necessary (locked) + Analytics & Location (off by default); stores choice in `localStorage`; exposes `window.K9Consent` and dispatches `k9:consent` event.
- **`analytics.js` refactor:** GA + geo beacon moved into `startAnalytics()`, fired ONLY when `K9Consent.analyticsAllowed()` or on `k9:consent`. `gtag`/`trackEvent` stubs remain so conversion calls never throw pre-consent.
- **`privacy-policy.html` (new):** honest data-practices page; linked from footers + `sitemap.xml`. Footer "Cookie Preferences" link re-opens the banner.

#### 4. Global compliance hardening + Yelp footer removal (commit `8760f2327`)
- **`consent.js`:** "Reject All" made an equally-prominent solid button (GDPR/CNIL equal-prominence).
- **`privacy-policy.html`:** added Legal bases (GDPR/UK), Your privacy rights (incl. CCPA/CPRA "we do not sell or share"), Data retention, International transfers, Children's privacy, Changes notice.
- **`index.html`:** removed the footer "Yelp Reviews" link (reported blocked; Yelp 403s automated checks so unverifiable). Testimonial "See more on Yelp" links and "Review Us on Yelp" button left intact.

### How It Was Done
1. **Plan mode** for the geo, consent, and compliance work — Explore agents mapped Functions/D1 patterns and admin-dashboard conventions; plans approved before coding.
2. **Pattern reuse:** public POST + D1 insert like `functions/api/contact/index.js`; `requireAdmin` like `functions/api/stats.js`; admin fetch/render + `getAuthHeaders()` patterns from `admin-app.js`; script-include rollout pattern for `consent.js`/`analytics.js`.
3. **Incremental commits + deploys** to Cloudflare Pages, with production verification each time (curl smoke tests, `wrangler d1 execute` reads). Remote D1 migration 031 applied with explicit user authorization.

### Files Touched
**New (5):** `analytics.js`, `consent.js`, `privacy-policy.html`, `functions/api/track/index.js`, `functions/api/analytics/geo.js`, `migrations/031_page_views.sql`
**Modified (key):** `index.html`, `admin-dashboard.html`, `admin-app.js`, `schema.sql`, `sitemap.xml`, and all 11 HTML pages (consent.js + analytics.js includes).

### Tech Stack Updates
- Added GA4 (gtag.js) wiring; first-party analytics via Cloudflare `request.cf` → D1; client-side consent management (localStorage, strict opt-in).
- Database: migration 031 → schema now at 31 migrations; new `page_views` table.

### Security Checklist
- Auth/RBAC: `/api/track` is public/unauthenticated (like `/api/contact`), stores no IP/PII; `/api/analytics/geo` is admin-only via `requireAdmin`.
- Privacy: strict opt-in — no geo beacon and no GA fire until the visitor consents; consent stored client-side only.
- SQL parameterization: all queries use prepared `bind()`.
- Secrets: none added (GA ID is a public client-side measurement ID placeholder).
- CORS: handled by existing `_middleware.js`.

### Next Steps
- Paste the real GA4 Measurement ID into `analytics.js` (one line) and redeploy.
- Confirm true total Yelp review count to update `aggregateRating.reviewCount` in `index.html` schema.
- Optional: Google Consent Mode v2 (only if/when GA4 is live with EEA traffic).
- Recommend legal review of `privacy-policy.html`; consider DPAs on file with Cloudflare/Resend/Google.
- Visitor Geography populates only from real consenting browser visits (production `request.cf`); not from bots/curl.

---

## Session 11 — Bot/Scanner Hardening, Security Headers & Rate-Limiter Bug Fix
**Date:** June 18, 2026
**Team Member:** Claude CLI (Supervisor + Backend/Data/QA leads)
**Session Focus:** Explain the 30-day 404/403/405/499/401 error volume and harden the site against bot/scanner traffic and brute-force logins.
**Command (user, paraphrased):** "Why so many 404/403/405/499/401 errors in the last 30 days? Add bot/WAF protection, rate-limit /api/*, tail live traffic now — and what else can be done as of June 2026?"

---

### What Was Said
User was alarmed by the error-code volume in Cloudflare analytics and wanted both an explanation and concrete hardening (WAF/bot protection, API rate limiting, a live traffic tail), plus a full menu of further options.

### What Was Done

#### Diagnosis
- Traced each code to its source: **401** = `requireAuth` (`functions/utils/auth.js`) + failed logins (`functions/api/auth/login.js`); **403** = `requireAdmin`/ownership checks across ~12 endpoints + Cloudflare edge bot-block; **405** = wrong HTTP method on POST/GET-only endpoints; **404** = automated vulnerability scanners probing `/wp-login.php`, `/.env`, etc.; **499** = client closed connection.
- Conclusion: overwhelmingly **automated bot/scanner traffic + normal auth behavior** (no 5xx), and it **predates** the current session's work.

#### Code hardening (deployed + verified live)
1. **`_headers` (new):** enforcing security headers — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`; plus a **Content-Security-Policy-Report-Only** with a full allowlist (Tailwind CDN, jsdelivr, unpkg, Google Fonts/GA, unsplash, self) — staged so it cannot break the live site; flip to enforcing later.
2. **`functions/_middleware.js`:** early **403** short-circuit for known scanner probe paths (`/wp-*`, `/xmlrpc.php`, `/.env`, `/.git`, `phpmyadmin`, `*.php`, etc.) before any Function/static lookup. Verified: probes → 403, real pages → 200.
3. **`functions/api/contact/index.js`:** rate-limit the public contact form to 5/min/IP via the existing `checkRateLimit` helper (anti-spam).
4. **🐛 BUG FIX — `functions/utils/rate-limit.js`:** the window check compared SQLite `created_at` ("YYYY-MM-DD HH:MM:SS") against a JS `toISOString()` value ("...T...Z"); the space-vs-`T` made the string comparison **always false**, so the attempt count was always 0 and **rate limiting never triggered** (login/register/change-password were silently unprotected). Fixed to `datetime('now', '-N seconds')`. Verified: 429 now fires on the 6th rapid request.

#### Live tail
- Ran `wrangler pages deployment tail <deployment-id> --project-name=k9sitecg` (non-interactive mode requires the deployment ID); captured live requests incl. scanner probes flowing through the middleware.

#### Cloudflare dashboard guidance (user action — not toggleable via wrangler OAuth, no zone scope)
- The actual reducers of edge error counts: **Bot Fight Mode**, **Block AI bots**, **WAF custom rule** blocking scanner paths, **WAF managed ruleset**, **edge Rate Limiting rules** on `/api/*`, **Security Level Medium/High**, and **Notifications / Security → Events** review.

### How It Was Done
1. **Plan mode** + 1 Explore agent mapped existing protections (found a working-looking but broken rate limiter, no `_headers`, no CSP, no CAPTCHA).
2. **Reused** `functions/utils/rate-limit.js` (`checkRateLimit`) rather than rebuilding.
3. **Incremental commits + deploys**, each verified with production `curl` (headers, 403 scanner block, 429 rate-limit) and a live `wrangler tail`.

### Files Touched
**New (1):** `_headers`
**Modified (3):** `functions/_middleware.js`, `functions/api/contact/index.js`, `functions/utils/rate-limit.js`
**Commits:** `3eb6bdbe2` (hardening), `9f3fb0707` (rate-limiter fix).

### Tech Stack Updates
- HTTP security headers via Cloudflare Pages `_headers`. No DB migration (`rate_limits` table already exists from migration 030).

### Security Checklist
- **Rate limiting now actually enforced** (login, register, change-password, contact) — previously a no-op due to the datetime bug.
- Scanner probes blocked early with a cheap 403 (no Function/static work).
- Security headers added; CSP staged Report-Only (flip to enforcing after a clean console check).
- No new secrets; parameterized SQL; no PII stored.
- Edge controls (Bot Fight Mode / WAF) documented as user dashboard actions.

### Next Steps
- **Enable Bot Fight Mode + WAF rules** in the Cloudflare dashboard (highest impact on the error counts).
- Optional: **Turnstile** on login + contact form (`turnstile-spin` skill; needs site/secret keys) — strongest defense vs credential-stuffing 401s and form spam.
- Flip the CSP from Report-Only to enforcing once the browser console shows no violations.
- Review **Security → Events** for the real offending IPs/paths.

---

## Session 12 — Activate GA4 + Add Microsoft Clarity (both consent-gated), deployed
**Date:** June 19, 2026
**Team Member:** Claude CLI (Supervisor + Frontend/QA leads)
**Session Focus:** Plug the real GA4 Measurement ID into the existing consent-gated analytics infra, then add Microsoft Clarity the same consent-first way, update disclosures, and deploy.
**Command (user, paraphrased):** "Here's the gtag.js snippet for `G-NQB0YE5XM2` — set up Google Analytics" → chose **consent-gated** (option 1), all pages tracked. Then: "deploy, and here's the Microsoft Clarity code (project `x9ln6uthfu`)."

---

### What Was Said
User pasted the standard `gtag.js` snippet (`G-NQB0YE5XM2`) and later the Microsoft Clarity loader (`x9ln6uthfu`), expecting manual per-page pastes. Exploration showed the site **already has a complete, consent-first analytics integration** (`/analytics.js` + `/consent.js`) on every served page. User endorsed keeping that consent-gated design instead of the always-on raw snippets. The GA screenshot confirmed the Measurement ID matched the K9VisionTX stream.

### What Was Done
- **GA4 — `analytics.js` line 20:** replaced placeholder `GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'` → `'G-NQB0YE5XM2'` (single source of truth per the file header). Line 34's `indexOf('G-XXXXXXXXXX')` guard left untouched (now false → `startGA()` runs).
- **Clarity — `analytics.js`:** added `CLARITY_PROJECT_ID = 'x9ln6uthfu'` + a `startClarity()` function (official Microsoft loader), called from `startAnalytics()` alongside `startGA()`/`sendGeoBeacon()`. So Clarity loads **only after Analytics consent**, never the raw always-on snippet.
- **`_headers` CSP:** added `https://www.clarity.ms https://*.clarity.ms` to `script-src` and `https://*.clarity.ms https://c.bing.com` to `connect-src`, so flipping CSP from Report-Only to enforcing later won't block Clarity.
- **Disclosures:** `privacy-policy.html` — added a "Site-experience analytics (Microsoft Clarity)" collected-data bullet and a Microsoft Clarity entry in the third-party list. `consent.js` — banner copy now reads "visitor geography, Google Analytics & Microsoft Clarity" so consent accurately covers what it gates.
- **Coverage:** all 12 served pages include `/analytics.js` + `/consent.js` → both GA + Clarity tracked once consent is granted. `actual_live_site.html` (local backup, not served) left alone.
- **Deployed** `npx wrangler pages deploy . --project-name=k9sitecg` → deployment `https://14f373dc.k9sitecg.pages.dev` (prod `k9visiontx.com`). Verified live: `analytics.js` serves both IDs + `startClarity()`; production CSP header includes the Clarity allowlist.

### How It Was Done
1. **Plan mode** + Explore agent confirmed the consent-first infra; raw snippets deemed unnecessary/harmful to privacy posture.
2. **Reused** the existing `analytics.js`/`consent.js` machinery — config + one small function, not per-page edits.
3. Single deploy for both changes; verified with production `curl` (served JS + CSP response header).

### Files Touched
**Modified (4):** `analytics.js` (GA ID + Clarity loader), `_headers` (CSP allowlist), `privacy-policy.html` (disclosures), `consent.js` (banner copy).

### Security / Privacy Impact Note
- Both GA4 and Clarity are **strictly consent-gated**: nothing loads until the visitor accepts "Analytics & Location" (`window.K9Consent`). GA runs with `anonymize_ip: true`; Clarity auto-masks form inputs/text.
- **No always-on third-party script added.** Disclosures updated so the cookie banner + privacy policy honestly name Clarity (session-behavior/heatmaps) — "Nothing is tracked until you choose" still holds.
- GA Measurement ID and Clarity project ID are public by design (ship in client JS) — no secret-handling concern. No DB/schema change. CSP allowlist kept accurate.

### Next Steps
- **Verify** (incognito): banner shows → no `gtag/js` or `clarity.ms/tag` request before Accept → after Accept both fire → GA **Realtime** + Clarity dashboard show the visit.
- When ready, flip `_headers` CSP from Report-Only to enforcing (allowlist now covers GA + Clarity).

---

## Session 13 — SEO: Board & Train + Houston-Area Targeting from Google Trends
**Date:** June 21, 2026
**Team Member:** Claude CLI (Supervisor + Frontend/QA leads)
**Session Focus:** Turn observed Houston search demand (Google Trends: `dog board and train near me` BREAKOUT, `dog board and train` +80%, `how to train a dog`, `dog training tips`) into on-page content + schema so the public site ranks for those queries. Single-page enhancement (no blog), per user choice.

---

### What Was Said
User shared a Google Trends screenshot (Houston, past week) and asked how to "add it to my code" so `k9visiontx.com` surfaces for those searches, plus a 2026 SEO checklist. Clarified via plan mode: (1) **Yes**, they offer board & train → build it prominently; (2) **enhance the existing single page** (no separate blog); (3) **Yes**, add Houston-area suburb targeting. Confirmed: **no phone** to list (schema `telephone` left empty, not fabricated); real service areas = Houston, Katy, Cypress, Spring, The Woodlands, Sugar Land, Pearland, Hockley, Waller, Montgomery County, Fort Bend County.

### What Was Done
- **`index.html` — new content:** added a dedicated **Board & Train in Houston** section (`id="board-and-train"`, "Most Popular Program"), a matching highlighted **Board & Train** card in the services scroll, and a **Service Areas** section (`id="areas"`) with 11 location chips. Wired "Board & Train" into desktop nav, mobile nav, and footer; added "Service Areas" to footer.
- **`index.html` — FAQ:** expanded from 5 → **9** Q&As, adding "What is board and train?", "How much does board and train cost in Houston?", "What are some basic dog training tips for new owners?", "How do I start training my dog at home?" — capturing the informational queries on a single page. Mirrored all four into the **FAQPage JSON-LD** (visible text === schema, verified).
- **`index.html` — meta/schema:** retuned `<title>`, meta description, OG/Twitter tags to include "board and train" + Houston suburbs. LocalBusiness JSON-LD: `areaServed` expanded from 1 City → **11** Cities/AdministrativeAreas, added a **`hasOfferCatalog`** of 6 Services (incl. Board & Train). Hero subhead now names "Houston dog training and board & train."
- **Crawl hygiene (audit-driven):** added `<meta name="robots" content="noindex,nofollow">` to 8 private pages (portal, admin-dashboard, client-dashboard, register, setup-account, reset-password, forgot-password, verify-email) and `noindex` to `review.html` (defense-in-depth atop existing robots.txt). Refreshed `sitemap.xml` home `lastmod` → 2026-06-21.
- **Verified:** both JSON-LD blocks parse (Python `json.loads`); 9 visible FAQ === 9 schema names; sections 8/8 balanced, details 9/9.

### How It Was Done
1. **Plan mode** + two Explore agents audited current on-page SEO (already strong: schema, sitemap, OG, GA4) and infra; established the real gap was **zero board & train content** + no suburb targeting.
2. **Reused existing markup patterns** — service-card, `<details>` FAQ, section padding/bg-alternation, `data-ga` CTA buttons — so no new CSS/JS.
3. Content written to **genuinely match intent** (not keyword-stuffed); service areas named only where the trainer actually works (truthfulness).
4. Programmatic verification of JSON-LD validity and visible/schema FAQ parity before finishing.

### Files Touched
**Modified (11):** `index.html` (sections, nav/footer, FAQ + JSON-LD, title/meta/OG, LocalBusiness schema); `portal.html`, `admin-dashboard.html`, `client-dashboard.html`, `register.html`, `setup-account.html`, `reset-password.html`, `forgot-password.html`, `verify-email.html`, `review.html` (noindex meta); `sitemap.xml` (lastmod).

### Security Impact Note
- **No new endpoints, integrations, secrets, or DB/schema changes.** Content + meta-tag edits only.
- `noindex` additions **improve** posture (defense-in-depth: private pages no longer rely on robots.txt alone). No change to auth, CORS, CSP, or rate limiting.
- Schema `telephone` deliberately left empty (no fabricated PII). All added content is truthful to services/areas the business provides.

### Next Steps
- **Deploy:** `npx wrangler pages deploy . --project-name=k9sitecg`, then in **Google Search Console** resubmit `sitemap.xml` + "Request indexing" for `/`.
- **Validate** the page in Google's Rich Results Test (LocalBusiness + FAQPage).
- **Off-code (highest impact for "near me"):** optimize **Google Business Profile** (category "Dog trainer", add Board & Train + service areas, photos, hours), actively gather **Google reviews**, keep NAP consistent across site/Google/Yelp.
- Optional later: add a real phone (`tel:` link + schema), consider prebuilt Tailwind CSS for LCP.

---

## Session 14 — Client guide: posting iPhone .MOV videos to TikTok/Instagram/Facebook
**Date:** July 11, 2026
**Team Member:** Claude CLI (Supervisor + QA/Docs lead)
**Session Focus:** Answer the client's ask — "a perfect strategy" for getting iPhone `.MOV` training videos onto TikTok, Instagram, and Facebook — by extending the existing `marketing_k9visiontx.md` guide (client chose: add to guide, iPhone source).

---

### What Was Said
User asked for a perfect strategy to post `.MOV` files to the three platforms. Clarified in plan mode: (1) deliverable = **add a section to `marketing_k9visiontx.md`** (not a separate artifact); (2) videos are recorded on **iPhone**. Confirmed no `.MOV` files present in the environment → this is guidance, not file processing.

### What Was Done
- **`marketing_k9visiontx.md` — new section** "🎬 The .MOV fix — make your iPhone videos look right (not washed-out)", inserted between Step 3 (posting routine) and Step 4 (tips). Covers: why raw iPhone `.MOV` (HEVC + HDR/Dolby Vision) washes out after platform re-encode; the one-time capture fix (**Settings → Camera → Formats → Most Compatible** = H.264; **Record Video → HDR Video OFF** = SDR); converting existing clips via **CapCut** export (→ clean MP4); a per-platform spec table; the "don't repost a watermarked TikTok" rule; and a desktop workflow (CapCut desktop + web upload, or AirDrop to phone). Added a checklist line: export MP4/H.264, not raw HDR `.MOV`.
- **Accuracy:** verified 2026 specs via web (TikTok/IG both accept `.MOV`; the culprit is the HEVC/HDR **codec**, not the `.MOV` container). Targets: **9:16, 1080×1920, MP4/H.264, ~30 fps, 15–45 s**. TikTok best 21–34 s (~288 MB in-app / 4 GB web); IG Reels best 15–30 s (1 GB); FB Reels best 15–60 s (≤90 s).

### How It Was Done
1. Plan mode; read the existing 232-line guide to build on it (not duplicate) — the gap was zero coverage of the `.MOV`/HEVC/HDR format issue.
2. Matched the guide's plain-language, emoji-section voice and reused its CapCut/native-post/desktop patterns.
3. Web-verified current platform limits before committing numbers (no fabricated specs).

### Files Touched
**Modified (2):** `marketing_k9visiontx.md` (new .MOV section + checklist line); `PROJECT_SUMMARY_PART3.md` (this entry).

### Security Impact Note
- **Docs-only.** No code, endpoints, integrations, secrets, DB/schema, auth, CORS, CSP, or rate-limit changes. Zero security surface.

### Next Steps
- Commit + push (auto-deploys the repo via the Pages Git integration — the `.md` is a client reference doc, not a rendered public page).
- Optional: if the client drops actual `.MOV` files into the workspace, convert/resize to 9:16 H.264 MP4 with the Adobe video tools.

---

## Session 15 — Google reviews wiring + geo-conditional consent default
**Date:** August 15, 2026
**Team Member:** Claude CLI (Supervisor + Frontend/Backend leads)
**Session Focus:** Two unrelated complaints — "I set up a Google review for this client and it's not showing", and "in the site analytics, location needs to be checked — why wasn't that automatically clicked on?"

---

### What Was Said
User reported a Google review not appearing, and clarified in plan mode that it is **not showing on Google itself** (not on the site), and that they do not have the Business Profile details to hand. Separately they asked why the **Analytics & Location** box isn't pre-ticked, and chose a custom option: **pre-check it for US visitors, leave it unchecked for non-US**. They also approved removing the self-serving review schema.

### What Was Found
- **No Google integration existed anywhere in the repo** — zero hits for `place_id`, `g.page`, `search.google.com/local/writereview`, `maps.google`, or any review-widget vendor. Every review surface pointed at Yelp; JSON-LD `sameAs` listed Yelp only. The review "not showing" is therefore entirely Google-side, and quite possibly there is no verified Business Profile at all (a web search surfaced the site but no listing). GBP setup was an unexecuted to-do from Sessions 13/14.
- **The unchecked box was deliberate, not a bug** (`consent.js` strict opt-in, commit `9178de64c`).
- **Genuine bug found:** the banner's `×` button called `save(false)`, persisting a permanent opt-out that `boot()` then honored forever — one stray click killed that visitor's location data for good. A direct contributor to the Visitor Geography report looking empty.

### What Was Done
- **New `functions/api/geo.js`** — public, unauthenticated, GET/HEAD only. Returns `{"country":"US"}` from `request.cf.country` and nothing else. Normalizes `XX` (unknown) and `T1` (Tor) to `null`. Sets `Cache-Control: no-store, no-cache, must-revalidate, private` + `CDN-Cache-Control: no-store` inside the Function. Needs **no D1 binding**, so unlike `/api/track` it works in preview and local dev.
- **`consent.js`** — memoized, timeout-bounded (1200 ms) country resolver; box pre-checked only when country is `US`. Priority order: stored choice → GPC → geography. GPC (`navigator.globalPrivacyControl`) short-circuits with **no network request**. Country cached in `sessionStorage.k9_geo` (session, not local — country legitimately changes with travel/VPN). `window.K9Consent` left untouched so `analytics.js`'s synchronous top-level gate still works.
- **`×` fixed** — now sets `sessionStorage.k9_dismissed` and persists **no decision**; banner returns next visit. Relabelled from "Close and reject". Deliberately does not `emit()` (no choice was made).
- **`index.html`** — removed `aggregateRating` + the 3-entry `review` array from the LocalBusiness JSON-LD (Google ignores self-published review markup; it can draw a manual action). Added a "Review Us on Google" CTA beside the Yelp button reusing the existing `[data-ga]` tracker, with a JS guard that removes it while the href still contains `PLACE_ID_HERE`.
- **`privacy-policy.html`** — disclosed the two session-only keys and the regional default; added a GPC bullet to the rights list.

### How It Was Done
1. Plan mode; two parallel Explore agents mapped every review surface and the full geography/consent data flow, then a Plan agent compared three ways for a static `consent.js` to learn the country (new endpoint vs HTMLRewriter in `_middleware.js` vs `Set-Cookie`).
2. Chose the endpoint: HTMLRewriter would make **every** HTML response per-visitor (a silent cache-correctness hazard — an edge-cached US response replayed to an EU visitor pre-ticks their box) and would block ever tightening `script-src`; `Set-Cookie` would set a pre-consent cookie on a site whose policy promises none.
3. Deliberately **wait** for the lookup rather than render-then-flip: `save()` reads the live checkbox, so a box that ticks itself between the visitor reading it and clicking Save would record the opposite of what they consented to. The wait is ~free because `consent.js` loads in `<head>` and the banner already deferred to `DOMContentLoaded`.
4. Verified with `wrangler pages dev` + Playwright against system Chrome: **26/26** consent tests (US checked / DE unchecked / `??` unchecked / GPC unchecked / blocked endpoint fails closed in 414 ms / `×` writes no `k9_consent` and the banner returns in a new session / decided visitors make zero `/api/geo` calls / stored choice beats US default / Google CTA absent while placeholder) and **6/6** gate tests (zero tracker requests before consent, after `×`, and after Reject All; GA + Clarity + `/api/track` all fire after Accept and again on the next load, proving the synchronous gate is intact).

### Files Touched
**Created (1):** `functions/api/geo.js`.
**Modified (4):** `consent.js`, `index.html`, `privacy-policy.html`, `PROJECT_SUMMARY_PART3.md` (this entry).

### Security Impact Note
- **New endpoint `/api/geo`** — public by necessity (the banner must render pre-consent). Read-only: **no D1 access**, so unlike `/api/track` it cannot be used to write to the database; a bot hitting it costs one no-op invocation. Returns only a 2-letter country code — no city, region, postal code, or IP. Not matched by any `SCANNER_PATHS` regex in `_middleware.js` (verified: `/wp-`, `/wordpress`, `/xmlrpc.php`, phpmyadmin group, `/administrator`, `/vendor/`, `/cgi-bin/`, dotfiles, `.php|.asp|.aspx|.jsp|.cgi`); `/wp-login.php` still returns 403.
- **No `?country=` debug override** was added — one would let anyone craft a URL that pre-ticks the analytics box for an EU visitor.
- **Privacy posture unchanged or improved.** Strict opt-in still holds: geography affects only the checkbox's default state, never `analyticsAllowed()`, and nothing is tracked until a click. GPC is now honored (CPRA). The `×` fix stops recording a decision the visitor never made. Two new session-only storage keys, both disclosed in the privacy policy.
- **No changes** to `_headers` (`connect-src 'self'` already covers the fetch), `_middleware.js`, `analytics.js`, `wrangler.toml`, auth, CORS, rate limits, or the DB schema.

### Next Steps
- **Off-code and blocking the rest:** confirm whether a Google Business Profile exists and is **verified** (unverified profiles do not display reviews publicly); set it up as a **service-area** business matching `areaServed`. If verified and the review is still missing it was almost certainly spam-filtered — check the GBP Reviews tab, and check whether the reviewer used a brand-new account, was on the same WiFi/IP as the business, or included a link/phone number in the text.
- Once verified, paste the **Place ID** into `index.html` (the CTA href + a new `sameAs` entry) — the guard then reveals the button automatically.
- Re-run Google's Rich Results Test to confirm LocalBusiness + FAQPage stay valid with the review markup gone.
- Verify migration 031 actually ran in production — `/api/track` swallows DB errors and still returns 200, so a missing `page_views` table is indistinguishable from success: `npx wrangler d1 execute k9-vision-db --remote --command "SELECT COUNT(*) FROM page_views"`.

## Session 16 — Make the Visitor Geography report trustworthy
**Date:** August 15, 2026
**Team Member:** Claude CLI (Supervisor + Backend/Data leads)
**Session Focus:** User pushed back on the Session 15 closing note — "the location report is not empty in google analytics."

---

### What Was Said
Session 15 ended by suggesting migration 031 might never have run in production. The user corrected that: GA4's location report has data. Asked what to do about the first-party report, they chose **"filter the junk out"**; Google Business Profile work stays parked pending a Place ID.

### What Was Found
- **The Session 15 suggestion was wrong.** A production query confirms migration 031 ran and `page_views` holds 10 rows.
- **But the report is misleading.** All 10 rows: 3 = our own June 18 testing (`/`, `/portal`, `/admin-dashboard` from Cypress TX), 1 direct Houston, 3 Instagram (`l.instagram.com`, utm-tagged, Houston), and **3 geolocated to Meta data centers** — Prineville OR ×2 and Forest City NC ×1. The admin's Top States therefore rendered **TX 7, OR 2, NC 1**, presenting Oregon as the #2 market for a Houston dog trainer.
- **The "bot traffic" read was also wrong.** Meta's crawler does not execute JavaScript, and this beacon is JS-only *and* consent-gated, so a crawler cannot reach it. All three rows carry `referrer: https://www.facebook.com/`, which only a real browser sets. These are **real people** in Facebook's in-app browser whose traffic egresses via Meta's network. Filtering them out would have discarded 30% of the real audience — the correct treatment is to keep the visit and suppress only the location.
- **Root blocker:** `page_views` stored no user-agent and no network info, so nothing could be classified retroactively. GA4 looks healthy because it applies automatic bot filtering that cannot be disabled; the first-party beacon had none.

### What Was Done
- **New `migrations/032_page_views_classification.sql`** — adds `user_agent`, `asn`, `as_org`, `traffic_type TEXT DEFAULT 'visitor'` + `idx_page_views_traffic_type`, following the `029` ALTER-style convention. Two documented one-time backfills: `internal` by private path, `proxied` for the facebook.com-referrer OR/NC rows. Mirrored into `schema.sql`.
- **`functions/api/track/index.js`** — now captures `User-Agent`, `cf.asn`, `cf.asOrganization` (all free-plan fields; the endpoint previously read no headers at all) and classifies each view: `bot` (crawler UA) → `internal` (auth-token hint or private path) → `proxied` (Meta/datacenter ASN or as_org) → `visitor`. Private-path list kept in sync with `robots.txt`. Dropped the dead `OPTIONS` branch (`_middleware.js` answers preflight first). Classification is wrapped in the existing swallow-all-errors-return-200 behavior so it can never break the beacon.
- **`analytics.js`** — beacon now sends `internal: true` when an auth token is in localStorage, so the trainer browsing their own *public* pages is excluded too (path matching alone cannot catch that).
- **`functions/api/analytics/geo.js`** — all four queries filtered (including the previously unfiltered `total`); returns `audience` (visitor + proxied), `mapped`, and an `excluded` breakdown so nothing is silently dropped.
- **`admin-app.js` / `admin-dashboard.html`** — `#geo-total` now reads e.g. "10 views · 5 mapped · 2 yours, 3 location hidden"; the caption no longer promises "bot traffic may appear" and explains the in-app-browser case.

### How It Was Done
1. Queried production D1 directly to establish ground truth rather than reasoning from code, then checked the `referrer` column — which is what disproved the bot theory.
2. Verified externally that Meta's crawler does not run JS and that `cf.asn`/`cf.asOrganization` are free-plan fields.
3. Tested against an **isolated** local D1 (`--persist-to` a scratch dir) so the repo's `.wrangler` state stayed clean. Note `wrangler pages dev --d1` and `wrangler d1 execute --local` hash the same DB name to *different* local files — migrations had to be applied to the one the server actually opens.
4. **21/21** classifier unit tests (Meta ASN → proxied; FB in-app browser on AT&T → visitor, not proxied; bot beats all; internal beats proxied; every robots.txt path; null/undefined inputs never throw). **9/9** live `/api/track` posts with forged user-agents. **7/7** browser end-to-end (visitor / no-consent-no-row / signed-in-on-homepage → internal / `/portal` → internal). Replaying production-shaped data through the real aggregation SQL turns **TX 7, OR 2, NC 1** into **Texas 5** only.
5. Regression: Session 15's suites re-run clean — **26/26** consent, **6/6** gate, confirming the beacon still fires only after consent.

### Files Touched
**Created (1):** `migrations/032_page_views_classification.sql`.
**Modified (6):** `functions/api/track/index.js`, `functions/api/analytics/geo.js`, `analytics.js`, `admin-app.js`, `admin-dashboard.html`, `schema.sql`, plus `PROJECT_SUMMARY_PART3.md` (this entry).

### Security Impact Note
- **No new endpoint; no new external integration.** `/api/track` remains public and unauthenticated as before.
- **New data captured:** `user_agent`, `asn`, `as_org`. This is more than the table previously held, but still **no IP address and no PII** — ASN identifies a network operator, not a person. Consent gating is unchanged: nothing is recorded until the visitor opts in. Privacy policy already discloses approximate-location analytics; if user-agent retention is considered material, that section should be revisited.
- **The `internal` flag is client-supplied** and deliberately carries no security weight — it is a reporting label only, and the worst a visitor can do by forging it is exclude themselves from the trainer's own stats.
- `traffic_type` is written server-side from server-observed signals (UA header, `request.cf`), not from client claims apart from that one hint.
- **Unchanged:** auth, CORS, CSP, rate limits, `_middleware.js`, `consent.js`.

### Next Steps
- **Blocked on permission:** applying 032 to production was denied by the sandbox classifier. Run it manually:
  `npx wrangler d1 execute DB --env production --remote --file=migrations/032_page_views_classification.sql`
  then verify: `SELECT traffic_type, COUNT(*) FROM page_views GROUP BY traffic_type` → expect **2 internal, 3 proxied, 5 visitor**. Until this runs, `/api/track` INSERTs will fail (silently, HTTP 200) against the un-migrated production table — apply it before or immediately after deploying.
- **Known gaps, deliberately not addressed:** `/api/track` has no rate limit and `page_views` has no retention job (unbounded growth); the panel counts **views, not visitors** (three Houston rows 28s apart are almost certainly one person — there is no session identifier); `geo.js` still returns `countries`, which the UI discards.
- Google Business Profile work still parked pending a Place ID.

## Session 17 — Rate-limit the beacon + fix Google brand-name matching
**Date:** August 15, 2026
**Team Member:** Claude CLI (Supervisor + Backend/SEO leads)
**Session Focus:** "add rate limiting to /api/track, also when i type in k9visiontx the google profile comes up but if i type K9VISION TX the google profile does not come up"

---

### What Was Said
Two requests. Rate limiting was a gap flagged and deferred in Session 16. The Google observation came with a screenshot that changed the diagnosis materially.

### What Was Found
- **A Google Business Profile DOES exist**, overturning the Session 15 conclusion (and a research agent that searched five indexes and concluded across all of them that none did — Google blocks automated fetches, so every index was inferring). The user's screenshot is authoritative: panel name **`K9VisionTX`**, category Dog trainer, service-area (no address), hours "Open 24 hours", **no phone**, and **"Be the first to review" — zero Google reviews**.
- **This finally answers the question that opened Session 15.** "I set up a Google review and it's not showing" — the profile has no reviews at all. Likely cause: **two unrelated businesses share the name** — K9 Vision Inc. (Buffalo NY, also a dog trainer) and K9 Vision System (dog-mounted cameras, 6K IG followers) — so a reviewer searching "K9 Vision" could easily have reviewed the wrong listing.
- **The name is rendered four ways**, which is the direct cause of the query discrepancy: GBP `K9VisionTX`, site title/og/twitter/body `K9 Vision` (11x), JSON-LD `K9 Vision TX`, Yelp `K9 VISION` (4.8 stars, 16 reviews, 44 photos). Google matches brand queries against the profile name, so the unspaced token hits and the spaced one does not.
- **Rate-limiting conflict:** the shared `rate_limits.ip` column stores the **raw IP**. Acceptable for login/contact; not for a beacon firing on every page load, since `privacy-policy.html` states "We do **not** store your raw IP address" and `track/index.js` says "No IP or PII is stored."

### What Was Done
- **`functions/api/track/index.js`** — added `hashIp()` using `crypto.subtle` + `TextEncoder` (the repo's existing convention from `utils/auth.js`), producing `SHA-256(JWT_SECRET + ':' + ip)` hex. Rate limiting reuses `checkRateLimit` unmodified at **30/min per hashed IP**, action `track`, via the established dynamic `await import()` inside a **fail-open** try. Returns **429 + Retry-After** when exceeded. The salt is load-bearing: unsalted SHA-256 of an IPv4 is brute-forceable in seconds (~4 billion inputs).
- **`privacy-policy.html`** — discloses the one-way, irreversible IP-derived fingerprint, deleted within the hour. Keeps the "no raw IP" statement literally true.
- **`index.html`** — JSON-LD `name` -> **"K9 Vision"** (matching the profile's planned rename, the logo, Yelp, and the site's own 11 mentions); added `alternateName: ["K9VisionTX", "K9 Vision TX", "K9 Vision Houston", "K9 Vision Dog Training"]` so Google can tell the spellings are one entity; **removed the empty `"telephone": ""`** (an empty string asserts a blank value — worse than an absent key; the no-phone decision stands). Replaced the stale "profile may not exist" comment with the confirmed state and the name-collision warning.

### How It Was Done
1. Treated the screenshot as ground truth over the research agent's confident-but-inferred conclusion.
2. Deliberately did **not** modify `checkRateLimit` — four other call sites depend on it. Only the value passed in changed.
3. **11/11** `hashIp` unit tests (deterministic, salt-sensitive, 64-char hex, contains no dotted-quad, never throws on missing salt / IPv6 / 'unknown'). **35 live POSTs -> exactly 30x200 then 5x429**, with `page_views` holding exactly 30 rows, proving throttled requests insert nothing. Verified `rate_limits` holds **30 hex digests and zero dotted-quad IPs**. Dropped `rate_limits` and confirmed the beacon still records (fails open). Full regression: **21/21** classifier, **7/7** track e2e, **26/26** consent, **6/6** gate — none of their many page loads throttled.

### Files Touched
**Modified (4):** `functions/api/track/index.js`, `privacy-policy.html`, `index.html`, `PROJECT_SUMMARY_PART3.md` (this entry).

### Security Impact Note
- **No new endpoint.** `/api/track` stays public and unauthenticated, but is now throttled at 30/min per hashed IP, closing the unbounded-insert abuse vector flagged in Session 16.
- **Privacy improved, not degraded.** The site's first per-visitor abuse record stores a salted one-way digest, never an IP, and expires within the hour via the existing cleanup. Disclosed in the privacy policy. Both published "no raw IP" claims remain literally true — verified by grepping the column for dotted-quads (zero found).
- **Salt** is `env.JWT_SECRET` with a constant fallback for local dev. Reusing the auth secret as a hash salt is pragmatic but not ideal; a dedicated `TRACK_SALT` var would be cleaner if ever rotated independently.
- **Fails open by design** — a missing `rate_limits` table or hashing error records the view rather than dropping it. Availability favored over throttling, matching `/api/contact`.
- **Unchanged:** auth, CORS, CSP, `_middleware.js`, `consent.js`, `rate-limit.js`, DB schema (no migration needed — `rate_limits` already exists from 030).

### Next Steps
- **Owner, off-code:** rename the profile to **"K9 Vision"** (Google requires the real-world name; URL-style names risk suspension — expect brief re-verification). Hunt the missing review on the Buffalo / camera-company listings. Fill the profile out (photos, service areas matching `areaServed`, reconsider "Open 24 hours", secondary category Pet boarding service). **Ask past clients for Google reviews — Yelp has 16, Google has 0**, which is the single biggest reason competitors win the local pack.
- **Place ID obtained and wired in — no longer blocked.** The owner first supplied a 20-digit **Business Profile ID** (`55687547460846647028`). That is *not* usable for a review link: `writereview` accepts only a `ChIJ…` Place ID, and the number is not even a valid CID — at 20 digits it exceeds the 64-bit maximum (`18446744073709551615`) by more than 3×. It was **not** written into the site, since a wrong ID would send customers to another business — a live risk given the three same-named companies. It is, however, exactly the identifier Google Support asks for, so it is worth keeping for the missing-review ticket.
  The owner then supplied the profile's own "Ask for reviews" short link, `https://g.page/r/Cck-Riu4E4RNEBM/review`, which **302-redirects** to `search.google.com/local/writereview?placeid=`**`ChIJVwB6YhFTAa4RyT5GK7gThE0`** — authoritative by construction. Wired into `#google-review-cta` and into `sameAs` as `https://www.google.com/maps/place/?q=place_id:ChIJVwB6YhFTAa4RyT5GK7gThE0`. The placeholder guard in the DOMContentLoaded block was removed as dead code, so the button now renders. Verified: **10/10** CTA checks (renders, visible, real Place ID, `target=_blank` + `noopener`, fires `cta_click`/`review_google`, shares the flex row with the Yelp button) and the consent suite's obsolete "CTA hidden" assertion was updated, taking it to **27/27**.
- **Social profiles added to `sameAs`:** `https://www.instagram.com/k9vision_ag/` (verified HTTP 200) and `https://www.facebook.com/charles.goodman.58`. Facebook could not be verified programmatically — a control test showed FB returns HTTP 400 to unauthenticated bots for a valid page, an invalid handle, and this URL alike, so the status carries no information. **Caveat recorded in the schema comment:** the Facebook entry is a *personal profile*, not a business Page. `sameAs` is meant to list other URLs for the same entity, so a Page would be a cleaner signal and should be swapped in if one is created.
- Still open: `page_views` retention (rate limiting caps the rate, not lifetime growth); views vs unique visitors.
