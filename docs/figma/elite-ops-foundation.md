# Elite Ops Design Foundation

This document is the Figma source-of-truth for the Elite Automations operating system visual language.

## Product Direction

- Hybrid visual direction:
  - Apple-grade clarity in spacing, typography, and motion restraint.
  - OpenAI/X-grade operational density in tables, activity surfaces, and decision tooling.
- Tone: premium enterprise command center, not a generic dashboard.

## Tokens

### Color roles

- `bg.base`: app background gradient base.
- `bg.panel`: glass panel base.
- `text.primary`: core content text.
- `text.secondary`: metadata and descriptive copy.
- `line.subtle`: low-emphasis borders.
- `line.strong`: structural separators.
- `accent.primary`: primary action and interactive highlights.
- `accent.secondary`: supporting highlights and chart accents.

### Semantic status colors

- Health:
  - `critical` (0-30): `#ef4444`
  - `weak` (31-50): `#f97316`
  - `workable` (51-70): `#eab308`
  - `stable` (71-100): `#22c55e`
- Pipeline stages:
  - `researched`: slate
  - `ready`: blue
  - `contacted`: indigo
  - `follow-up`: violet
  - `replied`: purple
  - `proposal`: amber
  - `won`: green
  - `lost`: red

## Typography

- Display heading:
  - Weight: 700-800
  - Tracking: -0.03em to -0.05em
- Section heading:
  - Weight: 650-700
  - Clear hierarchy over panel content
- Labels / kickers:
  - Uppercase
  - Tracking wide
  - Smaller size with muted color
- Body:
  - High legibility at dense layouts

## Layout

- App shell:
  - Left rail for global mode switch.
  - Context sidebar for queue and ledger.
  - Main workspace as mode-specific surface.
  - Inspector drawer on the right, collapsed by default.
- Grid:
  - 12-column thinking for major structures.
  - Keep key cards within readable width.

## Components

- Core primitives:
  - Mode rail button
  - Section header
  - KPI card
  - Score bar
  - Stage badge
  - Priority badge
  - Entity row
  - Timeline card
  - Task card
  - Proposal card
  - Empty-state action panel

## Motion

- Keep motion intentional and low-noise.
- Duration baseline: 150-220ms.
- Ease: smooth cubic-bezier for state transitions.
- Required behaviors:
  - Detail inspector open/close transitions.
  - Tab content crossfade.
  - Score/progress bar width animation on render.
  - Timeline event insert animation.

## Data-first behavior standards

- Every edit persists via API immediately.
- Inline edits:
  - Edit on interaction.
  - Save on blur.
  - Confirm save with subtle border flash.
- Avoid full-page reload patterns for mutations.

