# Elite Automations Ops — Setup Guide

**v3.0 — React 19 + Fastify-style CRM + OpenClaw AI Agents**

---

## 1. Prerequisites (macOS)

### Node.js 22

```bash
brew install nvm
mkdir -p ~/.nvm
export NVM_DIR="$HOME/.nvm"
source "$(brew --prefix nvm)/nvm.sh"
nvm install 22
nvm use 22
node -v   # should print v22.x.x
```

> Node 22 is required — the backend uses the built-in `node:sqlite` module which is only available in Node 22+.

---

## 2. Install dependencies

```bash
npm install
```

This installs both the frontend and backend stack in one go:

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS v4, React Router v7, Zustand v5, React Query, Framer Motion, Recharts, Lucide React |
| Backend | Node 22 built-ins (sqlite, http, fs), TSX, Zod v4 |
| Pipeline | Firecrawl SDK, Remotion, Cheerio, Stripe SDK |
| AI Agents | OpenClaw gateway client (local HTTP + SSE) |

---

## 3. Environment variables

Copy the example file and fill in your keys:

```bash
cp .env.example .env.local
```

Your `.env.local` should contain:

```env
# ── Lead discovery ──────────────────────────────────────────
FIRECRAWL_API_KEY=          # firecrawl.dev → Dashboard → API
FIRECRAWL_BASE_URL=https://api.firecrawl.dev/v2
APIFY_TOKEN=                # apify.com → Settings → Integrations → API token
APIFY_BASE_URL=https://api.apify.com/v2

# ── Brand image generation ───────────────────────────────────
KIE_API_KEY=                # kie.ai → Account → API
KIE_BASE_URL=https://api.kie.ai

# ── Mailbox sync (optional) ─────────────────────────────────
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_USER_EMAIL=hamid@eliteautomations.co.uk

# ── Banking / app revenue sync (optional) ───────────────────
PLAID_ENV=sandbox
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ACCESS_TOKEN=
REVENUECAT_API_KEY=
REVENUECAT_PROJECT_ID=
ASC_ISSUER_ID=
ASC_KEY_ID=
ASC_PRIVATE_KEY_PATH=
ASC_VENDOR_NUMBER=

# ── Payments (optional) ─────────────────────────────────────
STRIPE_PUBLISHABLE_KEY=     # dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=

# ── Real outbound email (optional) ──────────────────────────
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Hamid <noreply@eliteautomations.co.uk>

# ── Local AI agents ─────────────────────────────────────────
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_API_TOKEN=         # leave blank if no auth set
OPENCLAW_HOME=~/.openclaw   # where agent state is stored

# ── App config ───────────────────────────────────────────────
ELITE_NAME=Hamid
ELITE_BRAND=Elite Automations
ELITE_DOMAIN=eliteautomations.co.uk
DASHBOARD_PORT=3007

# ── Pipeline limits ──────────────────────────────────────────
PIPELINE_MAX_PER_QUERY=8
PIPELINE_MAX_QUALIFIED=10
```

---

## 4. Where to get the keys

### Firecrawl (lead discovery + website scraping)
1. Go to [firecrawl.dev](https://firecrawl.dev) → Sign up
2. Dashboard → API Keys → Copy key

### Apify (actor-based enrichment)
1. Go to [apify.com](https://apify.com) → Sign up
2. Settings → Integrations → API token → Copy token
3. Use the Research page to search actors, paste actor input JSON, and run enrichment jobs

### Gmail (real mailbox sync)
1. Create a Google Cloud OAuth app with Gmail API enabled
2. Add the Gmail readonly/send scopes you need and generate a refresh token for Hamid's mailbox
3. Put `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, and `GMAIL_USER_EMAIL` into `.env.local`
4. Without these variables, the Mail page shows CRM email drafts only and clearly marks Gmail as disconnected

### Plaid (banking and cashflow)
1. Create a Plaid app at [dashboard.plaid.com](https://dashboard.plaid.com)
2. Put `PLAID_ENV`, `PLAID_CLIENT_ID`, and `PLAID_SECRET` into `.env.local`
3. Generate a Link token from `POST /api/plaid/link-token`, complete Plaid Link in the browser, then exchange the public token with `POST /api/plaid/exchange-public-token`
4. Store the returned access token as `PLAID_ACCESS_TOKEN` in `.env.local`; never paste bank login details into the dashboard

### RevenueCat (mobile subscription revenue)
1. Go to [app.revenuecat.com](https://app.revenuecat.com) → Project settings → API keys
2. Add `REVENUECAT_API_KEY` and `REVENUECAT_PROJECT_ID` to `.env.local`
3. The System Health page can sync project and product snapshots into SQLite

### App Store Connect (Apple app operations)
1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → Users and Access → Integrations → App Store Connect API
2. Create an API key and save `ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_PRIVATE_KEY_PATH`, and `ASC_VENDOR_NUMBER`
3. Keep the `.p8` key file outside git and point `ASC_PRIVATE_KEY_PATH` at it

### SMTP (real outbound email)
1. Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` to `.env.local`
2. If SMTP is missing, the app logs drafts only and explicitly says no external email was sent

### KIE.ai (brand image generation)
1. Go to [kie.ai](https://kie.ai) → Sign up
2. Account → API → Copy key

### Stripe (optional — for tracking deal payments)
1. Go to [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
2. Copy the publishable key + secret key (or a restricted key with read access)

### OpenClaw (local AI agents — optional)
1. Install and start the OpenClaw gateway:
```bash
npm install -g @openclaw/cli
openclaw init
openclaw gateway start
```
2. If you set token auth, copy the token into `OPENCLAW_API_TOKEN`
3. Leave `OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789` as-is for local use
4. If not using OpenClaw, the Agents page will show a connection error — everything else still works

---

## 5. Start the full stack

```bash
npm run dev
```

This runs two processes concurrently:

| Process | URL | What it does |
|---|---|---|
| React frontend (Vite) | http://localhost:5173 | Dashboard UI |
| CRM backend | http://localhost:3007 | API + SQLite + SSE events |

The frontend proxies all `/api/*` requests to the CRM backend automatically.

---

## 6. All available commands

```bash
# Development
npm run dev              # Start both frontend + backend (recommended)
npm run frontend:dev     # Frontend only (Vite dev server)
npm run dashboard:dev    # Backend only (CRM server on :3007)

# Production
npm run build            # TypeScript check + Vite production build → dist/

# Lead pipeline
npm run pipeline         # Discover + enrich + qualify leads (writes to DB)

# Video generation
npm run videos:render    # Render Remotion lead preview videos
```

---

## 7. Dashboard pages

| Page | Route | What's there |
|---|---|---|
| Command Centre | `/` | Live greeting, stats, recent leads, activity feed |
| Leads Pipeline | `/leads` | Kanban + table view, search & filter |
| Lead Detail | `/leads/:id` | Full audit, scores, tasks, notes, demo link |
| Daily Planner | `/planner` | Timeline scheduler, streak tracker |
| Analytics | `/analytics` | Funnel, health pie, score distribution, deal values |
| Agents | `/agents` | OpenClaw mission control, live event stream |
| Settings | `/settings` | Theme selector, API key manager, data export |

---

## 8. Verify everything is working

After `npm run dev` opens, run these checks:

```bash
# Backend health
curl http://localhost:3007/api/health

# Pipeline state (leads data)
curl http://localhost:3007/api/state | head -c 500

# Client 360 spine
curl http://localhost:3007/api/client-360 | head -c 500

# Mail connector status
curl http://localhost:3007/api/mail/status

# Apify connector status
curl http://localhost:3007/api/ai/apify/status

# OpenClaw gateway (only if running)
curl http://localhost:18789/
```

The frontend should open automatically at `http://localhost:5173`.

---

## 9. Running the lead pipeline

Once your API keys are set:

```bash
npm run pipeline
```

This will:
1. Search for businesses in 12 Greater Manchester areas
2. Scrape and enrich each website via Firecrawl
3. Score each lead (100-point audit across 10 categories)
4. Generate demo HTML + email copy for qualified leads
5. Sync everything to the SQLite database

Results appear live in the dashboard within seconds of completing.

---

## 10. File structure

```
elite-automations/
├── src/
│   ├── app/           # React app entry + stores/hooks
│   ├── components/    # UI primitives, layout, feature components
│   ├── hooks/         # useTime, useNotifications
│   ├── pages/         # All dashboard pages
│   ├── services/      # API client + OpenClaw client
│   ├── stores/        # Zustand state (schedule, theme, settings)
│   ├── styles/        # Tailwind tokens + base CSS
│   ├── types/         # Frontend TypeScript types
│   ├── config.ts      # Pipeline configuration
│   ├── database.ts    # SQLite database layer
│   ├── dashboard-server.ts  # HTTP API server
│   └── index.ts       # Main pipeline entry
├── output/            # Generated demos, emails, images, DB
├── .env.local         # Your keys (gitignored)
├── .env.example       # Template
├── package.json
├── vite.config.ts
└── tsconfig.json
```
