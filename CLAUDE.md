# Claude CLI Team - K9 Vision Dog Training Platform

This file defines the Claude CLI team and the shared project knowledge for K9 Vision.

## Team
Supervisor (in charge)
- Name: Project Supervisor
- Role: Owns final decisions, approves releases, resolves conflicts, keeps scope aligned.
- Responsibilities: Prioritize work, enforce quality, coordinate members, maintain CLAUDE.md accuracy.

Team Members (4)
- Name: Frontend Lead
  Focus: HTML/Tailwind UI, UX flows, responsive behavior for all 4 pages.
- Name: Backend/API Lead
  Focus: Cloudflare Pages Functions, API routes, auth, CORS, integrations.
- Name: Data/Infra Lead
  Focus: D1 schema/migrations, R2 storage, wrangler config, deployment.
- Name: QA/Docs Lead
  Focus: Testing flows, endpoint validation, documentation updates, session history.

Operating Rules
- Supervisor has final approval on architecture, schema, and deploy changes.
- Members update their sections in this file when changes land.
- Keep edits factual and sourced from repo files.
- All members must update PROJECT_SUMMARY.md during each session with date/time, what was said, what was done, and how it was done.
- The Supervisor must paginate PROJECT_SUMMARY.md at ~24,000 tokens by creating a new file (e.g., PROJECT_SUMMARY_PART3.md) and continue logging there.
- At the first command of any session, every member must read PROJECT_SUMMARY.md to fully understand the project overview, tech stack, and architecture. Do this again after any conversation compaction.
- Every member must confirm the Tech Stack Snapshot and Security‑First Checklist in PROJECT_SUMMARY.md before proposing changes.
- Any new integration or endpoint change must include a brief security impact note in the session log.

---

# Project Knowledge Base

## 1. Project Overview
K9 Vision is a full-stack dog training business management platform for a Houston, TX-based trainer. It includes:
- Public marketing website with services, testimonials (real Yelp reviews), about, and contact/booking form.
- Authenticated portals for admin and clients with dashboards, client management, invoices, media, and training notes.

Live URL: https://k9visiontx.com
Repo: https://github.com/k9vision/k9siteCG

## 2. Tech Stack
- Cloudflare Pages (static hosting + Pages Functions)
- Cloudflare D1 (SQLite at the edge)
- Cloudflare R2 (media storage)
- Tailwind CSS (CDN) + vanilla JS
- bcryptjs (password hashing)
- JWT auth (24-hour tokens)
- Resend (transactional email)
- FormSubmit.co (contact form)

## 3. Architecture (ASCII)

+--------------------------- Cloudflare Edge ---------------------------+
|                                                                       |
|  Frontend (Static HTML)      Serverless API (Pages Functions)         |
|  - index.html                - /api/auth/*                            |
|  - portal.html               - /api/clients/*                         |
|  - admin-dashboard.html      - /api/services/*                        |
|  - client-dashboard.html     - /api/invoices/*                        |
|                             - /api/media/*                            |
|                             - /api/notes/*                            |
|                             - /api/fun-facts/*                        |
|                             - _middleware.js (CORS)                   |
|                                                                       |
|                      +-------------------------------+                |
|                      | D1 (SQLite)   | R2 (Media)    |                |
|                      | 8 tables      | photos/videos |                |
|                      +-------------------------------+                |
|                                                                       |
+-----------------------------------------------------------------------+
                             | External Services
                             | - Resend API (emails)
                             | - FormSubmit.co (contact form)
                             | - Google Fonts/Icons
                             | - Tailwind CDN

Request flow: Browser -> /api/* -> Pages Functions -> D1/R2 -> JSON response.

## 4. Database Schema (8 tables)
Engine: Cloudflare D1 (SQLite)
Database name: k9-vision-db

4.1 users
- id: INTEGER, PRIMARY KEY AUTOINCREMENT
- username: TEXT, UNIQUE NOT NULL
- password: TEXT, NOT NULL (bcrypt hash)
- role: TEXT, NOT NULL, CHECK IN ('admin', 'client')
- created_at: DATETIME, DEFAULT CURRENT_TIMESTAMP
Indexes: idx_users_username on username

4.2 clients
- id: INTEGER, PRIMARY KEY AUTOINCREMENT
- user_id: INTEGER, UNIQUE, FK -> users(id) ON DELETE CASCADE
- client_name: TEXT
- email: TEXT
- dog_name: TEXT
- breed: TEXT
- age: INTEGER
- photo_url: TEXT
- notes: TEXT
- created_at: DATETIME, DEFAULT CURRENT_TIMESTAMP
Indexes: idx_clients_user_id on user_id

4.3 media
- id: INTEGER, PRIMARY KEY AUTOINCREMENT
- client_id: INTEGER, NOT NULL, FK -> clients(id) ON DELETE CASCADE
- filename: TEXT, NOT NULL
- type: TEXT, NOT NULL, CHECK IN ('photo', 'video')
- url: TEXT, NOT NULL
- uploaded_at: DATETIME, DEFAULT CURRENT_TIMESTAMP
Indexes: idx_media_client_id on client_id

4.4 notes
- id: INTEGER, PRIMARY KEY AUTOINCREMENT
- client_id: INTEGER, NOT NULL, FK -> clients(id) ON DELETE CASCADE
- title: TEXT, NOT NULL
- content: TEXT, NOT NULL
- created_at: DATETIME, DEFAULT CURRENT_TIMESTAMP
- updated_at: DATETIME, DEFAULT CURRENT_TIMESTAMP
Indexes: idx_notes_client_id on client_id

4.5 fun_facts
- id: INTEGER, PRIMARY KEY AUTOINCREMENT
- client_id: INTEGER, NOT NULL, FK -> clients(id) ON DELETE CASCADE
- fact: TEXT, NOT NULL
- created_at: DATETIME, DEFAULT CURRENT_TIMESTAMP
Indexes: idx_fun_facts_client_id on client_id

4.6 services
- id: INTEGER, PRIMARY KEY AUTOINCREMENT
- name: TEXT, NOT NULL
- description: TEXT
- price: REAL, NOT NULL
- active: INTEGER, DEFAULT 1 (soft delete)
- created_at: DATETIME, DEFAULT CURRENT_TIMESTAMP
Indexes: idx_services_active on active

4.7 invoices
- id: INTEGER, PRIMARY KEY AUTOINCREMENT
- invoice_number: TEXT, UNIQUE NOT NULL
- client_id: INTEGER, NOT NULL, FK -> clients(id) ON DELETE CASCADE
- trainer_name: TEXT, NOT NULL
- date: DATE, NOT NULL
- due_date: DATE
- subtotal: REAL, NOT NULL
- tax_rate: REAL, NOT NULL
- tax_amount: REAL, NOT NULL
- total: REAL, NOT NULL
- status: TEXT, DEFAULT 'pending', CHECK IN ('pending','paid','overdue','cancelled')
- notes: TEXT
- created_at: DATETIME, DEFAULT CURRENT_TIMESTAMP
Indexes: idx_invoices_client_id on client_id; idx_invoices_number on invoice_number

4.8 invoice_items
- id: INTEGER, PRIMARY KEY AUTOINCREMENT
- invoice_id: INTEGER, NOT NULL, FK -> invoices(id) ON DELETE CASCADE
- service_id: INTEGER, FK -> services(id) ON DELETE SET NULL
- service_name: TEXT, NOT NULL
- quantity: INTEGER, NOT NULL
- price: REAL, NOT NULL
- total: REAL, NOT NULL
Indexes: idx_invoice_items_invoice_id on invoice_id

Relationship Diagram (ASCII)

users (1)---(1) clients (1)---(N) media
                         |---(N) notes
                         |---(N) fun_facts
                         |---(N) invoices (1)---(N) invoice_items (N)---(1) services

Notes: All child tables cascade-delete with the parent, except invoice_items.service_id which is SET NULL.

## 5. API Endpoints (21 files, 24+ methods)
All endpoints are under functions/api/.

Authentication
- POST /api/auth/login
- POST /api/auth/register

Clients
- GET /api/clients
- POST /api/clients
- GET /api/clients/user/:userId
- PUT /api/clients/:userId
- DELETE /api/clients/:userId
- POST /api/clients/create-with-email

Services
- GET /api/services
- POST /api/services
- GET /api/services/:id
- PUT /api/services/:id
- DELETE /api/services/:id

Invoices
- GET /api/invoices
- POST /api/invoices
- GET /api/invoices/:id
- PUT /api/invoices/:id
- DELETE /api/invoices/:id
- POST /api/invoices/:id/email

Media
- POST /api/media/upload
- GET /api/media/client/:clientId
- DELETE /api/media/:id

Notes
- POST /api/notes
- GET /api/notes/client/:clientId
- PUT /api/notes/:id
- DELETE /api/notes/:id

Fun Facts
- POST /api/fun-facts
- GET /api/fun-facts/client/:clientId
- DELETE /api/fun-facts/:id

Utility
- GET /api/test

## 6. Pages and UI (4 HTML pages)
1. index.html
- Public marketing site with hero, services, about, Yelp testimonials, and contact form.
- Contact form uses FormSubmit.co; validates that phone or email is provided.

2. portal.html
- Login page. POSTs to /api/auth/login and routes based on role:
  - Admin -> /admin-dashboard.html
  - Client -> /client-dashboard.html

3. admin-dashboard.html
- Admin dashboard for the trainer.
- Client management, services catalog, invoices, media uploads, notes, and fun facts.
- 8 quick action buttons and multiple modals (create client, upload media, add notes, create invoice, etc.).

4. client-dashboard.html
- Client portal showing dog profile, media gallery, notes, and fun facts.
- Clients can request services which create notes for admin review.

## 7. Key Features
- Client management with email credentials (Resend)
- Invoicing with line items, tax calculations, and email delivery
- Services catalog with CRUD + soft delete
- Media uploads to R2 and gallery view for clients
- Training notes (two-way communication)
- Fun facts per dog with random rotation
- Yelp reviews carousel (hardcoded verified reviews)
- Contact form via FormSubmit.co

## 8. Third-Party Integrations
- Resend (emails for invoices + welcome credentials)
- FormSubmit.co (contact form to k9vision@yahoo.com)
- Google Fonts (Poppins) and Google Material Icons
- Tailwind CDN (with forms + typography plugins)

## 9. Security
- Password hashing: bcryptjs (10 salt rounds)
- JWT auth: 24-hour expiration; Authorization: Bearer <token>
- RBAC: admin vs client enforced via requireAuth/requireAdmin
- CORS: global _middleware.js allows GET/POST/PUT/DELETE/OPTIONS
- Infrastructure: HTTPS enforced by Cloudflare; parameterized SQL; secrets stored in Cloudflare env vars; R2 accessed via binding

## 10. File Structure (annotated)

k9siteCG/
- .claude/                       # Local Claude CLI settings
- .git/                          # Git repository
- .wrangler/                     # Wrangler metadata
- functions/                     # Cloudflare Pages Functions
  - _middleware.js               # Global CORS
  - utils/auth.js                # JWT + RBAC helpers
  - api/                         # API route files (21)
- migrations/                    # D1 migrations
- static/                        # Static assets
- file-distributor/              # Legacy app (not used in main site)
- index.html                     # Public landing page
- portal.html                    # Login page
- admin-dashboard.html           # Admin dashboard
- client-dashboard.html          # Client portal
- k9visionlogo.jpeg              # Brand logo
- _redirects                     # Clean URL routes
- wrangler.toml                  # Cloudflare config
- schema.sql                     # Full DB schema
- add_fun_facts.sql              # fun_facts migration
- package.json                   # Dependencies
- PROJECT_REPORT.md              # Detailed report
- PROJECT_SUMMARY.md             # Project summary
- PROJECT_SUMMARY_PART2.md       # Additional summary
- RESEND_SETUP.md                # Resend setup
- YELP_SETUP.md                  # Yelp setup
- SETUP_DATABASE.md              # D1 setup
- REVIEWSCG.txt                  # Yelp review text
- actual_live_site.html          # Snapshot of live site
- memory.db                      # Local memory store
- settingsscreen1.jpeg           # Admin UI reference
- settingsscreen2.jpeg           # Admin UI reference
- settingsscreen3.jpeg           # Admin UI reference
- yelpbiz.jpeg                   # Yelp business image

## 11. Deployment
- Platform: Cloudflare Pages + Wrangler CLI
- wrangler.toml includes D1 and R2 bindings and JWT_SECRET var
- Deploy command:
  - npx wrangler pages deploy . --project-name=k9sitecg
- Redirects (from _redirects):
  - /login -> /portal.html (200)
  - /admin -> /admin-dashboard.html (200)
  - /client -> /client-dashboard.html (200)
- Migrations:
  - npx wrangler d1 execute k9-vision-db --file=schema.sql
  - npx wrangler d1 execute DB --file=migrations/002_add_email_and_new_tables.sql --remote
- Domains:
  - https://k9visiontx.com (production)
  - https://k9sitecg.pages.dev (default)
  - https://www.k9visiontx.com (CNAME)

## 12. Session History (4 sessions)
1. Session 1 (Oct 2025): Initial 4-page build, D1/R2 setup, JWT auth, 14 endpoints, base schema.
2. Session 2 (Oct 12-13, 2025): Yelp reviews integration, carousel, review CTA.
3. Session 3 (Oct 13, 2025): Invoicing system, services CRUD, client email creation, schema expansion, Resend integration.
4. Session 4 (Feb 2026): Updated marketing copy, custom domain verified live.
