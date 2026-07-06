/**
 * Centralised, type-safe environment variable access.
 *
 * Imported anywhere you'd otherwise reach for `process.env.X`. The first
 * import validates the full shape with Zod and prints a crisp report of what's
 * missing or malformed so misconfiguration fails on startup, not at request
 * time.
 *
 * Adding a new env var:
 *   1. Add to .env.example.
 *   2. Add to the `shape` below with the right type/default.
 *   3. Use `env.MY_VAR` everywhere. Do NOT reach back into process.env.
 *
 * Related: docs/ELITE_OS_ENTERPRISE_ROADMAP.md §0.4
 */

import {z} from "zod";

// Make undefined/empty strings treated the same: both mean "not set".
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const booleanFromString = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) return false;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  });

const intFromString = (defaultValue: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) return defaultValue;
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : defaultValue;
    });

const urlOrFallback = (fallback: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : fallback));

const shape = z.object({
  // ── Brand / runtime ────────────────────────────────────────────────
  ELITE_NAME: urlOrFallback("Hamid"),
  ELITE_BRAND: urlOrFallback("Elite Automations"),
  ELITE_DOMAIN: urlOrFallback("eliteautomations.co.uk"),
  DASHBOARD_PORT: intFromString(3007),
  PUBLIC_BASE_URL: urlOrFallback("http://127.0.0.1:3007"),
  NODE_ENV: urlOrFallback("development"),

  // ── Lead pipeline limits ───────────────────────────────────────────
  PIPELINE_MAX_PER_QUERY: intFromString(8),
  PIPELINE_MAX_QUALIFIED: intFromString(10),

  // ── Autopilot safety ───────────────────────────────────────────────
  AUTOPILOT_ALLOW_COLD_EMAIL_SEND: booleanFromString,
  AUTOPILOT_RATE_DELAY_MS: intFromString(2000),

  // ── Core enrichment ────────────────────────────────────────────────
  FIRECRAWL_API_KEY: optionalString,
  FIRECRAWL_BASE_URL: urlOrFallback("https://api.firecrawl.dev/v2"),
  APIFY_TOKEN: optionalString,
  APIFY_BASE_URL: urlOrFallback("https://api.apify.com/v2"),

  // ── Creative generation ────────────────────────────────────────────
  KIE_API_KEY: optionalString,
  KIE_BASE_URL: urlOrFallback("https://api.kie.ai"),

  // ── Voice + SMS ────────────────────────────────────────────────────
  TWILIO_ACCOUNT_SID: optionalString,
  TWILIO_AUTH_TOKEN: optionalString,
  TWILIO_PHONE_NUMBER: optionalString,
  ELEVENLABS_API_KEY: optionalString,
  ELEVENLABS_AGENT_ID: optionalString,
  ELEVENLABS_TWILIO_STREAM_URL: optionalString,

  // ── Payments ───────────────────────────────────────────────────────
  STRIPE_PUBLISHABLE_KEY: optionalString,
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString, // enables signed webhook ingest

  // ── Mail ───────────────────────────────────────────────────────────
  GMAIL_CLIENT_ID: optionalString,
  GMAIL_CLIENT_SECRET: optionalString,
  GMAIL_REFRESH_TOKEN: optionalString,
  GMAIL_USER_EMAIL: urlOrFallback("me"),
  SMTP_HOST: optionalString,
  SMTP_PORT: intFromString(587),
  SMTP_SECURE: booleanFromString,
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_FROM: optionalString,

  // ── Banking / app revenue ──────────────────────────────────────────
  PLAID_ENV: urlOrFallback("sandbox"),
  PLAID_CLIENT_ID: optionalString,
  PLAID_SECRET: optionalString,
  PLAID_ACCESS_TOKEN: optionalString,
  REVENUECAT_API_KEY: optionalString,
  REVENUECAT_PROJECT_ID: optionalString,
  ASC_ISSUER_ID: optionalString,
  ASC_KEY_ID: optionalString,
  ASC_PRIVATE_KEY: optionalString,
  ASC_PRIVATE_KEY_PATH: optionalString,
  ASC_VENDOR_NUMBER: optionalString,

  // ── OpenClaw / LLM ─────────────────────────────────────────────────
  OPENCLAW_GATEWAY_URL: urlOrFallback("http://127.0.0.1:18789"),
  OPENCLAW_API_TOKEN: optionalString,
  OPENCLAW_HOME: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: urlOrFallback("gpt-5.2"),
  ANTHROPIC_API_KEY: optionalString,

  // ── Phase 2 tier-1 enrichment (see ENTERPRISE_ROADMAP §2.1) ────────
  COMPANIES_HOUSE_API_KEY: optionalString,
  HUNTER_API_KEY: optionalString,
  NEVERBOUNCE_API_KEY: optionalString,
  BUILTWITH_API_KEY: optionalString,
  PAGESPEED_API_KEY: optionalString,
  GOOGLE_PLACES_API_KEY: optionalString,
  CLOUDFLARE_TURNSTILE_SECRET: optionalString,

  // ── Phase 2 tier-2 growth ──────────────────────────────────────────
  APOLLO_API_KEY: optionalString,
  CLAY_API_KEY: optionalString,
  CALENDLY_API_KEY: optionalString,
  SLACK_BOT_TOKEN: optionalString,
  SLACK_SIGNING_SECRET: optionalString,
  NOTION_API_KEY: optionalString,
  PERPLEXITY_API_KEY: optionalString,
  TAVILY_API_KEY: optionalString,
  EXA_API_KEY: optionalString,

  // ── Phase 0/5 platform ─────────────────────────────────────────────
  SENTRY_DSN: optionalString,
  POSTHOG_API_KEY: optionalString,
  POSTHOG_HOST: urlOrFallback("https://eu.i.posthog.com"),
  WORKOS_API_KEY: optionalString,
  WORKOS_CLIENT_ID: optionalString,
  AUTH_SESSION_SECRET: optionalString,
  CORS_ALLOWED_ORIGINS: optionalString, // comma-separated; empty = open (dev only)
});

export type Env = z.infer<typeof shape>;

function parseEnv(): Env {
  const result = shape.safeParse(process.env);
  if (result.success) return result.data;

  const lines = result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    return `  - ${path}: ${issue.message}`;
  });
  // eslint-disable-next-line no-console
  console.error(
    [
      "Elite OS: environment configuration failed validation.",
      "Fix the following keys in .env.local (see .env.example for templates):",
      ...lines,
    ].join("\n"),
  );
  throw new Error("Invalid environment configuration");
}

export const env: Env = parseEnv();

/**
 * Convenience: returns the list of env keys that are missing for a given
 * provider. Handy for `connectors/*` modules and the `/api/integrations/status`
 * endpoint without re-declaring the mapping in every place.
 */
export function missingEnvFor(provider: string): string[] {
  const missing: string[] = [];
  const push = (key: keyof Env, label?: string) => {
    if (!env[key]) missing.push(label ?? String(key));
  };

  switch (provider) {
    case "firecrawl":
      push("FIRECRAWL_API_KEY");
      break;
    case "apify":
      push("APIFY_TOKEN");
      break;
    case "kie":
      push("KIE_API_KEY");
      break;
    case "stripe":
      push("STRIPE_SECRET_KEY");
      break;
    case "stripe.webhook":
      push("STRIPE_WEBHOOK_SECRET");
      break;
    case "twilio":
      push("TWILIO_ACCOUNT_SID");
      push("TWILIO_AUTH_TOKEN");
      push("TWILIO_PHONE_NUMBER");
      break;
    case "elevenlabs":
      push("ELEVENLABS_API_KEY");
      push("ELEVENLABS_AGENT_ID");
      break;
    case "gmail":
      push("GMAIL_CLIENT_ID");
      push("GMAIL_CLIENT_SECRET");
      push("GMAIL_REFRESH_TOKEN");
      break;
    case "plaid":
      push("PLAID_CLIENT_ID");
      push("PLAID_SECRET");
      push("PLAID_ACCESS_TOKEN");
      break;
    case "companies-house":
      push("COMPANIES_HOUSE_API_KEY");
      break;
    case "hunter":
      push("HUNTER_API_KEY");
      break;
    case "neverbounce":
      push("NEVERBOUNCE_API_KEY");
      break;
    case "builtwith":
      push("BUILTWITH_API_KEY");
      break;
    case "pagespeed":
      // Works anonymously with lower quota; key only required for higher limits.
      break;
    case "google-places":
      push("GOOGLE_PLACES_API_KEY");
      break;
    case "apollo":
      push("APOLLO_API_KEY");
      break;
    case "clay":
      push("CLAY_API_KEY");
      break;
    case "slack":
      push("SLACK_BOT_TOKEN");
      break;
    case "notion":
      push("NOTION_API_KEY");
      break;
    default:
      break;
  }

  return missing;
}
