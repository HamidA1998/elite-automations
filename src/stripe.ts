import type {StripePaymentRecord, StripeSummary} from "@/types";

const STRIPE_API_VERSION = "2026-03-25.dahlia";
const SUMMARY_CACHE_MS = 60_000;
const RECENT_WINDOW_SECONDS = 60 * 60 * 24 * 90;
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

let cachedSummary: {value: StripeSummary; expiresAt: number} | null = null;

function getSecretKey() {
  return process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY || "";
}

function getPublishableKey() {
  return process.env.STRIPE_PUBLISHABLE_KEY || "";
}

function toMajorUnit(amount: number, currency: string) {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase()) ? amount : amount / 100;
}

function baseSummary(): StripeSummary {
  const secretKey = getSecretKey();
  return {
    configured: Boolean(secretKey),
    connected: false,
    mode: secretKey.startsWith("rk_live") || secretKey.startsWith("sk_live") ? "live" : secretKey ? "test" : "unconfigured",
    keyType: secretKey.startsWith("rk_") ? "restricted" : secretKey.startsWith("sk_") ? "secret" : "none",
    publishableKeyConfigured: Boolean(getPublishableKey()),
    currency: "GBP",
    availableBalance: 0,
    pendingBalance: 0,
    recentCollected: 0,
    recentChargeCount: 0,
    successfulChargeCount: 0,
    recentPayments: [],
    lastSyncedAt: null,
    error: null,
  };
}

export function isStripeConfigured() {
  return Boolean(getSecretKey());
}

async function getClient() {
  const apiKey = getSecretKey();
  if (!apiKey) return null;
  const {default: Stripe} = await import("stripe");
  return new Stripe(apiKey, {apiVersion: STRIPE_API_VERSION});
}

export async function getStripeSummary(force = false): Promise<StripeSummary> {
  if (!force && cachedSummary && Date.now() < cachedSummary.expiresAt) {
    return cachedSummary.value;
  }

  const summary = baseSummary();
  const stripe = await getClient();
  if (!stripe) {
    cachedSummary = {value: summary, expiresAt: Date.now() + SUMMARY_CACHE_MS};
    return summary;
  }

  const createdGte = Math.floor(Date.now() / 1000) - RECENT_WINDOW_SECONDS;
  const [balanceResult, chargesResult] = await Promise.allSettled([
    stripe.balance.retrieve(),
    stripe.charges.list({limit: 25, created: {gte: createdGte}}),
  ]);

  if (balanceResult.status === "fulfilled") {
    summary.connected = true;
    const balance = balanceResult.value;
    const available = balance.available.reduce((sum, entry) => sum + toMajorUnit(entry.amount, entry.currency), 0);
    const pending = balance.pending.reduce((sum, entry) => sum + toMajorUnit(entry.amount, entry.currency), 0);
    summary.availableBalance = available;
    summary.pendingBalance = pending;
    const firstCurrency = balance.available[0]?.currency || balance.pending[0]?.currency;
    if (firstCurrency) summary.currency = firstCurrency.toUpperCase();
  } else {
    summary.error = balanceResult.reason instanceof Error ? balanceResult.reason.message : "Unable to read Stripe balance";
  }

  if (chargesResult.status === "fulfilled") {
    summary.connected = true;
    const charges = chargesResult.value.data;
    summary.recentChargeCount = charges.length;
    summary.successfulChargeCount = charges.filter((charge) => charge.paid && charge.status === "succeeded").length;
    summary.recentCollected = charges
      .filter((charge) => charge.paid && charge.status === "succeeded")
      .reduce((sum, charge) => sum + toMajorUnit(charge.amount_captured || charge.amount, charge.currency), 0);
    summary.recentPayments = charges.slice(0, 8).map((charge): StripePaymentRecord => ({
      id: charge.id,
      amount: toMajorUnit(charge.amount_captured || charge.amount, charge.currency),
      currency: charge.currency.toUpperCase(),
      status: charge.status || "unknown",
      customerName: typeof charge.billing_details?.name === "string" ? charge.billing_details.name : null,
      description: charge.description ?? null,
      receiptUrl: charge.receipt_url ?? null,
      createdAt: new Date(charge.created * 1000).toISOString(),
    }));
    if (charges[0]?.currency) summary.currency = charges[0].currency.toUpperCase();
  } else if (!summary.error) {
    summary.error = chargesResult.reason instanceof Error ? chargesResult.reason.message : "Unable to read Stripe charges";
  }

  summary.lastSyncedAt = new Date().toISOString();
  cachedSummary = {value: summary, expiresAt: Date.now() + SUMMARY_CACHE_MS};
  return summary;
}
