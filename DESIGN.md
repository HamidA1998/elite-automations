---
name: HAMID.OS Executive Command
description: Premium operating-system interface for Elite Automations, focused on live work, revenue pressure, proof-led selling, and guarded automation.
colors:
  primary: "#d8b76a"
  secondary: "#76d6ce"
  background: "#070607"
  surface: "#11100f"
  text: "#f5f1e8"
  textMuted: "#9d978c"
  ink: "#070607"
  obsidian: "#11100f"
  bronze: "#d8b76a"
  cyan: "#76d6ce"
  cream: "#f5f1e8"
  muted: "#9d978c"
  success: "#10b981"
  warning: "#f59e0b"
  danger: "#ef4444"
typography:
  display: "Instrument Serif"
  body: "Satoshi"
  mono: "Geist Mono"
rounded:
  panel: "14px"
  card: "10px"
  control: "9999px"
spacing:
  hairline: "1px"
  unit: "4px"
  section: "24px"
components:
  commandHero:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.display}"
    rounded: "{rounded.panel}"
    padding: "{spacing.section}"
  liveLedger:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.text}"
    typography: "{typography.mono}"
    rounded: "{rounded.card}"
    padding: "{spacing.section}"
  actionCard:
    backgroundColor: "{colors.obsidian}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "{spacing.section}"
  primaryButton:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "{spacing.section}"
  liveStatus:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.background}"
    typography: "{typography.mono}"
    rounded: "{rounded.control}"
    padding: "{spacing.unit}"
---

## Overview

HAMID.OS should feel like a founder command room, not a generic SaaS dashboard. The product is a business operating system for finding leads, auditing proof, generating demo assets, controlling agents, sending outreach with guardrails, and moving clients toward payment.

Every screen must bias toward live work objects, evidence, and next action. The interface should feel expensive through precision: tight spacing, crisp panels, clear hierarchy, real operational states, and no decorative filler.

The command centre is the flagship surface. It should answer, in order: what matters now, which loop is running, which API or human approval is blocking progress, and what Hamid should do next. Business and personal systems sit in the same operating model because founder energy, focus, calls, cash, and delivery all affect the same outcome.

## Colors

Use a near-black base with bronze/gold as the premium operational accent and cyan as the live-system accent. Avoid broad purple gradients, bright blue SaaS defaults, and colourful card borders. Status colours are reserved for state: green for live, amber for warning/setup, red for blocked/risk.

Use glow as evidence of live systems only. Bronze glow means executive focus or revenue gravity. Cyan glow means live automation, agent activity, or connected infrastructure. Never use glow to decorate dead cards.

## Typography

Use Instrument Serif only for major editorial moments and screen-defining statements. Use Satoshi for interface text. Use Geist Mono for timestamps, counts, money, IDs, system state, and operational labels.

Large display text should be sparse and confident. Data should be compact and readable.

## Layout

Prefer operating surfaces over card mosaics:

- One precise command surface per primary page.
- One live ledger showing truth and blockers.
- One pipeline/action strip showing what happens next.
- Cards should expose a decision, state, or route.
- The flagship dashboard should combine a cockpit hero, API readiness spine, operating-loop strip, pipeline board, and live timeline.
- API/setup surfaces must name the provider, job-to-be-done, status, and destination route.

Never centre all text by default. Dashboards are working tools; left alignment should dominate. Use compact panels, tables, boards, and right-side dossiers before oversized marketing composition.

## Elevation & Depth

Depth should be layered and restrained: dark glass panels, hairline borders, inset highlights, and bronze/cyan glow used sparingly. Avoid fake 3D, broad soft blobs, heavy shadows everywhere, and visual noise that competes with data.

## Shapes

Use precise command panels, compact cards, and pill controls only for filters or short status. Cards should usually sit between 8px and 14px radius. Avoid soft blob-like geometry.

## Components

Command hero: large editorial thesis, live status stack, primary route buttons.

Live ledger: connected services, automation state, blockers, next run, proof counts.

Action cards: one owner/agent, one reason, one action route.

Pipeline strip: discover, audit, demo, outreach, close. Each stage must link to a real workspace.

## Do's and Don'ts

Do use real data freshness and connected states.
Do label blocked/setup/draft/approval-gated work honestly.
Do make important rows clickable.
Do use empty states to tell Hamid what to configure next.

Don't add fake testimonials, fake revenue, fake sent emails, fake connected states, or decorative cards with no action.
Don't make buttons that do nothing.
Don't use generic SaaS aesthetics, gradient buttons, broad purple/blue SaaS colour systems, or random neon.
Don't hide risk behind optimistic copy.
