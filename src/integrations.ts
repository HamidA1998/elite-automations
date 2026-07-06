import crypto from "node:crypto";
import fs from "node:fs";

type ConnectorStatus = "connected" | "not_configured" | "error";

export interface ConnectorSnapshot {
  provider: string;
  label: string;
  connected: boolean;
  status: ConnectorStatus;
  enables: string;
  missingEnv: string[];
  setupUrl: string;
  syncedAt: string | null;
  summary: Record<string, unknown>;
  error: string | null;
}

export interface ConnectorSyncResult {
  provider: string;
  status: ConnectorStatus;
  summary: Record<string, unknown>;
  data: unknown;
  error: string | null;
  syncedAt: string;
}

const PLAID_BASE_URLS: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
};

function nowIso() {
  return new Date().toISOString();
}

function compactMissing(entries: Array<[string, string | undefined]>) {
  return entries.filter(([, value]) => !value).map(([key]) => key);
}

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function readSecretValue(value: string, pathValue: string) {
  if (value) return value.replace(/\\n/g, "\n");
  if (!pathValue) return "";
  try {
    return fs.readFileSync(pathValue, "utf8").trim();
  } catch {
    return "";
  }
}

function connector(
  provider: string,
  label: string,
  enables: string,
  setupUrl: string,
  missingEnv: string[],
  syncedAt: string | null,
  summary: Record<string, unknown> = {},
  error: string | null = null,
): ConnectorSnapshot {
  const status: ConnectorStatus = error ? "error" : missingEnv.length === 0 ? "connected" : "not_configured";
  return {
    provider,
    label,
    connected: status === "connected",
    status,
    enables,
    missingEnv,
    setupUrl,
    syncedAt,
    summary,
    error,
  };
}

async function postJson<T>(url: string, body: Record<string, unknown>, headers?: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }
  return payload as T;
}

async function getJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...headers,
    },
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }
  return payload as T;
}

async function getGoogleAccessToken(config: ReturnType<typeof gmailConfig>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded", Accept: "application/json"},
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(JSON.stringify(payload));
  return payload as {access_token: string};
}

function plaidConfig() {
  const environment = env("PLAID_ENV") || "sandbox";
  const clientId = env("PLAID_CLIENT_ID");
  const secret = env("PLAID_SECRET");
  const accessToken = env("PLAID_ACCESS_TOKEN");
  const baseUrl = PLAID_BASE_URLS[environment] ?? PLAID_BASE_URLS.sandbox;
  return {
    environment,
    clientId,
    secret,
    accessToken,
    baseUrl,
    missingEnv: compactMissing([
      ["PLAID_CLIENT_ID", clientId],
      ["PLAID_SECRET", secret],
      ["PLAID_ACCESS_TOKEN", accessToken],
    ]),
  };
}

function revenueCatConfig() {
  const apiKey = env("REVENUECAT_API_KEY");
  const projectId = env("REVENUECAT_PROJECT_ID");
  return {
    apiKey,
    projectId,
    missingEnv: compactMissing([
      ["REVENUECAT_API_KEY", apiKey],
      ["REVENUECAT_PROJECT_ID", projectId],
    ]),
  };
}

function appStoreConfig() {
  const issuerId = env("ASC_ISSUER_ID") || env("APP_STORE_CONNECT_ISSUER_ID");
  const keyId = env("ASC_KEY_ID") || env("APP_STORE_CONNECT_KEY_ID");
  const vendorNumber = env("ASC_VENDOR_NUMBER") || env("APP_STORE_CONNECT_VENDOR_NUMBER");
  const privateKey = readSecretValue(
    env("ASC_PRIVATE_KEY") || env("APP_STORE_CONNECT_PRIVATE_KEY"),
    env("ASC_PRIVATE_KEY_PATH") || env("APP_STORE_CONNECT_PRIVATE_KEY_PATH"),
  );
  return {
    issuerId,
    keyId,
    vendorNumber,
    privateKey,
    missingEnv: compactMissing([
      ["ASC_ISSUER_ID", issuerId],
      ["ASC_KEY_ID", keyId],
      ["ASC_PRIVATE_KEY or ASC_PRIVATE_KEY_PATH", privateKey],
      ["ASC_VENDOR_NUMBER", vendorNumber],
    ]),
  };
}

function gmailConfig() {
  const clientId = env("GMAIL_CLIENT_ID") || env("GOOGLE_CLIENT_ID");
  const clientSecret = env("GMAIL_CLIENT_SECRET") || env("GOOGLE_CLIENT_SECRET");
  const refreshToken = env("GMAIL_REFRESH_TOKEN") || env("GOOGLE_REFRESH_TOKEN");
  const userEmail = env("GMAIL_USER_EMAIL") || "me";
  return {
    clientId,
    clientSecret,
    refreshToken,
    userEmail,
    missingEnv: compactMissing([
      ["GMAIL_CLIENT_ID", clientId],
      ["GMAIL_CLIENT_SECRET", clientSecret],
      ["GMAIL_REFRESH_TOKEN", refreshToken],
    ]),
  };
}

function appStoreJwt() {
  const config = appStoreConfig();
  if (config.missingEnv.length > 0) {
    throw new Error(`App Store Connect missing ${config.missingEnv.join(", ")}`);
  }
  const header = {alg: "ES256", kid: config.keyId, typ: "JWT"};
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.issuerId,
    iat: now,
    exp: now + 20 * 60,
    aud: "appstoreconnect-v1",
  };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const signingInput = `${encode(header)}.${encode(payload)}`;
  const signature = crypto.sign("sha256", Buffer.from(signingInput), config.privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

export function buildConnectorStatuses(snapshots: Array<{provider: string; status: string; summary_json: string; error: string | null; synced_at: string}>) {
  const byProvider = new Map(snapshots.map((snapshot) => [snapshot.provider, snapshot]));
  const snapshotFor = (provider: string) => byProvider.get(provider);
  const summaryFor = (provider: string) => {
    const snapshot = snapshotFor(provider);
    if (!snapshot) return {};
    try {
      return JSON.parse(snapshot.summary_json) as Record<string, unknown>;
    } catch {
      return {};
    }
  };

  const plaid = plaidConfig();
  const revenueCat = revenueCatConfig();
  const appStore = appStoreConfig();
  const gmail = gmailConfig();

  return [
    connector("gmail", "Gmail", "Live inbox, replies, outreach tracking, and message history", "https://console.cloud.google.com/apis/credentials", gmail.missingEnv, snapshotFor("gmail")?.synced_at ?? null, summaryFor("gmail"), snapshotFor("gmail")?.error ?? null),
    connector("apify", "Apify / Actors", "Google Maps, review scraping, enrichment actors, and lead data pulls", "https://console.apify.com/account/integrations", compactMissing([["APIFY_TOKEN or APIFY_API_TOKEN", env("APIFY_TOKEN") || env("APIFY_API_TOKEN") || env("APIFY_API_KEY")]]), snapshotFor("apify")?.synced_at ?? null, summaryFor("apify"), snapshotFor("apify")?.error ?? null),
    connector("firecrawl", "Firecrawl", "Website search, scraping, and audit intelligence", "https://firecrawl.dev", compactMissing([["FIRECRAWL_API_KEY", env("FIRECRAWL_API_KEY")]]), snapshotFor("firecrawl")?.synced_at ?? null, summaryFor("firecrawl"), snapshotFor("firecrawl")?.error ?? null),
    connector("plaid", "Plaid Banking", "Bank balances, transactions, runway, and business cashflow", "https://dashboard.plaid.com", plaid.missingEnv, snapshotFor("plaid")?.synced_at ?? null, summaryFor("plaid"), snapshotFor("plaid")?.error ?? null),
    connector("stripe", "Stripe", "Customers, invoices, payment links, subscriptions, and revenue", "https://dashboard.stripe.com/apikeys", compactMissing([["STRIPE_SECRET_KEY", env("STRIPE_SECRET_KEY") || env("STRIPE_RESTRICTED_KEY")]]), snapshotFor("stripe")?.synced_at ?? null, summaryFor("stripe"), snapshotFor("stripe")?.error ?? null),
    connector("revenuecat", "RevenueCat", "App subscriptions, MRR, customers, and mobile monetisation", "https://app.revenuecat.com", revenueCat.missingEnv, snapshotFor("revenuecat")?.synced_at ?? null, summaryFor("revenuecat"), snapshotFor("revenuecat")?.error ?? null),
    connector("appstore", "App Store Connect", "Apple app sales, downloads, ratings, and operational reports", "https://appstoreconnect.apple.com/access/integrations/api", appStore.missingEnv, snapshotFor("appstore")?.synced_at ?? null, summaryFor("appstore"), snapshotFor("appstore")?.error ?? null),
    connector("twilio", "Twilio", "Outbound calls, inbound calls, call records, recordings, and SMS", "https://console.twilio.com", compactMissing([["TWILIO_ACCOUNT_SID", env("TWILIO_ACCOUNT_SID")], ["TWILIO_AUTH_TOKEN", env("TWILIO_AUTH_TOKEN")], ["TWILIO_PHONE_NUMBER", env("TWILIO_PHONE_NUMBER")]]), snapshotFor("twilio")?.synced_at ?? null, summaryFor("twilio"), snapshotFor("twilio")?.error ?? null),
    connector("elevenlabs", "ElevenLabs", "Voice agent calls, post-call logs, bookings, summaries, and transcripts", "https://elevenlabs.io/app/conversational-ai", compactMissing([["ELEVENLABS_API_KEY", env("ELEVENLABS_API_KEY")], ["ELEVENLABS_AGENT_ID", env("ELEVENLABS_AGENT_ID")]]), snapshotFor("elevenlabs")?.synced_at ?? null, summaryFor("elevenlabs"), snapshotFor("elevenlabs")?.error ?? null),
    connector("kie", "KIE.ai", "Nano Banana Pro images, video models, and creative asset generation", "https://kie.ai", compactMissing([["KIE_API_KEY", env("KIE_API_KEY")]]), snapshotFor("kie")?.synced_at ?? null, summaryFor("kie"), snapshotFor("kie")?.error ?? null),
    connector("openclaw", "OpenClaw", "AI workforce sessions, tools, approvals, and memory", "http://127.0.0.1:18789", compactMissing([["OPENCLAW_GATEWAY_URL", env("OPENCLAW_GATEWAY_URL") || "http://127.0.0.1:18789"]]), snapshotFor("openclaw")?.synced_at ?? null, summaryFor("openclaw"), snapshotFor("openclaw")?.error ?? null),
  ];
}

export async function createPlaidLinkToken() {
  const config = plaidConfig();
  const missing = compactMissing([
    ["PLAID_CLIENT_ID", config.clientId],
    ["PLAID_SECRET", config.secret],
  ]);
  if (missing.length > 0) throw new Error(`Plaid missing ${missing.join(", ")}`);
  return postJson(`${config.baseUrl}/link/token/create`, {
    client_id: config.clientId,
    secret: config.secret,
    client_name: env("ELITE_BRAND") || "Elite Automations",
    country_codes: ["GB"],
    language: "en",
    user: {client_user_id: "hamid"},
    products: ["transactions"],
  });
}

export async function exchangePlaidPublicToken(publicToken: string) {
  const config = plaidConfig();
  const missing = compactMissing([
    ["PLAID_CLIENT_ID", config.clientId],
    ["PLAID_SECRET", config.secret],
  ]);
  if (missing.length > 0) throw new Error(`Plaid missing ${missing.join(", ")}`);
  return postJson<{access_token: string; item_id: string}>(`${config.baseUrl}/item/public_token/exchange`, {
    client_id: config.clientId,
    secret: config.secret,
    public_token: publicToken,
  });
}

export async function syncPlaid(): Promise<ConnectorSyncResult> {
  const config = plaidConfig();
  if (config.missingEnv.length > 0) throw new Error(`Plaid missing ${config.missingEnv.join(", ")}`);
  const [balances, transactions] = await Promise.all([
    postJson<{accounts: Array<{account_id: string; name: string; balances: {current: number | null; available: number | null; iso_currency_code: string | null}}>}>(
      `${config.baseUrl}/accounts/balance/get`,
      {client_id: config.clientId, secret: config.secret, access_token: config.accessToken},
    ),
    postJson<{transactions: Array<{transaction_id: string; name: string; amount: number; date: string; iso_currency_code: string | null}>}>(
      `${config.baseUrl}/transactions/get`,
      {
        client_id: config.clientId,
        secret: config.secret,
        access_token: config.accessToken,
        start_date: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
        end_date: new Date().toISOString().slice(0, 10),
      },
    ),
  ]);
  const cash = balances.accounts.reduce((sum, account) => sum + (account.balances.current ?? 0), 0);
  const moneyOut = transactions.transactions.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const moneyIn = transactions.transactions.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  return {
    provider: "plaid",
    status: "connected",
    syncedAt: nowIso(),
    summary: {
      accounts: balances.accounts.length,
      transactions: transactions.transactions.length,
      currentBalance: cash,
      moneyIn,
      moneyOut,
      environment: config.environment,
    },
    data: {balances, transactions},
    error: null,
  };
}

export async function syncRevenueCat(): Promise<ConnectorSyncResult> {
  const config = revenueCatConfig();
  if (config.missingEnv.length > 0) throw new Error(`RevenueCat missing ${config.missingEnv.join(", ")}`);
  const projects = await getJson<{items?: unknown[]}>(`https://api.revenuecat.com/v2/projects`, {
    Authorization: `Bearer ${config.apiKey}`,
  });
  const products = await getJson<{items?: unknown[]}>(`https://api.revenuecat.com/v2/projects/${encodeURIComponent(config.projectId)}/products`, {
    Authorization: `Bearer ${config.apiKey}`,
  }).catch((error: unknown) => ({items: [], error: error instanceof Error ? error.message : String(error)}));
  return {
    provider: "revenuecat",
    status: "connected",
    syncedAt: nowIso(),
    summary: {
      projects: projects.items?.length ?? 0,
      products: products.items?.length ?? 0,
      projectId: config.projectId,
    },
    data: {projects, products},
    error: null,
  };
}

export async function syncAppStore(): Promise<ConnectorSyncResult> {
  const config = appStoreConfig();
  if (config.missingEnv.length > 0) throw new Error(`App Store Connect missing ${config.missingEnv.join(", ")}`);
  const token = appStoreJwt();
  const apps = await getJson<{data?: Array<{id: string; attributes?: {name?: string; bundleId?: string}}>}>("https://api.appstoreconnect.apple.com/v1/apps?limit=20", {
    Authorization: `Bearer ${token}`,
  });
  return {
    provider: "appstore",
    status: "connected",
    syncedAt: nowIso(),
    summary: {
      apps: apps.data?.length ?? 0,
      vendorNumber: config.vendorNumber,
    },
    data: apps,
    error: null,
  };
}

export async function syncGmail(): Promise<ConnectorSyncResult> {
  const config = gmailConfig();
  if (config.missingEnv.length > 0) throw new Error(`Gmail missing ${config.missingEnv.join(", ")}`);
  const token = await getGoogleAccessToken(config);
  const list = await getJson<{messages?: Array<{id: string; threadId: string}>; resultSizeEstimate?: number}>(
    `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(config.userEmail)}/messages?maxResults=25`,
    {Authorization: `Bearer ${token.access_token}`},
  );
  return {
    provider: "gmail",
    status: "connected",
    syncedAt: nowIso(),
    summary: {
      account: config.userEmail,
      resultSizeEstimate: list.resultSizeEstimate ?? list.messages?.length ?? 0,
      cachedMessages: list.messages?.length ?? 0,
    },
    data: list,
    error: null,
  };
}

export async function runConnectorSync(provider: string): Promise<ConnectorSyncResult> {
  if (provider === "gmail") return syncGmail();
  if (provider === "plaid") return syncPlaid();
  if (provider === "revenuecat") return syncRevenueCat();
  if (provider === "appstore") return syncAppStore();
  throw new Error(`No live sync handler for ${provider}. This connector is status-only or already handled by a dedicated module.`);
}
