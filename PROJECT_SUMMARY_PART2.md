# K9 Vision - Project Summary Part 2
**Date:** February 16, 2026
**Session Focus:** Business Management System + Production Deployment
**Live URL:** https://k9visiontx.com

---

## What Was Done This Session

### 1. Invoicing System (New)
- Created full invoice creation flow with dynamic line items
- Invoice number auto-generated: YY + DD + Client initials + Dog initials
- Manual tax rate entry per invoice with real-time total calculation
- Invoice status tracking: pending / paid / overdue / cancelled
- Email delivery of branded HTML invoices via Resend API
- **Files added:**
  - `functions/api/invoices/index.js` — List/create invoices
  - `functions/api/invoices/[id].js` — Get/update/delete invoice
  - `functions/api/invoices/[id]/email.js` — Email invoice to client

### 2. Services Management (New)
- CRUD for training services catalog (name, description, price)
- Soft delete (sets `active = 0`) to preserve historical invoice data
- 6 default services pre-loaded (Puppy Foundation, Obedience, Board & Train, etc.)
- Services populate the dropdown in invoice creation
- **Files added:**
  - `functions/api/services/index.js` — List/create services
  - `functions/api/services/[id].js` — Get/update/delete service

### 3. Client Creation with Email (New)
- Admin can create client accounts with auto-generated or manual passwords
- Welcome email sent with login credentials (branded HTML template)
- Username auto-generated from client name if not specified
- **File added:**
  - `functions/api/clients/create-with-email.js`

### 4. Database Migrations
- Added `email` field to clients table
- Created `services` table with 6 default entries
- Created `invoices` table (invoice_number, client_id, trainer_name, dates, totals, status)
- Created `invoice_items` table (line items with service references)
- **Files added:**
  - `migrations/001_add_client_fields.sql`
  - `migrations/002_add_email_and_new_tables.sql`

### 5. Admin Dashboard Overhaul
- Expanded quick actions from 4 to 8 buttons
- Added modals: Create Client, Manage Services, Create Invoice, View Invoices
- Credentials display after client creation
- Dynamic service selection in invoice form
- Real-time invoice total calculations
- **File modified:** `admin-dashboard.html` (+612 lines)

### 6. Security Fix
- Removed exposed login credentials from `portal.html` (previously showed admin/client passwords in plaintext)

### 7. Email Integration Setup
- Integrated Resend API for transactional emails
- From address: `trainercg@k9visiontx.com`
- Templates: Welcome emails (credentials) + Invoice emails (branded HTML)
- **Documentation added:** `RESEND_SETUP.md`

### 8. Cleanup
- Removed unused Yelp reviews API endpoint (`functions/api/yelp/reviews.js` deleted)
- Updated `wrangler.toml` configuration
- Updated `schema.sql` with all new tables

### 9. Production Deployment
- Committed all changes: `a6e93a109`
- Pushed to GitHub: `https://github.com/k9vision/k9siteCG`
- Deployed to Cloudflare Pages: `npx wrangler pages deploy . --project-name=k9sitecg`
- Deployment ID: `e2f5cd18`
- Live at: `https://k9visiontx.com`

---

## Summary of Changes

| Category | Files Added | Files Modified | Files Deleted | Lines Changed |
|----------|------------|----------------|---------------|---------------|
| API Endpoints | 6 | 0 | 1 | +876 / -76 |
| Frontend | 0 | 2 | 0 | +612 / -5 |
| Database | 2 | 1 | 0 | +182 |
| Documentation | 1 | 1 | 0 | +627 |
| Config | 0 | 1 | 0 | +4 / -4 |
| **Total** | **9** | **5** | **1** | **+2,257 / -125** |

---

## New API Endpoints (8 total)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/services` | Public | List active services |
| POST | `/api/services` | Admin | Create service |
| GET/PUT/DELETE | `/api/services/[id]` | Admin | Manage service |
| GET | `/api/invoices` | Admin | List all invoices |
| POST | `/api/invoices` | Admin | Create invoice |
| GET/PUT/DELETE | `/api/invoices/[id]` | Admin | Manage invoice |
| POST | `/api/invoices/[id]/email` | Admin | Email invoice |
| POST | `/api/clients/create-with-email` | Admin | Create client + send credentials |

---

## New Database Tables (3 total)

- **services** — Training service catalog (name, description, price, active flag)
- **invoices** — Invoice records (number, client, trainer, dates, totals, status)
- **invoice_items** — Line items per invoice (service reference, quantity, price)

---

## Deployment Details

```
Commit:      a6e93a109
Deploy ID:   e2f5cd18
Upload:      46 files (2 new, 44 cached)
Duration:    ~2 seconds
URL:         https://e2f5cd18.k9sitecg.pages.dev
Production:  https://k9visiontx.com
```

---

## What's Next (from Session 5)

1. Set `RESEND_API_KEY` secret in Cloudflare dashboard for email functionality
2. Test client creation with email delivery
3. Create and email first invoice
4. Consider Stripe integration for online payments
5. Consider Brevo for SMS notifications and marketing campaigns

---
---

## Session 6 — Google Calendar Sync + iCal Feed Integration
**Date:** March 6, 2026
**Session Focus:** Calendar sync so appointments, availability, and blocked dates appear on phone calendars (Android + iPhone)

---

### What Was Done

#### 1. Database Migration (New)
- Created `migrations/008_calendar_integration.sql` with 3 new tables:
  - **google_calendar_tokens** — Stores Google OAuth access/refresh tokens per user (user_id UNIQUE, auto-refresh on expiry)
  - **calendar_event_sync** — Maps local entities (appointment, availability, blocked_date) to Google Calendar event IDs for update/delete tracking
  - **ical_feed_tokens** — Stores cryptographic feed tokens for public iCal URLs (one per user, no JWT needed)

#### 2. Google Calendar API Utility (New)
- **File:** `functions/utils/gcal.js`
- Token management: `getValidAccessToken()` reads from DB, auto-refreshes via Google OAuth2 token endpoint if expired (60s buffer), updates DB
- CRUD operations: `createCalendarEvent()`, `updateCalendarEvent()`, `deleteCalendarEvent()` — all call Google Calendar API v3
- Sync functions (fire-and-forget, never block primary operations):
  - `syncAppointmentToGoogle()` — Creates events on both admin + client calendars (if connected), stores mapping in calendar_event_sync
  - `syncAvailabilityToGoogle()` — Creates availability events on admin's calendar. Recurring slots (day_of_week) generate events for next 4 weeks; specific_date slots create one event
  - `syncBlockedDateToGoogle()` — Creates "Blocked - {reason}" events on admin's calendar (all-day or timed)
  - `removeSyncedEvents()` — Finds all sync records for an entity, deletes Google events, cleans up DB rows
- Timezone: `America/Chicago` (Houston, TX)
- All sync functions wrapped in try/catch — failures log to console but never throw

#### 3. iCal Feed Generator (New)
- **File:** `functions/utils/ical.js`
- `generateIcalFeed(db, userId, role)` produces RFC 5545 compliant VCALENDAR strings
- **Admin feeds include:** All appointments (pending/confirmed) + availability slots (recurring expanded to 4 weeks + specific_date one-offs) + blocked dates (all-day and timed)
- **Client feeds include:** Only their own appointments
- Uses `TZID=America/Chicago`, proper `DTSTART`/`DTEND` formatting, unique UIDs per entity (`appointment-{id}@k9visiontx.com`)
- All-day blocked dates use `VALUE=DATE` with DTEND set to next day per RFC 5545 spec

#### 4. Google OAuth API Endpoints (4 new files)
| File | Method | Auth | Purpose |
|------|--------|------|---------|
| `functions/api/calendar/google/auth-url.js` | GET | requireAuth | Builds Google OAuth URL with JWT as `state` param, scope `calendar.events`, `access_type: offline`, `prompt: consent` |
| `functions/api/calendar/google/callback.js` | GET | Public (JWT in state) | Exchanges auth code for tokens via Google token endpoint, stores in `google_calendar_tokens` (INSERT OR REPLACE), redirects to correct dashboard with `?gcal=connected` |
| `functions/api/calendar/google/disconnect.js` | DELETE | requireAuth | Revokes token at Google (fire-and-forget), deletes `google_calendar_tokens` + `calendar_event_sync` rows for user |
| `functions/api/calendar/google/status.js` | GET | requireAuth | Returns `{ connected: true/false, calendar_id }` by checking if token row exists |

- **OAuth scope:** `https://www.googleapis.com/auth/calendar.events` (events only, not full calendar)
- **Redirect URI:** `https://k9visiontx.com/api/calendar/google/callback`

#### 5. iCal Feed API Endpoints (2 new files)
| File | Method | Auth | Purpose |
|------|--------|------|---------|
| `functions/api/calendar/feed/generate.js` | POST | requireAuth | Creates/returns feed token using `generateSecureToken()` from `functions/utils/tokens.js`. Returns existing token if one already exists. Response: `{ feed_url, token }` |
| `functions/api/calendar/feed/[token].js` | GET | Public (token-based) | Looks up token in `ical_feed_tokens` joined with `users` for role, calls `generateIcalFeed()`, returns `.ics` with `Content-Type: text/calendar`, `Cache-Control: no-cache` |

- Feed URL format: `https://k9visiontx.com/api/calendar/feed/{token}`
- 48-byte cryptographic token serves as auth (no JWT needed for feed URLs)

#### 6. Sync Hooks in Existing Endpoints (7 files modified)
All hooks use dynamic `import()` and try/catch — sync failures never block the primary operation.

| Trigger | File | Hook Added |
|---------|------|------------|
| Appointment created | `functions/api/appointments/index.js` (POST) | `syncAppointmentToGoogle()` for admin + client |
| Appointment cancelled | `functions/api/appointments/[id].js` (PUT) | `removeSyncedEvents('appointment', id)` |
| Appointment deleted | `functions/api/appointments/[id].js` (DELETE) | `removeSyncedEvents('appointment', id)` |
| Availability created | `functions/api/availability/index.js` (POST) | `syncAvailabilityToGoogle()` on admin's calendar |
| Availability deleted | `functions/api/availability/[id].js` (DELETE) | `removeSyncedEvents('availability', id)` |
| Date blocked | `functions/api/availability/blocked.js` (POST) | `syncBlockedDateToGoogle()` on admin's calendar |
| Date unblocked | `functions/api/availability/blocked/[id].js` (DELETE) | `removeSyncedEvents('blocked_date', id)` |

#### 7. Admin Dashboard UI (Modified)
- **File:** `admin-dashboard.html`
- Added gear/settings icon button next to "Schedule Management" header
- New **Calendar Settings Modal** with:
  - **Google Calendar section:** Connect button (redirects to Google OAuth) / "Connected" status + Disconnect button
  - **iCal Feed section:** "Get Feed URL" button → generates token → shows copyable URL with clipboard button
- JS functions: `openCalendarSettings`, `closeCalendarSettings`, `checkGoogleCalendarStatus`, `connectGoogleCalendar`, `disconnectGoogleCalendar`, `generateIcalFeed`, `copyIcalUrl`
- Handles `?gcal=connected` URL param on page load (shows success alert, cleans URL)

#### 8. Client Dashboard UI (Modified)
- **File:** `client-dashboard.html`
- New **"Sync to Your Calendar"** card placed between appointments and invoices sections
- Same two options: Google Calendar connect/disconnect + iCal feed subscribe with copyable URL
- Client-prefixed JS functions to avoid naming collisions
- Status check on page load + OAuth callback handling

---

### How It Was Done

1. **Architecture:** Two parallel sync paths — Google Calendar API for real-time two-way sync, iCal (.ics) feed as universal fallback for any calendar app
2. **Google OAuth flow:** User clicks Connect → frontend calls `/api/calendar/google/auth-url` → server returns Google OAuth URL with JWT as state → user authorizes → Google redirects to `/api/calendar/google/callback` → server exchanges code for tokens, stores in DB, redirects to dashboard
3. **Sync approach:** Fire-and-forget — every sync call is wrapped in try/catch so calendar sync failures never block appointment booking, availability changes, or date blocking
4. **iCal feeds:** Token-based public URLs (no JWT needed) — calendar apps poll the URL and get fresh data each time. Admin sees everything, clients see only their appointments
5. **Implementation:** Parallelized across 3 agents — backend (migration + gcal utility + OAuth endpoints + sync hooks), data/infra (iCal utility + feed endpoints), frontend (both dashboard UIs)

---

### Summary of Changes (Session 6)

| Category | Files Added | Files Modified | Lines Changed (approx) |
|----------|------------|----------------|------------------------|
| Database Migration | 1 | 0 | +34 |
| Utility Modules | 2 | 0 | +436 |
| API Endpoints | 6 | 0 | +214 |
| Sync Hooks | 0 | 7 | +56 |
| Frontend UI | 0 | 2 | +200 |
| **Total** | **9** | **9** | **~940** |

---

### New API Endpoints (Session 6 — 6 total)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/calendar/google/auth-url` | JWT | Get Google OAuth URL |
| GET | `/api/calendar/google/callback` | Public (state=JWT) | OAuth code exchange |
| DELETE | `/api/calendar/google/disconnect` | JWT | Disconnect Google Calendar |
| GET | `/api/calendar/google/status` | JWT | Check connection status |
| POST | `/api/calendar/feed/generate` | JWT | Create/get iCal feed URL |
| GET | `/api/calendar/feed/[token]` | Public (token) | Serve .ics feed |

---

### New Database Tables (Session 6 — 3 total)

- **google_calendar_tokens** — OAuth tokens per user (access_token, refresh_token, expiry, calendar_id)
- **calendar_event_sync** — Entity-to-Google-event mapping (entity_type, entity_id, google_event_id)
- **ical_feed_tokens** — Public feed URL tokens (feed_token UNIQUE per user)

---

### What's Next — One-Time Setup Steps

#### 1. Google Cloud Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing) named "K9 Vision Dog Training"
3. Enable the **Google Calendar API** (APIs & Services → Library → search "Calendar API" → Enable)
4. Configure **OAuth consent screen** (APIs & Services → OAuth consent screen):
   - App name: `K9 Vision Dog Training`
   - Authorized domain: `k9visiontx.com`
   - Scope: `https://www.googleapis.com/auth/calendar.events`
   - Publishing status: Testing (supports up to 100 users — more than enough)
5. Create **OAuth 2.0 Client ID** (APIs & Services → Credentials → Create Credentials → OAuth client ID):
   - Application type: Web application
   - Name: `K9 Vision Calendar Sync`
   - Authorized redirect URI: `https://k9visiontx.com/api/calendar/google/callback`
6. Copy the **Client ID** and **Client Secret**

#### 2. Cloudflare Secrets
Run these commands to set the Google OAuth credentials as Cloudflare secrets:
```bash
npx wrangler secret put GOOGLE_CLIENT_ID
# Paste the Client ID from Google Cloud Console

npx wrangler secret put GOOGLE_CLIENT_SECRET
# Paste the Client Secret from Google Cloud Console
```

#### 3. Run Database Migration
```bash
# Local (for dev testing)
npx wrangler d1 execute k9-vision-db --file=migrations/008_calendar_integration.sql --local

# Remote (production)
npx wrangler d1 execute DB --file=migrations/008_calendar_integration.sql --remote
```

#### 4. Deploy
```bash
# Push to GitHub (auto-deploys via Cloudflare Pages)
git add -A && git commit -m "Add Google Calendar sync + iCal feed integration" && git push

# Or manual deploy
npx wrangler pages deploy . --project-name=k9sitecg
```

#### 5. Verification Checklist
- [ ] Admin: Connect Google Calendar → set availability → verify events appear on phone
- [ ] Admin: Block a date → verify "Blocked" event appears on Google Calendar
- [ ] Client: Book appointment → verify it appears on both admin and client phone calendars
- [ ] Client: Subscribe to iCal feed URL → verify appointments appear in calendar app
- [ ] Cancel an appointment → verify Google Calendar events are removed
- [ ] Disconnect Google Calendar → verify clean disconnection

#### 6. Other Pending Items
- Set `RESEND_API_KEY` secret if not already done
- Consider Stripe integration for online payments
- Consider Brevo for SMS notifications

---
---

## Session 7 — Major Platform Overhaul: Non-Client Support, Appointments, Reviews, Invoicing, Notifications
**Date:** March 22-23, 2026
**Time:** ~6-hour session (evening through early morning)
**Session Focus:** 11 commits addressing appointment system, video uploads, invoicing, email notifications, non-client workflows, review system, and responsive UX
**Commits:** `7e966a6` through `c117d74`

---

### What Was Done

#### 1. Appointment Booking + Client Confirmation Flow
**Commit:** `7e966a6` | **Time:** ~6:00 PM, March 22
- **What:** Fixed video upload MIME type rejection (WebM codec suffix), added client appointment confirmation, admin "Book Appointment" modal
- **Why:** Video uploads failed because `video/webm;codecs=vp9,opus` didn't match the exact `video/webm` MIME check. Clients couldn't confirm appointments created by admin. Admin had no UI to create appointments for clients.
- **How:** Strip codec suffix before MIME validation. Allow clients to set status to 'confirmed' (was restricted to 'cancelled' only). New Book Appointment modal with client/date/slot/service selection. Email sent to client asking them to confirm.
- **Files:** `functions/api/media/upload.js`, `functions/api/appointments/[id].js`, `admin-dashboard.html`, `client-dashboard.html`, `functions/utils/emails.js`

#### 2. Five Platform Improvements
**Commit:** `a3b7a9e` | **Time:** ~6:30 PM, March 22
- **What:** Video display names, cross-platform playback, default availability, multi-select media picker for notes, non-client invoicing, auto-email invoices
- **Why:** Video filenames showed ugly timestamps. No availability meant clients couldn't book. Notes only allowed one media attachment. No way to invoice non-clients. Invoices weren't auto-emailed.
- **How:**
  - Friendly display names (`Video 1`, `Photo 2`) + `<source>` tags with `playsinline` for iOS
  - Default 8AM-6PM availability when no slots configured (all 7 days)
  - Multi-select media picker with Select All / Clear All
  - Invoice non-client toggle with recipient_email/recipient_name fields (migration 015)
  - Auto-email invoice with PDF on creation
- **Migrations:** `014_notes_multi_media.sql`, `015_invoice_recipient.sql`
- **Files:** 10 files modified across frontend and backend

#### 3. Admin Custom Time Booking + Email Notifications + Invoice Item Status
**Commit:** `c14ef6d` | **Time:** ~7:15 PM, March 22
- **What:** Admin can type custom start/end time for appointments (not just pre-set slots). Email notifications for notes/fun facts/media. Per-item paid/pending status on invoices.
- **Why:** Admin needed flexibility to book any time. Fun facts had no email notification. Invoice items needed individual payment tracking.
- **How:**
  - Time inputs alongside slot buttons; `admin_override` flag bypasses availability checks; conflict warning dialog
  - New `funFactAddedHtml` email template; enhanced note email with content preview; enhanced media email with type+caption
  - Migration 016: `status` column on `invoice_items`; toggle buttons in detail view; confirm dialog for email notification
- **Migration:** `016_invoice_item_status.sql`

#### 4. Password Security Warnings + Note Media Capture
**Commit:** `d9c0a2b` | **Time:** ~7:45 PM, March 22
- **What:** All credential/invite/reset emails now warn about unique passwords. Client note modal has Take Photo / Record Video / Upload File buttons.
- **Why:** Security best practice — clients should use unique passwords. Clients couldn't capture new media within the note flow.
- **How:** Updated `generateWelcomeEmail`, `inviteEmailHtml`, `resetEmailHtml` with security tip text. Added `noteMediaPending` flag and capture buttons that auto-attach new media to the note.

#### 5. Video Filename Fix + Review Request System
**Commit:** `82dc472` | **Time:** ~8:30 PM, March 22
- **What:** Training Conversation now shows original filenames instead of hashes. Full review request and management system.
- **Why:** Videos showed `1774220891763-2exzy.mp4` instead of the original name. No way to collect and manage client reviews.
- **How:**
  - Added `original_name` to notes media query; frontend prefers `caption || original_name || 'Video'`
  - New: `reviews` + `review_tokens` DB tables (migration 017), review submission page (`review.html`), 3 API endpoints (`/api/reviews/request`, `/api/reviews/submit`, `/api/reviews/index`), admin Manage Reviews section, dynamic approved reviews on homepage
- **Migration:** `017_reviews.sql`
- **New files:** `review.html`, `functions/api/reviews/request.js`, `functions/api/reviews/submit.js`, `functions/api/reviews/index.js`

#### 6. Appointment Email Notification Gaps Fixed
**Commit:** `01993a3` | **Time:** ~9:15 PM, March 22
- **What:** Fixed ALL missing email notifications for appointment status changes
- **Why:** Client cancellation sent NO email to anyone. Client confirmation didn't email client back. Reschedule sent NO emails. Admin deletion was silent.
- **How:** New `appointmentCancelledHtml` and `appointmentRescheduledHtml` templates. Complete rewrite of notification logic in `[id].js` with `getClientInfo()`/`getClientEmail()` helpers. Every action now emails both parties appropriately.

#### 7. Five Admin Dashboard Fixes
**Commit:** `e9d6dce` | **Time:** ~10:00 PM, March 22
- **What:** Invoice item status toggle UX (3-option flow), non-client invoice null safety, "Also email to" fields, admin note media capture, client detail responsive fix
- **Why:** Status toggle had no "keep as is" option. Invoice crashed on null data. Notes/facts/media couldn't email non-clients. Admin couldn't capture photos in note modal. Client detail broke on zoom.
- **How:** 2-step confirm dialog. `Number()` wrappers on `.toFixed()`. "Also email to" optional fields. File input capture buttons. Responsive grid breakpoints + `max-h-[95vh]`.

#### 8. True Non-Client Support
**Commit:** `74ce166` | **Time:** ~10:45 PM, March 22
- **What:** Notes, fun facts, and media can now be sent to non-clients via email without selecting a client
- **Why:** All three modals required client selection (client_id NOT NULL). Admin needed to send content to non-clients.
- **How:** Non-client toggle on each modal. When toggled, client dropdown hides, email field appears. Calls new `/api/email/send-content` endpoint that sends styled email without DB storage. New `genericContentEmailHtml` template.
- **New file:** `functions/api/email/send-content.js`

#### 9. Non-Client Media Attachment + Appointments
**Commit:** `d075c52` | **Time:** ~11:15 PM, March 22
- **What:** Non-client media email now includes the actual file as attachment. Non-client appointment booking with confirm/reschedule/cancel buttons.
- **Why:** Media email was text-only. Appointments required a client.
- **How:** Frontend reads file as base64 via `FileReader`, sends as attachment to `send-content.js`. Appointment modal has non-client toggle; sends email with date/time/service and mailto action buttons (Confirm/Reschedule/Cancel).

#### 10. Non-Client Invoice DB Storage
**Commits:** `843d60a`, `c117d74` | **Time:** ~12:00 AM - 12:30 AM, March 23
- **What:** Non-client invoices now stored in DB, appear in View Invoices, are deletable and editable
- **Why:** Non-client invoices were email-only (bypassed DB) so they disappeared after sending. Admin needed to track all invoices.
- **How:** Migration 018 recreates `invoices` table with `client_id INTEGER` (nullable, was NOT NULL). Unified single INSERT flow: `client_id = NULL` for non-clients. All downstream queries already used LEFT JOIN + COALESCE.
- **Migration:** `018_invoices_nullable_client.sql`

---

### How It Was Done

1. **Iterative development:** Each feature was planned, implemented, tested via deployment, and refined based on admin feedback in real-time
2. **Database evolution:** 5 new migrations (014-018) extending the schema without breaking existing data
3. **Non-client pattern:** Three approaches tried — (a) "also email to" field (insufficient), (b) email-only bypass (lost data), (c) nullable client_id + unified flow (final solution)
4. **Email templates:** 6 new Resend HTML templates added: cancellation, reschedule, fun fact, invoice item status, generic content, review request
5. **Cloudflare Pages auto-deploy:** Every `git push origin main` triggered automatic deployment. 11 deployments verified via `wrangler pages deployment list`
6. **Plan mode workflow:** Each feature set was explored, planned, approved, then implemented — ensuring alignment before coding

---

### Summary of Changes (Session 7)

| Category | Files Added | Files Modified | Approx Lines Changed |
|----------|------------|----------------|----------------------|
| API Endpoints | 5 | 8 | +1,200 |
| Frontend (admin) | 0 | 1 | +800 |
| Frontend (client) | 0 | 1 | +200 |
| Frontend (public) | 1 (review.html) | 1 (index.html) | +200 |
| Email Templates | 0 | 1 (emails.js) | +250 |
| Utilities | 0 | 1 (invoice-pdf.js) | +20 |
| Migrations | 5 | 0 | +50 |
| Config | 0 | 1 (_redirects) | +1 |
| **Total** | **11** | **14** | **~2,720** |

---

### New/Modified API Endpoints (Session 7)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/email/send-content` | Admin | Send email to any address (non-client support) |
| POST | `/api/reviews/request` | Admin | Send review request email with token link |
| POST | `/api/reviews/submit` | Public (token) | Submit review via token-validated form |
| GET/PUT | `/api/reviews` | Public (approved) / Admin (all) | List + manage reviews |
| GET | `/api/appointments/available-slots` | Auth | Now returns default 8AM-6PM if no slots configured |

---

### New Database Tables (Session 7)

| Table | Migration | Purpose |
|-------|-----------|---------|
| `reviews` | 017 | Client/non-client reviews with approval workflow |
| `review_tokens` | 017 | 30-day tokens for review submission links |

### Schema Changes (Session 7)

| Change | Migration | Impact |
|--------|-----------|--------|
| `notes.media_ids TEXT` | 014 | Multi-media support (JSON array) |
| `invoices.recipient_email TEXT` | 015 | Non-client invoice email |
| `invoices.recipient_name TEXT` | 015 | Non-client invoice name |
| `invoice_items.status TEXT` | 016 | Per-item paid/pending tracking |
| `invoices.client_id` nullable | 018 | Non-client invoices stored in DB |

---

### New Email Templates (Session 7)

| Template | Trigger | Recipient |
|----------|---------|-----------|
| `appointmentCancelledHtml` | Appointment cancelled | Client + Admin |
| `appointmentRescheduledHtml` | Appointment rescheduled | Client + Admin |
| `appointmentPendingConfirmHtml` | Admin books for client | Client |
| `funFactAddedHtml` | Fun fact created | Client |
| `invoiceItemStatusHtml` | Line item status toggle | Client |
| `genericContentEmailHtml` | Non-client note/fact/media/appointment | Any email |
| `reviewRequestHtml` | Admin sends review request | Client/non-client |

---

### Deployment Log (Session 7)

| # | Commit | Deploy ID | Status |
|---|--------|-----------|--------|
| 1 | `7e966a6` | `0049e45f` | Deployed |
| 2 | `a3b7a9e` | `3519fc64` | Deployed |
| 3 | `c14ef6d` | `076d5014` | Deployed |
| 4 | `d9c0a2b` | `758b9973` | Deployed |
| 5 | `82dc472` | `27b47b18` | Deployed |
| 6 | `01993a3` | `a0de958d` | Deployed |
| 7 | `e9d6dce` | `9dbd147c` | Deployed |
| 8 | `74ce166` | `ace6e7a2` | Deployed |
| 9 | `d075c52` | `97c32f6f` | Deployed |
| 10 | `843d60a` | `1efef5dd` | Deployed |
| 11 | `c117d74` | `ba361bb4` | Active (Production) |

---

### Improvements Needed Going Forward

#### High Priority
1. **Stripe/Payment Integration** — Allow clients to pay invoices online directly from the invoice email or dashboard
2. **SMS Notifications** — Brevo or Twilio for appointment reminders and status updates (not everyone checks email)
3. **Invoice PDF Download on Client Dashboard** — Clients can view invoice details but PDF download button needs verification
4. **Admin Dashboard Mobile Optimization** — While responsive fixes were made, full mobile-first audit needed for smaller screens

#### Medium Priority
5. **Review System Enhancement** — Add star ratings display to Yelp-style carousel; allow admin to edit approved reviews; auto-request review after completed appointment
6. **Non-Client Contact Management** — Currently non-client notes/facts bypass DB. Consider a lightweight `contacts` table for tracking non-client interactions
7. **Appointment Reminders** — Automated email reminders 24 hours before appointments
8. **Invoice Payment Status Sync** — When all line items are marked "paid", prompt to auto-update invoice status

#### Lower Priority
9. **Google Calendar Sync Verification** — Session 6 added the integration but setup steps (Google Cloud Console credentials) may still be pending
10. **Media Gallery Improvements** — Bulk delete, drag-and-drop reordering, album organization
11. **Training Progress Tracking** — The `training_progress` table exists (migration 013) but UI integration may be incomplete
12. **Client Self-Service** — Allow clients to update their own profile info, add dogs, and manage preferences
13. **Reporting Dashboard** — Revenue tracking, appointment analytics, client activity metrics for admin
14. **Dark Mode Polish** — Some newer UI elements may need dark/light mode consistency check

---
---

## Session 8 — 8-Feature Build: Mobile, Milestones, Contacts, Reports, Reminders, Bulk Delete, Password Change, PDF Fix
**Date:** March 23, 2026
**Time:** 4:00 AM – 5:15 AM CDT
**Session Focus:** Implemented all 8 items from the Session 7 "Improvements Needed" list in a single session across 4 phases
**Commit:** `0e8bf3d` | **Deploy ID:** `ca120b81` | **Status:** Active (Production)

---

### What Was Done

#### 1. Invoice PDF Download — Page Break + Notes Wrapping Fix
**Phase:** 1A (Quick Win) | **Files:** `client-dashboard.html`
- **What:** Added multi-page support and word-wrapped notes to client-side PDF generation
- **Why:** Invoices with many line items or long notes would overflow the single page, cutting off content. Previously at lines 2143-2224 with no page-break handling.
- **How:** Introduced `currentPage` variable that creates a new PDF page when `y < 80`. Notes text now word-wraps using `font.widthOfTextAtSize()` to measure line width and break at page width minus margins. Footer renders on the last page only.

#### 2. Admin Dashboard Mobile Optimization
**Phase:** 1B (Quick Win) | **Files:** `admin-dashboard.html`
- **What:** Fixed 10+ hardcoded grid layouts that broke on mobile screens (375px)
- **Why:** Several grids used `grid-cols-3`, `grid-cols-5`, `grid-cols-7` with no responsive fallback. Modals had no side margins on small screens. Calendar grid was unscrollable at narrow widths.
- **How:**
  - Appointment slots: `grid-cols-3` → `grid-cols-2 sm:grid-cols-3`
  - Time inputs: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`
  - Dog form inputs: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`
  - Invoice items (both static and JS-generated): `grid-cols-5` → `grid-cols-2 sm:grid-cols-5`
  - Dog display/edit grids: `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`
  - Invoice recipient fields: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`
  - Calendar: wrapped in `overflow-x-auto` with `min-w-[320px]`
  - All modals: added `mx-2 sm:mx-auto` margins and `p-4 sm:p-8` padding

#### 3. Training Progress — Admin UI Integration
**Phase:** 1C (Quick Win) | **Files:** `admin-dashboard.html`
- **What:** Built full milestone management UI in admin client detail modal (schema + API already existed from migration 013)
- **Why:** The `training_milestones` table and `/api/milestones` CRUD endpoints existed but admin had no UI to create, view, update, or delete milestones. Client dashboard UI was already built.
- **How:**
  - Added "Training Progress" section after Fun Facts in client detail modal
  - Progress bar showing `X/Y completed (Z%)` with animated green fill
  - "Add Milestone" form with title, description, and status dropdown (not_started / in_progress / completed)
  - Each milestone renders with status icon, inline status dropdown for quick updates, and delete button
  - JS functions: `toggleMilestoneForm()`, `renderMilestones()`, `createMilestone()`, `updateMilestoneStatus()`, `deleteMilestone()`, `refreshMilestones()`
  - Milestones loaded in parallel with dogs/media/notes/fun-facts via `Promise.all`

#### 4. Client Password Change
**Phase:** 2A (Client Experience) | **Files:** `functions/api/auth/change-password.js` (new), `client-dashboard.html`
- **What:** Replaced email-based password reset with inline password change modal
- **Why:** Previous flow sent a reset link via `/api/auth/forgot-password` which required email round-trip. Clients needed to change passwords directly from their dashboard.
- **How:**
  - New endpoint `POST /api/auth/change-password`: accepts `current_password` + `new_password`, verifies current with bcryptjs, hashes new password (10 salt rounds), updates `users` table
  - Modal with three fields: current password, new password, confirm new password
  - Client-side validation: all fields required, min 8 chars, passwords must match
  - Error display inline in modal; success toast on completion

#### 5. Media Bulk Delete
**Phase:** 2B (Client Experience) | **Files:** `functions/api/media/bulk-delete.js` (new), `admin-dashboard.html`, `client-dashboard.html`
- **What:** Multi-select mode with checkboxes and bulk delete on both admin and client dashboards
- **Why:** Media could only be deleted one at a time with individual confirmation dialogs. No way to clean up multiple files efficiently.
- **How:**
  - New endpoint `POST /api/media/bulk-delete`: accepts `{ ids: [...] }`, verifies ownership for non-admin users, deletes from R2 storage + D1 database in loop, max 50 items per request
  - **Client dashboard:** "Select" toggle button activates checkbox overlays on media items. Selected items get blue ring highlight. "Select All" / "Delete Selected (N)" buttons appear. Click behavior switches from lightbox to toggle-select.
  - **Admin dashboard:** Same pattern in client detail modal media section. Extracted `renderAdminMedia()` function from inline rendering. Uses `showConfirmModal()` for bulk delete confirmation.
  - State variables: `mediaSelectMode`, `selectedMediaIds` (Set) for client; `adminMediaSelectMode`, `adminSelectedMediaIds` for admin

#### 6. Non-Client Contact Management
**Phase:** 3A (Business Operations) | **Files:** `migrations/019_contacts_table.sql` (new), `functions/api/contacts/index.js` (new), `functions/api/contacts/[id].js` (new), `functions/api/contact/index.js` (modified), `admin-dashboard.html`
- **What:** New `contacts` table, full CRUD API, admin UI section with search, add/edit, and "Convert to Client" workflow
- **Why:** Non-client interactions (contact form submissions, manual leads) had no persistence. Contact form was email-only with no audit trail. No way to track leads or convert them to clients.
- **How:**
  - **Migration 019:** `contacts` table with `id`, `name`, `email`, `phone`, `dog_name`, `source` (manual/contact_form/invoice), `notes`, `created_at`, `updated_at` + indexes on email and source
  - **API:** `GET /api/contacts` (list with search + source filter), `POST /api/contacts` (create), `GET/PUT/DELETE /api/contacts/:id` — all admin-only
  - **Contact form auto-save:** Modified `functions/api/contact/index.js` to INSERT into contacts table after successful email send (checks for duplicate email first, non-blocking try/catch)
  - **Admin UI:** New "Contacts" section with searchable table (name, email, phone, dog, source badge, actions). Add/Edit contact modal. "Convert to Client" button calls existing `/api/clients/create-with-email` then deletes the contact record.
  - Quick action button: "📇 Contacts" added to dashboard

#### 7. Reporting Dashboard
**Phase:** 3B (Business Operations) | **Files:** `functions/api/stats/extended.js` (new), `admin-dashboard.html`
- **What:** Chart.js-powered analytics dashboard with 4 charts, summary cards, and CSV export
- **Why:** Admin dashboard only had 4 static stat numbers (total clients, today's appointments, overdue invoices, monthly revenue). No trend data, no visualizations, no service analytics, no export capability.
- **How:**
  - **Extended stats API** (`GET /api/stats/extended`): 5 parallel D1 queries returning revenue by month (12mo), service popularity (top 10), client growth (12mo), invoice status breakdown, and outstanding balance
  - **Chart.js 4 CDN** added to admin dashboard head
  - **4 summary cards:** Outstanding balance, total services sold, top service, paid invoice count
  - **4 charts:**
    - Revenue trend (line chart, 12 months, blue fill)
    - Invoice status (doughnut chart, color-coded: green=paid, yellow=pending, red=overdue, gray=cancelled)
    - Service popularity (horizontal bar chart, purple)
    - Client growth (bar chart, green, 12 months)
  - Charts auto-detect dark/light mode for text/grid colors
  - **CSV export:** Generates downloadable CSV with revenue, service, and invoice data
  - Quick action button: "📊 Reports" added to dashboard

#### 8. Appointment Reminders
**Phase:** 4 (Infrastructure) | **Files:** `migrations/020_appointment_reminder_sent.sql` (new), `functions/api/appointments/send-reminders.js` (new), `functions/utils/emails.js` (modified), `admin-dashboard.html`
- **What:** Manual "Send Reminders" button in schedule section that emails all clients with appointments tomorrow
- **Why:** No reminder system existed. Clients could forget appointments, leading to no-shows.
- **How:**
  - **Migration 020:** Added `reminder_sent INTEGER DEFAULT 0` column to `appointments` table
  - **Endpoint** `POST /api/appointments/send-reminders` (admin-only): queries appointments for tomorrow where `status IN ('pending', 'confirmed') AND reminder_sent = 0`, joins clients + primary dog, sends `appointmentReminderHtml` email per appointment via Resend, marks `reminder_sent = 1`
  - **Email template:** `appointmentReminderHtml()` — yellow-themed reminder with date/time/service details, "arrive 5 minutes early" note, and link to client dashboard
  - **Admin UI:** "Send Reminders" button in schedule section header with notification badge showing count of unsent reminders. Badge auto-checks on schedule load via `checkPendingReminders()`. Button shows spinner during send.

---

### How It Was Done

1. **4-phase approach:** Organized by effort and impact — Phase 1 (quick wins), Phase 2 (client UX), Phase 3 (business ops), Phase 4 (infrastructure)
2. **Parallel exploration:** Used 2 explore agents simultaneously to map current state of all 8 feature areas before writing any code
3. **Plan mode:** Full plan created, reviewed, and approved before implementation — ensured no wasted effort
4. **Backend-first pattern:** Created API endpoints and migrations first, then wired up frontend UI
5. **Existing code reuse:** Leveraged existing milestones API (migration 013), client create-with-email endpoint, showConfirmModal(), email templates pattern
6. **Migrations run on production D1:** Both 019 and 020 executed via `npx wrangler d1 execute DB --env production --remote`
7. **Single commit deployment:** All 12 files committed and pushed together, auto-deployed via Cloudflare Pages GitHub integration
8. **Post-deploy verification:** All 5 new endpoints confirmed responding with `{"error":"Authentication required"}` on production

---

### Summary of Changes (Session 8)

| Category | Files Added | Files Modified | Approx Lines Changed |
|----------|------------|----------------|----------------------|
| API Endpoints | 5 | 1 | +331 |
| Frontend (admin) | 0 | 1 | +712 |
| Frontend (client) | 0 | 1 | +215 |
| Email Templates | 0 | 1 | +20 |
| Migrations | 2 | 0 | +17 |
| **Total** | **7** | **4** | **~1,246 insertions, 70 deletions** |

---

### New API Endpoints (Session 8 — 5 total)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/change-password` | JWT (any user) | Change password with current password verification |
| POST | `/api/media/bulk-delete` | JWT (ownership) | Delete up to 50 media items from R2 + D1 |
| GET/POST | `/api/contacts` | Admin | List (with search/filter) and create contacts |
| GET/PUT/DELETE | `/api/contacts/[id]` | Admin | Manage individual contact |
| GET | `/api/stats/extended` | Admin | Revenue, services, growth, invoice analytics |
| POST | `/api/appointments/send-reminders` | Admin | Send tomorrow's appointment reminder emails |

---

### New Database Tables (Session 8 — 1 total)

| Table | Migration | Columns | Purpose |
|-------|-----------|---------|---------|
| `contacts` | 019 | id, name, email, phone, dog_name, source, notes, created_at, updated_at | Track leads and non-client interactions |

### Schema Changes (Session 8)

| Change | Migration | Impact |
|--------|-----------|--------|
| `appointments.reminder_sent INTEGER DEFAULT 0` | 020 | Track which appointments have received reminder emails |

---

### New Email Templates (Session 8 — 1 total)

| Template | Trigger | Recipient |
|----------|---------|-----------|
| `appointmentReminderHtml` | Admin clicks "Send Reminders" | Clients with appointments tomorrow |

---

### Deployment Log (Session 8)

| # | Commit | Deploy ID | Status | Time |
|---|--------|-----------|--------|------|
| 1 | `0e8bf3d` | `ca120b81` | Active (Production) | ~5:10 AM CDT, March 23, 2026 |

---

### Improvements Needed Going Forward

#### High Priority
1. **Stripe/Payment Integration** — Allow clients to pay invoices online from email or dashboard
2. **SMS Notifications** — Twilio or Brevo for appointment reminders + status updates (not everyone checks email)
3. **Automated Appointment Reminders** — Current system is manual (admin button). Add Cloudflare Worker with Cron Trigger for daily 10 AM auto-send
4. **Invoice Payment Status Sync** — When all line items marked "paid", auto-update invoice status to "paid"

#### Medium Priority
5. **Media Gallery Enhancements** — Drag-and-drop reordering (display_order column), album/folder organization
6. **Review System Enhancement** — Star ratings display in carousel, auto-request review after completed appointment, admin edit for approved reviews
7. **Client Profile Photo Upload** — Allow clients to upload/change their own profile picture
8. **Dark Mode Polish** — New UI elements (contacts table, reports charts, milestones, password modal) need dark/light consistency audit
9. **Google Calendar Sync Setup** — Session 6 integration still needs Google Cloud Console credentials configured

#### Lower Priority
10. **Multi-Dog Milestone Tracking** — Current milestones are per-client; consider per-dog milestones for clients with multiple dogs
11. **Contact-to-Invoice Linking** — Auto-populate non-client invoice fields from contact dropdown
12. **Report Date Filtering** — Add date range picker to filter revenue/service/growth charts
13. **Appointment Analytics** — Busiest days, cancellation rates, no-show tracking in reports
14. **Bulk Contact Import** — CSV upload for importing leads from external sources
15. **Email Template Preview** — Admin preview of reminder/notification emails before sending

---

## Session 8 — March 25, 2026 (5:00 PM – 10:15 PM CST)
**Session Focus:** Invoice Line Item Enhancements, Multi-Week Auto-Split, Payment Tracking, Credit Transfer, Bug Fixes
**Commits:** 9fd9d02 → d40997d (8 commits)

---

### What Was Done

#### 1. Per-Line-Item Due Date & Amount Paid
**What:** Each invoice line item now has its own due date and amount paid fields, with auto-calculated balance (total - paid).
**How:**
- **Migration 024** (`migrations/024_invoice_item_due_date_amount_paid.sql`): Added `due_date DATE` and `amount_paid REAL DEFAULT 0` columns to `invoice_items` table
- **Backend:** Updated INSERT statements in `functions/api/invoices/index.js` (POST create), `functions/api/invoices/[id].js` (PUT new_items), and `functions/api/invoices/items/[id].js` (PUT update) to accept and store `due_date` and `amount_paid`
- **Frontend:** Added Due Date and Amount Paid inputs to both the create invoice modal and invoice detail modal line item rows in `admin-dashboard.html`
- **Client dashboard:** Updated `client-dashboard.html` invoice table to show Due Date, Paid, and Balance columns
- **PDF:** Updated `functions/utils/invoice-pdf.js` to render Due Date, Paid, and Balance columns in the line items table
- **Commit:** `9fd9d02`

#### 2. Tax Rate Made Optional
**What:** Tax rate field no longer requires a value. Defaults to 0% when left blank.
**How:**
- Removed `required` attribute and asterisk from the `#invoice-tax-rate` input in `admin-dashboard.html`
- Backend already handled `tax_rate || 0` — no backend changes needed
- **Commit:** `9fd9d02`

#### 3. Multi-Week Service Auto-Split
**What:** Services can now have a `sessions` field. When a multi-session service (e.g., "Board and Train 4-weeks" with sessions=4) is added to an invoice, it auto-creates N weekly line items with evenly split pricing and sequential weekly due dates.
**How:**
- **Migration 025** (`migrations/025_service_sessions.sql`): Added `sessions INTEGER DEFAULT 1` to `services` table
- **Backend:** Updated `functions/api/services/index.js` (POST) and `functions/api/services/[id].js` (PUT) to accept `sessions` field
- **Frontend:** Added "Sessions/Weeks" input to service create/edit modal. Updated `addInvoiceItem()` in create modal and `addDetailInvoiceItem()` in detail modal to detect `data-sessions` attribute on service dropdown. When sessions > 1, generates N items named `"{ServiceName} - Week {n}"` with per-session price = total price / sessions, and weekly due date increments
- Service dropdowns show `[N wks]` suffix for multi-session services
- **Commit:** `1ae147f`

#### 4. Inline Editing for Invoice Line Items
**What:** Each line item in the invoice detail modal is now fully editable inline — qty, price, due date, amount paid — with a Save button per row.
**How:**
- Replaced static text cells with `<input>` fields in the `viewInvoiceDetails()` function in `admin-dashboard.html`
- Added `saveItemEdits(itemId, invoiceId)` function that collects inline values and PUTs to `/api/invoices/items/{id}`
- **Backend:** Updated `functions/api/invoices/items/[id].js` PUT handler to accept `quantity` and `price`, recalculate item `total`, and trigger invoice-level recalculation (subtotal, discount, tax, total) when qty/price changes
- **Commit:** `1ae147f`

#### 5. Payment Totals (Total Paid & Balance Due)
**What:** Invoice detail modal, email preview, email HTML, and PDF all now show Total Paid (green) and Balance Due (red/green) below the Total line.
**How:**
- **Detail modal:** Added `#detail-total-paid` and `#detail-balance-due` elements in the totals section HTML. Calculated in `viewInvoiceDetails()` by summing `amount_paid` across all items
- **Email preview:** Added calculation in `emailInvoice()` function using an IIFE to compute totals inline
- **Email HTML:** Added `totalPaid` and `balanceDue` calculations at the top of `invoiceEmailHtml()` in `functions/utils/emails.js`, rendered after the Total line
- **PDF:** Added Total Paid and Balance Due lines after the Total in `functions/utils/invoice-pdf.js` using GREEN/RED colors
- **Commits:** `1ae147f`, `2ae0f66`, `dc65173`

#### 6. Credit Transfer Between Line Items
**What:** Admin can apply a paid amount from one service to another on the same invoice. Source keeps its payment (balance stays $0), target gets credited.
**How:**
- Added "Xfer" button on each line item with `amount_paid > 0` in the detail modal
- Added Transfer Credit modal HTML (`#transfer-credit-modal`) with: source display, target dropdown, amount input, Transfer/Cancel buttons
- `transferCredit(fromItemId, invoiceId)` opens modal, populates target dropdown with other items
- `executeTransfer()` sends a single PUT to increase target's `amount_paid` (source is NOT reduced — credit is additive)
- **Bug fix:** Saved `transferInvoiceId` to local variable before `closeTransferModal()` nullifies it, preventing "Failed to load invoice details" error on refresh
- **Commits:** `1ae147f`, `8c72170`, `43eef0a`

#### 7. Upfront Payment Percentage
**What:** Each line item has an "Upfront %" dropdown (0/25/50/75/100%) indicating how much was paid upfront. Selecting a percentage auto-calculates the Amount Paid field.
**How:**
- **Migration 026** (`migrations/026_invoice_item_upfront_pct.sql`): Added `upfront_pct INTEGER DEFAULT 0` to `invoice_items` table
- **Backend:** Updated all 3 invoice API files to accept `upfront_pct` in INSERT and UPDATE operations
- **Frontend:** Added `<select>` dropdown in create modal line items, detail modal line items, and "Add New Item" form. `applyUpfrontPct()` and `applyCreateUpfrontPct()` helper functions auto-set `amount_paid = (qty × price × pct / 100)`
- Auto-split items inherit the upfront % and calculate per-session paid amounts
- **Commit:** `35734594`

#### 8. Bug Fix: Invoice Detail Load Error (LEFT JOIN)
**What:** Viewing invoice details returned "Failed to load invoice details" for non-client invoices.
**How:**
- Root cause: `functions/api/invoices/[id].js` GET (line 33) and PUT response (line 190) used `JOIN clients` instead of `LEFT JOIN clients`. Invoices with NULL `client_id` returned no rows → 404
- Fixed both queries to use `LEFT JOIN` and added `COALESCE` for client name/email fields (matching the pattern already used in `index.js`)
- **Commit:** `35734594`

#### 9. Bug Fix: Delete Item Discount Recalculation
**What:** Deleting a line item recalculated invoice totals without accounting for discount, causing incorrect totals.
**How:**
- In `functions/api/invoices/items/[id].js` DELETE handler, changed the recalculation query to also fetch `discount_type` and `discount_value`
- Applied discount before tax calculation (same pattern as the PUT handler's recalculation block)
- Updated the UPDATE statement to also write `discount_amount`
- **Commit:** `35734594`

#### 10. Bug Fix: Email Preview & Email/PDF Missing Columns
**What:** Email preview only showed Service/Qty/Price/Total. Email HTML and PDF were also missing the new columns.
**How:**
- **Email preview** (`admin-dashboard.html` `emailInvoice()` function): Updated table to include all 8 columns (Service, Qty, Price, Total, Due Date, Upfront, Paid, Balance) plus Total Paid / Balance Due
- **Email HTML** (`functions/utils/emails.js` `invoiceEmailHtml()`): Same — added all columns to table header and rows, added Total Paid and Balance Due to totals
- **PDF** (`functions/utils/invoice-pdf.js`): Added Upfront % column, Total Paid and Balance Due lines
- **Commits:** `2ae0f66`, `dc65173`

#### 11. Bug Fix: Date Timezone Shift
**What:** Invoice date showed 04/19/2026 in detail modal but 4/18/2026 in email preview. Off by one day.
**How:**
- Root cause: `new Date('2026-04-19')` without `T00:00:00` interprets as UTC midnight, which shifts to the previous day in US timezones
- Added `+ 'T00:00:00'` to all 6 date parsing locations across 3 files:
  - `admin-dashboard.html` (email preview Date and Due Date)
  - `functions/utils/emails.js` (email Date and Due Date)
  - `functions/utils/invoice-pdf.js` (PDF Date and Due Date)
- Item-level dates already had the fix from the initial implementation
- **Commit:** `d40997d`

---

### Migrations Run This Session
| Migration | Description | Local | Remote |
|-----------|------------|-------|--------|
| 024 | `invoice_items`: add `due_date`, `amount_paid` | ✅ | ✅ |
| 025 | `services`: add `sessions` | ✅ | ✅ |
| 026 | `invoice_items`: add `upfront_pct` | ✅ | ✅ |

### Files Modified This Session
| File | Changes |
|------|---------|
| `admin-dashboard.html` | Inline editing, auto-split, transfer modal, upfront %, payment totals, email preview, date fixes |
| `client-dashboard.html` | Due Date, Paid, Balance columns in invoice display and client PDF |
| `functions/api/invoices/index.js` | Accept `due_date`, `amount_paid`, `upfront_pct` in item INSERT |
| `functions/api/invoices/[id].js` | LEFT JOIN fix, COALESCE, accept new item fields in PUT |
| `functions/api/invoices/items/[id].js` | Accept `quantity`, `price`, `upfront_pct` in PUT; invoice recalc; discount fix in DELETE |
| `functions/api/services/index.js` | Accept `sessions` in POST |
| `functions/api/services/[id].js` | Accept `sessions` in PUT |
| `functions/utils/invoice-pdf.js` | All 8 columns, Upfront %, Total Paid, Balance Due, date fix |
| `functions/utils/emails.js` | All 8 columns, Total Paid, Balance Due, date fix |

### Files Created This Session
| File | Purpose |
|------|---------|
| `migrations/024_invoice_item_due_date_amount_paid.sql` | Add due_date and amount_paid to invoice_items |
| `migrations/025_service_sessions.sql` | Add sessions to services |
| `migrations/026_invoice_item_upfront_pct.sql` | Add upfront_pct to invoice_items |

### Current Database Schema — invoice_items (11 columns)
```
id, invoice_id, service_id, service_name, quantity, price, total, status, due_date, amount_paid, upfront_pct
```

### Current Database Schema — services (7 columns)
```
id, name, description, price, active, created_at, sessions
```

### Deployment Verification
- All 8 commits pushed to GitHub (`main` branch)
- All deployments confirmed Active on Cloudflare Pages
- All 3 migrations run on both local and remote D1
- Live browser testing confirmed: invoice detail loads, inline editing saves, transfer credit works, email preview matches detail modal, no console errors, dates consistent across all views

--- End of PROJECT_SUMMARY_PART2.md. Continued in PART3.md ---
