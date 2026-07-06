# Elite OS 1000 Percent Upgrade Plan

Date: 2026-04-19
Scope: `http://localhost:5173/#/` main dashboard

## Design Thesis

Elite OS should feel like a private-bank operations terminal crossed with a calm AI mission-control room: dense, quiet, decisive, expensive, and built around action. The goal is not more cards, glow, or decoration. The goal is a system where Hamid can open one surface and instantly know what is happening, what is blocked, what costs money, what needs approval, and what the agents should do next.

## Research Takeaways

- Linear's redesign is the closest product-design reference for our app shell: reduce visual noise, increase navigation density, align chrome, and make the product evolve from a set of tools into a system.
- Apple HIG reinforces that the most important information should sit near the top and leading side, controls should be visually distinct from content, and layouts must adapt while staying familiar.
- Action-centric dashboard research says dashboards should be purpose-built around decisions and workflows, not static reports. The top view should show only essential signals, grouped for insight, with enough whitespace to keep cognition calm.
- Carbon and enterprise design systems reinforce that data visualization must tell accurate, accessible stories, not just render charts.
- Stripe, Gmail, HubSpot, Twilio, ElevenLabs, and Apify docs all point to the same product architecture: the serious systems are event-driven. Webhooks, callbacks, timeline events, API runs, call states, invoices, and message IDs should become first-class timeline events inside Elite OS.

## Current Diagnosis

The app already has many valuable modules: CRM, AI, OPS, calls, mail, pay, personal, agents, video, timeline, leads, planner, analytics, and settings. The issue is not that it lacks pages. The issue is that it still behaves like a collection of pages instead of one operating system.

The missing layer is a shared operational spine:

- A universal object model connecting clients, leads, projects, calls, messages, invoices, agent runs, approvals, tasks, files, and timeline events.
- A universal activity timeline that becomes the truth layer across CRM, mail, Twilio, ElevenLabs, Stripe, Firecrawl, Apify, and OpenClaw.
- A global command surface where Hamid can ask, search, approve, assign, create, and navigate without hunting through modules.
- A persistent inspector/dossier panel that shows the selected client, lead, call, invoice, project, or agent run from anywhere.
- A single "Today / Inbox / Next" layer that turns all data into decisions.

## North-Star Product Model

Elite OS should have four foundations:

1. Object Graph
Every important thing in the business is a typed object: account, contact, lead, opportunity, project, deliverable, invoice, payment, call, SMS, email, agent run, approval, task, file, content item, automation, and booking.

2. Event Timeline
Every system writes into one normalized timeline. A lead found by Firecrawl, a call answered by ElevenLabs, an invoice paid in Stripe, an email reply from Gmail, and an Apify actor run should all use the same event grammar.

3. Action Engine
Every event can suggest next actions. Sensitive actions require approval. Expensive actions check budgets. Autonomous actions are logged with agent, tool, rationale, cost, and outcome.

4. Operating Shell
The UI shell should be consistent everywhere: rail, module sidebar, command/search bar, main workspace, right inspector, notification/approval drawer, and universal keyboard shortcuts.

## 1000 Percent Upgrade Priorities

### 1. Build The Global Command Layer

Add a `Cmd/Ctrl + K` command palette that can:

- Search every object: clients, leads, contacts, calls, messages, invoices, projects, files, agent runs, tasks, and settings.
- Run commands: create client, add task, call lead, draft email, generate demo, create invoice, ask JARVIS, open approval queue.
- Show recent entities and suggested next actions.
- Route natural-language commands to the right module or agent.

This is the biggest perceived-power upgrade because it makes the whole system feel alive.

### 2. Add The Right-Side Dossier Inspector

Every page should support a persistent inspector panel. Selecting anything opens its dossier:

- Client identity, status, score, owner, tags, and value.
- Latest timeline events.
- Next best action.
- Related emails, calls, invoices, projects, files, and agent runs.
- Buttons for call, email, invoice, schedule, approve, assign, or ask agent.

This removes the need to jump between pages and makes the app feel like a cockpit.

### 3. Turn CRM Into Client 360

The CRM should be upgraded from overview/contact/activity pages into a full client record system:

- Account record with company, people, opportunities, projects, invoices, communication history, files, notes, and health score.
- Relationship timeline with calls, emails, SMS, bookings, payments, proposals, meetings, agent actions, and delivery progress.
- Client portal readiness: login, project status, invoices, files, booking history, support messages, and handover checklist.
- Clear stages: Lead, Qualified, Demo Sent, Call Booked, Proposal, Won, Onboarding, Active, Aftercare, Dormant.

### 4. Create The Mission Control Board

The OPS page should become the business operating board:

- Global Kanban: Inbox, Planning, Executing, Reviewing, Waiting, Done.
- Every card is a unit of work: lead, audit, email campaign, demo build, booking, project task, invoice, content piece, or agent job.
- Cards show owner agent, human owner, SLA, due time, last action, blocked reason, cost estimate, and approval state.
- Stuck items are highlighted because no activity happened within the expected window.

### 5. Make Agents Visible As A Workforce

Agents should not be generic chat panels. They should be operating roles:

- JARVIS: strategy, priorities, weekly plans, pivots.
- OPS: stuck work, pipeline hygiene, approvals, daily focus.
- LEADGEN: searches, enrichment, qualification.
- OUTREACH: emails, follow-ups, reply handling.
- BUILDER: demo sites, images, videos, delivery.
- CONTENT: posts, scripts, landing copy.
- FINANCE: costs, invoices, spend alerts.
- SUPPORT: future client replies and updates.

Each agent needs:

- Responsibility tags.
- Tool access list.
- Budget and rate limits.
- Current workload.
- Last actions.
- Approval-required tools.
- Error/stuck status.

### 6. Upgrade Client Portals

The client portal should become a sellable product proof point:

- Client sees project stage, timeline, files, invoice/payment status, next meeting, action requests, and handover checklist.
- Voice agent can fetch project status by reference number.
- Portal is branded per client and connected to Stripe payment state.
- Client messages and support requests become timeline events and OPS tasks.

### 7. Make Twilio And ElevenLabs Event-Native

Calls cannot live as logs only. They need to become business events:

- Incoming call started, answered, missed, failed, recorded, transcribed, analyzed.
- ElevenLabs post-call transcript, summary, intent, lead quality, booking request, and next action.
- Twilio status callbacks for initiated, ringing, answered, completed, busy, failed, no-answer.
- Booking created, SMS sent, email confirmation sent, follow-up task created.
- Reference number generated and attached to account/project.

### 8. Make Stripe A Revenue Operations Layer

Pay should not only show products and payment links. It should show revenue operations:

- Customers, invoices, payment links, subscriptions, products, refunds, disputes, failed payments, overdue invoices, and collected revenue.
- Invoice pipeline: Draft, Sent, Viewed, Paid, Overdue, Failed, Refunded.
- Client-level money view inside the dossier.
- Payment link generation from a proposal or accepted call outcome.
- Stripe webhook events normalized into the universal timeline.

### 9. Add Design-System Hardening

The app needs stronger product UI primitives:

- `WorkspaceHeader`: breadcrumb, title, status, freshness, primary action.
- `CommandInput`: global and local search/filter pattern.
- `DataLedger`: premium dense table with pinned columns, filters, bulk actions, empty state, and row inspector.
- `ObjectDossier`: right inspector shell.
- `EventTimeline`: reusable normalized event stream.
- `ApprovalCard`: standard who/what/why/cost/impact/approve/edit/reject.
- `PipelineBoard`: reusable board for leads, projects, content, finance, and agent tasks.
- `InsightPanel`: chart plus plain-English interpretation and suggested action.

### 10. Fix The Visual Language

The design direction should become:

- Fewer isolated cards. More structured panes, ledgers, timelines, split views, and boards.
- Higher information density, but with calmer alignment.
- One accent per state. Avoid rainbow dashboards unless the colors encode meaning.
- Less marketing copy. More operational copy.
- Strong top-left hierarchy: what this page is, what changed, what needs action.
- Right panels for context, not more modals.
- Charts must always include labels, date ranges, source, freshness, and one sentence of interpretation.
- Empty states must be operational: what is missing, why it matters, and how to connect/fix it.

## Recommended Build Order

1. Global search and command palette.
2. Universal object/event schema and timeline normalization.
3. Right-side dossier inspector.
4. CRM Client 360 redesign around accounts and timelines.
5. Mission Control work board for OPS.
6. Agent workforce observability with tools, caps, approvals, and runbooks.
7. Twilio and ElevenLabs event capture into timeline.
8. Stripe revenue operations and payment automation.
9. Client portal MVP.
10. Design-system hardening pass across every module.

## Anti-Slop Rules

- No new dashboard page unless it answers a specific business question.
- No chart without a recommended action.
- No integration without writing events into the universal timeline.
- No autonomous agent action without owner, rationale, cost, impact, and audit log.
- No sensitive external-world action without approval.
- No new visual style per page.
- No mock data where a real integration exists.
- No decorative UI that does not improve scanning, confidence, or decision speed.

## Definition Of A Proper Operating System

Hamid should be able to open Elite OS and answer these in under 30 seconds:

- Who should I contact next?
- Which client or lead is closest to money?
- What is blocked?
- What did the agents do while I was away?
- What did it cost?
- What needs my approval?
- What calls, emails, payments, or bookings happened today?
- Which client projects need attention?
- What should happen automatically next?

If the dashboard answers those questions, it becomes more than a UI. It becomes the business.

## References Consulted

- Linear: How we redesigned the Linear UI: https://linear.app/now/how-we-redesigned-the-linear-ui
- Apple Human Interface Guidelines: Layout: https://developer.apple.com/design/human-interface-guidelines/layout
- Qualtrics XM Institute: Action-centric dashboard design: https://www.qualtrics.com/articles/customer-experience/action-centric-dashboard-design/
- IBM Carbon Design System: Dashboards: https://carbondesignsystem.com/data-visualization/dashboards/
- Stripe docs: Customer portal and customer management: https://docs.stripe.com/customer-management
- Gmail API docs: List Gmail messages: https://developers.google.com/workspace/gmail/api/guides/list-messages
- Twilio docs: Call resource and status callbacks: https://www.twilio.com/docs/voice/api/call-resource
- Twilio docs: Voice webhooks: https://www.twilio.com/docs/usage/webhooks/voice-webhooks
- ElevenLabs docs: Post-call webhooks: https://elevenlabs.io/docs/conversational-ai/workflows/post-call-webhooks
- ElevenLabs docs: Twilio personalization: https://elevenlabs.io/docs/conversational-ai/phone-numbers/twilio-integration/customising-calls
- Apify docs: Run Actor API: https://docs.apify.com/api/v2/act-runs-post
