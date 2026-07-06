# Elite OS — Enterprise-Grade Roadmap

Date: 2026-04-21
Companion: `ELITE_OS_AUDIT_2026-04.md`, builds on `ELITE_OS_1000_PERCENT_UPGRADE_PLAN.md`.

This roadmap turns Elite OS from a single-operator dashboard into an
enterprise-grade operating system that runs your business and your AI
workforce end-to-end. It's organised so each phase ships value on its own,
and so the phases compound.

---

## Guiding principles

1. **Everything is an event.** Calls, emails, invoice.paid, agent action, approval, file upload — one universal event log with the same grammar. The dashboard and the agents both read from it.
2. **Every action has an author.** Human or agent, attributed, logged, reversible where possible, approved where necessary.
3. **Enterprise posture from day one, even while single-operator.** Auth, RBAC, audit log, multi-tenant keys on every table. Turning on team mode later should be a switch, not a rewrite.
4. **APIs are pipes, not products.** Every external service writes into the same normalised event log and reads from the same object graph. Swapping a provider is a file change, not a feature.
5. **Ship vertical slices.** Each phase delivers something usable — not a refactor with no user-visible output.

---

## Phase 0 — Foundations (week 1)

These are prerequisites for every later phase. Ship first, ship together.

### 0.1 Consolidate the data model

- Decide `accounts` is the canonical table; drop `clients` after migrating references. (`src/database.ts:181, 320`)
- Add `org_id TEXT NOT NULL` to every business table, defaulting to `'elite'`. Even as a single tenant, this lets you add team members or sell the platform later without a schema surgery.
- Add universal tables (see §0.2).

### 0.2 Universal event log + audit log

New tables (to add to `src/database.ts`):

```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  kind TEXT NOT NULL,            -- e.g. 'lead.created', 'call.completed', 'invoice.paid'
  actor_type TEXT NOT NULL,      -- 'user' | 'agent' | 'system' | 'external'
  actor_id TEXT,                 -- user_id, agent_id, connector name, etc.
  subject_type TEXT NOT NULL,    -- 'account' | 'contact' | 'lead' | 'invoice' | 'call' | 'agent_run' | ...
  subject_id TEXT NOT NULL,
  at TEXT NOT NULL,              -- ISO timestamp
  cost_pence INTEGER DEFAULT 0,  -- what did this cost me
  payload_json TEXT NOT NULL,
  related_ids_json TEXT NOT NULL DEFAULT '[]',
  source TEXT                    -- 'stripe_webhook' | 'twilio_status' | 'ui' | 'openclaw' | ...
);
CREATE INDEX idx_events_subject ON events (org_id, subject_type, subject_id, at DESC);
CREATE INDEX idx_events_kind ON events (org_id, kind, at DESC);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  at TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  action TEXT NOT NULL,          -- 'account.update', 'invoice.create', 'secret.read', ...
  target_type TEXT,
  target_id TEXT,
  before_json TEXT,
  after_json TEXT,
  ip TEXT,
  user_agent TEXT,
  ok INTEGER NOT NULL,
  error TEXT
);

CREATE TABLE webhook_inbox (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  kind TEXT,
  received_at TEXT NOT NULL,
  signature_ok INTEGER NOT NULL,
  raw_body TEXT NOT NULL,
  processed_at TEXT,
  process_error TEXT
);

CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL,          -- 'running' | 'completed' | 'errored' | 'awaiting_approval'
  subject_type TEXT,
  subject_id TEXT,
  cost_pence INTEGER DEFAULT 0,
  tool_calls_json TEXT NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL DEFAULT ''
);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  requested_by TEXT NOT NULL,    -- agent_id usually
  action TEXT NOT NULL,
  subject_type TEXT,
  subject_id TEXT,
  rationale TEXT,
  cost_estimate_pence INTEGER,
  state TEXT NOT NULL,           -- 'pending' | 'approved' | 'rejected' | 'expired'
  decided_at TEXT,
  decided_by TEXT
);
```

Write a thin helper: `recordEvent({ kind, subject, payload, cost })` used everywhere external API calls complete. Start by wiring the hot paths: call started/completed, SMS sent/received, email sent/received, Stripe webhook, agent tool call, approval requested/resolved.

### 0.3 Auth + RBAC (even for a team of one)

Pick **one** of these, ranked by lock-in risk:

1. **WorkOS** (recommended) — SSO, SAML, magic link, SCIM. Enterprise buyers ask for WorkOS by name. Works in dev via magic link.
2. **Clerk** — faster to set up, great DX, more consumer-feeling.
3. **Self-hosted Lucia / Auth.js** — zero lock-in, more work.

Add middleware in `src/dashboard-server.ts` that:
- Parses `Authorization: Bearer …` OR a httpOnly cookie.
- Resolves `{ userId, orgId, roles[] }` from a session store.
- Attaches it to the request as `ctx`.
- Checks per-route role requirements from a table.

Tighten `Access-Control-Allow-Origin` to the allowed frontend origin(s) only.

### 0.4 Secrets + config hygiene

- Move `.env.local` behind **1Password CLI** (`op run --`) or **Doppler** so secrets never land on disk in plain text.
- Add `src/env.ts` with a `zod` schema that parses every expected env var, fails fast, and emits a typed `env` object. No more `process.env.X ?? ""` scattered around.
- Add `.env.validate` make target / npm script used by CI.

### 0.5 Job queue + background work

Pick **one**:

1. **Inngest** (recommended at this scale) — step-function style, durable, free tier generous, retries + DLQ built in.
2. **BullMQ** — self-hosted, needs Redis.
3. **Node `node:worker_threads` + SQLite-backed queue** — no deps, simplest, enough for single-operator.

Move `overnight-pipeline.ts` behind it. Add jobs for: lead enrichment, Firecrawl scrape, Kie image gen, Remotion render, Stripe webhook reconciliation, nightly backup, connector sync.

### 0.6 Observability

- **Sentry** for errors (frontend + backend).
- **Pino** structured logs (JSON), piped to a file + stdout. Add `traceId` + `userId` + `orgId` fields.
- **PostHog** for product analytics on the dashboard (which pages, which actions, funnel).
- **/metrics** Prometheus endpoint for basic process metrics (latency, error rate, queue depth).

### 0.7 Backups + durability

- Daily `VACUUM INTO /var/backups/elite-ops-YYYY-MM-DD.sqlite` + upload to Cloudflare R2.
- Weekly rotation, monthly permanence, quarterly restore drill.
- Consider **LiteFS** or **Turso** to replicate SQLite across machines without switching to Postgres yet.

### 0.8 CI/CD

- `.github/workflows/ci.yml` — `tsc --noEmit`, Vitest, Playwright smoke, Biome/ESLint, `vite build`.
- `.github/workflows/deploy.yml` — one-click deploy to the chosen host (Fly.io, Railway, or Cloudflare Containers).
- Branch previews for every PR (Vercel for frontend, Fly.io preview machines for backend).

**Definition of done for Phase 0:** the product looks the same to the user, but no route is accessible without auth, every external-state change writes an event, secrets are not on disk, errors surface in Sentry, and a clean machine can be restored from last night's backup.

---

## Phase 1 — Revenue engine (weeks 2–3)

The point of an agency OS is to make money. This phase wires the money.

### 1.1 Stripe as revenue operations, not just a read API

- New route `POST /api/webhooks/stripe` (`src/dashboard-server.ts`): verify `Stripe-Signature` header with `STRIPE_WEBHOOK_SECRET`, log to `webhook_inbox`, emit events (`invoice.finalized`, `invoice.paid`, `invoice.payment_failed`, `charge.dispute.created`, `customer.subscription.*`).
- New tables: `invoices`, `payments`, `subscriptions` — mirror Stripe locally so dashboards don't round-trip for every read.
- Dunning: when `invoice.payment_failed` fires, create an `approval` + schedule a reminder sequence (email → SMS → voice agent call).
- Payment links from dossier: one click to create a Stripe payment link for an accepted proposal.

### 1.2 Outreach sequences (multi-touch state machine)

- New table `sequences` + `sequence_steps` + `sequence_enrollments`.
- Each enrollment is a state machine: `drafted → sent → opened → replied → booked | dropped`.
- Triggers: lead qualified (auto-enroll), proposal sent (follow-up cadence), no-reply (bump), reply detected (stop).
- Open/click tracking pixels + UTMs.
- Compliance: per-country opt-out, list-unsubscribe header, GDPR lawful basis stored.

### 1.3 Reply detection + routing

- Gmail push (watch + Pub/Sub) or poll (current sync) detects replies.
- Classifier (OpenClaw or direct LLM) tags each reply: `positive | objection | question | out-of-office | unsubscribe | noise`.
- Positive/question → dossier + task + notify + stop sequence.
- Objection → dossier + suggested response draft + requires approval to send.
- OOO → reschedule sequence.

### 1.4 Deals + forecasting

- Add `deals` table (one per opportunity): stage, amount, close_probability, expected_close_date, owner, source, campaign.
- Analytics page gets a weighted-pipeline chart, velocity chart, win/loss by source.
- A deal can be linked to one or many accounts (for group deals) and one or many proposals.

### 1.5 Attribution

- Every lead keeps `source` + `campaign` + `medium` + `utm_*` + `first_touch_at` + `first_touch_event_id`.
- Closed-won events roll up by source → "where did £X come from this quarter".

### 1.6 Client portal MVP

- `/portal/:token` — branded per client, read-only: proposal, invoices, payment status, project stage, files, booking history.
- Magic-link access, no client password.
- Client messages → `events` → tasks for the right agent.

**Definition of done:** I can send a proposal from the dossier, the client pays via Stripe, Elite OS auto-files the invoice, starts onboarding tasks, and the Finance page shows the revenue attributed to the Firecrawl search that found the lead.

---

## Phase 2 — Data / API power-up (weeks 3–4)

Make the scoring and enrichment genuinely best-in-class. The order below is by revenue-impact / cost ratio.

### 2.1 Integrations to add (tier 1 — free or high ROI)

- **Companies House API** — free, UK company registry. Add years-active, officers, filings, SIC code, accounts-due dates. Instant trust + recency signal.
- **Google Places API / Google Business Profile** — richer and more reliable than scraping; photos, posts, attributes, hours.
- **PageSpeed Insights (Lighthouse) API** — free, Core Web Vitals + accessibility + SEO scores become audit inputs.
- **BuiltWith / Wappalyzer** — tech stack detection (jQuery-era sites = higher close-prob for your offer).
- **Hunter.io + NeverBounce** — find + verify decision-maker emails. Verification is non-negotiable for deliverability.
- **Cloudflare Turnstile** — bot protection for the client portal and any public form.

### 2.2 Integrations to add (tier 2 — grows with the agency)

- **Apollo.io** — or Lusha/RocketReach — full contact enrichment, phone numbers, direct dials, LinkedIn URLs.
- **Clay** — enrichment orchestrator on top of many sources; one API key, many signals.
- **LinkedIn Sales Navigator + PhantomBuster** — automated LinkedIn outreach, mindful of rate limits/TOS.
- **Calendly / Cal.com** — bookings; webhook into `events`.
- **Slack** — outbound only at first: daily brief, approvals queue, money events. Later, two-way commands.
- **Notion** — internal KB + ops runbook sync.
- **Perplexity / Tavily / Exa** — research APIs for agent grounding.
- **Ahrefs or Semrush** — SEO snapshot per lead (DR, backlinks, organic traffic, keyword gaps).
- **Google Search Console** — for won clients, read live search performance.
- **Sentry, PostHog** — already listed in 0.6 but they're APIs too.

### 2.3 Integrations to add (tier 3 — enterprise readiness)

- **WorkOS / Clerk** — from 0.3.
- **Apideck or Merge.dev** — unified CRM connector so clients can sync Elite OS into their HubSpot/Salesforce/Pipedrive.
- **DocuSign or PandaDoc** — proposal e-sign.
- **Resend or Postmark** — transactional email (replace SMTP for reliability).
- **Loops** — marketing/newsletter.
- **Vercel + Cloudflare R2 + Cloudflare Workers** — hosting + CDN + edge logic.

### 2.4 Integrations pattern — write once, run everywhere

Refactor `src/integrations.ts` into a registry where each connector implements:

```ts
interface Connector<TSummary> {
  provider: string;
  label: string;
  enables: string;
  missingEnv: () => string[];
  snapshot?: () => Promise<ConnectorSyncResult>;  // nightly sync
  webhook?: {                                     // if it pushes
    path: string;
    verify: (headers, raw) => boolean;
    handle: (parsed) => Promise<Event[]>;
  };
  tools?: ConnectorTool[];                        // callable by agents
  reader?: ConnectorReader;                       // UI + dossier
}
```

Everything — Firecrawl, Apify, Twilio, ElevenLabs, Stripe, Gmail, Plaid, Companies House, new ones — implements this interface. The server auto-mounts webhooks, the nightly job auto-runs snapshots, the command palette auto-includes the tools, and the dossier auto-renders the reader.

### 2.5 Scoring v2

Replace `src/scoring.ts` with a pluggable scorer:

- Signals registered with weights: `presence` (Google rating, review velocity, GBP completeness), `technical` (Lighthouse, CWV, mobile, schema, HTTPS, sitemap), `commercial` (Companies House activity, years, filings), `intent` (hiring signals, new press, stack changes), `contactability` (verified email, phone, LinkedIn, identified DM).
- Output: 0–100 score + per-signal breakdown + top-3 "what would move this score".
- Learn weights from your own close-won/close-lost outcomes (`deals` table). Start with expert weights, log predictions vs. outcomes, periodically re-fit.

### 2.6 Universal contact + account graph

- `contacts` today FKs to `clients` only. Add `contact_accounts` join table so one decision-maker can belong to multiple accounts (group owners, franchisees).
- `relationships`: director-of, referral-from, competitor-of. Useful for later "who else does Hamid know there" questions.

**Definition of done:** a lead comes in → within 2 minutes it has Companies House, Lighthouse, BuiltWith, Hunter-verified emails, an Apollo decision-maker lookup, and a v2 score with a "top 3 reasons" explanation in the dossier.

---

## Phase 3 — UI / UX overhaul (weeks 4–6)

Builds on the 1000% plan but with specific file-level changes.

### 3.1 Design-system hardening

Add these to `src/components/ui/` (new files):

- `WorkspaceHeader.tsx` — breadcrumb + title + status + freshness + primary action.
- `CommandInput.tsx` — reusable slash-filter + search pattern.
- `DataLedger.tsx` — premium dense table with pinned columns, column filters, bulk actions, keyboard nav, empty state, row-inspector hook.
- `EventTimeline.tsx` — renders `events` with icons by `kind` and tool/actor chips.
- `ApprovalCard.tsx` — standard who / what / why / cost / impact / approve / edit / reject.
- `PipelineBoard.tsx` — shared kanban powering Leads, Deals, Projects, Content, Finance.
- `InsightPanel.tsx` — chart + plain-English interpretation + suggested action.
- `EmptyState.tsx` — operational empty states ("no data because X; connect Y here").
- `ErrorBoundary.tsx` — per-page, with reset + Sentry tag.
- Grow `Skeleton.tsx` beyond 16 lines into a proper shimmer/skeleton kit.

### 3.2 Fix the dossier

- Remove the `2xl:flex` gate in `src/components/os/ObjectDossierPanel.tsx:42`. Make it a collapsible drawer that is always available; key `]` toggles it.
- Add `buildCallDossier`, `buildInvoiceDossier`, `buildAgentDossier`, `buildApprovalDossier`, `buildProjectDossier`, `buildContactDossier` in `src/os/os-spine.ts`.
- Selection state lives in a Zustand store so any page can open a dossier for any subject.

### 3.3 Global command palette v2

- Index: accounts, contacts, leads, tasks, calls, SMS threads, email threads, invoices, payment links, proposals, files, agent runs, approvals, settings pages, help docs, and every registered connector tool.
- Typeahead is fuzzy across title + keywords + subject_id + recent events.
- Natural-language: type `call hamid's brother about oldham lead` → routes to OpenClaw with context.
- Recent + suggested sections.
- Scoped palette (`Cmd+P` for "find anywhere" vs `Cmd+K` for "act here").

### 3.4 Mission control (OPS) v2

- Rebuild `src/pages/ops/OpsCommandPage.tsx` around a `PipelineBoard` with lanes: Inbox, Planning, Executing, Reviewing, Waiting, Done.
- Every card is a mission: lead to qualify, demo to build, email to send, campaign to launch, invoice to chase, content piece to publish, agent job to review.
- Filters: owner (human or agent), source module, due today, overdue, stuck, high cost.

### 3.5 Client 360 rebuild

Rebuild `src/pages/crm/*` around a single `<ClientRecord>` component with tabs: Overview, People, Timeline, Deals, Emails, Calls, Messages, Invoices, Files, Notes, Memory, Audit, Delivery. Every tab reads from the universal event log + the relevant table, not from page-specific endpoints.

### 3.6 Agents as a workforce

Rebuild `src/pages/AgentsPage.tsx` (51k lines today — worth breaking up) into one row per agent:

- Role, tools granted, budget this week, approvals required, work-in-progress, last 10 actions, error state.
- A "dry run" button: pretend to do your next action and show the cost/impact/approval requirement before committing.

### 3.7 Visual language pass

Follow the anti-slop rules from the 1000% plan: no isolated cards, structured panes + ledgers + timelines, one accent per state, top-left hierarchy, right-side context panel not modals, all charts with labels/source/freshness + one-sentence interpretation, empty states that teach.

**Definition of done:** opening Elite OS on any device shows a command surface, a dossier, a mission board, and answers the 9 questions from the 1000% plan in <30 seconds.

---

## Phase 4 — Agent workforce (weeks 6–8)

OpenClaw today is a gateway to generic agents. The goal: make each agent a named role with a job description, tools, budgets, and a runbook.

### 4.1 Named agents

Codify the roles from the 1000% plan (`JARVIS`, `OPS`, `LEADGEN`, `OUTREACH`, `BUILDER`, `CONTENT`, `FINANCE`, `SUPPORT`) as rows in a new `agents` table with:

- `role`, `system_prompt`, `tools_json`, `models_json`, `weekly_budget_pence`, `requires_approval_json`, `runbook_md`.
- Each has its own OpenClaw session family; runs are tracked in `agent_runs` (§0.2).

### 4.2 Tool-use sandbox

Every integration connector's `tools` (§2.4) is gated by agent role. `OUTREACH` gets Gmail.send only for templates in a whitelisted set. `FINANCE` gets Stripe.read but not Stripe.createInvoice without approval. `BUILDER` gets Kie, Firecrawl, Playwright. Budget ceilings enforced in the queue layer.

### 4.3 Approvals as first-class UI

`src/pages/ops/ApprovalsPage.tsx` becomes a live stream of `approvals` rows with the `ApprovalCard` primitive. Swipe/keyboard approve, explain-why prompt stored, cost running total.

### 4.4 Agent memory

A shared vector store of past calls, emails, proposals, and outcomes. Each agent can `memory.search("dental practices Oldham objections")`. Use Turso + `sqlite-vec` to keep the SQLite-first story going, or add pgvector if moving to Postgres later.

### 4.5 Daily brief

Every morning `JARVIS` writes a briefing: what changed overnight, what needs approval, what calls are scheduled, where the money is this week, what the agents propose to do today. Posted to Slack + shown as the Command Centre hero.

---

## Phase 5 — Enterprise hardening (weeks 8–10)

### 5.1 Compliance + governance

- **GDPR / UK-GDPR**: export-all + delete-for-contact endpoints, data-retention policy by table, PII classification.
- **SOC 2 Type 1 readiness**: use Vanta or Drata for controls, or hand-rolled.
- **DPA template** + subprocessor list (each tier-1/tier-2 connector).
- **Audit log** is immutable (append-only table + nightly hash chain).

### 5.2 Multi-tenant hardening

- `org_id` scoping middleware: every query takes `ctx.orgId`, no exceptions. Add a test that scans for queries missing it.
- Row-level checks in the DB layer (helper wrappers) rather than per-endpoint.
- Per-org secrets (not just env vars) stored encrypted with a KMS key — enables you to sell Elite OS to other agencies later.

### 5.3 Deployment topology

- App on **Fly.io** or **Railway** (3 machines, rolling deploys).
- SQLite on **LiteFS** (primary + 2 replicas) for HA, or graduate to **Postgres on Neon/Supabase**.
- Static assets + R2.
- Cloudflare in front for WAF, rate limits, bot mgmt, DDoS.

### 5.4 Performance + scale

- Break `dashboard-server.ts` into Fastify plugins by module (crm, stripe, twilio, …). One file per route group.
- Read-replicas for reports.
- Turn the 100+ routes into an `openapi.yaml` so clients can be generated (replace hand-written `src/services/api.ts`).

### 5.5 Security hardening

- **Secrets** behind KMS (Infisical, Doppler, or AWS KMS envelopes).
- **CSP**, **HSTS**, **COOP/COEP**, **Referrer-Policy**, **Permissions-Policy** headers.
- **CSRF** double-submit cookie for cookie-auth endpoints.
- **Rate limiting** in Cloudflare + per-route per-user (not per-IP) limits.
- **SBOM** generated in CI.
- **Dependabot** / Renovate on.
- **Pen-test** externally before first enterprise customer.

### 5.6 SLAs + status

- `status.eliteautomations.co.uk` (Instatus or roll your own).
- Error budget policy, on-call rota (even if it's just you + agents).

---

## Phase 6 — Platform as product (months 3–6)

Optional, but the point of the enterprise posture above is that you can do this without a rewrite.

- Offer Elite OS to peer agencies as a SaaS. Billing via Stripe (dogfood).
- Onboarding flow, marketing site, docs, support inbox, help center.
- Marketplace of connector packs ("Plumbing vertical pack" = pre-tuned scoring + templates + agent prompts).
- Affiliate/partner program.

---

## Integration checklist — everything, ranked

Legend: ✅ already wired · 🟡 partial · ⬜ not present · 💷 direct revenue impact · ⚡ speed impact · 🛡 compliance/enterprise.

| Tier | API | Purpose | Status | Impact |
|---|---|---|---|---|
| 0 | Firecrawl | Search + scrape | ✅ | ⚡ |
| 0 | Apify | Actors / enrichment | ✅ | ⚡ |
| 0 | Kie.ai | Image + video | ✅ | ⚡ |
| 0 | Twilio | Calls + SMS | ✅ | 💷 |
| 0 | ElevenLabs | Voice agents | ✅ | 💷 |
| 0 | Stripe | Payments | 🟡 (no webhook) | 💷💷💷 |
| 0 | Gmail | Inbox + send | 🟡 (OAuth + list only) | 💷 |
| 0 | Plaid | Banking | ✅ | ⚡ |
| 0 | RevenueCat | App subs | ✅ | ⚡ |
| 0 | App Store Connect | Apple reports | ✅ | ⚡ |
| 0 | OpenClaw | AI workforce | ✅ | ⚡ |
| 1 | Companies House | UK registry | ⬜ | 💷💷 |
| 1 | Google Places / GBP | Place data | ⬜ | 💷 |
| 1 | PageSpeed / Lighthouse | Audit signals | ⬜ | 💷 |
| 1 | BuiltWith | Tech stack | ⬜ | 💷 |
| 1 | Hunter.io | Email find | ⬜ | 💷💷 |
| 1 | NeverBounce | Email verify | ⬜ | 💷 🛡 |
| 1 | Cloudflare Turnstile | Bot protection | ⬜ | 🛡 |
| 2 | Apollo.io | Contact enrichment | ⬜ | 💷💷💷 |
| 2 | Clay | Enrichment graph | ⬜ | 💷💷 |
| 2 | LinkedIn Sales Nav + PhantomBuster | Outbound | ⬜ | 💷💷 |
| 2 | Calendly / Cal.com | Bookings | ⬜ | 💷 |
| 2 | Slack | Ops + alerts | ⬜ | ⚡ |
| 2 | Notion | KB | ⬜ | ⚡ |
| 2 | Perplexity / Tavily / Exa | Research | ⬜ | ⚡ |
| 2 | Ahrefs / Semrush | SEO | ⬜ | 💷 |
| 2 | Google Search Console | SEO (won clients) | ⬜ | 💷 |
| 2 | Sentry | Errors | ⬜ | 🛡 |
| 2 | PostHog | Product analytics | ⬜ | ⚡ |
| 3 | WorkOS / Clerk | SSO | ⬜ | 🛡 |
| 3 | Apideck / Merge.dev | CRM sync | ⬜ | 💷 |
| 3 | DocuSign / PandaDoc | E-sign | ⬜ | 💷 |
| 3 | Resend / Postmark | Transactional email | ⬜ | 💷 🛡 |
| 3 | Loops | Newsletter | ⬜ | 💷 |
| 3 | Vercel + Cloudflare R2 | Hosting + CDN | ⬜ | 🛡 |
| 3 | Fly.io / Railway | App runtime | ⬜ | 🛡 |
| 3 | Turso / LiteFS / Neon | DB | ⬜ | 🛡 |
| 3 | Infisical / Doppler | Secrets | ⬜ | 🛡 |
| 3 | Vanta / Drata | SOC 2 | ⬜ | 🛡 |

---

## Suggested execution order

If you can only touch 10 things in the next 30 days, do these, in this order:

1. Add auth + CORS lockdown + per-user rate limit (Phase 0.3) — **unblocks everything else safely**.
2. Add `events`, `audit_log`, `webhook_inbox`, `approvals`, `agent_runs` tables (Phase 0.2).
3. Stripe webhook + invoices/payments tables (Phase 1.1).
4. Companies House + PageSpeed + Hunter + NeverBounce + BuiltWith (Phase 2.1).
5. Scoring v2 (Phase 2.5).
6. Dossier out of the 2xl-only hiding; palette indexes more subjects (Phase 3.2–3.3).
7. Mission control v2 + `ApprovalCard` primitive (Phase 3.1, 3.4).
8. Inngest or equivalent queue; move overnight pipeline to it (Phase 0.5).
9. Sentry + Pino + PostHog (Phase 0.6).
10. Consolidate `clients` → `accounts`, add `org_id`, kill `dashboard.ts` legacy (Phase 0.1).

After that, Phase 4 (agent workforce) and Phase 5 (hardening) are what get you to "sellable to enterprise".

---

## The success test

Elite OS is enterprise-grade the day all of these are true:

- Every screen is behind login; every action is attributed and logged.
- Every external event (invoice paid, call completed, reply received) lands in the universal event log within seconds and appears in the right dossier.
- Every agent has a budget, a toolset, a runbook, and an approval queue.
- The scoring model is demonstrably better than static rules (measured against closed-won).
- A clean machine restores from last night's backup in <15 minutes.
- A new connector takes one day to add because of the `Connector` interface.
- The money-where-from chart is live, per source, and matches Stripe to the penny.
- The command palette finds any object in the business in <200ms.
- The dossier answers "what should I do about this right now" without page hopping.

That's the product that scales you to whatever ambition "£500M" maps to — whether it's your own agency throughput or a platform you sell to every agency like you.
