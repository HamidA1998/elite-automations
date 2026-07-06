# Elite OS — Codebase Audit

Date: 2026-04-21
Scope: everything under `src/` plus `.env.example`, `package.json`, `docs/`.
Companion document: `ELITE_OS_ENTERPRISE_ROADMAP.md`

This audit is written for Hamid, who wants to turn Elite OS into the operating
system of his whole business — running himself and his AI workforce — at
enterprise grade.

---

## 1. One-sentence summary

Elite OS is already an impressive single-operator platform: ~14k lines of
TypeScript, 46 frontend pages, an SQLite object store, 12 external
integrations registered, and a genuine "OS spine" abstraction
(`src/os/os-spine.ts`) feeding a Cmd+K command palette and a right-side
dossier — but the server is a 4,351-line monolithic `node:http` handler
with no authentication, no job queue, no audit log, no webhook verification,
and a data model that still has both a legacy `clients` table and a newer
`accounts` table in parallel. The product architecture is 70% of the way to
"enterprise", the platform architecture is closer to 30%.

---

## 2. Module inventory and state

### Backend

| File | Lines | Purpose | State |
|---|---:|---|---|
| `src/dashboard-server.ts` | 4,351 | Main HTTP API (~100 routes) | Works, but monolithic and unauthenticated |
| `src/dashboard.ts` | 2,912 | Older dashboard HTML generator | **Legacy / duplication risk** — still present |
| `src/database.ts` | 2,112 | SQLite layer (node:sqlite) | Solid, but schema has legacy + new tables side by side |
| `src/automation/overnight-pipeline.ts` | 595 | Nightly lead pipeline orchestration | In-process, no queue, no retries |
| `src/integrations.ts` | 398 | Connector registry + sync (gmail/plaid/rc/asc) | 4 of 12 connectors have live sync |
| `src/firecrawl.ts` | 416 | Business search + scrape | Wired |
| `src/kie.ts` | 541 | Image + video generation via KIE.ai | Wired |
| `src/twilio.ts` | 335 | Calls, SMS, recordings | Wired — no webhook signature check (see §6) |
| `src/elevenlabs.ts` | 272 | Voice agents + conversations | Wired — post-call webhook unauthenticated |
| `src/stripe.ts` | 113 | Stripe summary helpers | Wired (API key) — **no webhook** ingest |
| `src/apify.ts` | 113 | Actor discovery + run | Wired |
| `src/browser-audit.ts` | 253 | Playwright technical audit | Wired |
| `src/tunnel.ts` | 271 | ngrok/localtunnel control | Wired |
| `src/services/openclaw/*` | — | OpenClaw gateway client (local agent runtime) | Wired via HTTP+SSE |
| `src/scoring.ts` | 100 | Lead scoring rubric | Simplistic — see §8 |
| `src/email.ts` | 32 | Nodemailer wrapper | Minimal |
| `src/types.ts` | 277 | Shared types | Good |

### Frontend

| Area | Count / note |
|---|---|
| Top-level pages | 9 (Command Centre, Leads, Lead Detail, Planner, Analytics, Agents, Settings, Personal, Timeline) |
| Module pages | 37 across `ai/`, `calls/`, `crm/`, `mail/`, `ops/`, `pay/`, `vid/` |
| Layout shell | `AppShell`, `ModuleRail`, `ModuleSidebar`, `TopBar`, `MobileNav`, `PageWrapper`, `Sidebar` |
| OS spine | `GlobalCommandPalette` (165 lines), `ObjectDossierPanel` (186 lines), `os-spine.ts` (342 lines) |
| UI primitives | 10: Button, Card, Badge, Input, Modal, Progress, Skeleton (16 lines!), StatCard, Switch, Timeline |
| Feature components | 6: ActivityFeed, HourlyPlanner, LeadStatusBadge, NextUpCard, ScheduleComposer, NewAccountModal |
| State stores | 3 Zustand stores (schedule, settings, theme) + TanStack Query for server state |

---

## 3. API surface (by prefix, counts approximate)

- `/api/openclaw/*` — agents, sessions, stream (SSE), memory, approvals
- `/api/calls/*` — config, summary, logs, recordings, twiml, outbound, end, status, webhook
- `/api/voice/elevenlabs/*` — personalization, post-call
- `/api/sms/*` — inbox, thread, send, webhook
- `/api/mail/*` — status, oauth/url, oauth/callback, inbox, templates, generate-template, send, campaign, drafts
- `/api/leads/*`, `/api/accounts/*`, `/api/clients/*`, `/api/contacts/*`, `/api/tasks/*`, `/api/notes/*`, `/api/memories/*`, `/api/proposals/*` — CRM CRUD
- `/api/stripe/*` — summary, invoices, payment-links, customers, products, subscriptions (no webhook)
- `/api/ai/*` — command, scrape, search, apify/*, images/generate, videos/generate
- `/api/elevenlabs/*` — agents, voices, conversations
- `/api/automation/*` — readiness, hourly, status, run, abort
- `/api/tunnel/*` — status, start, stop
- `/api/integrations/*` — status, sync
- `/api/plaid/*` — link-token, exchange-public-token
- `/api/system/health`
- `/api/search`, `/api/export/csv`, `/api/metrics`, `/api/state`, `/api/client-360`, `/api/backup`, `/api/pipeline/results`

All routes are registered inline as `if (method === "X" && pathname === "Y")` branches in a single function; there is no router or middleware chain.

---

## 4. Data model (SQLite)

Tables present (`src/database.ts:181–432`):

- `clients` — legacy full lead record with 30+ columns (scores, JSON blobs, file paths).
- `accounts` — newer, leaner record with identical keys. **Both exist.** See §7.
- `contacts`, `activities`, `tasks`, `memories`, `proposals`, `comments`, `assets`, `settings`
- `audit_scores`, `audit_analysis`, `browser_audits`
- `timeline_events` — **client-scoped only** (`REFERENCES accounts(client_id)`). Not the universal business event log the upgrade plan calls for.
- `memory`, `notes`, `call_logs`, `integration_snapshots`

What's **missing** vs. the "universal object graph" in the 1000% upgrade plan:

- No `organizations` / tenants table. Implicit single-tenant.
- No `users` table, no `roles`, no `permissions`. There's no auth concept.
- No `events` table at the business level (only client-scoped `timeline_events`).
- No `projects` / `deliverables` table for post-close delivery.
- No `invoices` / `payments` tables — Stripe is queried live each request.
- No `agent_runs` / `agent_actions` / `approvals` tables — OpenClaw state is external.
- No `audit_log` / `action_log` for "who did what, when, why, at what cost".
- No `api_keys`, `connections`, `connection_secrets` (secrets live only in env vars).
- No `webhooks_inbound` ledger for replay/debug.

---

## 5. Integration matrix

| Provider | Status in this repo | Live sync handler? | Webhook ingest? | Signature verified? | Timeline event writes? |
|---|---|---|---|---|---|
| Firecrawl | Wired (search, scrape, extract) | n/a (pull on demand) | n/a | n/a | Partial (pipeline logs) |
| Apify | Wired (actors, run) | n/a | n/a | n/a | Partial |
| Kie.ai | Wired (image, video) | n/a | n/a | n/a | No |
| Twilio | Wired (calls, SMS, recordings) | No snapshot | `/api/calls/status`, `/api/sms/webhook` | **No** | Partial (call logs only) |
| ElevenLabs | Wired (agents, voices, conversations) | No snapshot | `/api/voice/elevenlabs/post-call` | **No** | No |
| Stripe | Wired (read-only summaries) | No snapshot | **No webhook route** | n/a | No |
| Gmail | Wired (OAuth flow + inbox list) | **Yes** (`syncGmail`) | n/a | n/a | No |
| Plaid | Wired (link + exchange + sync) | **Yes** (`syncPlaid`) | n/a | n/a | No |
| RevenueCat | Wired (projects + products) | **Yes** (`syncRevenueCat`) | n/a | n/a | No |
| App Store Connect | Wired (apps list only) | **Yes** (`syncAppStore`) | n/a | n/a | No |
| OpenClaw | Wired (SSE + HTTP) | n/a (external) | n/a | n/a | Partial |
| SMTP | Wired (nodemailer) | n/a | n/a | n/a | Partial |

**Gaps that cost money:**

- Stripe has no webhook route, so invoice.paid / payment_failed / subscription events never feed the dashboard or trigger dunning. The app queries Stripe on every page load, instead.
- ElevenLabs post-call webhook (`src/dashboard-server.ts:2320`) is unauthenticated — anyone can forge a post-call payload.
- Twilio status callbacks (`src/dashboard-server.ts:2244, 4180`) do not verify the `X-Twilio-Signature` header.

---

## 6. Enterprise-grade gaps

### Auth, identity, tenancy

- **No authentication** on any route. `checkRateLimit` is the only gate, limiting to 120 req/min per IP. Anyone who can reach `:3007` can call everything.
- **CORS** is set to `Access-Control-Allow-Origin: *` equivalent (`src/dashboard-server.ts:1851`).
- No user model, no session, no JWT, no API key system.
- No organization model → **can't go multi-tenant** without a migration.

### Authorization / audit

- No RBAC. No roles. No scopes. Every endpoint does the same thing for every caller.
- No audit log. Nothing records "Hamid updated lead X at time T with these fields".
- Stripe, Twilio, ElevenLabs actions are taken from inside the server process with no attribution or logging beyond console output.

### Reliability

- No job queue. `overnight-pipeline.ts` runs inline; a crash or a long Firecrawl request blocks the API.
- No retries or idempotency keys for external-write calls (Stripe, Twilio, ElevenLabs).
- No dead-letter queue.
- No structured logging — just `console.log`.
- Rate limiter is in-process and resets on restart.

### Secrets

- All secrets sit in `.env.local` as plaintext. `ASC_PRIVATE_KEY_PATH` reads a `.p8` file from disk.
- No rotation, no vault, no secret-at-rest encryption.

### Observability

- No metrics endpoint beyond `/api/metrics` (business metrics, not platform metrics).
- No tracing.
- No error aggregator (Sentry) wired up.
- `/api/system/health` (`src/dashboard-server.ts:4103`) exists but is shallow.

### Data durability

- No backup job. Only a manual `/api/backup` endpoint.
- No replication. Single SQLite file on disk.
- No migration versioning beyond `ensureColumn` patches.

### Webhooks inbound

- No ledger table. No replay. No signature verification (see §5).

### Compliance

- No GDPR/UK-GDPR tooling (export-all / delete-for-contact).
- No data-retention policy.
- No PII classification of fields.

---

## 7. Data-model debt

`clients` vs. `accounts` — both tables exist (`src/database.ts:181` and `:320`), both key on `client_id`, with overlapping fields. Other tables (`contacts`, `activities`, `tasks`, `memories`, `proposals`, `comments`, `assets`) FK to `clients`; `timeline_events`, `audit_scores`, `audit_analysis`, `browser_audits`, `memory`, `notes`, `call_logs` FK to `accounts`. The codebase therefore has two parallel records of the same business, mutated through different endpoints. This is the single biggest correctness risk. Must be consolidated.

---

## 8. Scoring rubric is thin

`src/scoring.ts` is 100 lines — the scoring that powers qualification, pipeline prioritisation, and the whole "who to contact next" decision is a short weighted sum over a small set of signals. A revenue engine needs:

- Technical-audit signals (Lighthouse, Core Web Vitals, mobile usability, HTTPS, schema, sitemap, accessibility).
- Presence signals (Google Business Profile freshness, review velocity, review count vs. category median).
- Commercial signals (years in business from Companies House, filings delinquent, employee count, estimated revenue band).
- Intent signals (job ads live, tech stack changes, new domain registrations, press mentions).
- Contactability signals (verified email, phone, LinkedIn presence, decision-maker identified).

Scoring weights should also be learned from closed-won vs. closed-lost outcomes — not static.

---

## 9. Frontend UX audit

### Strengths

- Real OS spine: `os-spine.ts` builds `OsCommandItem[]`, `MissionCard[]`, and `ObjectDossier[]` from typed data. This is the right abstraction.
- `AppShell` properly wires Cmd+K, mission cards, and the dossier panel.
- TanStack Query used correctly for server state.
- Typography tokens + CSS vars (`--color-*`) suggest a design system is in flight.

### Issues

1. **Dossier is desktop-only** — `ObjectDossierPanel` is `hidden … 2xl:flex 2xl:flex-col` (`src/components/os/ObjectDossierPanel.tsx:42`). On any screen smaller than 2xl (1536px), the best-designed part of the app is invisible.
2. **UI primitives too thin** — 10 components; `Skeleton` is 16 lines. Pages will be reinventing tables, empty states, inspectors, and filters inline.
3. **Two parallel nav concepts** — both `Sidebar` and `ModuleRail`+`ModuleSidebar`. Potential for drift.
4. **Module coverage gaps** vs. the 1000% plan:
   - No Projects/Delivery module (post-close work management).
   - No Client Portal module.
   - No Content module (posts, scripts, landing copy).
   - No Finance/Ledger page (revenue by source, LTV, CAC, runway).
   - No Approvals queue beyond `ops/ApprovalsPage.tsx`.
   - No unified Inbox across email / SMS / call voicemail / client portal messages.
5. **Command palette coverage** — `os-spine.ts` seeds items from `accounts`, `agents`, `approvals`. It does **not** index calls, SMS threads, invoices, tasks, files, or timeline events. So Cmd+K is partial.
6. **Dossier coverage** — only `buildAccountDossier` exists. There's no `buildCallDossier`, `buildInvoiceDossier`, `buildAgentDossier`, etc.
7. **No keyboard shortcut registry** beyond Cmd+K.
8. **No empty-state pattern** — pages relying on TanStack Query will flash blank before data loads.
9. **No error boundaries** visible.
10. **Theme auto-switching** by time-of-day is a nice touch but should be a user preference, not hard-coded.

---

## 10. Top 20 concrete risks / gaps, ranked

| # | Risk | Severity | Location |
|---:|---|---|---|
| 1 | No authentication on any API route | Critical | `src/dashboard-server.ts` — all routes |
| 2 | CORS wide open | Critical | `src/dashboard-server.ts:1851` |
| 3 | Stripe webhook not implemented; app polls for money events | High | `src/stripe.ts`, missing route |
| 4 | Twilio + ElevenLabs webhooks unsigned | High | `:2244`, `:2320`, `:4180`, `:4188` |
| 5 | `clients` + `accounts` dual tables | High | `src/database.ts:181, 320` |
| 6 | No universal business-level event log | High | `timeline_events` is per-client |
| 7 | No job queue; pipeline runs in-process | High | `src/automation/overnight-pipeline.ts` |
| 8 | Monolithic 4,351-line server with no middleware | High | `src/dashboard-server.ts` |
| 9 | Dossier panel hidden below 2xl | High | `src/components/os/ObjectDossierPanel.tsx:42` |
| 10 | Scoring rubric simplistic | High | `src/scoring.ts` |
| 11 | No audit/action log table | Medium | `src/database.ts` |
| 12 | No Stripe invoices/payments tables — everything live | Medium | Cache gap |
| 13 | Secrets in plaintext `.env.local` | Medium | platform |
| 14 | No retries/idempotency for external writes | Medium | Twilio, Stripe, ElevenLabs calls |
| 15 | Dual nav components (`Sidebar` + `ModuleRail`) | Low | `src/components/layout/*` |
| 16 | Command palette indexes only accounts/agents/approvals | Medium | `src/os/os-spine.ts:buildCommandItems` |
| 17 | No keyboard shortcut registry | Low | UX |
| 18 | No Sentry / structured logs / tracing | Medium | platform |
| 19 | `dashboard.ts` (legacy HTML generator) still present | Low | `src/dashboard.ts` |
| 20 | No CI (no `.github/workflows/`, no tests beyond one) | Medium | repo root |

---

## 11. What's genuinely strong (don't break these)

- The `os-spine.ts` abstraction — typed object graph powering palette + dossier + mission cards.
- The `integrations.ts` connector snapshot model — extensible.
- The module-based IA (crm/ai/calls/mail/ops/pay/vid) is good.
- Using TanStack Query + SSE for live updates.
- SQLite with WAL + row-scoped CRUD endpoints works well for a single operator at current scale.
- The overnight pipeline is well factored into steps with per-step logs.
- Theme system (dawn/day/dusk/night + CSS variables) is tasteful.

These are the foundations the roadmap builds on.
