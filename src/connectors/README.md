# Elite OS — Connectors

One folder per external enrichment API. Each module exports a uniform
surface so the platform can mount them into the dashboard, the scoring
pipeline, the command palette, and (eventually) agent tool-use without
special-casing.

Target interface (Phase 2.4 of the roadmap):

```ts
export const connector = {
  provider: "companies-house",
  label: "Companies House",
  enables: "UK company identity, filings, officers, SIC codes",
  missingEnv: () => missingEnvFor("companies-house"),
  snapshot: async () => {...},        // nightly, optional
  tools: [...],                       // agent-callable functions
  fetchForBusiness: async (...) => {...}, // ad-hoc lookup from a lead row
};
```

Today only the **read paths** exist — enough to wire each into the
scoring v2 work from §2.5. The webhook / tool / snapshot hooks will
be filled in over Phase 2.

Files:

- `companies-house.ts` — UK registry, free, API key required.
- `hunter.ts` — email finder + pattern guesser.
- `neverbounce.ts` — email verification (single-check).
- `builtwith.ts` — tech stack detection by domain.
- `pagespeed.ts` — Lighthouse / Core Web Vitals / accessibility scores.

Each module:

- Uses `env` from `@/env` (never reaches into `process.env`).
- Returns typed, narrow results.
- Throws a labelled error when the API key is missing — callers can catch
  and downgrade to "signal unavailable".
- Is safe to call in parallel (no shared state, no globals).
