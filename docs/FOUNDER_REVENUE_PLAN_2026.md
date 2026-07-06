# Elite Automations Founder Revenue Plan

Date: 2026-05-02
Owner: Hamid

## Goal

Build a one-person AI automation business that can produce real cashflow first, then compound into software, data, and agent-driven operations. The near-term goal is not vague passive income. The near-term goal is to get paid by local businesses for measurable improvements: more enquiries, faster follow-up, better websites, and automated customer handling.

## Research Signals

- UK SMEs already treat digital tools as important, but they still need reliable, personalised support to adopt them. Source: GOV.UK, "Understanding technology adoption among UK SMEs", published 2025-07-31.
- McKinsey's 2025 AI survey says 88% of organisations use AI in at least one business function, but only about one-third have started scaling AI across the enterprise. This means the market is interested but implementation is still messy.
- McKinsey also reports revenue benefits are most common in marketing and sales, strategy/corporate finance, and product/service development. That points us toward offers tied to lead generation, conversion, customer service, and revenue operations.
- Business.com’s 2026 Small Business AI Outlook says 62% of SMBs have at least partially adopted AI in customer service and marketing, but workflow automation tool use is still much lower than chatbot use. That gap is an agency opportunity.
- Reimagine Main Street’s 2025 survey says 77% of active small-business AI users see marketing and customer engagement as the biggest impact area; 84% are willing to automate marketing content and 59% customer service inquiries.

Sources:
- https://www.gov.uk/government/publications/understanding-technology-adoption-among-uk-smes
- https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai
- https://www.business.com/articles/ai-usage-smb-workplace-study/
- https://www.reimaginemainstreet.org/ai-survey-press-release

## Chosen Wedge

Start with a local AI conversion and follow-up agency for high-value appointment businesses in Greater Manchester.

Primary niche for the first sprint: dental practices.

Why dental first:
- One extra private patient can be worth much more than a small website fee.
- Many practices still rely on weak websites, slow follow-up, and generic contact forms.
- The offer can be proven with a free demo homepage, missed-opportunity audit, and patient enquiry follow-up workflow.
- Existing workspace assets already include dental/health demos and an agency operating system, so we can move faster.

Secondary niches after proof:
- estate agents and letting agents
- accountants
- solicitors
- physiotherapists/chiropractors
- beauty clinics

## First Paid Offer

Name: Patient Enquiry Growth System

Price test:
- Setup: GBP 750 to GBP 2,500
- Monthly care: GBP 250 to GBP 750
- Optional performance bonus: only after a clean attribution process exists

Deliverables:
- 10-minute website and conversion audit
- Free demo page showing a better patient enquiry journey
- Clear call-to-action and trust proof rewrite
- AI-assisted enquiry reply drafts
- Missed-call / enquiry follow-up workflow
- Monthly lead and response report

What we do not promise:
- Guaranteed patients
- Medical advice
- Fake reviews or misleading claims
- Fully autonomous outbound without approval

## Sales Motion

1. Find 20 local practices with weak websites or unclear enquiry flows.
2. Build 5 personalised demo pages and email drafts.
3. Contact owners/managers manually first.
4. Ask one simple question: "Do you want me to send the free demo I made for your website?"
5. If they reply yes, send demo + short Loom-style walkthrough.
6. Close a simple paid setup: "I can install this properly and connect the follow-up workflow this week."

## Agent Operating Model

Human approval stays required for outbound messages, contracts, payments, and anything using sensitive data.

Agents can safely do:
- lead discovery
- public website audits
- demo page generation
- email draft writing
- CRM updates
- follow-up reminders
- proposal drafts
- reporting

Agents must not auto-send:
- cold emails
- WhatsApp/SMS messages
- contract terms
- payment requests

## First 7 Days

Day 1:
- Focus pipeline on dental practices in Oldham and Rochdale.
- Generate first 2 qualified leads with demos and email drafts.
- Review copy manually before any outreach.

Day 2:
- Build a sharper dental landing/demo template.
- Create a one-page offer page for Elite Automations.

Day 3:
- Prepare 10 outreach drafts.
- Manually send only after approval.

Day 4:
- Call or email follow-up for non-responders.
- Record objections in CRM.

Day 5:
- Create proposal template and Stripe payment link workflow.

Day 6:
- Improve pipeline based on what was slow or low quality.

Day 7:
- Review numbers: leads found, demos built, replies, booked calls, money collected.

## Current System Status

The project at `elite-automations` is the operating system for this business. It already has:
- lead discovery code
- website audit scoring
- demo page generation
- email draft creation
- CRM JSON/SQLite output
- dashboard UI
- Stripe integration hooks

Added on 2026-05-11:
- Added the Agency Launch OS at `#/agency`.
- The new surface turns the white-label AI agency pattern into Hamid's own operating model: choose a vertical wedge, model setup plus monthly care revenue, generate a launch brief, run the five-day first-client sprint, and keep credibility guardrails visible.
- The first sellable wedge remains dental practices, with medspas, estate agents, solicitors, and accountants held as expansion templates after proof.

Changes made on 2026-05-02:
- Added command-line targeting with `PIPELINE_AREAS`.
- Added command-line targeting with `PIPELINE_BUSINESS_TYPES`.
- Added progress logs for search, audit, skip, and qualification stages.

Example focused run:

```bash
PIPELINE_AREAS='Oldham, Greater Manchester|Rochdale, Greater Manchester' \
PIPELINE_BUSINESS_TYPES='Dental practices and dentists' \
PIPELINE_MAX_PER_QUERY=3 \
PIPELINE_MAX_QUALIFIED=2 \
npm run pipeline
```

## Next Engineering Priorities

1. Add a hard timeout and clearer error path around external lead search.
2. Add a `--no-images` mode for cheap lead qualification before generating paid image assets.
3. Add a dental-specific demo template.
4. Add a review screen where Hamid approves email drafts before any sending integration is enabled.
5. Add a small public offer page for `eliteautomations.co.uk`.
