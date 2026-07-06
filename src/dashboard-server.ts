import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import {spawn} from "node:child_process";

import {z} from "zod";

import {brand, outputDir, outputFiles, rootDir} from "@/config";
import {EliteOpsDatabase} from "@/database";
import {runBrowserAudit} from "@/browser-audit";
import {regenerateLeadDemo, regenerateLeadEmail, regenerateLeadVideo} from "@/lead-artifacts";
import {openClawService} from "@/services/openclaw/client";
import {EliteOperatorRuntime} from "@/os/operator-runtime";
import {buildToolForgePayload} from "@/os/tool-forge";
import {
  buildDealRoom,
  buildDesignLab,
  buildFinanceGuard,
  buildLeadEvidenceDossier,
  buildOwnedVoiceAgentProfile,
  buildOwnedVoiceAgentTurn,
  buildOpportunityEngine,
  buildProofVault,
  buildRevenueRadar,
  buildReplyRadar,
  buildWarRoom,
  type OwnedAccountContext,
  type ReplyRadarItem,
} from "@/os/owned-tools";
import {getStripeSummary, isStripeConfigured} from "@/stripe";
import {analyseScrape, buildBusinessSearchReport, extractVisibleText, scrapeWebsite} from "@/firecrawl";
import {
  buildConnectorStatuses,
  createPlaidLinkToken,
  exchangePlaidPublicToken,
  runConnectorSync,
} from "@/integrations";
import {getApifyStatus, runApifyActor, searchApifyActors} from "@/apify";
import {generateKieImageAsset, generateKieVideoAsset, listKieModels} from "@/kie";
import {
  createAgent as createElevenLabsAgent,
  getAgent as getElevenLabsAgent,
  getAgentConversations as getElevenLabsConversations,
  getAgents as getElevenLabsAgents,
  getVoices as getElevenLabsVoices,
  isElevenLabsConfigured,
  registerTwilioCall,
  updateAgent as updateElevenLabsAgent,
} from "@/elevenlabs";
import {
  buildSayTwiML,
  endCall,
  getCallLogs,
  getMessages,
  getPhoneNumbers,
  getRecordings,
  getSMSThread,
  getTwilioSummary,
  isTwilioConfigured,
  makeCall,
  recordingMp3Url,
  sendSMS,
} from "@/twilio";
import {
  getTunnelState,
  getTunnelUrl,
  startTunnel,
  stopTunnel,
} from "@/tunnel";
import type {ClientComment, ClientContact, ClientMemory, ClientProposal, ClientTask, DashboardData, OutreachActivity} from "@/types";
import {uniqueId} from "@/utils";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.DASHBOARD_PORT ?? "3007", 10);
const clients = new Set<http.ServerResponse>();
const frontendDistDir = path.join(rootDir, "dist");
const frontendEntryFile = path.join(frontendDistDir, "index.html");
const frontendDevUrl = process.env.FRONTEND_DEV_URL ?? "http://localhost:5173/#/";

// In-memory email templates store
interface EmailTemplate { id: string; name: string; subject: string; body: string; createdAt: string; }
const emailTemplates: Map<string, EmailTemplate> = new Map();

// Stripe is loaded lazily so payments cannot block dashboard boot.
async function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY || "";
  if (!key) return null;
  const {default: Stripe} = await import("stripe");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" as any });
}
const openClawStreamClients = new Set<http.ServerResponse>();
const database = new EliteOpsDatabase();
const operatorRuntime = new EliteOperatorRuntime({
  database,
  buildDashboardState,
  buildClient360Payload,
  triggerLeadSearch,
  integrationStatusPayload,
  sendTransportStatus,
});
let lastRefreshBroadcastAt = 0;
let leadSearchStatus: {
  status: "idle" | "running" | "completed" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  message: string;
  output: string[];
} = {
  status: "idle",
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  message: "No Firecrawl discovery run has been started from the frontend yet.",
  output: [],
};

type HourlyAutopilotConfig = {
  enabled: boolean;
  intervalMinutes: number;
  searchQuery: string;
  location: string;
  maxLeads: number;
  minScore: number;
  generateImages: boolean;
  sendEmails: boolean;
};

const hourlyAutopilotConfigPath = path.join(outputDir, "hourly-autopilot-config.json");
let hourlyAutopilotTimer: ReturnType<typeof setInterval> | null = null;
let hourlyAutopilotConfig: HourlyAutopilotConfig = {
  enabled: false,
  intervalMinutes: 60,
  searchQuery: "local businesses Greater Manchester with outdated websites",
  location: "Greater Manchester",
  maxLeads: 50,
  minScore: 40,
  generateImages: true,
  sendEmails: true,
};
let hourlyAutopilotState = {
  status: "idle" as "idle" | "scheduled" | "running" | "completed" | "skipped" | "failed",
  lastRunAt: null as string | null,
  nextRunAt: null as string | null,
  lastRunId: null as string | null,
  lastError: null as string | null,
};

function normalizePhone(value: string | null | undefined) {
  return String(value ?? "").replace(/[^\d+]/g, "");
}

function isPublicWebhookUrl(value: string) {
  return /^https?:\/\//.test(value) && !/localhost|127\.0\.0\.1/.test(value);
}

function getExternalBaseUrl(host: string, port: number) {
  return getTunnelUrl() ?? process.env.PUBLIC_BASE_URL ?? `http://${host}:${port}`;
}

function appendUniqueHighlight(
  highlights: Array<{date: string; note: string}>,
  entry: {date: string; note: string},
) {
  const normalized = entry.note.trim();
  if (!normalized) return highlights;
  if (highlights.some((item) => item.note.trim() === normalized)) return highlights;
  return [entry, ...highlights].slice(0, 25);
}

function parseIsoDateCandidate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function integrationStatusPayload() {
  const snapshots = database.getIntegrationSnapshots();
  const connectors = buildConnectorStatuses(snapshots);
  return {
    generatedAt: new Date().toISOString(),
    connectors,
    snapshots: snapshots.map((snapshot) => ({
      provider: snapshot.provider,
      status: snapshot.status,
      summary: parseJsonField<Record<string, unknown>>(snapshot.summary_json, {}),
      error: snapshot.error,
      syncedAt: snapshot.synced_at,
    })),
  };
}

function buildAutomationReadinessPayload() {
  const integrationStatus = integrationStatusPayload();
  const connectorByProvider = new Map(integrationStatus.connectors.map((connector) => [connector.provider, connector]));
  const accounts = database.getAccounts(1, 500);
  const directLeadCount = accounts.filter((account) => Boolean(account.websiteUrl)).length;
  const enrichedLeadCount = accounts.filter((account) =>
    Boolean(account.emailAddress || account.phoneNumber || account.googleRating || account.reviewCount || account.address),
  ).length;
  const demoReadyCount = accounts.filter((account) => Boolean(account.demoFile || account.imageHero || account.videoFile)).length;
  const contactedCount = accounts.filter((account) =>
    ["contacted", "in-follow-up", "replied", "proposal", "won"].includes(account.accountStatus),
  ).length;

  const transport = sendTransportStatus();
  const stages = [
    {
      id: "discover",
      name: "Find clients",
      owner: "LEADGEN",
      status: process.env.FIRECRAWL_API_KEY ? "live" : "blocked",
      evidence: `${directLeadCount} direct website lead${directLeadCount === 1 ? "" : "s"} stored`,
      nextAction: process.env.FIRECRAWL_API_KEY
        ? "Run Firecrawl discovery, then enrich with Apify actors."
        : "Add FIRECRAWL_API_KEY before discovery can run.",
    },
    {
      id: "enrich",
      name: "Enrich dossier",
      owner: "OPS",
      status: connectorByProvider.get("apify")?.connected ? "live" : "needs-setup",
      evidence: `${enrichedLeadCount} enriched dossier${enrichedLeadCount === 1 ? "" : "s"} with contact/review/location data`,
      nextAction: connectorByProvider.get("apify")?.connected
        ? "Use Apify review/contact actors after each lead is created."
        : "Add APIFY_API_TOKEN to unlock richer Google/Trustpilot/review scraping.",
    },
    {
      id: "audit",
      name: "Human browser audit",
      owner: "BUILDER",
      status: "live",
      evidence: "Playwright is installed and audits are available from each lead file.",
      nextAction: "Run browser audits before demo generation for evidence-led redesigns.",
    },
    {
      id: "demo",
      name: "Build premium demo",
      owner: "BUILDER",
      status: process.env.KIE_API_KEY && process.env.OPENAI_API_KEY ? "live" : "needs-setup",
      evidence: `${demoReadyCount} lead${demoReadyCount === 1 ? "" : "s"} already have generated assets or demos`,
      nextAction: process.env.KIE_API_KEY && process.env.OPENAI_API_KEY
        ? "Generate proof-led hero assets and no-slop demo pages."
        : "Add KIE_API_KEY and OPENAI_API_KEY for asset generation plus strategy copy.",
    },
    {
      id: "outreach",
      name: "Draft and send outreach",
      owner: "OUTREACH",
      status: transport.canSend ? "approval-required" : "blocked",
      evidence: `${contactedCount} lead${contactedCount === 1 ? "" : "s"} have outreach-stage activity`,
      nextAction: transport.canSend
        ? "Email transport is connected. Sending remains approval-gated unless AUTOPILOT_ALLOW_COLD_EMAIL_SEND=true."
        : "Configure SMTP or Gmail OAuth before external emails can be sent.",
    },
    {
      id: "replies",
      name: "Check replies",
      owner: "JARVIS",
      status: connectorByProvider.get("gmail")?.connected ? "live" : "needs-setup",
      evidence: connectorByProvider.get("gmail")?.connected ? "Gmail connector is available for reply sync." : "Gmail is not connected yet.",
      nextAction: connectorByProvider.get("gmail")?.connected
        ? "Sync Gmail and promote replies into CRM next actions."
        : "Create Google OAuth credentials and connect the mailbox.",
    },
  ];

  const liveStages = stages.filter((stage) => stage.status === "live" || stage.status === "approval-required").length;
  const blockers = stages.filter((stage) => stage.status === "blocked" || stage.status === "needs-setup");
  const score = Math.round((liveStages / stages.length) * 100);

  return {
    generatedAt: new Date().toISOString(),
    mode: transport.canSend && connectorByProvider.get("gmail")?.connected ? "continuous-with-approvals" : "assisted-autopilot",
    score,
    stages,
    blockers,
    interfaceFeatures: [
      {
        name: "Command-first control",
        inspiration: "Raycast / Linear",
        status: "implemented",
        value: "Global command and AI command surfaces route work without forcing Hamid through menus.",
      },
      {
        name: "Design-code traceability",
        inspiration: "Figma Code Connect",
        status: "next",
        value: "Map reusable UI primitives to Figma components once the production component library stabilises.",
      },
      {
        name: "Waterfall enrichment",
        inspiration: "Clay",
        status: connectorByProvider.get("apify")?.connected ? "ready" : "needs-setup",
        value: "Run sequential enrichment across Firecrawl, Apify actors, reviews, contact data, and browser evidence.",
      },
      {
        name: "CRM object brain",
        inspiration: "Attio",
        status: accounts.length > 0 ? "implemented" : "ready",
        value: "Every lead/client should become a clickable file with contacts, tasks, calls, proposals, notes, and proof.",
      },
      {
        name: "Approval-gated automation",
        inspiration: "Retool / enterprise ops",
        status: "implemented",
        value: "Risky outside-world actions are separated from safe draft and analysis work.",
      },
    ],
    guardrails: [
      "External email sending is blocked unless SMTP is configured; Gmail currently powers reply sync and inbox intelligence.",
      "Outreach sending, large scrape runs, and payment actions must go through approvals.",
      "Every demo should be backed by Firecrawl, Apify, and Playwright evidence before it is sent.",
      "Pipeline logs only count real API work; missing integrations are shown as setup blockers.",
    ],
    nextRevenueMove: blockers.length > 0
      ? blockers[0]?.nextAction
      : "Run a focused 10-lead batch, browser-audit the top 3, then send approved personalised outreach with demo links.",
  };
}

async function syncIntegrationProvider(provider: "gmail" | "plaid" | "revenuecat" | "appstore") {
  try {
    const result = await runConnectorSync(provider);
    database.saveIntegrationSnapshot(result);
    return result;
  } catch (error) {
    const failed = {
      provider,
      status: "error" as const,
      summary: {},
      data: null,
      error: error instanceof Error ? error.message : String(error),
      syncedAt: new Date().toISOString(),
    };
    database.saveIntegrationSnapshot(failed);
    return failed;
  }
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function loadHourlyAutopilotConfig() {
  try {
    const payload = JSON.parse(await fsp.readFile(hourlyAutopilotConfigPath, "utf8")) as Partial<HourlyAutopilotConfig>;
    hourlyAutopilotConfig = {
      ...hourlyAutopilotConfig,
      ...payload,
      intervalMinutes: Math.max(15, Math.min(24 * 60, Number(payload.intervalMinutes ?? hourlyAutopilotConfig.intervalMinutes))),
      maxLeads: Math.max(1, Math.min(50, Number(payload.maxLeads ?? hourlyAutopilotConfig.maxLeads))),
      minScore: Math.max(0, Math.min(100, Number(payload.minScore ?? hourlyAutopilotConfig.minScore))),
    };
  } catch {
    await saveHourlyAutopilotConfig();
  }
}

async function saveHourlyAutopilotConfig() {
  await fsp.mkdir(path.dirname(hourlyAutopilotConfigPath), {recursive: true});
  await fsp.writeFile(hourlyAutopilotConfigPath, JSON.stringify(hourlyAutopilotConfig, null, 2), "utf8");
}

function sendTransportStatus() {
  const gmail = getGmailConfig();
  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  return {
    gmailConfigured: gmail.configured,
    smtpConfigured,
    canSend: Boolean(gmail.configured || smtpConfigured),
    allowColdEmailSend: process.env.AUTOPILOT_ALLOW_COLD_EMAIL_SEND === "true",
    missingSmtp: [
      !process.env.SMTP_HOST ? "SMTP_HOST" : null,
      !process.env.SMTP_USER ? "SMTP_USER" : null,
      !process.env.SMTP_PASS ? "SMTP_PASS" : null,
    ].filter((item): item is string => Boolean(item)),
  };
}

function scheduleHourlyAutopilot() {
  if (hourlyAutopilotTimer) {
    clearInterval(hourlyAutopilotTimer);
    hourlyAutopilotTimer = null;
  }
  if (!hourlyAutopilotConfig.enabled) {
    hourlyAutopilotState = {...hourlyAutopilotState, status: "idle", nextRunAt: null};
    return;
  }
  const intervalMs = hourlyAutopilotConfig.intervalMinutes * 60_000;
  hourlyAutopilotState = {
    ...hourlyAutopilotState,
    status: "scheduled",
    nextRunAt: new Date(Date.now() + intervalMs).toISOString(),
  };
  hourlyAutopilotTimer = setInterval(() => {
    void runHourlyAutopilot("scheduled");
  }, intervalMs);
}

async function runHourlyAutopilot(trigger: "manual" | "scheduled") {
  const pipeline = await import("@/automation/overnight-pipeline");
  const current = pipeline.getPipelineStatus();
  if (current?.status === "running") {
    hourlyAutopilotState = {
      ...hourlyAutopilotState,
      status: "skipped",
      lastError: "Skipped because another automation pipeline is already running.",
      nextRunAt: hourlyAutopilotConfig.enabled
        ? new Date(Date.now() + hourlyAutopilotConfig.intervalMinutes * 60_000).toISOString()
        : null,
    };
    return current;
  }

  hourlyAutopilotState = {
    ...hourlyAutopilotState,
    status: "running",
    lastRunAt: new Date().toISOString(),
    lastError: null,
  };

  try {
    const result = await pipeline.runOvernightPipeline({
      searchQuery: hourlyAutopilotConfig.searchQuery,
      location: hourlyAutopilotConfig.location,
      maxLeads: hourlyAutopilotConfig.maxLeads,
      minScore: hourlyAutopilotConfig.minScore,
      generateImages: hourlyAutopilotConfig.generateImages,
      runBrowserAudit: true,
      sendEmails: hourlyAutopilotConfig.sendEmails,
      requireApprovalBeforeSend: process.env.AUTOPILOT_ALLOW_COLD_EMAIL_SEND !== "true",
      rateDelayMs: Number(process.env.AUTOPILOT_RATE_DELAY_MS ?? 2000),
    }, database);
    hourlyAutopilotState = {
      status: result.status === "completed" ? "completed" : result.status === "failed" ? "failed" : "scheduled",
      lastRunAt: new Date().toISOString(),
      nextRunAt: hourlyAutopilotConfig.enabled
        ? new Date(Date.now() + hourlyAutopilotConfig.intervalMinutes * 60_000).toISOString()
        : null,
      lastRunId: result.runId,
      lastError: result.status === "failed" ? "Pipeline failed. Check live log." : null,
    };
    return result;
  } catch (error) {
    hourlyAutopilotState = {
      ...hourlyAutopilotState,
      status: "failed",
      lastError: error instanceof Error ? error.message : String(error),
      nextRunAt: hourlyAutopilotConfig.enabled
        ? new Date(Date.now() + hourlyAutopilotConfig.intervalMinutes * 60_000).toISOString()
        : null,
    };
    throw error;
  }
}

function hourlyAutopilotPayload() {
  return {
    config: hourlyAutopilotConfig,
    state: hourlyAutopilotState,
    transport: sendTransportStatus(),
    policy: {
      maxLeadsPerRun: 50,
      minimumIntervalMinutes: 15,
      actualDefaultIntervalMinutes: 60,
      outsideWorldActions: "Cold email sending requires Gmail/SMTP transport and AUTOPILOT_ALLOW_COLD_EMAIL_SEND=true. Otherwise drafts are logged for approval.",
      compliance: [
        "Use relevant B2B targeting only.",
        "Include sender identity and opt-out instructions.",
        "Do not contact opted-out recipients.",
        "Avoid sole traders or personal addresses unless you have a lawful basis.",
      ],
    },
  };
}

function findAccountByPhone(rawPhone: string) {
  const target = normalizePhone(rawPhone);
  if (!target) return null;

  for (const account of database.getAccounts(1, 500)) {
    if (normalizePhone(account.phoneNumber) === target) {
      return {account, full: database.getAccountFull(account.clientId)};
    }
  }

  for (const account of database.getAccounts(1, 500)) {
    const full = database.getAccountFull(account.clientId);
    const match = full.contacts.find((contact) => normalizePhone(contact.phone as string | null) === target);
    if (match) {
      return {account, full, contact: match};
    }
  }

  return null;
}

// Simple in-memory rate limiter
const rateLimitWindow = 60_000; // 1 minute
const rateLimitMax = 120; // requests per window
const rateLimitMap = new Map<string, {count: number; resetAt: number}>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, {count: 1, resetAt: now + rateLimitWindow});
    return true;
  }
  entry.count += 1;
  return entry.count <= rateLimitMax;
}

// Periodically clean stale rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 120_000);

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

const clientCreateSchema = z.object({
  businessName: z.string().min(2),
  businessType: z.string().min(2),
  area: z.string().min(2),
  emailAddress: z.string().email().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  websiteUrl: z.string().url().optional().nullable(),
  address: z.string().optional().nullable(),
  googleRating: z.number().min(0).max(5).optional().nullable(),
  reviewCount: z.number().int().min(0).optional().nullable(),
  accountStatus: z.enum(["researched", "ready-to-send", "contacted", "in-follow-up", "replied", "proposal", "won", "lost"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  dueDate: z.string().optional().nullable(),
  nextActionNotes: z.string().optional(),
  dealValue: z.number().int().min(0).optional(),
  siteScore: z.number().int().min(0).max(100).optional(),
  sourceNotes: z.string().optional(),
});

const clientPatchSchema = z.object({
  accountStatus: z.enum(["researched", "ready-to-send", "contacted", "in-follow-up", "replied", "proposal", "won", "lost"]).optional(),
  followUpPriority: z.enum(["critical", "high", "medium", "low"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  followUpNextStep: z.string().min(2).optional(),
  nextActionNotes: z.string().min(1).optional(),
  followUpDueDate: z.string().min(8).optional(),
  dueDate: z.string().min(8).optional(),
  owner: z.string().min(1).optional(),
  closeProbability: z.number().int().min(0).max(100).optional(),
  valueEstimate: z.number().int().min(0).optional(),
  lastContactedAt: z.string().nullable().optional(),
  businessName: z.string().min(2).optional(),
  businessType: z.string().min(2).optional(),
  area: z.string().min(2).optional(),
  websiteUrl: z.string().url().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  emailAddress: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  googleRating: z.number().min(0).max(5).nullable().optional(),
  reviewCount: z.number().int().min(0).nullable().optional(),
  score: z.number().int().min(0).max(100).optional(),
  sourceNotes: z.string().optional(),
  heroImage: z.string().nullable().optional(),
  servicesImage: z.string().nullable().optional(),
  demoFile: z.string().nullable().optional(),
  videoFile: z.string().nullable().optional(),
  emailFile: z.string().nullable().optional(),
});

function normalizePriorityInput(
  priority: "critical" | "high" | "medium" | "low" | undefined,
): "high" | "medium" | "low" | undefined {
  if (!priority) return undefined;
  return priority === "critical" ? "high" : priority;
}

const contactSchema = z.object({
  fullName: z.string().min(2),
  role: z.string().min(1).default("Decision maker"),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  linkedin: z.string().url().optional().nullable(),
  isPrimary: z.boolean().optional().default(false),
  notes: z.string().optional().default(""),
  status: z.enum(["reachable", "needs-research", "decision-maker", "gatekeeper"]).optional().default("reachable"),
  bestTime: z.enum(["Morning 9–12", "Afternoon 12–5", "Evening 5–7", "Any time"]).optional().default("Any time"),
  contactPreference: z.enum(["Email first", "Call first", "Both"]).optional().default("Both"),
});

const contactPatchSchema = contactSchema.partial();

const activitySchema = z.object({
  type: z.enum(["audit", "demo", "video", "email", "cold-call", "follow-up", "note"]),
  status: z.enum(["prepared", "queued", "sent", "delivered", "replied", "booked", "won", "lost"]),
  title: z.string().min(2),
  summary: z.string().min(2),
  owner: z.string().optional().default(brand.ownerName),
  scheduledFor: z.string().nullable().optional().default(null),
  completedAt: z.string().nullable().optional().default(null),
  linkedFiles: z.array(z.string()).optional().default([]),
  linkedChannels: z.array(z.string()).optional().default([]),
  eventSource: z.enum(["manual", "pipeline", "email", "call", "ai"]).optional().default("manual"),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

const eventSchema = z.object({
  channel: z.enum(["email", "call"]),
  status: z.enum(["prepared", "queued", "sent", "delivered", "replied", "booked", "won", "lost"]),
  summary: z.string().min(2),
  title: z.string().optional(),
});

const taskSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2).optional().default(""),
  status: z.enum(["todo", "doing", "done", "blocked"]).optional().default("todo"),
  priority: z.enum(["high", "medium", "low"]).optional().default("medium"),
  dueDate: z.string().min(8),
  owner: z.string().optional().default(brand.ownerName),
  lane: z.string().optional().default("ops"),
  taskType: z.string().optional().default("Other"),
});

const taskPatchSchema = z.object({
  status: z.enum(["todo", "doing", "done", "blocked"]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  dueDate: z.string().min(8).optional(),
  owner: z.string().min(1).optional(),
});

const memorySchema = z.object({
  clientId: z.string().nullable().optional().default(null),
  kind: z.enum(["context", "objection", "playbook", "follow-up", "intel"]),
  title: z.string().min(2),
  note: z.string().min(2),
  tags: z.array(z.string()).optional().default([]),
  source: z.enum(["manual", "pipeline", "ai"]).optional().default("manual"),
});

const proposalSchema = z.object({
  title: z.string().min(2),
  status: z.enum(["draft", "sent", "negotiating", "accepted", "lost"]).optional().default("draft"),
  packageName: z.string().min(2),
  price: z.number().int().min(0),
  probability: z.number().int().min(0).max(100),
  nextStep: z.string().min(2),
  scope: z.array(z.string()).optional().default([]),
  setupFee: z.number().int().min(0).optional(),
  monthlyRetainer: z.number().int().min(0).nullable().optional(),
  contractLength: z.string().optional(),
  estimatedDelivery: z.string().optional(),
  sentDate: z.string().nullable().optional(),
  responseDate: z.string().nullable().optional(),
  notes: z.string().optional(),
});

const proposalPatchSchema = z.object({
  status: z.enum(["draft", "sent", "negotiating", "accepted", "lost"]).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  price: z.number().int().min(0).optional(),
  nextStep: z.string().min(2).optional(),
});

const commentSchema = z.object({
  author: z.string().optional().default(brand.ownerName),
  body: z.string().min(2),
  type: z.enum(["note", "system", "decision"]).optional().default("note"),
});

const timelineSchema = z.object({
  eventType: z.string().min(2),
  timestamp: z.string().min(8),
  contactName: z.string().nullable().optional().default(null),
  notes: z.string().optional().default(""),
  duration: z.number().int().nullable().optional().default(null),
  followUpDate: z.string().nullable().optional().default(null),
  loggedBy: z.string().optional().default(brand.ownerName),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

const memoryPatchSchema = z.object({
  personality: z.string().optional(),
  painPoints: z.string().optional(),
  whatResonates: z.string().optional(),
  whatToAvoid: z.string().optional(),
  decisionProcess: z.string().optional(),
  bestWindow: z.string().optional(),
  conversationHighlights: z.array(z.object({date: z.string(), note: z.string()})).optional(),
  objections: z.array(z.object({objection: z.string(), handled: z.string()})).optional(),
  internalNotes: z.string().optional(),
});

const noteSchema = z.object({
  body: z.string().min(1),
});

const auditScoreSchema = z.object({
  criterion: z.string().min(2),
  score: z.number().int().min(0).max(10),
  note: z.string().optional().default(""),
});

const auditAnalysisSchema = z.object({
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  topProblems: z.array(z.string()).optional(),
  recommendedActions: z.string().optional(),
});

const callSchema = z.object({
  calledAt: z.string().min(8),
  outcome: z.string().min(2),
  durationMinutes: z.number().int().nullable().optional(),
  contactName: z.string().nullable().optional(),
  notes: z.string().optional(),
  followUpDate: z.string().nullable().optional(),
});

const leadSearchSchema = z.object({
  maxQualified: z.number().int().min(1).max(50).optional(),
  maxPerQuery: z.number().int().min(1).max(20).optional(),
});

const integrationSyncSchema = z.object({
  provider: z.enum(["gmail", "plaid", "revenuecat", "appstore"]).optional(),
});

const hourlyAutomationSchema = z.object({
  enabled: z.boolean().optional(),
  intervalMinutes: z.number().int().min(15).max(24 * 60).optional(),
  searchQuery: z.string().min(3).max(180).optional(),
  location: z.string().min(2).max(120).optional(),
  maxLeads: z.number().int().min(1).max(50).optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  generateImages: z.boolean().optional(),
  sendEmails: z.boolean().optional(),
  runNow: z.boolean().optional(),
});

const revenueRadarScanSchema = z.object({
  query: z.string().trim().min(3).max(180),
  location: z.string().trim().min(2).max(120),
  maxLeads: z.number().int().min(1).max(25).optional().default(10),
});

const plaidExchangeSchema = z.object({
  publicToken: z.string().min(8),
});

const leadStatusSchema = z.object({
  status: z.enum(["researched", "ready-to-send", "contacted", "in-follow-up", "replied", "proposal", "won", "lost"]),
});

const apifyRunSchema = z.object({
  input: z.record(z.string(), z.unknown()).optional().default({}),
  waitForFinishSeconds: z.number().int().min(0).max(120).optional().default(30),
  clientId: z.string().optional(),
  purpose: z.string().optional().default("External data enrichment"),
});

const gmailTokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});

const aiCommandSchema = z.object({
  message: z.string().min(1).max(8000),
  clientId: z.string().optional(),
  mode: z.enum(["operator", "sales", "technical", "strategy"]).optional().default("operator"),
});

const realtimeVoiceOfferSchema = z.object({
  sdp: z.string().min(100),
});

const voiceTranscriptionSchema = z.object({
  audioBase64: z.string().min(100),
  mimeType: z.string().min(3).max(120).default("audio/webm"),
});

const voiceToolCallSchema = z.object({
  name: z.enum([
    "get_dashboard_context",
    "get_visible_app_snapshot",
    "navigate",
    "run_acquisition",
    "ask_dashboard_ai",
    "open_highest_priority_lead",
  ]),
  arguments: z.record(z.string(), z.unknown()).optional().default({}),
});

const operatorCommandSchema = z.object({
  message: z.string().min(1).max(6000),
  source: z.enum(["voice", "text", "system"]).optional().default("text"),
  route: z.string().optional().default("/"),
  visibleText: z.string().max(12000).optional(),
});

const operatorApprovalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
});

const ownedVoiceTurnSchema = z.object({
  transcript: z.string().min(1).max(8000),
  callerPhone: z.string().max(80).optional(),
  clientId: z.string().max(160).optional(),
});

const dealRoomGenerateSchema = z.object({
  clientId: z.string().min(1).max(160).optional(),
});

const gmailListSchema = z.object({
  messages: z.array(z.object({id: z.string(), threadId: z.string().optional()})).optional(),
  nextPageToken: z.string().optional(),
  resultSizeEstimate: z.number().optional(),
});

const gmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().optional(),
  internalDate: z.string().optional(),
  payload: z.object({
    headers: z.array(z.object({name: z.string(), value: z.string()})).optional(),
  }).passthrough().optional(),
}).passthrough();

function injectLiveReload(html: string) {
  const snippet = `
<script>
  (() => {
    const source = new EventSource('/events');
    source.addEventListener('refresh', () => window.location.reload());
  })();
</script>`;
  return html.includes("</body>") ? html.replace("</body>", `${snippet}\n</body>`) : `${html}\n${snippet}`;
}

async function buildDashboardState() {
  const state = database.getState();
  state.sync.stripeConnectorReady = isStripeConfigured();
  state.sync.callConnectorReady = isTwilioConfigured();
  return state;
}

async function buildMetricsPayload() {
  return {
    ...database.getMetrics(),
    stripe: await getStripeSummary(),
  };
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s.`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function buildPipelinePayload() {
  const [rawLeads, qualifiedLeads, crmSnapshot] = await Promise.all([
    readJsonFile<unknown[]>(outputFiles.leadsRaw, []),
    readJsonFile<unknown[]>(outputFiles.leadsQualified, []),
    readJsonFile<Record<string, unknown>>(outputFiles.crmJson, {}),
  ]);
  return {
    rawLeads,
    qualifiedLeads,
    crmSnapshot,
    files: {
      leadsRaw: outputFiles.leadsRaw,
      leadsQualified: outputFiles.leadsQualified,
      crmJson: outputFiles.crmJson,
    },
  };
}

function toOutputRelative(filePath: string) {
  const marker = `${path.sep}output${path.sep}`;
  const normalized = path.normalize(filePath);
  const index = normalized.indexOf(marker);
  return index >= 0 ? normalized.slice(index + marker.length).split(path.sep).join("/") : normalized.replace(/^\/+/, "");
}

function getGmailConfig() {
  const clientId = process.env.GMAIL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GMAIL_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? "";
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN ?? process.env.GOOGLE_REFRESH_TOKEN ?? "";
  const userEmail = process.env.GMAIL_USER_EMAIL ?? "me";
  const missingEnv = [
    !clientId ? "GMAIL_CLIENT_ID" : null,
    !clientSecret ? "GMAIL_CLIENT_SECRET" : null,
    !refreshToken ? "GMAIL_REFRESH_TOKEN" : null,
  ].filter((item): item is string => Boolean(item));
  return {
    clientId,
    clientSecret,
    refreshToken,
    userEmail,
    configured: missingEnv.length === 0,
    missingEnv,
  };
}

async function getGmailAccessToken() {
  const config = getGmailConfig();
  if (!config.configured) {
    throw new Error(`Gmail is missing ${config.missingEnv.join(", ")}`);
  }
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Google OAuth token refresh failed: ${JSON.stringify(payload)}`);
  }
  return gmailTokenSchema.parse(payload).access_token;
}

function gmailOAuthRedirectUri() {
  return `${process.env.PUBLIC_BASE_URL ?? `http://${host}:${port}`}/api/mail/oauth/callback`;
}

function buildGmailOAuthUrl() {
  const config = getGmailConfig();
  const missing = [
    !config.clientId ? "GMAIL_CLIENT_ID" : null,
    !config.clientSecret ? "GMAIL_CLIENT_SECRET" : null,
  ].filter((item): item is string => Boolean(item));
  if (missing.length) {
    return {
      configured: false,
      missingEnv: missing,
      authUrl: null,
      redirectUri: gmailOAuthRedirectUri(),
    };
  }
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", gmailOAuthRedirectUri());
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("scope", [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" "));
  return {
    configured: true,
    missingEnv: [] as string[],
    authUrl: authUrl.toString(),
    redirectUri: gmailOAuthRedirectUri(),
  };
}

async function upsertEnvLocal(updates: Record<string, string>) {
  const envPath = path.join(rootDir, ".env.local");
  let text = "";
  try {
    text = await fsp.readFile(envPath, "utf8");
  } catch {
    text = "";
  }
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    text = pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\s*$/, "")}\n${line}\n`;
  }
  await fsp.writeFile(envPath, text);
}

async function exchangeGmailAuthCode(code: string) {
  const config = getGmailConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Gmail OAuth needs GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET first.");
  }
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: gmailOAuthRedirectUri(),
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Google OAuth code exchange failed: ${JSON.stringify(payload)}`);
  }
  const token = gmailTokenSchema.parse(payload);
  if (!token.refresh_token) {
    throw new Error("Google did not return a refresh token. Reopen the setup link and approve with prompt=consent.");
  }
  let emailAddress = "";
  try {
    const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: {Authorization: `Bearer ${token.access_token}`, Accept: "application/json"},
    });
    const profile = await profileResponse.json() as {emailAddress?: string};
    emailAddress = profile.emailAddress ?? "";
  } catch {
    emailAddress = "";
  }
  await upsertEnvLocal({
    GMAIL_REFRESH_TOKEN: token.refresh_token,
    ...(emailAddress ? {GMAIL_USER_EMAIL: emailAddress} : {}),
  });
  process.env.GMAIL_REFRESH_TOKEN = token.refresh_token;
  if (emailAddress) process.env.GMAIL_USER_EMAIL = emailAddress;
  return {emailAddress};
}

function mailHeader(headers: Array<{name: string; value: string}> | undefined, name: string) {
  return headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseEmailAddress(value: string) {
  const match = value.match(/^(.*?)\s*<([^>]+)>$/);
  if (!match) return {name: value || "Unknown sender", email: value || ""};
  return {
    name: match[1].replace(/^"|"$/g, "").trim() || match[2],
    email: match[2].trim(),
  };
}

async function gmailFetchWithRetry(url: URL, accessToken: string, maxAttempts = 4): Promise<Response> {
  let attempt = 0;
  while (true) {
    attempt += 1;
    const res = await fetch(url, {
      headers: {Authorization: `Bearer ${accessToken}`, Accept: "application/json"},
    });
    if (res.ok) return res;
    // 429 (rate limit) and 503 (backend overloaded) are retryable.
    if ((res.status === 429 || res.status === 503) && attempt < maxAttempts) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const backoff = retryAfter > 0
        ? retryAfter * 1000
        : Math.min(4000, 250 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 150);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      continue;
    }
    return res;
  }
}

function encodeMimeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

async function sendViaGmailApi(opts: {to: string; subject: string; body: string; from?: string; cc?: string; replyTo?: string}) {
  const accessToken = await getGmailAccessToken();
  const config = getGmailConfig();
  const sender = opts.from || config.userEmail || "me";
  const lines: string[] = [
    `From: ${encodeMimeHeader(sender)}`,
    `To: ${opts.to}`,
  ];
  if (opts.cc) lines.push(`Cc: ${opts.cc}`);
  if (opts.replyTo) lines.push(`Reply-To: ${opts.replyTo}`);
  lines.push(
    `Subject: ${encodeMimeHeader(opts.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    opts.body,
  );
  const raw = Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({raw}),
  });
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(`Gmail send failed (${res.status}): ${JSON.stringify(payload)}`);
  }
  return payload as {id: string; threadId: string; labelIds?: string[]};
}

async function fetchGmailInbox(options: {q?: string; maxResults?: number}) {
  const config = getGmailConfig();
  const drafts = database.getMailDrafts();
  if (!config.configured) {
    return {
      provider: "gmail",
      configured: false,
      connected: false,
      account: config.userEmail,
      missingEnv: config.missingEnv,
      messages: [],
      drafts,
      resultSizeEstimate: 0,
      error: null,
    };
  }

  const accessToken = await getGmailAccessToken();
  const listUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(config.userEmail)}/messages`);
  listUrl.searchParams.set("maxResults", String(Math.min(Math.max(options.maxResults ?? 25, 1), 50)));
  if (options.q?.trim()) listUrl.searchParams.set("q", options.q.trim());

  const listResponse = await gmailFetchWithRetry(listUrl, accessToken);
  const listPayload = await listResponse.json();
  if (!listResponse.ok) {
    throw new Error(`Gmail message list failed: ${JSON.stringify(listPayload)}`);
  }
  const list = gmailListSchema.parse(listPayload);

  const rawMessages = list.messages ?? [];
  const messages: Array<{
    id: string;
    threadId: string;
    fromName: string;
    fromEmail: string;
    subject: string;
    preview: string;
    receivedAt: string;
    read: boolean;
    starred: boolean;
    labels: string[];
    tag: string;
  }> = [];
  const concurrency = 5;
  for (let cursor = 0; cursor < rawMessages.length; cursor += concurrency) {
    const batch = rawMessages.slice(cursor, cursor + concurrency);
    const resolved = await Promise.all(batch.map(async (message) => {
      const detailUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(config.userEmail)}/messages/${encodeURIComponent(message.id)}`);
      detailUrl.searchParams.set("format", "metadata");
      for (const header of ["From", "To", "Subject", "Date"]) detailUrl.searchParams.append("metadataHeaders", header);
      const detailResponse = await gmailFetchWithRetry(detailUrl, accessToken);
      const detailPayload = await detailResponse.json();
      if (!detailResponse.ok) {
        throw new Error(`Gmail message get failed: ${JSON.stringify(detailPayload)}`);
      }
      const detail = gmailMessageSchema.parse(detailPayload);
      const headers = detail.payload?.headers ?? [];
      const from = parseEmailAddress(mailHeader(headers, "From"));
      const subject = mailHeader(headers, "Subject") || "(no subject)";
      const labels = detail.labelIds ?? [];
      const receivedAt = detail.internalDate
        ? new Date(Number(detail.internalDate)).toISOString()
        : parseIsoDateCandidate(mailHeader(headers, "Date")) ?? new Date().toISOString();
      const tag = labels.includes("SENT")
        ? "outreach"
        : subject.toLowerCase().startsWith("re:")
          ? "reply"
          : labels.includes("IMPORTANT")
            ? "lead"
            : "inbox";
      return {
        id: detail.id,
        threadId: detail.threadId ?? message.threadId ?? detail.id,
        fromName: from.name,
        fromEmail: from.email,
        subject,
        preview: detail.snippet ?? "",
        receivedAt,
        read: !labels.includes("UNREAD"),
        starred: labels.includes("STARRED"),
        labels,
        tag,
      };
    }));
    messages.push(...resolved);
  }

  return {
    provider: "gmail",
    configured: true,
    connected: true,
    account: config.userEmail,
    missingEnv: [],
    messages,
    drafts,
    resultSizeEstimate: list.resultSizeEstimate ?? messages.length,
    error: null,
  };
}

async function runAiCommand(input: z.infer<typeof aiCommandSchema>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const modelCandidates = Array.from(new Set([
    process.env.OPENAI_MODEL || "gpt-4o-mini",
    "gpt-4.1-mini",
    "gpt-4o-mini",
  ].filter(Boolean)));
  const state = await buildDashboardState();
  const client360 = buildClient360Payload();
  const selectedLead = input.clientId ? database.getAccountFull(input.clientId) : null;
  const compactAccounts = client360.accounts.slice(0, 30).map((account) => ({
    clientId: account.clientId,
    businessName: account.businessName,
    status: account.accountStatus,
    area: account.area,
    type: account.businessType,
    score: account.siteScore,
    relationshipScore: account.relationshipScore,
    openTasks: account.openTasks,
    risks: account.riskFlags,
    nextBestAction: account.nextBestAction,
  }));
  const system = [
    "You are the Elite Automations operating assistant inside Hamid's private business OS.",
    "Use the provided live dashboard context. Be practical, specific, and honest about missing data.",
    "If an action affects the outside world, recommend an approval step instead of pretending it has been done.",
    "Write like a calm elite operator: direct, commercially sharp, no hype, no filler.",
  ].join(" ");
  const context = {
    generatedAt: new Date().toISOString(),
    mode: input.mode,
    metrics: state.metrics,
    sync: state.sync,
    clientTotals: client360.totals,
    signals: client360.signals,
    accounts: compactAccounts,
    selectedLead,
  };
  let lastError = "OpenAI request failed.";
  for (const model of modelCandidates) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {role: "system", content: system},
          {role: "user", content: `Live context:\n${JSON.stringify(context, null, 2)}\n\nHamid asks:\n${input.message}`},
        ],
      }),
    });
    const payload = await response.json() as {
      choices?: Array<{message?: {content?: string}}>;
      error?: {message?: string};
      usage?: Record<string, unknown>;
    };
    if (!response.ok) {
      lastError = payload.error?.message ?? `OpenAI request failed for ${model}.`;
      continue;
    }
    return {
      reply: payload.choices?.[0]?.message?.content ?? "No reply returned.",
      model,
      usage: payload.usage ?? null,
      context: {
        accountsIncluded: compactAccounts.length,
        selectedLead: input.clientId ?? null,
        metricsAt: state.generatedAt,
      },
    };
  }
  throw new Error(lastError);
}

function getOpenAiVoiceStatus() {
  const configured = Boolean(process.env.OPENAI_API_KEY);
  return {
    provider: "openai",
    configured,
    transport: "webrtc",
    model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-1.5",
    voice: process.env.OPENAI_REALTIME_VOICE || "marin",
    missingEnv: configured ? [] : ["OPENAI_API_KEY"],
  };
}

type MarketWatchlistItem = {
  symbol: string;
  yahoo?: string;
  binance?: string;
  label: string;
  market: "stock" | "crypto" | "fx" | "index";
  note: string;
};

const marketWatchlist: MarketWatchlistItem[] = [
  {symbol: "NASDAQ:NVDA", yahoo: "NVDA", label: "NVIDIA", market: "stock", note: "AI infrastructure bellwether"},
  {symbol: "NASDAQ:MSFT", yahoo: "MSFT", label: "Microsoft", market: "stock", note: "Cloud and enterprise AI"},
  {symbol: "NASDAQ:AAPL", yahoo: "AAPL", label: "Apple", market: "stock", note: "Consumer demand signal"},
  {symbol: "NASDAQ:TSLA", yahoo: "TSLA", label: "Tesla", market: "stock", note: "Automation and sentiment"},
  {symbol: "NASDAQ:GOOGL", yahoo: "GOOGL", label: "Alphabet", market: "stock", note: "Search, ads, Gemini"},
  {symbol: "COINBASE:BTCUSD", binance: "BTCUSDT", label: "Bitcoin", market: "crypto", note: "Risk appetite"},
  {symbol: "COINBASE:ETHUSD", binance: "ETHUSDT", label: "Ethereum", market: "crypto", note: "On-chain activity"},
  {symbol: "BINANCE:SOLUSDT", binance: "SOLUSDT", label: "Solana", market: "crypto", note: "High-beta crypto"},
  {symbol: "FX:GBPUSD", yahoo: "GBPUSD=X", label: "GBP / USD", market: "fx", note: "UK purchasing power"},
  {symbol: "TVC:UKX", yahoo: "^FTSE", label: "FTSE 100", market: "index", note: "UK market baseline"},
];

let marketQuoteCache: {expiresAt: number; payload: unknown} | null = null;

function numericValue(value: unknown) {
  const numberValue = typeof value === "string" ? Number.parseFloat(value) : typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(numberValue) ? numberValue : null;
}

async function fetchMarketJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "HamidOS/1.0 market-watchlist",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`Market data request failed with ${response.status}`);
  }
  return await response.json() as T;
}

async function fetchYahooQuote(symbol: string) {
  type YahooChartResponse = {
    chart?: {
      result?: Array<{
        meta?: Record<string, unknown>;
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            close?: Array<number | null>;
          }>;
        };
      }>;
    };
  };
  const payload = await fetchMarketJson<YahooChartResponse>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`,
  );
  const result = payload.chart?.result?.[0];
  if (!result?.meta) throw new Error("Yahoo returned no quote.");
  const price = numericValue(result.meta.regularMarketPrice)
    ?? numericValue(result.indicators?.quote?.[0]?.close?.filter((value) => value !== null).at(-1));
  const previousClose = numericValue(result.meta.previousClose)
    ?? numericValue(result.meta.chartPreviousClose);
  if (price === null) throw new Error("Yahoo quote was missing a live price.");
  const change = previousClose === null ? null : price - previousClose;
  const changePercent = previousClose === null || previousClose === 0 ? null : (change ?? 0) / previousClose * 100;
  return {
    price,
    change,
    changePercent,
    currency: typeof result.meta.currency === "string" ? result.meta.currency : "USD",
    exchangeName: typeof result.meta.exchangeName === "string" ? result.meta.exchangeName : null,
    regularMarketTime: numericValue(result.meta.regularMarketTime),
    points: (result.timestamp ?? []).map((timestamp, index) => ({
      time: new Date(timestamp * 1000).toISOString(),
      value: result.indicators?.quote?.[0]?.close?.[index] ?? null,
    })).filter((point) => point.value !== null).slice(-80),
  };
}

async function fetchBinanceQuote(symbol: string) {
  type BinanceTickerResponse = {
    lastPrice?: string;
    priceChange?: string;
    priceChangePercent?: string;
    closeTime?: number;
  };
  const payload = await fetchMarketJson<BinanceTickerResponse>(
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
  );
  const price = numericValue(payload.lastPrice);
  if (price === null) throw new Error("Binance quote was missing a live price.");
  return {
    price,
    change: numericValue(payload.priceChange),
    changePercent: numericValue(payload.priceChangePercent),
    currency: "USD",
    exchangeName: "BINANCE",
    regularMarketTime: payload.closeTime ? Math.floor(payload.closeTime / 1000) : null,
    points: [],
  };
}

async function buildMarketWatchlistPayload() {
  const now = Date.now();
  if (marketQuoteCache && marketQuoteCache.expiresAt > now) return marketQuoteCache.payload;

  const quotes = await Promise.all(marketWatchlist.map(async (item) => {
    try {
      const quote = item.binance
        ? await fetchBinanceQuote(item.binance)
        : await fetchYahooQuote(item.yahoo ?? item.symbol);
      return {
        ...item,
        status: "live" as const,
        source: item.binance ? "Binance public market data" : "Yahoo Finance chart data",
        ...quote,
        fetchedAt: new Date().toISOString(),
        error: null,
      };
    } catch (error) {
      return {
        ...item,
        status: "error" as const,
        source: item.binance ? "Binance public market data" : "Yahoo Finance chart data",
        price: null,
        change: null,
        changePercent: null,
        currency: item.binance ? "USD" : "USD",
        exchangeName: null,
        regularMarketTime: null,
        points: [],
        fetchedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Market data failed.",
      };
    }
  }));

  const payload = {
    generatedAt: new Date().toISOString(),
    ttlSeconds: 60,
    quotes,
  };
  marketQuoteCache = {expiresAt: now + 60_000, payload};
  return payload;
}

async function buildVoiceDashboardContext() {
  const state = await buildDashboardState();
  const client360 = buildClient360Payload();
  let agents: Array<{id: string; name: string; role: string; status: string}> = [];
  let approvalsPending = 0;

  try {
    const agentList = await openClawService.listAgents();
    agents = agentList.slice(0, 12).map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
    }));
  } catch {
    agents = [];
  }

  try {
    const approvals = await openClawService.getApprovals();
    approvalsPending = approvals.pending.length;
  } catch {
    approvalsPending = 0;
  }

  const integrationStatus = integrationStatusPayload();
  const compactAccount = (account: typeof client360.accounts[number]) => ({
    clientId: account.clientId,
    businessName: account.businessName,
    area: account.area,
    status: account.accountStatus,
    priority: account.priority,
    siteScore: account.siteScore,
    relationshipScore: account.relationshipScore,
    openTasks: account.openTasks,
    overdueTasks: account.overdueTasks,
    risks: account.riskFlags.slice(0, 3),
    nextBestAction: account.nextBestAction,
  });
  const topAccounts = client360.accounts
    .slice()
    .sort((a, b) => (b.siteScore + b.relationshipScore + b.openTasks) - (a.siteScore + a.relationshipScore + a.openTasks))
    .slice(0, 12)
    .map((account) => ({
      clientId: account.clientId,
      businessName: account.businessName,
      area: account.area,
      businessType: account.businessType,
      status: account.accountStatus,
      priority: account.priority,
      siteScore: account.siteScore,
      relationshipScore: account.relationshipScore,
      dealValue: account.dealValue,
      risks: account.riskFlags,
      nextBestAction: account.nextBestAction,
    }));

  return {
    generatedAt: new Date().toISOString(),
    owner: state.owner,
    brand: state.brand,
    metrics: state.metrics,
    clientTotals: client360.totals,
    signals: {
      staleAccounts: client360.signals.staleAccounts.slice(0, 5).map(compactAccount),
      overdueAccounts: client360.signals.overdueAccounts.slice(0, 5).map(compactAccount),
      hotAccounts: client360.signals.hotAccounts.slice(0, 5).map(compactAccount),
      incompleteDossiers: client360.signals.incompleteDossiers.slice(0, 5).map(compactAccount),
    },
    sync: state.sync,
    integrations: integrationStatus.connectors.map((connector) => ({
      provider: connector.provider,
      label: connector.label,
      connected: connector.connected,
      status: connector.status,
      lastSyncAt: connector.syncedAt,
      missingEnv: connector.missingEnv,
    })),
    agents,
    approvalsPending,
    leadSearchStatus: {
      status: leadSearchStatus.status,
      startedAt: leadSearchStatus.startedAt,
      finishedAt: leadSearchStatus.finishedAt,
      message: leadSearchStatus.message,
    },
    hourlyAutopilot: hourlyAutopilotPayload(),
    topAccounts,
    routes: [
      {route: "/", label: "Command centre"},
      {route: "/leads", label: "Leads pipeline"},
      {route: "/planner", label: "Daily planner"},
      {route: "/agents", label: "Agent fleet"},
      {route: "/ops/automation", label: "Automation"},
      {route: "/ops/approvals", label: "Approvals"},
      {route: "/calls", label: "Calls centre"},
      {route: "/mail", label: "Email inbox"},
      {route: "/pay", label: "Revenue"},
      {route: "/markets", label: "Markets and trading view"},
    ],
  };
}

function getRealtimeVoiceTools() {
  return [
    {
      type: "function",
      name: "get_dashboard_context",
      description: "Read the current HAMID.OS dashboard context, metrics, integrations, agents, approvals, and top accounts.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "get_visible_app_snapshot",
      description: "Read the current browser route, page title, and visible dashboard text. This is handled client-side by the dashboard.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "navigate",
      description: "Move the dashboard to a safe internal route so Hamid can see the requested workspace.",
      parameters: {
        type: "object",
        properties: {
          route: {
            type: "string",
            description: "Internal hash route such as /leads, /planner, /markets, /calls, /ops/automation, /pay.",
          },
        },
        required: ["route"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "run_acquisition",
      description: "Start a small Firecrawl/lead acquisition run. Larger runs are approval-gated.",
      parameters: {
        type: "object",
        properties: {
          maxLeads: {
            type: "number",
            minimum: 1,
            maximum: 50,
            description: "How many qualified leads to search for. Values above 10 require approval.",
          },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "ask_dashboard_ai",
      description: "Ask the text strategy assistant to analyse current dashboard context and return an operator answer.",
      parameters: {
        type: "object",
        properties: {
          message: {type: "string"},
          mode: {type: "string", enum: ["operator", "sales", "technical", "strategy"]},
        },
        required: ["message"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "open_highest_priority_lead",
      description: "Find the most urgent lead/client file and open it in the dashboard.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ];
}

async function buildRealtimeVoiceInstructions() {
  const context = await buildVoiceDashboardContext();
  return [
    "You are JARVIS Voice inside Hamid's private Elite Automations command centre.",
    "Sound calm, human, concise, and grounded. Never start with exaggerated energy; use a natural low-pressure sales-operator tone.",
    "Help Hamid operate the business: leads, client files, calls, payments, projects, personal planning, and approvals.",
    "When live data is missing, say exactly what needs connecting. Do not invent results.",
    "You can use dashboard tools for safe internal actions. If an action affects the outside world, uses spend, sends messages, or launches a large scrape, tell Hamid it needs approval before execution.",
    "Keep spoken answers short unless Hamid asks for a full plan.",
    "Current dashboard context JSON:",
    JSON.stringify(context).slice(0, 14000),
  ].join("\n\n");
}

function normalizeInternalRoute(route: unknown) {
  if (typeof route !== "string") return "/";
  const cleaned = route.trim().startsWith("/") ? route.trim() : `/${route.trim()}`;
  const allowed = new Set([
    "/",
    "/agency",
    "/agents",
    "/analytics",
    "/leads",
    "/planner",
    "/settings",
    "/crm",
    "/crm/contacts",
    "/crm/pipeline",
    "/crm/activity",
    "/ai",
    "/ai/scraper",
    "/ai/imagegen",
    "/ai/agents",
    "/ai/intel",
    "/mail",
    "/mail/compose",
    "/mail/templates",
    "/mail/campaigns",
    "/pay",
    "/pay/invoices",
    "/pay/subscriptions",
    "/pay/products",
    "/pay/links",
    "/pay/customers",
    "/personal",
    "/ops",
    "/ops/revenue-radar",
    "/ops/tools",
    "/ops/tools/evidence-dossier",
    "/ops/tools/reply-radar",
    "/ops/tools/deal-room",
    "/ops/tools/owned-voice-agent",
    "/ops/tools/finance-guard",
    "/ops/tools/war-room",
    "/ops/tools/opportunity-engine",
    "/ops/tools/revenue-radar",
    "/ops/tools/proof-vault",
    "/ops/tools/design-lab",
    "/ops/metrics",
    "/ops/automation",
    "/ops/workflows",
    "/ops/approvals",
    "/ops/tunnel",
    "/ops/health",
    "/timeline",
    "/calls",
    "/calls/outbound",
    "/calls/logs",
    "/calls/messages",
    "/calls/agents",
    "/vid",
    "/vid/assets",
    "/markets",
  ]);
  return allowed.has(cleaned) ? cleaned : "/";
}

async function runVoiceToolCall(input: z.infer<typeof voiceToolCallSchema>) {
  const args = input.arguments;

  if (input.name === "get_dashboard_context") {
    return {ok: true, data: await buildVoiceDashboardContext()};
  }

  if (input.name === "get_visible_app_snapshot") {
    return {
      ok: false,
      message: "The visible app snapshot must be handled in the browser session.",
    };
  }

  if (input.name === "navigate") {
    const route = normalizeInternalRoute(args.route);
    return {
      ok: true,
      action: "navigate",
      route,
      message: `Opening ${route}.`,
    };
  }

  if (input.name === "open_highest_priority_lead") {
    const context = await buildVoiceDashboardContext();
    const topAccount = context.topAccounts[0];
    if (!topAccount) {
      return {ok: false, message: "No client files are available yet. Run acquisition or create an account first."};
    }
    return {
      ok: true,
      action: "navigate",
      route: `/leads/${topAccount.clientId}`,
      account: topAccount,
      message: `Opening ${topAccount.businessName}.`,
    };
  }

  if (input.name === "run_acquisition") {
    const requested = typeof args.maxLeads === "number" ? Math.round(args.maxLeads) : 5;
    const maxLeads = Math.max(1, Math.min(50, requested));
    if (maxLeads > 10) {
      return {
        ok: false,
        requiresApproval: true,
        message: "That is a larger acquisition run. Open approvals or automation and confirm it before spending API/search budget.",
        suggestedRoute: "/ops/automation",
      };
    }
    const status = await triggerLeadSearch({maxQualified: maxLeads, maxPerQuery: Math.min(maxLeads, 10)});
    return {
      ok: true,
      action: "refresh",
      route: "/leads",
      message: `Started a ${maxLeads}-lead acquisition run.`,
      status,
    };
  }

  const message = typeof args.message === "string" ? args.message : "Summarise the current state and tell Hamid the next best action.";
  const mode = args.mode === "sales" || args.mode === "technical" || args.mode === "strategy" || args.mode === "operator"
    ? args.mode
    : "operator";
  return {
    ok: true,
    data: await runAiCommand({message, mode}),
  };
}

async function createOpenAiRealtimeAnswer(offerSdp: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const status = getOpenAiVoiceStatus();
  const sessionConfig = JSON.stringify({
    type: "realtime",
    model: status.model,
    instructions: await buildRealtimeVoiceInstructions(),
    tools: getRealtimeVoiceTools(),
    tool_choice: "auto",
    audio: {
      output: {
        voice: status.voice,
      },
    },
  });
  const formData = new FormData();
  formData.set("sdp", offerSdp);
  formData.set("session", sessionConfig);

  const response = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Safety-Identifier": "hamid-os-local-command-centre",
    },
    body: formData,
  });

  const answer = await response.text();
  if (!response.ok) {
    let message = answer || "OpenAI Realtime voice call failed.";
    try {
      const parsed = JSON.parse(answer) as {error?: {message?: string}};
      message = parsed.error?.message ?? message;
    } catch {
      // The API can return plain text for SDP-related failures.
    }
    throw new Error(message);
  }

  return answer;
}

function audioExtensionFromMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("mpeg")) return "mpeg";
  if (mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("m4a")) return "m4a";
  return "webm";
}

async function transcribeOpenAiVoiceAudio(input: z.infer<typeof voiceTranscriptionSchema>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const base64 = input.audioBase64.replace(/^data:[^;]+;base64,/, "");
  const audioBytes = Buffer.from(base64, "base64");
  if (audioBytes.byteLength < 300) {
    throw new Error("Recorded audio was too short to transcribe.");
  }

  const audioFile = new Blob([
    audioBytes.buffer.slice(audioBytes.byteOffset, audioBytes.byteOffset + audioBytes.byteLength),
  ], {type: input.mimeType});
  const modelCandidates = Array.from(new Set([
    process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
    "gpt-4o-transcribe",
    "whisper-1",
  ].filter(Boolean)));
  let lastError = "OpenAI transcription failed.";
  const accessErrors: string[] = [];

  for (const model of modelCandidates) {
    const formData = new FormData();
    formData.set("model", model);
    formData.set("file", audioFile, `hamid-voice-command.${audioExtensionFromMimeType(input.mimeType)}`);
    formData.set("language", "en");
    formData.set("prompt", "Hamid is controlling HAMID.OS, an Elite Automations business command centre. Transcribe commands clearly, preserving business names, routes, agents, and numbers.");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });
    const raw = await response.text();
    let payload: {text?: string; error?: {message?: string}} = {};
    try {
      payload = JSON.parse(raw) as typeof payload;
    } catch {
      payload = {text: raw};
    }
    if (!response.ok) {
      lastError = payload.error?.message ?? (raw || `OpenAI transcription failed for ${model}.`);
      if (/does not exist|do not have access|does not have access/i.test(lastError)) {
        accessErrors.push(`${model}: ${lastError}`);
      }
      continue;
    }
    const text = String(payload.text ?? raw ?? "").trim();
    if (!text) {
      lastError = "OpenAI returned an empty transcription.";
      continue;
    }
    return {text, model};
  }

  if (accessErrors.length === modelCandidates.length) {
    throw new Error("OpenAI voice recording is wired, but this API project does not have access to any transcription model. Enable one of: gpt-4o-mini-transcribe, gpt-4o-transcribe, or whisper-1.");
  }

  throw new Error(lastError);
}

function mapLeadListItem(row: ReturnType<EliteOpsDatabase["getAccounts"]>[number]) {
  return {
    id: row.clientId,
    clientId: row.clientId,
    businessName: row.businessName,
    businessType: row.businessType,
    area: row.area,
    websiteUrl: row.websiteUrl,
    phoneNumber: row.phoneNumber,
    emailAddress: row.emailAddress,
    googleRating: row.googleRating,
    reviewCount: row.reviewCount,
    address: row.address,
    accountStatus: row.accountStatus,
    priority: row.priority,
    siteScore: row.siteScore,
    dueDate: row.dueDate,
    nextActionNotes: row.nextActionNotes,
    demoFile: row.demoFile,
    videoFile: row.videoFile,
    emailFile: row.emailFile,
    imageHero: row.imageHero,
    lastTimelineEventAt: row.lastTimelineEventAt,
    health: row.health,
  };
}

function normalizeLeadDetail(clientId: string) {
  const full = database.getAccountFull(clientId) as {
    account: Record<string, unknown>;
    auditScores: Array<Record<string, unknown>>;
    auditAnalysis?: Record<string, unknown>;
    contacts: Array<Record<string, unknown>>;
    timeline: Array<Record<string, unknown>>;
    tasks: Array<Record<string, unknown>>;
    proposals: Array<Record<string, unknown>>;
    memory?: Record<string, unknown>;
    notes: Array<Record<string, unknown>>;
    calls: Array<Record<string, unknown>>;
    browserAudits?: Array<Record<string, unknown>>;
  };

  const account = full.account;
  return {
    lead: {
      clientId,
      businessName: String(account.business_name ?? ""),
      businessType: String(account.business_type ?? ""),
      area: String(account.area ?? ""),
      websiteUrl: (account.website_url as string | null) ?? null,
      phoneNumber: (account.phone_number as string | null) ?? null,
      emailAddress: (account.email_address as string | null) ?? null,
      googleRating: account.google_rating == null ? null : Number(account.google_rating),
      reviewCount: account.review_count == null ? null : Number(account.review_count),
      address: (account.address as string | null) ?? null,
      accountStatus: String(account.account_status ?? "researched"),
      priority: String(account.priority ?? "medium"),
      dueDate: (account.due_date as string | null) ?? null,
      nextActionNotes: String(account.next_action_notes ?? ""),
      siteScore: Number(account.site_score ?? 0),
      dealValue: Number(account.deal_value ?? 0),
      closeProbability: Number(account.close_probability ?? 0),
      sourceNotes: String(account.source_notes ?? ""),
      imageHero: (account.image_hero as string | null) ?? null,
      imageServices: (account.image_services as string | null) ?? null,
      demoFile: (account.demo_file as string | null) ?? null,
      videoFile: (account.video_file as string | null) ?? null,
      emailFile: (account.email_file as string | null) ?? null,
      createdAt: String(account.created_at ?? ""),
      updatedAt: String(account.updated_at ?? ""),
    },
    auditScores: full.auditScores.map((row) => ({
      criterion: String(row.criterion ?? ""),
      score: Number(row.score ?? 0),
      note: String(row.note ?? ""),
      updatedAt: String(row.updated_at ?? ""),
    })),
    auditAnalysis: {
      strengths: parseJsonField<string[]>(full.auditAnalysis?.strengths ?? full.auditAnalysis?.strengths_json, []),
      weaknesses: parseJsonField<string[]>(full.auditAnalysis?.weaknesses ?? full.auditAnalysis?.weaknesses_json, []),
      topProblems: parseJsonField<string[]>(full.auditAnalysis?.top_problems ?? full.auditAnalysis?.top_problems_json, []),
      recommendedActions: String(full.auditAnalysis?.recommended_actions ?? ""),
    },
    contacts: full.contacts.map((row) => ({
      id: String(row.id),
      fullName: String(row.full_name ?? ""),
      role: String(row.role ?? ""),
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      linkedIn: (row.linkedin as string | null) ?? null,
      isPrimary: Boolean(row.is_primary),
      notes: String(row.notes ?? ""),
      status: String(row.status ?? "reachable"),
      bestTime: String(row.best_time ?? "Any time"),
      contactPreference: String(row.contact_preference ?? "Both"),
      createdAt: String(row.created_at ?? ""),
    })),
    timeline: full.timeline.map((row) => ({
      id: String(row.id),
      eventType: String(row.event_type ?? ""),
      timestamp: String(row.timestamp ?? ""),
      contactName: (row.contact_name as string | null) ?? null,
      notes: String(row.notes ?? ""),
      duration: row.duration == null ? null : Number(row.duration),
      followUpDate: (row.follow_up_date as string | null) ?? null,
      loggedBy: String(row.logged_by ?? ""),
      metadata: row.metadata_json ? JSON.parse(String(row.metadata_json)) : {},
      createdAt: String(row.created_at ?? ""),
    })),
    tasks: full.tasks.map((row) => ({
      id: String(row.id),
      title: String(row.title ?? ""),
      taskType: String(row.task_type ?? "Other"),
      assignedTo: String(row.assigned_to ?? ""),
      dueDate: String(row.due_date ?? ""),
      priority: String(row.priority ?? "normal"),
      notes: String(row.notes ?? ""),
      status: String(row.status ?? "open"),
      completedAt: (row.completed_at as string | null) ?? null,
      createdAt: String(row.created_at ?? ""),
    })),
    proposals: full.proposals.map((row) => ({
      id: String(row.id),
      packageName: String(row.package_name ?? ""),
      services: String(row.services_text ?? parseJsonField<string[]>(row.scope_json, []).join("\n")),
      setupFee: Number(row.setup_fee ?? row.price ?? 0),
      monthlyRetainer: row.monthly_retainer == null ? null : Number(row.monthly_retainer),
      contractLength: String(row.contract_length ?? ""),
      estimatedDelivery: String(row.estimated_delivery ?? ""),
      status: String(row.status ?? "draft"),
      sentDate: (row.sent_date as string | null) ?? null,
      responseDate: (row.response_date as string | null) ?? null,
      closeProbability: Number(row.probability ?? row.close_probability ?? 0),
      notes: String(row.notes ?? ""),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
    })),
    memory: full.memory
      ? {
          personality: String(full.memory.personality ?? ""),
          painPoints: String(full.memory.pain_points ?? ""),
          whatResonates: String(full.memory.what_resonates ?? ""),
          whatToAvoid: String(full.memory.what_to_avoid ?? ""),
          decisionProcess: String(full.memory.decision_process ?? ""),
          bestWindow: String(full.memory.best_window ?? ""),
          conversationHighlights: parseJsonField<Array<{date: string; note: string}>>(
            full.memory.conversation_highlights ?? full.memory.conversation_highlights_json,
            [],
          ),
          objections: parseJsonField<Array<{objection: string; handled: string}>>(
            full.memory.objections ?? full.memory.objections_json,
            [],
          ),
          internalNotes: String(full.memory.internal_notes ?? ""),
          updatedAt: String(full.memory.updated_at ?? ""),
        }
      : null,
    notes: full.notes.map((row) => ({
      id: String(row.id),
      body: String(row.body ?? ""),
      pinnedAt: (row.pinned_at as string | null) ?? null,
      createdAt: String(row.created_at ?? ""),
    })),
    calls: full.calls.map((row) => ({
      id: String(row.id),
      calledAt: String(row.called_at ?? ""),
      outcome: String(row.outcome ?? ""),
      durationMinutes: row.duration_minutes == null ? null : Number(row.duration_minutes),
      contactName: (row.contact_name as string | null) ?? null,
      notes: String(row.notes ?? ""),
      followUpDate: (row.follow_up_date as string | null) ?? null,
      createdAt: String(row.created_at ?? ""),
    })),
    browserAudits: (full.browserAudits ?? []).map((row) => ({
      id: String(row.id),
      websiteUrl: String(row.website_url ?? ""),
      summary: String(row.summary ?? ""),
      flaws: parseJsonField<string[]>(row.flaws_json, []),
      opportunities: parseJsonField<string[]>(row.opportunities_json, []),
      plan: parseJsonField<string[]>(row.plan_json, []),
      scores: parseJsonField<Record<string, number>>(row.scores_json, {}),
      evidence: parseJsonField<Record<string, unknown>>(row.evidence_json, {}),
      screenshotPath: (row.screenshot_path as string | null) ?? null,
      createdAt: String(row.created_at ?? ""),
    })),
  };
}

type LeadDetailPayload = ReturnType<typeof normalizeLeadDetail>;

function toOwnedAccountContext(detail: LeadDetailPayload): OwnedAccountContext {
  return {
    account: {
      clientId: detail.lead.clientId,
      businessName: detail.lead.businessName,
      businessType: detail.lead.businessType,
      area: detail.lead.area,
      websiteUrl: detail.lead.websiteUrl,
      phoneNumber: detail.lead.phoneNumber,
      emailAddress: detail.lead.emailAddress,
      googleRating: detail.lead.googleRating,
      reviewCount: detail.lead.reviewCount,
      address: detail.lead.address,
      sourceNotes: detail.lead.sourceNotes,
      accountStatus: detail.lead.accountStatus,
      priority: detail.lead.priority,
      siteScore: detail.lead.siteScore,
      dealValue: detail.lead.dealValue,
      closeProbability: detail.lead.closeProbability,
      nextActionNotes: detail.lead.nextActionNotes,
      lastTimelineEventAt: detail.timeline[0]?.timestamp ?? null,
    },
    contacts: detail.contacts.map((contact) => ({
      fullName: contact.fullName,
      role: contact.role,
      email: contact.email,
      phone: contact.phone,
      isPrimary: contact.isPrimary,
    })),
    tasks: detail.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
    })),
    proposals: detail.proposals.map((proposal) => ({
      id: proposal.id,
      packageName: proposal.packageName,
      services: proposal.services,
      setupFee: proposal.setupFee,
      monthlyRetainer: proposal.monthlyRetainer,
      status: proposal.status,
      closeProbability: proposal.closeProbability,
      notes: proposal.notes,
      updatedAt: proposal.updatedAt,
    })),
    timeline: detail.timeline.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      timestamp: event.timestamp,
      notes: event.notes,
      loggedBy: event.loggedBy,
    })),
    browserAudits: detail.browserAudits.map((audit) => ({
      id: audit.id,
      websiteUrl: audit.websiteUrl,
      summary: audit.summary,
      flaws: audit.flaws,
      opportunities: audit.opportunities,
      plan: audit.plan,
      scores: audit.scores,
      evidence: audit.evidence as OwnedAccountContext["browserAudits"][number]["evidence"],
      screenshotPath: audit.screenshotPath,
      createdAt: audit.createdAt,
    })),
    memory: detail.memory
      ? {
          painPoints: detail.memory.painPoints,
          whatResonates: detail.memory.whatResonates,
          decisionProcess: detail.memory.decisionProcess,
          conversationHighlights: detail.memory.conversationHighlights,
          objections: detail.memory.objections,
          internalNotes: detail.memory.internalNotes,
        }
      : null,
  };
}

function getOwnedAccountContexts(limit = 500) {
  return database.getAccounts(1, limit).map((account) => toOwnedAccountContext(normalizeLeadDetail(account.clientId)));
}

async function buildRevenueRadarPayload() {
  const [state, operatorStatus] = await Promise.all([
    buildDashboardState(),
    operatorRuntime.status(),
  ]);
  const integrations = integrationStatusPayload();
  return buildRevenueRadar({
    state,
    contexts: getOwnedAccountContexts(),
    connectors: integrations.connectors.map((connector) => ({
      provider: connector.provider,
      label: connector.label,
      connected: connector.connected,
      status: connector.status,
      enables: connector.enables,
    })),
    approvals: operatorStatus.approvals.length,
    nextRunAt: hourlyAutopilotState.nextRunAt,
  });
}

function scoreRadarBusiness(business: Awaited<ReturnType<typeof buildBusinessSearchReport>>["businesses"][number]) {
  let score = 42;
  if (business.url) score += 12;
  if (business.contactSignals.emailHints.length) score += 11;
  if (business.contactSignals.phoneHints.length) score += 9;
  score += Math.min(14, business.reviewSources.length * 4);
  score += Math.min(12, business.trustSignals.length * 3);
  if (!business.contactSignals.emailHints.length && !business.contactSignals.phoneHints.length) score += 6;
  if (business.description.length < 120) score -= 8;
  if (/booking|quote|call|contact/i.test(business.description)) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function inferRadarBusinessType(businessName: string, description: string, query: string) {
  const lower = `${businessName} ${description} ${query}`.toLowerCase();
  if (lower.includes("dent")) return "Dental";
  if (lower.includes("builder") || lower.includes("construction") || lower.includes("contractor")) return "Construction";
  if (lower.includes("restaurant") || lower.includes("takeaway") || lower.includes("cafe") || lower.includes("café")) return "Hospitality";
  if (lower.includes("beauty") || lower.includes("salon") || lower.includes("aesthetic")) return "Beauty & Wellness";
  if (lower.includes("estate") || lower.includes("property")) return "Estate Agency";
  if (lower.includes("plumb")) return "Plumbing";
  if (lower.includes("electric")) return "Electrical";
  if (lower.includes("legal") || lower.includes("solicitor") || lower.includes("law")) return "Legal";
  return "Local Business";
}

function isRadarDirectoryResult(business: Awaited<ReturnType<typeof buildBusinessSearchReport>>["businesses"][number]) {
  const haystack = `${business.name} ${business.url ?? ""} ${business.description}`.toLowerCase();
  return [
    "best & worst",
    "best and worst",
    "top 10",
    "best rated",
    "worst rated",
    "index ",
    "directory",
    "find a ",
    "find the ",
    "list of",
    "ranked",
    "/blog/",
    "/news/",
    "yell.com",
    "tripadvisor.",
    "trustpilot.com",
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "x.com/",
    "twitter.com",
    "google.com/search",
    "google.co.uk/search",
    "maps.google.",
    "checkatrade.com",
    "ratedpeople.com",
    "mybuilder.com",
    "fmb.org.uk",
    "companies house",
    "gov.uk",
  ].some((signal) => haystack.includes(signal));
}

function normalizeRadarBusinessUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const path = url.pathname.toLowerCase();
    if (/\/(reviews?|testimonials?|contact|about|services?|blog|news)(\/|$)/.test(path)) {
      return `${url.origin}/`;
    }
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return value;
  }
}

function cleanRadarBusinessName(name: string, url: string | null) {
  const parts = name
    .split(/\s[-–—|]\s/g)
    .map((part) => part.trim())
    .filter(Boolean);
  const lower = name.toLowerCase();
  if (/^(reviews?|testimonials?|contact|about)\b/.test(lower) && parts.length > 1) {
    return parts[parts.length - 1];
  }
  const best = parts.find((part) => !/reviews?|testimonials?|contact|about|best|worst|index|directory/i.test(part)) ?? parts[0] ?? name;
  if (best && best.length > 2) return best;
  if (!url) return name.trim();
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").split(".")[0] ?? "";
    return host.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) || name.trim();
  } catch {
    return name.trim();
  }
}

function estimatedRadarDealValue(businessType: string, score: number) {
  const type = businessType.toLowerCase();
  const base = type.includes("dental") || type.includes("estate")
    ? 2800
    : type.includes("construction") || type.includes("legal")
      ? 2400
      : type.includes("hospitality") || type.includes("beauty")
        ? 1800
        : 1500;
  return Math.round(base + Math.max(0, score - 55) * 22);
}

async function runRevenueRadarDiscovery(rawBody: unknown) {
  const payload = revenueRadarScanSchema.parse(rawBody);
  const runId = `RR-${uniqueId(payload.query, payload.location, String(Date.now()))}`;
  const reportLimit = Math.min(25, Math.max(payload.maxLeads * 4, payload.maxLeads));
  const report = await withTimeout(
    buildBusinessSearchReport(payload.query, payload.location, reportLimit),
    45_000,
    "Revenue Radar web discovery",
  );
  const existingAccounts = database.getAccounts(1, 500);
  const results: Array<{
    businessName: string;
    url: string | null;
    score: number;
    clientId: string | null;
    status: "created" | "existing" | "skipped";
    reason: string;
  }> = [];

  let accepted = 0;
  for (const business of report.businesses) {
    if (accepted >= payload.maxLeads) break;
    const normalizedUrl = normalizeRadarBusinessUrl(business.url);
    const businessName = cleanRadarBusinessName(business.name.trim(), normalizedUrl);
    if (!businessName || businessName.length < 2) {
      results.push({
        businessName: businessName || "Unknown business",
        url: business.url,
        score: 0,
        clientId: null,
        status: "skipped",
        reason: "The search result did not include a usable business name.",
      });
      continue;
    }

    if (isRadarDirectoryResult(business)) {
      results.push({
        businessName,
        url: business.url,
        score: 0,
        clientId: null,
        status: "skipped",
        reason: "Skipped because this looks like a directory, article, ranking page, or marketplace rather than a direct business website.",
      });
      continue;
    }

    const score = scoreRadarBusiness(business);
    const existing = existingAccounts.find((account) =>
      account.businessName.toLowerCase() === businessName.toLowerCase() ||
      Boolean(normalizedUrl && account.websiteUrl === normalizedUrl),
    );

    if (existing) {
      results.push({
        businessName,
        url: normalizedUrl,
        score,
        clientId: existing.clientId,
        status: "existing",
        reason: "Matched an existing client file, so no duplicate record was created.",
      });
      accepted += 1;
      continue;
    }

    const businessType = inferRadarBusinessType(businessName, business.description, payload.query);
    const clientId = database.createClient({
      businessName,
      businessType,
      area: business.location ?? payload.location,
      websiteUrl: normalizedUrl,
      emailAddress: business.contactSignals.emailHints[0] ?? null,
      phoneNumber: business.contactSignals.phoneHints[0] ?? null,
      reviewCount: business.reviewSources.length || null,
      accountStatus: "researched",
      priority: score >= 72 ? "high" : score >= 55 ? "medium" : "low",
      dealValue: estimatedRadarDealValue(businessType, score),
      siteScore: score,
      sourceNotes: [
        `Revenue Radar run ${runId}`,
        business.url && business.url !== normalizedUrl ? `Source page: ${business.url}` : null,
        business.sourceSnippet,
        business.trustSignals.length ? `Trust signals: ${business.trustSignals.join(", ")}` : null,
        business.reviewSources.length ? `Review sources: ${business.reviewSources.map((source) => source.label).join(", ")}` : null,
      ].filter(Boolean).join("\n"),
      nextActionNotes: score >= 68
        ? "Run browser audit, capture proof screenshots, then draft a specific outreach angle."
        : "Enrich contact data before spending build time.",
    });

    database.addTimelineEvent(clientId, {
      id: `TL-${uniqueId("revenue-radar", runId, clientId)}`,
      eventType: "Revenue Radar discovered",
      timestamp: new Date().toISOString(),
      contactName: null,
      notes: `${report.operatorBrief.headline}\n\n${business.description}\n\nRecommendation: ${report.operatorBrief.recommendation}`,
      duration: null,
      followUpDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      loggedBy: "LEADGEN",
      metadata: {
        runId,
        query: payload.query,
        location: payload.location,
        score,
        reviewSources: business.reviewSources,
        trustSignals: business.trustSignals,
      },
    });

    results.push({
      businessName,
      url: normalizedUrl,
      score,
      clientId,
      status: "created",
      reason: "Created a real CRM file from live web discovery evidence.",
    });
    accepted += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    runId,
    query: payload.query,
    location: payload.location,
    searched: report.businesses.length,
    created: results.filter((item) => item.status === "created").length,
    existing: results.filter((item) => item.status === "existing").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    results,
    radar: await buildRevenueRadarPayload(),
  };
}

async function buildReplyRadarPayload(options: {maxResults?: number; q?: string} = {}) {
  let inbox: Awaited<ReturnType<typeof fetchGmailInbox>>;
  try {
    inbox = await withTimeout(
      fetchGmailInbox({
        q: options.q ?? "newer_than:45d",
        maxResults: options.maxResults ?? 50,
      }),
      8000,
      "Gmail Reply Radar",
    );
  } catch (error) {
    const config = getGmailConfig();
    inbox = {
      provider: "gmail",
      configured: config.configured,
      connected: config.configured,
      account: config.userEmail,
      missingEnv: config.missingEnv,
      messages: [],
      drafts: database.getMailDrafts(),
      resultSizeEstimate: 0,
      error: error instanceof Error ? error.message : "Gmail could not be inspected.",
    };
  }

  return buildReplyRadar({
    provider: "gmail",
    configured: inbox.configured,
    connected: inbox.connected,
    account: inbox.account,
    error: inbox.error,
    resultSizeEstimate: inbox.resultSizeEstimate,
    messages: inbox.messages,
    contexts: getOwnedAccountContexts(),
  });
}

function logReplyRadarItem(item: ReplyRadarItem) {
  if (!item.linkedClient || item.sentiment === "admin" || item.sentiment === "unknown") return null;
  const clientId = item.linkedClient.clientId;
  const timestamp = item.receivedAt ?? new Date().toISOString();
  database.addTimelineEvent(clientId, {
    id: `TL-REPLY-${uniqueId(item.id, clientId)}`,
    eventType: item.sentiment === "hot" ? "Email replied — hot" : item.sentiment === "objection" ? "Email replied — objection" : "Email replied",
    timestamp,
    contactName: item.fromName || item.fromEmail,
    notes: `${item.subject}\n\n${item.preview}\n\nReply Radar: ${item.suggestedAction.reason}`,
    duration: null,
    followUpDate: item.urgency === "now" || item.urgency === "today" ? new Date().toISOString().slice(0, 10) : null,
    loggedBy: "OUTREACH",
    metadata: {
      tool: "reply-radar",
      messageId: item.id,
      threadId: item.threadId,
      sentiment: item.sentiment,
      evidence: item.evidence,
    },
  });

  database.insertTask(clientId, {
    id: `TASK-REPLY-${uniqueId(item.id, clientId)}`,
    title: item.suggestedAction.taskTitle,
    description: `${item.suggestedAction.label}: ${item.suggestedAction.reason}`,
    status: "todo",
    priority: item.suggestedAction.priority,
    dueDate: item.urgency === "this-week"
      ? new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    owner: "OUTREACH",
    lane: "reply-radar",
    createdAt: new Date().toISOString(),
  });

  return {
    clientId,
    messageId: item.id,
    businessName: item.linkedClient.businessName,
    sentiment: item.sentiment,
  };
}

function findOwnedVoiceContext(input: {clientId?: string; callerPhone?: string; transcript?: string}) {
  if (input.clientId) {
    try {
      return toOwnedAccountContext(normalizeLeadDetail(input.clientId));
    } catch {
      return null;
    }
  }
  const phone = normalizePhone(input.callerPhone);
  const words = (input.transcript ?? "").toLowerCase();
  return getOwnedAccountContexts().find((context) => {
    const account = context.account;
    if (phone && [account.phoneNumber, ...context.contacts.map((contact) => contact.phone)].some((candidate) => normalizePhone(candidate).endsWith(phone.slice(-8)))) {
      return true;
    }
    return account.businessName && words.includes(account.businessName.toLowerCase());
  }) ?? null;
}

function pickDealRoomContext(clientId?: string) {
  if (clientId) return toOwnedAccountContext(normalizeLeadDetail(clientId));
  const contexts = getOwnedAccountContexts();
  return contexts.sort((left, right) => {
    const stageWeight: Record<string, number> = {
      proposal: 80,
      replied: 70,
      "in-follow-up": 58,
      contacted: 45,
      "ready-to-send": 35,
      researched: 25,
      won: 10,
      lost: 0,
    };
    const leftScore = (stageWeight[left.account.accountStatus] ?? 20) + left.account.closeProbability + Math.round(left.account.dealValue / 100);
    const rightScore = (stageWeight[right.account.accountStatus] ?? 20) + right.account.closeProbability + Math.round(right.account.dealValue / 100);
    return rightScore - leftScore;
  })[0] ?? null;
}

function generateDealRoomProposal(context: OwnedAccountContext) {
  const dealRoom = buildDealRoom({context, stripeConnected: isStripeConfigured()});
  const proposal: ClientProposal = {
    id: `PROP-${uniqueId(context.account.clientId, "deal-room", String(Date.now()))}`,
    title: `${context.account.businessName} — ${dealRoom.offer.packageName}`,
    status: "draft",
    packageName: dealRoom.offer.packageName,
    price: dealRoom.offer.setupFee,
    probability: Math.max(45, context.account.closeProbability || dealRoom.readinessScore),
    nextStep: "Review proof, approve proposal copy, then send payment route.",
    scope: dealRoom.offer.scope,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  database.insertProposal(context.account.clientId, proposal);
  database.addTimelineEvent(context.account.clientId, {
    id: `TL-${proposal.id}`,
    eventType: "Deal Room proposal drafted",
    timestamp: proposal.createdAt,
    contactName: null,
    notes: `${proposal.title}\n£${proposal.price.toLocaleString("en-GB")} setup · ${dealRoom.offer.monthlyRetainer ? `£${dealRoom.offer.monthlyRetainer}/mo after launch` : "no retainer"}`,
    duration: null,
    followUpDate: null,
    loggedBy: "JARVIS",
    metadata: {tool: "deal-room", proposalId: proposal.id},
  });
  return proposal;
}

type Client360TimelineEvent = {
  id: string;
  clientId: string;
  businessName: string;
  area: string;
  type: "timeline" | "call" | "task" | "proposal" | "note";
  channel: "crm" | "call" | "email" | "ops" | "proposal";
  label: string;
  body: string;
  at: string;
  actor: string;
  status: string;
  impact: "low" | "medium" | "high";
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function dateToTime(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function daysSinceIso(value: string | null | undefined) {
  const time = dateToTime(value);
  if (!time) return 999;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function clientLifecycle(status: string) {
  if (status === "won") return "Client";
  if (status === "lost") return "Closed";
  if (status === "proposal") return "Proposal";
  if (status === "replied" || status === "in-follow-up" || status === "contacted") return "Conversation";
  return "Lead";
}

function relationshipBand(score: number) {
  if (score < 35) return "critical";
  if (score < 55) return "weak";
  if (score < 75) return "workable";
  return "stable";
}

function moneyImpact(value: number): "low" | "medium" | "high" {
  if (value >= 2500) return "high";
  if (value >= 750) return "medium";
  return "low";
}

function firstUsefulDate(values: Array<string | null | undefined>) {
  const best = values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => dateToTime(b) - dateToTime(a))[0];
  return best ?? null;
}

function buildClient360Account(account: ReturnType<EliteOpsDatabase["getAccounts"]>[number], detail: LeadDetailPayload) {
  const primaryContact = detail.contacts.find((contact) => contact.isPrimary) ?? detail.contacts[0] ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const openTasks = detail.tasks.filter((task) => task.status !== "done").length;
  const overdueTasks = detail.tasks.filter((task) => task.status !== "done" && task.dueDate < today).length;
  const blockedTasks = detail.tasks.filter((task) => task.status === "blocked").length;
  const latestActivityAt = firstUsefulDate([
    account.lastTimelineEventAt,
    detail.timeline[0]?.timestamp,
    detail.calls[0]?.calledAt,
    detail.notes[0]?.createdAt,
    detail.proposals[0]?.updatedAt,
    detail.tasks[0]?.createdAt,
    account.updatedAt,
  ]);
  const daysSinceLastActivity = daysSinceIso(latestActivityAt);
  const hasDirectContact = Boolean(primaryContact?.email || primaryContact?.phone || account.emailAddress || account.phoneNumber);
  const hasMemory = Boolean(
    detail.memory &&
      [
        detail.memory.personality,
        detail.memory.painPoints,
        detail.memory.whatResonates,
        detail.memory.decisionProcess,
        detail.memory.internalNotes,
      ].some((field) => field.trim().length > 0),
  );
  const completenessChecks = [
    Boolean(account.websiteUrl),
    Boolean(account.emailAddress || account.phoneNumber),
    detail.contacts.length > 0,
    detail.timeline.length > 0,
    detail.tasks.length > 0,
    hasMemory,
    detail.proposals.length > 0,
    detail.auditScores.some((score) => score.score > 0),
    account.sourceNotes.trim().length > 0,
    detail.calls.length > 0 || detail.notes.length > 0,
  ];
  const dossierCompleteness = Math.round(
    (completenessChecks.filter(Boolean).length / completenessChecks.length) * 100,
  );
  const stageWeight: Record<string, number> = {
    researched: 4,
    "ready-to-send": 8,
    contacted: 12,
    "in-follow-up": 14,
    replied: 18,
    proposal: 22,
    won: 28,
    lost: 0,
  };
  const recencyWeight = daysSinceLastActivity <= 2 ? 22 : daysSinceLastActivity <= 7 ? 15 : daysSinceLastActivity <= 14 ? 8 : 2;
  const contactWeight = hasDirectContact ? 18 : 2;
  const taskPenalty = overdueTasks * 6 + blockedTasks * 8;
  const stalePenalty = daysSinceLastActivity > 10 && !["won", "lost"].includes(account.accountStatus) ? 10 : 0;
  const relationshipScore = clampScore(
    (stageWeight[account.accountStatus] ?? 6) + recencyWeight + contactWeight + dossierCompleteness * 0.38 - taskPenalty - stalePenalty,
  );
  const riskFlags = [
    !hasDirectContact ? "No direct contact route" : null,
    detail.timeline.length === 0 ? "No outreach timeline yet" : null,
    overdueTasks > 0 ? `${overdueTasks} overdue task${overdueTasks === 1 ? "" : "s"}` : null,
    blockedTasks > 0 ? `${blockedTasks} blocked task${blockedTasks === 1 ? "" : "s"}` : null,
    daysSinceLastActivity > 10 && !["won", "lost"].includes(account.accountStatus) ? `No movement for ${daysSinceLastActivity} days` : null,
    account.accountStatus === "replied" && detail.proposals.length === 0 ? "Reply needs proposal path" : null,
  ].filter((flag): flag is string => Boolean(flag));
  const overdueTask = detail.tasks
    .filter((task) => task.status !== "done" && task.dueDate < today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const nextBestAction = overdueTask
    ? `Clear overdue task: ${overdueTask.title}`
    : !hasDirectContact
      ? "Find and verify the owner or manager contact route."
      : detail.timeline.length === 0
        ? "Log the first outreach touch and attach a concrete next step."
        : account.accountStatus === "ready-to-send"
          ? "Send the demo-backed outreach and schedule a 48 hour follow-up."
          : account.nextActionNotes || "Review the file and decide the next commercial move.";

  return {
    ...account,
    lifecycle: clientLifecycle(account.accountStatus),
    contacts: detail.contacts.map((contact) => ({
      id: contact.id,
      fullName: contact.fullName,
      role: contact.role,
      email: contact.email,
      phone: contact.phone,
      status: contact.status,
      isPrimary: contact.isPrimary,
      bestTime: contact.bestTime,
      contactPreference: contact.contactPreference,
      notes: contact.notes,
      createdAt: contact.createdAt,
    })),
    primaryContact: primaryContact
      ? {
          id: primaryContact.id,
          fullName: primaryContact.fullName,
          role: primaryContact.role,
          email: primaryContact.email,
          phone: primaryContact.phone,
          status: primaryContact.status,
        }
      : null,
    contactCount: detail.contacts.length,
    timelineCount: detail.timeline.length,
    callCount: detail.calls.length,
    noteCount: detail.notes.length,
    proposalCount: detail.proposals.length,
    openTasks,
    overdueTasks,
    blockedTasks,
    latestActivityAt,
    daysSinceLastActivity,
    relationshipScore,
    dossierCompleteness,
    relationshipBand: relationshipBand(relationshipScore),
    riskFlags,
    nextBestAction,
  };
}

function buildClientTimeline(account: ReturnType<EliteOpsDatabase["getAccounts"]>[number], detail: LeadDetailPayload): Client360TimelineEvent[] {
  const timeline: Client360TimelineEvent[] = [];
  for (const event of detail.timeline) {
    const eventName = event.eventType.toLowerCase();
    const channel = eventName.includes("email")
      ? "email"
      : eventName.includes("call") || eventName.includes("voicemail")
        ? "call"
        : "crm";
    timeline.push({
      id: event.id,
      clientId: account.clientId,
      businessName: account.businessName,
      area: account.area,
      type: "timeline",
      channel,
      label: event.eventType,
      body: event.notes || "Timeline event logged.",
      at: event.timestamp,
      actor: event.loggedBy || brand.ownerName,
      status: account.accountStatus,
      impact: channel === "call" || channel === "email" ? "medium" : "low",
    });
  }
  for (const call of detail.calls) {
    timeline.push({
      id: call.id,
      clientId: account.clientId,
      businessName: account.businessName,
      area: account.area,
      type: "call",
      channel: "call",
      label: call.outcome,
      body: call.notes || "Call logged.",
      at: call.calledAt,
      actor: call.contactName ?? brand.ownerName,
      status: account.accountStatus,
      impact: call.outcome.toLowerCase().includes("interested") ? "high" : "medium",
    });
  }
  for (const task of detail.tasks) {
    timeline.push({
      id: task.id,
      clientId: account.clientId,
      businessName: account.businessName,
      area: account.area,
      type: "task",
      channel: "ops",
      label: task.status === "done" ? `Completed: ${task.title}` : `Task: ${task.title}`,
      body: task.notes || `Due ${task.dueDate}`,
      at: task.completedAt ?? task.createdAt,
      actor: task.assignedTo || brand.ownerName,
      status: task.status,
      impact: task.priority === "high" ? "high" : task.priority === "medium" ? "medium" : "low",
    });
  }
  for (const proposal of detail.proposals) {
    timeline.push({
      id: proposal.id,
      clientId: account.clientId,
      businessName: account.businessName,
      area: account.area,
      type: "proposal",
      channel: "proposal",
      label: `${proposal.packageName} proposal ${proposal.status}`,
      body: proposal.notes || proposal.services || `£${proposal.setupFee.toLocaleString()} package`,
      at: proposal.updatedAt || proposal.createdAt,
      actor: brand.ownerName,
      status: proposal.status,
      impact: moneyImpact(proposal.setupFee + (proposal.monthlyRetainer ?? 0)),
    });
  }
  for (const note of detail.notes.slice(0, 5)) {
    timeline.push({
      id: note.id,
      clientId: account.clientId,
      businessName: account.businessName,
      area: account.area,
      type: "note",
      channel: "crm",
      label: note.pinnedAt ? "Pinned note" : "Account note",
      body: note.body,
      at: note.createdAt,
      actor: brand.ownerName,
      status: account.accountStatus,
      impact: note.pinnedAt ? "medium" : "low",
    });
  }
  return timeline;
}

function distribution<T extends string>(items: T[]) {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([label, value]) => ({label, value})).sort((a, b) => b.value - a.value);
}

function buildClient360Payload() {
  const accounts = database.getAccounts(1, 1000);
  const details = accounts.map((account) => ({
    account,
    detail: normalizeLeadDetail(account.clientId),
  }));
  const enrichedAccounts = details.map(({account, detail}) => buildClient360Account(account, detail));
  const timeline = details
    .flatMap(({account, detail}) => buildClientTimeline(account, detail))
    .filter((event) => dateToTime(event.at) > 0)
    .sort((a, b) => dateToTime(b.at) - dateToTime(a.at))
    .slice(0, 300);
  const today = new Date().toISOString().slice(0, 10);
  const openAccounts = enrichedAccounts.filter((account) => !["won", "lost"].includes(account.accountStatus));
  const totals = {
    totalAccounts: enrichedAccounts.length,
    totalContacts: enrichedAccounts.reduce((sum, account) => sum + account.contactCount, 0),
    openTasks: enrichedAccounts.reduce((sum, account) => sum + account.openTasks, 0),
    overdueTasks: enrichedAccounts.reduce((sum, account) => sum + account.overdueTasks, 0),
    dueToday: enrichedAccounts.filter((account) => account.dueDate === today).length,
    proposalValue: enrichedAccounts.reduce((sum, account) => sum + account.dealValue, 0),
    weightedPipelineValue: openAccounts.reduce((sum, account) => sum + account.dealValue * (account.closeProbability / 100), 0),
    timelineEvents: timeline.length,
    staleAccounts: enrichedAccounts.filter((account) => account.daysSinceLastActivity > 10 && !["won", "lost"].includes(account.accountStatus)).length,
    missingContacts: enrichedAccounts.filter((account) => !account.primaryContact && !account.emailAddress && !account.phoneNumber).length,
  };
  return {
    generatedAt: new Date().toISOString(),
    totals,
    signals: {
      staleAccounts: enrichedAccounts
        .filter((account) => account.daysSinceLastActivity > 10 && !["won", "lost"].includes(account.accountStatus))
        .slice(0, 12),
      overdueAccounts: enrichedAccounts.filter((account) => account.overdueTasks > 0).slice(0, 12),
      hotAccounts: enrichedAccounts
        .filter((account) => ["replied", "proposal", "won"].includes(account.accountStatus) || account.relationshipScore >= 75)
        .slice(0, 12),
      incompleteDossiers: enrichedAccounts.filter((account) => account.dossierCompleteness < 60).slice(0, 12),
    },
    charts: {
      statusDistribution: distribution(enrichedAccounts.map((account) => account.accountStatus)),
      priorityDistribution: distribution(enrichedAccounts.map((account) => account.priority)),
      lifecycleDistribution: distribution(enrichedAccounts.map((account) => account.lifecycle)),
      healthDistribution: distribution(enrichedAccounts.map((account) => account.relationshipBand)),
      valueByStage: Object.entries(
        enrichedAccounts.reduce<Record<string, number>>((acc, account) => {
          acc[account.accountStatus] = (acc[account.accountStatus] ?? 0) + account.dealValue;
          return acc;
        }, {}),
      ).map(([label, value]) => ({label, value})).sort((a, b) => b.value - a.value),
    },
    accounts: enrichedAccounts,
    timeline,
  };
}

async function refreshDashboardFile() {
  // The React app on :5173 is now the single operator surface.
  // Keep this hook as a harmless no-op so existing mutation flows do not
  // need to be rewritten while the legacy HTML dashboard is retired.
}

async function hydrateFromPipelineIfPresent() {
  try {
    const raw = await fsp.readFile(outputFiles.crmJson, "utf8");
    database.syncPipelineData(JSON.parse(raw) as DashboardData);
  } catch {
    // No pipeline snapshot yet; the manual CRM can still run from SQLite.
  }
}

async function triggerLeadSearch(options: {maxQualified?: number; maxPerQuery?: number}) {
  if (leadSearchStatus.status === "running") return leadSearchStatus;

  leadSearchStatus = {
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    message: "Running Firecrawl discovery, audit, and asset preparation pipeline.",
    output: [],
  };

  const child = spawn(
    process.execPath,
    ["--env-file=.env.local", "--import", "tsx", "src/index.ts"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...(options.maxQualified ? {PIPELINE_MAX_QUALIFIED: String(options.maxQualified)} : {}),
        ...(options.maxPerQuery ? {PIPELINE_MAX_PER_QUERY: String(options.maxPerQuery)} : {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const appendOutput = (prefix: string, chunk: Buffer) => {
    const lines = chunk
      .toString("utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `${prefix}${line}`);
    if (!lines.length) return;
    leadSearchStatus.output = [...leadSearchStatus.output, ...lines].slice(-30);
  };

  child.stdout.on("data", (chunk) => appendOutput("", Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => appendOutput("ERR ", Buffer.from(chunk)));
  child.on("close", async (code) => {
    const success = code === 0;
    leadSearchStatus = {
      ...leadSearchStatus,
      status: success ? "completed" : "failed",
      finishedAt: new Date().toISOString(),
      exitCode: code ?? null,
      message: success
        ? "Lead discovery completed and the latest pipeline snapshot has been imported."
        : "Lead discovery failed. Check the output log for the last emitted lines.",
    };

    if (success) {
      await hydrateFromPipelineIfPresent();
      await refreshDashboardFile();
      broadcastRefresh();
    }
  });

  child.on("error", (error) => {
    leadSearchStatus = {
      ...leadSearchStatus,
      status: "failed",
      finishedAt: new Date().toISOString(),
      message: error.message,
      output: [...leadSearchStatus.output, `ERR ${error.message}`].slice(-30),
    };
  });

  return leadSearchStatus;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {"Content-Type": "application/json; charset=utf-8", ...corsHeaders});
  response.end(JSON.stringify(payload));
}

function sendError(response: http.ServerResponse, statusCode: number, message: string) {
  sendJson(response, statusCode, {error: message});
}

const MAX_BODY_BYTES = 8_388_608; // 8 MB for short voice-command clips

async function readRawBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error("Request body exceeds 1 MB limit");
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function parseBody(request: http.IncomingMessage) {
  const raw = (await readRawBody(request)).trim();
  if (!raw) return {};
  const contentType = String(request.headers["content-type"] ?? "").toLowerCase();
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw).entries());
  }
  try {
    return JSON.parse(raw);
  } catch {
    if (raw.includes("=")) {
      return Object.fromEntries(new URLSearchParams(raw).entries());
    }
    throw new Error("Invalid JSON in request body");
  }
}

async function parseRealtimeVoiceOffer(request: http.IncomingMessage) {
  const contentType = String(request.headers["content-type"] ?? "").toLowerCase();
  if (contentType.includes("application/sdp") || contentType.includes("text/plain")) {
    return realtimeVoiceOfferSchema.parse({sdp: await readRawBody(request)});
  }
  return realtimeVoiceOfferSchema.parse(await parseBody(request));
}

function broadcastRefresh() {
  const now = Date.now();
  if (now - lastRefreshBroadcastAt < 350) return;
  lastRefreshBroadcastAt = now;
  for (const client of clients) client.write("event: refresh\ndata: now\n\n");
}

async function commitMutation(response: http.ServerResponse, action: () => void | Promise<void>) {
  await action();
  await refreshDashboardFile();
  broadcastRefresh();
  sendJson(response, 200, await buildDashboardState());
}

async function serveFile(filePath: string, response: http.ServerResponse) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const content = await fsp.readFile(filePath);
    response.writeHead(200, {"Content-Type": mimeTypes[ext] ?? "application/octet-stream"});
    response.end(ext === ".html" ? injectLiveReload(content.toString("utf8")) : content);
  } catch {
    sendError(response, 404, "Not found");
  }
}

async function fileExists(filePath: string) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function serveFrontend(response: http.ServerResponse, requestPath: string) {
  const normalized = path.normalize(requestPath.replace(/^\/+/, ""));
  const candidate = path.resolve(frontendDistDir, normalized);
  const distRoot = path.resolve(frontendDistDir);

  if (normalized !== "." && normalized !== "" && candidate.startsWith(distRoot) && await fileExists(candidate)) {
    await serveFile(candidate, response);
    return;
  }

  if (await fileExists(frontendEntryFile)) {
    await serveFile(frontendEntryFile, response);
    return;
  }

  response.writeHead(302, {
    ...corsHeaders,
    Location: frontendDevUrl,
  });
  response.end();
}

function clientIdFromUrl(urlPath: string, suffix: string) {
  return decodeURIComponent(urlPath.slice("/api/clients/".length, urlPath.length - suffix.length));
}

async function handleApi(request: http.IncomingMessage, response: http.ServerResponse, pathname: string) {
  if (request.method === "GET" && pathname === "/api/openclaw/stream") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      ...corsHeaders,
    });
    response.write(": connected\n\n");
    openClawStreamClients.add(response);
    for (const event of openClawService.getRecentEvents(40).reverse()) {
      response.write(`event: activity\ndata: ${JSON.stringify(event)}\n\n`);
    }
    request.on("close", () => {
      openClawStreamClients.delete(response);
      response.end();
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/openclaw/agents") {
    sendJson(response, 200, {agents: await openClawService.listAgents()});
    return;
  }

  if (request.method === "GET" && /^\/api\/openclaw\/agents\/[^/]+$/.test(pathname)) {
    const agentId = decodeURIComponent(pathname.slice("/api/openclaw/agents/".length));
    sendJson(response, 200, await openClawService.getAgentConfig(agentId));
    return;
  }

  if (request.method === "POST" && /^\/api\/openclaw\/agents\/[^/]+\/send$/.test(pathname)) {
    const agentId = decodeURIComponent(pathname.slice("/api/openclaw/agents/".length, -"/send".length));
    const payload = z.object({
      message: z.string().min(1),
      sessionId: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }).parse(await parseBody(request));
    sendJson(response, 200, await openClawService.sendMessageToAgent({
      agentId,
      sessionId: payload.sessionId,
      message: payload.message,
      metadata: payload.metadata,
    }));
    return;
  }

  if (request.method === "GET" && pathname === "/api/openclaw/sessions") {
    sendJson(response, 200, {sessions: await openClawService.listSessions()});
    return;
  }

  if (request.method === "GET" && /^\/api\/openclaw\/sessions\/[^/]+$/.test(pathname)) {
    const sessionId = decodeURIComponent(pathname.slice("/api/openclaw/sessions/".length));
    sendJson(response, 200, await openClawService.getSessionDetails(sessionId));
    return;
  }

  if (request.method === "GET" && pathname === "/api/openclaw/system") {
    sendJson(response, 200, await openClawService.getSystemStats());
    return;
  }

  if (request.method === "GET" && pathname === "/api/openclaw/memory") {
    const url = new URL(request.url ?? "/api/openclaw/memory", `http://${host}:${port}`);
    const query = url.searchParams.get("q") ?? "";
    sendJson(response, 200, {sections: await openClawService.getMemorySections(query)});
    return;
  }

  if (request.method === "GET" && pathname === "/api/openclaw/approvals") {
    sendJson(response, 200, await openClawService.getApprovals());
    return;
  }

  if (request.method === "POST" && /^\/api\/openclaw\/approvals\/[^/]+\/resolve$/.test(pathname)) {
    const approvalId = decodeURIComponent(pathname.slice("/api/openclaw/approvals/".length, -"/resolve".length));
    const payload = z.object({
      decision: z.enum(["allow-once", "allow-always", "deny"]),
    }).parse(await parseBody(request));
    sendJson(response, 200, await openClawService.resolveApproval(approvalId, payload.decision));
    return;
  }

  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, {
      status: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: outputFiles.crmDatabase,
      version: "0.1.0",
    });
    return;
  }

  // ── Calls / SMS / Twilio ────────────────────────────────────────────────
  if (request.method === "GET" && pathname === "/api/calls/config") {
    try {
      const publicBaseUrl = getExternalBaseUrl(host, port);
      const [twilioNumbers, elevenAgents, elevenVoices, selectedAgent] = await Promise.all([
        isTwilioConfigured() ? getPhoneNumbers().catch(() => []) : Promise.resolve([]),
        isElevenLabsConfigured() ? getElevenLabsAgents().catch(() => []) : Promise.resolve([]),
        isElevenLabsConfigured() ? getElevenLabsVoices().catch(() => []) : Promise.resolve([]),
        isElevenLabsConfigured() && process.env.ELEVENLABS_AGENT_ID
          ? getElevenLabsAgent(process.env.ELEVENLABS_AGENT_ID).catch(() => null)
          : Promise.resolve(null),
      ]);

      sendJson(response, 200, {
        configured: isTwilioConfigured(),
        elevenLabsConfigured: isElevenLabsConfigured(),
        phoneNumber: process.env.TWILIO_PHONE_NUMBER ?? "",
        accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
        elevenLabsAgentId: process.env.ELEVENLABS_AGENT_ID ?? "",
        streamUrl: process.env.ELEVENLABS_TWILIO_STREAM_URL ?? "",
        publicBaseUrl,
        publicWebhookReady: isPublicWebhookUrl(publicBaseUrl),
        phoneNumbers: twilioNumbers.map((item) => ({
          sid: item.sid,
          phoneNumber: item.phone_number,
          friendlyName: item.friendly_name,
          capabilities: item.capabilities,
        })),
        agents: elevenAgents.map((agent) => ({
          id: agent.agent_id,
          name: agent.name,
          voiceId: agent.conversation_config?.tts?.voice_id ?? null,
          firstMessage: agent.conversation_config?.agent?.first_message ?? "",
        })),
        voices: elevenVoices.slice(0, 50).map((voice) => ({
          id: voice.voice_id,
          name: voice.name,
          category: voice.category,
        })),
        selectedAgent: selectedAgent ? {
          id: selectedAgent.agent_id,
          name: selectedAgent.name,
          firstMessage: selectedAgent.conversation_config?.agent?.first_message ?? "",
          prompt: selectedAgent.conversation_config?.agent?.prompt?.prompt ?? "",
          voiceId: selectedAgent.conversation_config?.tts?.voice_id ?? "",
          language: selectedAgent.conversation_config?.agent?.language ?? "en",
        } : null,
      });
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Calls config error");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/calls/summary") {
    try {
      sendJson(response, 200, await getTwilioSummary());
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Twilio summary error");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/calls/logs") {
    try {
      const url = new URL(request.url ?? "/api/calls/logs", `http://${host}:${port}`);
      const page = Number.parseInt(url.searchParams.get("page") ?? "0", 10);
      sendJson(response, 200, await getCallLogs(50, page));
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Twilio logs error");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/calls/recordings") {
    try {
      const url = new URL(request.url ?? "/api/calls/recordings", `http://${host}:${port}`);
      const callSid = url.searchParams.get("callSid") ?? undefined;
      sendJson(response, 200, {recordings: await getRecordings(callSid, 50)});
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Twilio recordings error");
    }
    return;
  }

  if (request.method === "GET" && /^\/api\/calls\/recording\/[^/]+\/download$/.test(pathname)) {
    try {
      const recordingSid = decodeURIComponent(pathname.slice("/api/calls/recording/".length, -"/download".length));
      const twilioUrl = recordingMp3Url(recordingSid);
      const mp3 = await fetch(twilioUrl);
      if (!mp3.ok) {
        sendError(response, mp3.status, "Recording download failed");
        return;
      }
      response.writeHead(200, {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename=\"${recordingSid}.mp3\"`,
      });
      response.end(Buffer.from(await mp3.arrayBuffer()));
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Recording download error");
    }
    return;
  }

  if ((request.method === "GET" || request.method === "POST") && pathname === "/api/calls/twiml") {
    const url = new URL(request.url ?? "/api/calls/twiml", `http://${host}:${port}`);
    const hasAgentRuntime = Boolean(process.env.ELEVENLABS_AGENT_ID && process.env.ELEVENLABS_TWILIO_STREAM_URL);
    const mode = url.searchParams.get("mode") ?? (hasAgentRuntime ? "ai-agent" : "manual");
    const leadId = url.searchParams.get("leadId") ?? "";
    const lead = leadId ? database.getAccounts(1_000).find((item) => item.clientId === leadId) : undefined;
    const agentId = url.searchParams.get("agentId") ?? process.env.ELEVENLABS_AGENT_ID ?? "";
    const payload = request.method === "POST" ? await parseBody(request) as Record<string, unknown> : {};
    const fromNumber = String(payload.From ?? payload.from ?? url.searchParams.get("from") ?? process.env.TWILIO_PHONE_NUMBER ?? "");
    const toNumber = String(payload.To ?? payload.to ?? url.searchParams.get("to") ?? process.env.TWILIO_PHONE_NUMBER ?? "");
    const callSid = String(payload.CallSid ?? payload.callSid ?? url.searchParams.get("callSid") ?? "");
    const direction =
      normalizePhone(toNumber) === normalizePhone(process.env.TWILIO_PHONE_NUMBER)
        ? "inbound"
        : "outbound";

    let body = buildSayTwiML(`Hello from Elite Automations. This is a short automated introduction call regarding ${lead?.businessName ?? "your business"}.`);
    if (mode === "ai-agent" && agentId && fromNumber && toNumber) {
      try {
        body = await registerTwilioCall({
          agentId,
          fromNumber,
          toNumber,
          direction,
          conversationInitiationClientData: {
            dynamic_variables: {
              customer_name: lead?.businessName ?? "caller",
              business_name: lead?.businessName ?? "caller",
              reference_number: lead?.clientId ?? callSid ?? "EA-GENERAL",
              project_stage: lead?.accountStatus ?? "new enquiry",
              next_action: lead?.nextActionNotes ?? "Qualify the caller and route the conversation into the CRM.",
            },
          },
        });
      } catch (error) {
        console.error("[ElevenLabs register-call failed]", error);
      }
    }
    response.writeHead(200, {"Content-Type": "text/xml; charset=utf-8"});
    response.end(body);
    return;
  }

  if (request.method === "POST" && pathname === "/api/calls/outbound") {
    try {
      const payload = z.object({
        to: z.string().min(5),
        mode: z.enum(["manual", "ai-agent"]).default("manual"),
        leadId: z.string().optional(),
        agentId: z.string().optional(),
      }).parse(await parseBody(request));
      const baseUrl = getExternalBaseUrl(host, port);
      const twimlUrl = new URL("/api/calls/twiml", baseUrl);
      twimlUrl.searchParams.set("mode", payload.mode);
      if (payload.leadId) twimlUrl.searchParams.set("leadId", payload.leadId);
      if (payload.agentId) twimlUrl.searchParams.set("agentId", payload.agentId);
      const call = await makeCall({
        to: payload.to,
        twimlUrl: twimlUrl.toString(),
        record: true,
        statusCallbackUrl: new URL("/api/calls/status", baseUrl).toString(),
      });
      if (payload.leadId) {
        database.logCall(payload.leadId, {
          calledAt: new Date().toISOString(),
          outcome: `Twilio ${payload.mode === "ai-agent" ? "AI" : "manual"} outbound call started`,
          durationMinutes: null,
          contactName: null,
          notes: `Call SID ${call.sid} · status ${call.status}`,
          followUpDate: null,
        });
      }
      sendJson(response, 200, {callSid: call.sid, status: call.status});
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Outbound call error");
    }
    return;
  }

  if (request.method === "POST" && /^\/api\/calls\/end\/[^/]+$/.test(pathname)) {
    try {
      const callSid = decodeURIComponent(pathname.slice("/api/calls/end/".length));
      const call = await endCall(callSid);
      sendJson(response, 200, {callSid: call.sid, status: call.status});
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "End call error");
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/calls/status") {
    const body = await parseBody(request) as Record<string, unknown>;
    const from = String(body.From ?? "");
    const callStatus = String(body.CallStatus ?? body.CallStatus ?? "");
    const matched = from ? findAccountByPhone(from) : null;
    if (matched?.account && callStatus && ["busy", "failed", "no-answer", "canceled"].includes(callStatus)) {
      database.addTimelineEvent(matched.account.clientId, {
        id: `TL-${uniqueId(matched.account.clientId, "twilio-status", String(Date.now()))}`,
        eventType: "Call attempt",
        timestamp: new Date().toISOString(),
        contactName: (matched.contact?.fullName as string | undefined) ?? null,
        notes: `Twilio status update: ${callStatus}`,
        duration: null,
        followUpDate: null,
        loggedBy: "System",
        metadata: {
          callStatus,
          callSid: body.CallSid ?? null,
          errorCode: body.ErrorCode ?? null,
          errorMessage: body.ErrorMessage ?? null,
        },
      });
    }
    sendJson(response, 200, {ok: true});
    return;
  }

  if ((request.method === "GET" || request.method === "POST") && pathname === "/api/voice/elevenlabs/personalization") {
    try {
      const url = new URL(request.url ?? "/api/voice/elevenlabs/personalization", `http://${host}:${port}`);
      const body = request.method === "POST" ? await parseBody(request) as Record<string, unknown> : {};
      const caller =
        String(body.from_number ?? body.caller ?? url.searchParams.get("from_number") ?? url.searchParams.get("caller") ?? "");
      const matched = caller ? findAccountByPhone(caller) : null;
      const account = matched?.account;
      const full = matched?.full;
      const latestProposal = full?.proposals?.[0];
      const openTasks = (full?.tasks ?? []).filter((task) => task.status !== "completed").slice(0, 3);

      sendJson(response, 200, {
        success: true,
        caller,
        referenceNumber: account?.clientId ?? null,
        customer: account ? {
          clientId: account.clientId,
          businessName: account.businessName,
          stage: account.accountStatus,
          area: account.area,
          priority: account.priority,
          phoneNumber: account.phoneNumber,
          emailAddress: account.emailAddress,
          nextAction: account.nextActionNotes,
          websiteUrl: account.websiteUrl,
          proposalStatus: latestProposal?.status ?? null,
          proposalPackage: latestProposal?.packageName ?? null,
          outstandingTasks: openTasks.map((task) => ({
            title: task.title,
            dueDate: task.dueDate,
            priority: task.priority,
          })),
        } : null,
        dynamic_variables: {
          reference_number: account?.clientId ?? "EA-GENERAL",
          customer_name: account?.businessName ?? "caller",
          project_stage: account?.accountStatus ?? "new enquiry",
          next_action: account?.nextActionNotes ?? "Capture their goals and route the enquiry into the CRM.",
          proposal_status: latestProposal?.status ?? "none",
          account_area: account?.area ?? "",
        },
      });
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "ElevenLabs personalization error");
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/voice/elevenlabs/post-call") {
    try {
      const payload = await parseBody(request) as {
        from_number?: string;
        to_number?: string;
        conversation_id?: string;
        call_sid?: string;
        summary?: string;
        disposition?: string;
        transcript?: Array<{ role?: string; message?: string }>;
        booking_requested?: boolean;
        follow_up_date?: string | null;
        duration_seconds?: number | null;
        analysis?: Record<string, unknown>;
        conversation_summary?: string;
        extracted_data?: Record<string, unknown>;
        conversation_initiation_client_data?: Record<string, unknown>;
      };
      const matched = payload.from_number ? findAccountByPhone(payload.from_number) : null;
      const account = matched?.account;
      const full = matched?.full;
      const transcriptText = (payload.transcript ?? [])
        .map((item) => `${item.role ?? "unknown"}: ${item.message ?? ""}`.trim())
        .filter(Boolean)
        .join("\n");
      const extracted = payload.extracted_data ?? {};
      const summary =
        payload.summary
        ?? payload.conversation_summary
        ?? String(payload.analysis?.summary ?? "")
        ?? "";
      const interestLevel = String(
        extracted.interest_level
        ?? payload.analysis?.interest_level
        ?? "",
      ).trim();
      const meetingBooked =
        Boolean(payload.booking_requested)
        || String(extracted.meeting_booked ?? "").toLowerCase() === "true";
      const meetingDateTime = parseIsoDateCandidate(
        String(extracted.meeting_date_time ?? payload.follow_up_date ?? ""),
      );
      const prospectName = String(
        extracted.prospect_name
        ?? payload.analysis?.prospect_name
        ?? (matched?.contact?.fullName as string | undefined)
        ?? "",
      ).trim();
      const prospectEmail = String(extracted.prospect_email ?? "").trim();
      const noteParts = [
        summary,
        interestLevel ? `Interest level: ${interestLevel}` : "",
        prospectName ? `Prospect: ${prospectName}` : "",
        prospectEmail ? `Email captured: ${prospectEmail}` : "",
        transcriptText ? `Transcript\n${transcriptText}` : "",
      ].filter(Boolean);

      if (account) {
        database.logCall(account.clientId, {
          calledAt: new Date().toISOString(),
          outcome: payload.disposition ?? (meetingBooked ? "Booked via voice agent" : "AI agent call completed"),
          durationMinutes: payload.duration_seconds ? Math.max(1, Math.round(payload.duration_seconds / 60)) : null,
          contactName: prospectName || (matched?.contact?.fullName as string | null | undefined) || null,
          notes: noteParts.join("\n\n"),
          followUpDate: meetingDateTime ?? payload.follow_up_date ?? null,
        });

        database.addNote(
          account.clientId,
          [
            "Voice agent conversation recorded.",
            summary ? `Summary: ${summary}` : "",
            interestLevel ? `Interest: ${interestLevel}` : "",
            meetingBooked ? `Meeting booked${meetingDateTime ? ` for ${meetingDateTime}` : ""}.` : "",
          ].filter(Boolean).join("\n"),
        );

        database.upsertStructuredMemory(account.clientId, {
          conversationHighlights: appendUniqueHighlight(
            full?.memory
              ? JSON.parse(String(full.memory.conversation_highlights_json ?? "[]"))
              : [],
            {
              date: new Date().toISOString(),
              note: summary || `Voice conversation completed${interestLevel ? ` · ${interestLevel}` : ""}`,
            },
          ),
          bestWindow: meetingDateTime ?? String(full?.memory?.best_window ?? ""),
          internalNotes: [
            String(full?.memory?.internal_notes ?? ""),
            prospectEmail ? `Latest email captured: ${prospectEmail}` : "",
          ].filter(Boolean).join("\n").trim(),
        });

        if (meetingBooked || meetingDateTime || payload.follow_up_date) {
          database.insertTask(account.clientId, {
            id: `TASK-${uniqueId(account.clientId, "voice-follow-up")}`,
            title: meetingBooked ? "Confirm booked call from voice agent" : "Voice-agent follow up",
            description: summary || "Follow up after ElevenLabs voice conversation.",
            status: "todo",
            priority: "high",
            dueDate: (meetingDateTime ?? payload.follow_up_date ?? new Date(Date.now() + 86400000).toISOString()).slice(0, 10),
            owner: brand.ownerName,
            lane: "ops",
            createdAt: new Date().toISOString(),
          });
        }
      }

      sendJson(response, 200, {
        success: true,
        matchedClientId: account?.clientId ?? null,
        conversationId: payload.conversation_id ?? null,
        callSid: payload.call_sid ?? null,
        meetingBooked,
      });
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "ElevenLabs post-call error");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/sms/inbox") {
    try {
      const data = await getMessages({limit: 100});
      sendJson(response, 200, {messages: data.messages});
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "SMS inbox error");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/sms/thread") {
    try {
      const url = new URL(request.url ?? "/api/sms/thread", `http://${host}:${port}`);
      const number = url.searchParams.get("number");
      if (!number) {
        sendError(response, 400, "number required");
        return;
      }
      sendJson(response, 200, {messages: await getSMSThread(number)});
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "SMS thread error");
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/sms/send") {
    try {
      const payload = z.object({
        to: z.string().min(5),
        body: z.string().min(1),
      }).parse(await parseBody(request));
      sendJson(response, 200, await sendSMS(payload));
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "SMS send error");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/client-360") {
    sendJson(response, 200, buildClient360Payload());
    return;
  }

  if (request.method === "GET" && pathname === "/api/mail/status") {
    const config = getGmailConfig();
    sendJson(response, 200, {
      provider: "gmail",
      configured: config.configured,
      connected: null,
      account: config.userEmail,
      missingEnv: config.missingEnv,
      draftsReady: database.getMailDrafts().length,
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/mail/oauth/url") {
    sendJson(response, 200, buildGmailOAuthUrl());
    return;
  }

  if (request.method === "GET" && pathname === "/api/mail/oauth/callback") {
    const url = new URL(request.url ?? "/api/mail/oauth/callback", `http://${host}:${port}`);
    const code = url.searchParams.get("code");
    const oauthError = url.searchParams.get("error");
    const oauthErrorDesc = url.searchParams.get("error_description");
    if (!code) {
      const detail = oauthError
        ? `<p><strong>Google returned:</strong> <code>${oauthError}</code></p>` +
          (oauthErrorDesc ? `<p>${oauthErrorDesc}</p>` : "") +
          `<p>Common causes:</p><ul style="line-height:1.8">
             <li><code>access_denied</code> — your account isn't in the OAuth client's <strong>Test users</strong> list (Google Cloud Console → OAuth consent screen → Audience → Test users), or you clicked Cancel on the consent screen.</li>
             <li><code>redirect_uri_mismatch</code> — the redirect URI in your client doesn't exactly match <code>http://127.0.0.1:3007/api/mail/oauth/callback</code>.</li>
             <li><code>admin_policy_enforced</code> — your Google Workspace admin blocks third-party OAuth apps.</li>
           </ul>`
        : `<p>No <code>code</code> parameter was present in the callback. Start the flow at <a href="/api/mail/oauth/url">/api/mail/oauth/url</a> and open the returned <code>authUrl</code> in your browser.</p>`;
      response.writeHead(400, {"Content-Type": "text/html; charset=utf-8"});
      response.end(`<html><body style="font-family:system-ui;background:#0a0a0f;color:#e8e8f0;padding:40px;line-height:1.5">
        <h1>Gmail setup failed</h1>${detail}
        <p style="margin-top:30px;color:#9aa">Full callback URL: <code>${request.url}</code></p>
      </body></html>`);
      return;
    }
    try {
      const result = await exchangeGmailAuthCode(code);
      response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
      response.end(`
        <html>
          <body style="font-family: system-ui; background:#0a0a0f; color:#e8e8f0; padding:40px">
            <h1>Gmail connected</h1>
            <p>The refresh token has been saved locally for ${result.emailAddress || "this mailbox"}.</p>
            <p>You can close this tab and refresh the Elite Automations dashboard.</p>
          </body>
        </html>
      `);
    } catch (error) {
      response.writeHead(500, {"Content-Type": "text/html; charset=utf-8"});
      response.end(`<h1>Gmail setup failed</h1><pre>${String(error instanceof Error ? error.message : error)}</pre>`);
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/mail/inbox") {
    const url = new URL(request.url ?? "/api/mail/inbox", `http://${host}:${port}`);
    const maxResults = Number.parseInt(url.searchParams.get("maxResults") ?? "25", 10);
    const q = url.searchParams.get("q") ?? undefined;
    try {
      sendJson(response, 200, await fetchGmailInbox({q, maxResults}));
    } catch (error) {
      const config = getGmailConfig();
      const message = error instanceof Error ? error.message : "Gmail inbox could not be loaded.";
      // If we have full credentials, the failure is transient (rate limit, network, etc.)
      // — don't downgrade to connected:false, that flips the UI to "not connected".
      const stillConnected = config.configured;
      sendJson(response, 200, {
        provider: "gmail",
        configured: config.configured,
        connected: stillConnected,
        account: config.userEmail,
        missingEnv: config.missingEnv,
        messages: [],
        drafts: database.getMailDrafts(),
        resultSizeEstimate: 0,
        error: message,
      });
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/ai/command") {
    try {
      const payload = aiCommandSchema.parse(await parseBody(request));
      sendJson(response, 200, await runAiCommand(payload));
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "AI command failed.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/operator/status") {
    try {
      sendJson(response, 200, await operatorRuntime.status());
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Operator status failed.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/operator/tool-forge") {
    try {
      const status = await operatorRuntime.status();
      sendJson(response, 200, buildToolForgePayload({
        operatorToolCount: status.tools.length,
        pendingApprovals: status.approvals.length,
      }));
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Tool forge payload failed.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/tools/reply-radar") {
    const url = new URL(request.url ?? "/api/tools/reply-radar", `http://${host}:${port}`);
    const maxResults = Number.parseInt(url.searchParams.get("maxResults") ?? "50", 10);
    const q = url.searchParams.get("q") ?? undefined;
    try {
      sendJson(response, 200, await buildReplyRadarPayload({maxResults, q}));
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Reply Radar failed.");
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/tools/reply-radar/sync") {
    try {
      const radar = await buildReplyRadarPayload({maxResults: 50});
      const synced: Array<NonNullable<ReturnType<typeof logReplyRadarItem>>> = [];
      for (const item of radar.messages) {
        const result = logReplyRadarItem(item);
        if (result) synced.push(result);
      }
      sendJson(response, 200, {
        syncedAt: new Date().toISOString(),
        synced,
        radar,
      });
      broadcastRefresh();
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Reply Radar sync failed.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/tools/voice-agent") {
    const integrationStatus = integrationStatusPayload();
    sendJson(response, 200, {
      generatedAt: new Date().toISOString(),
      profile: buildOwnedVoiceAgentProfile({
        connectedSystems: integrationStatus.connectors
          .filter((connector) => connector.connected)
          .map((connector) => connector.label),
      }),
      recentCalls: await withTimeout(getTwilioSummary(), 5000, "Twilio call summary").catch((error) => ({
        configured: isTwilioConfigured(),
        connected: false,
        error: error instanceof Error ? error.message : "Twilio summary unavailable.",
      })),
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/tools/voice-agent/respond") {
    try {
      const payload = ownedVoiceTurnSchema.parse(await parseBody(request));
      const context = findOwnedVoiceContext(payload);
      const turn = buildOwnedVoiceAgentTurn({
        transcript: payload.transcript,
        callerPhone: payload.callerPhone,
        context,
      });

      if (context) {
        database.addTimelineEvent(context.account.clientId, {
          id: `TL-VOICE-AGENT-${uniqueId(payload.transcript, String(Date.now()))}`,
          eventType: "Owned voice agent brief",
          timestamp: new Date().toISOString(),
          contactName: context.contacts.find((contact) => contact.isPrimary)?.fullName ?? null,
          notes: `Intent: ${turn.intent}\nTranscript: ${payload.transcript}\nAgent reply: ${turn.reply}`,
          duration: null,
          followUpDate: turn.intent === "booking" ? new Date().toISOString().slice(0, 10) : null,
          loggedBy: "JARVIS",
          metadata: {tool: "owned-voice-agent", intent: turn.intent, confidence: turn.confidence},
        });
        database.upsertStructuredMemory(context.account.clientId, {
          conversationHighlights: [
            ...(context.memory?.conversationHighlights ?? []),
            {date: new Date().toISOString(), note: `Voice intent ${turn.intent}: ${payload.transcript.slice(0, 220)}`},
          ].slice(-25),
        });
        if (turn.intent === "booking") {
          database.insertTask(context.account.clientId, {
            id: `TASK-VOICE-BOOKING-${uniqueId(context.account.clientId, payload.transcript)}`,
            title: "Confirm booking from voice agent conversation",
            description: payload.transcript,
            status: "todo",
            priority: "high",
            dueDate: new Date().toISOString().slice(0, 10),
            owner: "JARVIS",
            lane: "voice-agent",
            createdAt: new Date().toISOString(),
          });
        }
      }

      sendJson(response, 200, {
        ...turn,
        profile: buildOwnedVoiceAgentProfile({
          connectedSystems: integrationStatusPayload().connectors.filter((connector) => connector.connected).map((connector) => connector.label),
        }),
      });
      broadcastRefresh();
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Owned voice agent failed.");
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/tools/deal-room/generate") {
    try {
      const payload = dealRoomGenerateSchema.parse(await parseBody(request));
      const context = pickDealRoomContext(payload.clientId);
      if (!context) {
        sendError(response, 404, "No client file is available for Deal Room.");
        return;
      }
      const proposal = generateDealRoomProposal(context);
      const refreshedContext = toOwnedAccountContext(normalizeLeadDetail(context.account.clientId));
      sendJson(response, 200, {
        generatedAt: new Date().toISOString(),
        proposal,
        dealRoom: buildDealRoom({context: refreshedContext, stripeConnected: isStripeConfigured()}),
      });
      broadcastRefresh();
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Deal Room proposal generation failed.");
    }
    return;
  }

  const dealRoomGenerateMatch = pathname.match(/^\/api\/tools\/deal-room\/([^/]+)\/generate$/);
  if (request.method === "POST" && dealRoomGenerateMatch) {
    try {
      const clientId = decodeURIComponent(dealRoomGenerateMatch[1]);
      const context = pickDealRoomContext(clientId);
      if (!context) {
        sendError(response, 404, `Client ${clientId} was not found.`);
        return;
      }
      const proposal = generateDealRoomProposal(context);
      const refreshedContext = toOwnedAccountContext(normalizeLeadDetail(context.account.clientId));
      sendJson(response, 200, {
        generatedAt: new Date().toISOString(),
        proposal,
        dealRoom: buildDealRoom({context: refreshedContext, stripeConnected: isStripeConfigured()}),
      });
      broadcastRefresh();
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Deal Room proposal generation failed.");
    }
    return;
  }

  const dealRoomMatch = pathname.match(/^\/api\/tools\/deal-room(?:\/([^/]+))?$/);
  if (request.method === "GET" && dealRoomMatch) {
    try {
      const url = new URL(request.url ?? "/api/tools/deal-room", `http://${host}:${port}`);
      const clientId = dealRoomMatch[1] ? decodeURIComponent(dealRoomMatch[1]) : url.searchParams.get("clientId") ?? undefined;
      const context = pickDealRoomContext(clientId);
      if (!context) {
        sendError(response, 404, "No client file is available for Deal Room.");
        return;
      }
      sendJson(response, 200, buildDealRoom({context, stripeConnected: isStripeConfigured()}));
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Deal Room failed.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/tools/finance-guard") {
    try {
      const [state, stripe] = await Promise.all([
        buildDashboardState(),
        withTimeout(getStripeSummary(), 6000, "Stripe finance summary").catch(async (error) => ({
          configured: isStripeConfigured(),
          connected: false,
          mode: "unconfigured" as const,
          keyType: process.env.STRIPE_RESTRICTED_KEY ? "restricted" as const : process.env.STRIPE_SECRET_KEY ? "secret" as const : "none" as const,
          publishableKeyConfigured: Boolean(process.env.STRIPE_PUBLISHABLE_KEY),
          currency: "gbp",
          availableBalance: 0,
          pendingBalance: 0,
          recentCollected: 0,
          recentChargeCount: 0,
          successfulChargeCount: 0,
          recentPayments: [],
          lastSyncedAt: null,
          error: error instanceof Error ? error.message : "Stripe finance summary unavailable.",
        })),
      ]);
      const integrations = integrationStatusPayload();
      sendJson(response, 200, buildFinanceGuard({
        state,
        stripe,
        integrationStatuses: integrations.connectors,
      }));
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Finance Guard failed.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/tools/war-room") {
    try {
      const [state, operatorStatus] = await Promise.all([
        buildDashboardState(),
        operatorRuntime.status(),
      ]);
      const toolForge = buildToolForgePayload({
        operatorToolCount: operatorStatus.tools.length,
        pendingApprovals: operatorStatus.approvals.length,
      });
      const integrations = integrationStatusPayload();
      sendJson(response, 200, buildWarRoom({
        state,
        contexts: getOwnedAccountContexts(),
        toolForge: {summary: toolForge.summary},
        connectors: integrations.connectors.map((connector) => ({
          provider: connector.provider,
          label: connector.label,
          connected: connector.connected,
        })),
      }));
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "War Room failed.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/tools/opportunity-engine") {
    try {
      sendJson(response, 200, buildOpportunityEngine({
        state: await buildDashboardState(),
        contexts: getOwnedAccountContexts(),
      }));
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Opportunity Engine failed.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/tools/revenue-radar") {
    try {
      sendJson(response, 200, await buildRevenueRadarPayload());
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Revenue Radar failed.");
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/tools/revenue-radar/scan") {
    try {
      const body = await parseBody(request);
      sendJson(response, 200, await runRevenueRadarDiscovery(body));
      broadcastRefresh();
    } catch (err) {
      sendError(response, err instanceof z.ZodError ? 400 : 500, err instanceof Error ? err.message : "Revenue Radar scan failed.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/tools/evidence-dossier") {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      const clientId = url.searchParams.get("clientId") ?? undefined;
      const context = pickDealRoomContext(clientId);
      if (!context) {
        sendError(response, 404, "No client file is available for a lead evidence dossier.");
        return;
      }
      sendJson(response, 200, buildLeadEvidenceDossier({context}));
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Lead Evidence Dossier failed.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/tools/proof-vault") {
    try {
      sendJson(response, 200, buildProofVault({contexts: getOwnedAccountContexts()}));
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Proof Vault failed.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/tools/design-lab") {
    try {
      sendJson(response, 200, buildDesignLab());
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Design Lab failed.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/operator/sessions") {
    try {
      sendJson(response, 200, await operatorRuntime.sessions());
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Operator sessions failed.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/operator/approvals") {
    try {
      sendJson(response, 200, await operatorRuntime.approvals());
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Operator approvals failed.");
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/operator/command") {
    try {
      const payload = operatorCommandSchema.parse(await parseBody(request));
      sendJson(response, 200, await operatorRuntime.runCommand(payload));
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Operator command failed.");
    }
    return;
  }

  const operatorApprovalMatch = pathname.match(/^\/api\/operator\/approvals\/([^/]+)\/resolve$/);
  if (request.method === "POST" && operatorApprovalMatch) {
    try {
      const approvalId = decodeURIComponent(operatorApprovalMatch[1]);
      const payload = operatorApprovalDecisionSchema.parse(await parseBody(request));
      sendJson(response, 200, await operatorRuntime.resolveApproval(approvalId, payload.decision));
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Operator approval resolution failed.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/voice/openai/status") {
    sendJson(response, 200, getOpenAiVoiceStatus());
    return;
  }

  if (request.method === "GET" && pathname === "/api/markets/watchlist") {
    try {
      sendJson(response, 200, await buildMarketWatchlistPayload());
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Market watchlist failed.");
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/voice/openai/realtime-sdp") {
    try {
      const payload = await parseRealtimeVoiceOffer(request);
      const answerSdp = await createOpenAiRealtimeAnswer(payload.sdp);
      response.writeHead(200, {
        "Content-Type": "application/sdp; charset=utf-8",
        ...corsHeaders,
      });
      response.end(answerSdp);
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Realtime voice session failed.");
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/voice/openai/transcribe") {
    try {
      const payload = voiceTranscriptionSchema.parse(await parseBody(request));
      sendJson(response, 200, await transcribeOpenAiVoiceAudio(payload));
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Voice transcription failed.");
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/voice/openai/tool") {
    try {
      const payload = voiceToolCallSchema.parse(await parseBody(request));
      sendJson(response, 200, await runVoiceToolCall(payload));
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Voice tool call failed.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/accounts") {
    const url = new URL(request.url ?? "/api/accounts", `http://${host}:${port}`);
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const perPageRaw = Number.parseInt(url.searchParams.get("perPage") ?? "50", 10);
    const perPage = Number.isFinite(perPageRaw) ? Math.max(1, Math.min(100, perPageRaw)) : 50;
    sendJson(response, 200, {accounts: database.getAccounts(page, perPage), page, perPage});
    return;
  }

  if (request.method === "POST" && pathname === "/api/leads/search") {
    const payload = leadSearchSchema.parse(await parseBody(request));
    sendJson(response, 202, await triggerLeadSearch(payload));
    return;
  }

  if (request.method === "GET" && pathname === "/api/leads/search/status") {
    sendJson(response, 200, leadSearchStatus);
    return;
  }

  if (request.method === "GET" && pathname === "/api/leads") {
    const url = new URL(request.url ?? "/api/leads", `http://${host}:${port}`);
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const accounts = database.getAccounts(page).map(mapLeadListItem);
    sendJson(response, 200, {leads: accounts});
    return;
  }

  if (request.method === "GET" && /^\/api\/leads\/[^/]+$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/leads/".length));
    sendJson(response, 200, normalizeLeadDetail(clientId));
    return;
  }

  if (request.method === "PATCH" && /^\/api\/leads\/[^/]+\/status$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/leads/".length, -"/status".length));
    const payload = leadStatusSchema.parse(await parseBody(request));
    await commitMutation(response, () => {
      database.updateClient(clientId, {accountStatus: payload.status});
      database.addTimelineEvent(clientId, {
        id: `TL-${uniqueId(clientId, "stage-change", String(Date.now()))}`,
        eventType: "Stage changed",
        timestamp: new Date().toISOString(),
        contactName: null,
        notes: `Stage set to ${payload.status}.`,
        duration: null,
        followUpDate: null,
        loggedBy: brand.ownerName,
      });
    });
    return;
  }

  if (request.method === "POST" && /^\/api\/leads\/[^/]+\/demo$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/leads/".length, -"/demo".length));
    await commitMutation(response, async () => {
      const lead = await regenerateLeadDemo(clientId, database.getAccountFull(clientId) as never);
      database.updateClient(clientId, {
        demoFile: lead.demoFile,
        heroImage: lead.imageAssets.hero,
        servicesImage: lead.imageAssets.services,
      });
      database.addTimelineEvent(clientId, {
        id: `TL-${uniqueId(clientId, "queue-demo", String(Date.now()))}`,
        eventType: "Demo generated",
        timestamp: new Date().toISOString(),
        contactName: null,
        notes: "Demo site regenerated from the lead workspace.",
        duration: null,
        followUpDate: null,
        loggedBy: brand.ownerName,
      });
    });
    return;
  }

  if (request.method === "POST" && /^\/api\/leads\/[^/]+\/email$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/leads/".length, -"/email".length));
    await commitMutation(response, async () => {
      const lead = await regenerateLeadEmail(clientId, database.getAccountFull(clientId) as never);
      database.updateClient(clientId, {
        emailFile: lead.emailFile,
      });
      database.addTimelineEvent(clientId, {
        id: `TL-${uniqueId(clientId, "queue-email", String(Date.now()))}`,
        eventType: "Email draft generated",
        timestamp: new Date().toISOString(),
        contactName: null,
        notes: "Cold email draft regenerated from the lead workspace.",
        duration: null,
        followUpDate: null,
        loggedBy: brand.ownerName,
      });
    });
    return;
  }

  if (request.method === "POST" && /^\/api\/leads\/[^/]+\/video$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/leads/".length, -"/video".length));
    await commitMutation(response, async () => {
      const lead = await regenerateLeadVideo(clientId, database.getAccountFull(clientId) as never);
      database.updateClient(clientId, {
        videoFile: lead.videoFile,
        heroImage: lead.imageAssets.hero,
        servicesImage: lead.imageAssets.services,
      });
      database.addTimelineEvent(clientId, {
        id: `TL-${uniqueId(clientId, "queue-video", String(Date.now()))}`,
        eventType: "Video rendered",
        timestamp: new Date().toISOString(),
        contactName: null,
        notes: "Preview render completed from the lead workspace.",
        duration: null,
        followUpDate: null,
        loggedBy: brand.ownerName,
      });
    });
    return;
  }

  if (request.method === "POST" && /^\/api\/leads\/[^/]+\/browser-audit$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/leads/".length, -"/browser-audit".length));
    await commitMutation(response, async () => {
      const detail = normalizeLeadDetail(clientId);
      if (!detail.lead.websiteUrl) throw new Error("This lead does not have a website URL to audit.");
      const audit = await runBrowserAudit({
        clientId,
        websiteUrl: detail.lead.websiteUrl,
        businessName: detail.lead.businessName,
        businessType: detail.lead.businessType,
        area: detail.lead.area,
      });
      database.saveBrowserAudit(clientId, {
        id: `BA-${uniqueId(clientId, "browser", String(Date.now()))}`,
        websiteUrl: audit.url,
        summary: audit.summary,
        flaws: audit.flaws,
        opportunities: audit.opportunities,
        plan: audit.plan,
        scores: audit.scores,
        evidence: audit.evidence,
        screenshotPath: audit.evidence.screenshotPath,
        createdAt: audit.auditedAt,
      });
      for (const [criterion, scoreValue] of Object.entries(audit.scores)) {
        database.upsertAuditScore(clientId, criterion, scoreValue, `Browser evidence audit: ${audit.summary}`);
      }
      database.updateAuditAnalysis(clientId, {
        strengths: audit.opportunities.slice(0, 3),
        weaknesses: audit.flaws,
        topProblems: audit.flaws.slice(0, 3),
        recommendedActions: audit.plan.join("\n"),
      });
      database.updateClient(clientId, {
        accountStatus: "ready-to-send",
        followUpNextStep: "Review browser audit evidence, build the demo angle, then send a personalised audit-led email.",
      });
      database.addTimelineEvent(clientId, {
        id: `TL-${uniqueId(clientId, "browser-audit", String(Date.now()))}`,
        eventType: "Browser audit completed",
        timestamp: audit.auditedAt,
        contactName: null,
        notes: audit.summary,
        duration: Math.max(1, Math.round(audit.evidence.loadMs / 1000)),
        followUpDate: null,
        loggedBy: "Playwright audit",
        metadata: {screenshotPath: audit.evidence.screenshotPath, finalUrl: audit.evidence.finalUrl},
      });
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/accounts") {
    const payload = clientCreateSchema.parse(await parseBody(request));
    const clientId = database.createClient({
      ...payload,
      priority: normalizePriorityInput(payload.priority),
    });
    database.addTimelineEvent(clientId, {
      id: `TL-${uniqueId(clientId, "api-created")}`,
      eventType: "Account created",
      timestamp: new Date().toISOString(),
      contactName: null,
      notes: "Account created from the enterprise account form.",
      duration: null,
      followUpDate: payload.dueDate ?? null,
      loggedBy: brand.ownerName,
    });
    await refreshDashboardFile();
    broadcastRefresh();
    sendJson(response, 200, {clientId, state: await buildDashboardState()});
    return;
  }

  if (request.method === "PATCH" && /^\/api\/accounts\/[^/]+$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/accounts/".length));
    const payload = clientPatchSchema.parse(await parseBody(request));
    await commitMutation(response, () => {
      database.updateClient(clientId, {
        ...payload,
        followUpPriority: normalizePriorityInput(payload.priority ?? payload.followUpPriority),
        followUpNextStep: payload.nextActionNotes ?? payload.followUpNextStep,
        followUpDueDate: payload.dueDate ?? payload.followUpDueDate,
      });
    });
    return;
  }

  if (request.method === "DELETE" && /^\/api\/accounts\/[^/]+$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/accounts/".length));
    await commitMutation(response, () => {
      database.deleteClient(clientId);
    });
    return;
  }

  if (request.method === "GET" && /^\/api\/accounts\/[^/]+\/full$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/accounts/".length, -"/full".length));
    sendJson(response, 200, database.getAccountFull(clientId));
    return;
  }

  if (request.method === "POST" && /^\/api\/accounts\/[^/]+\/timeline$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/accounts/".length, -"/timeline".length));
    const payload = timelineSchema.parse(await parseBody(request));
    await commitMutation(response, () => {
      database.addTimelineEvent(clientId, {
        id: `TL-${uniqueId(clientId, payload.eventType, String(Date.now()))}`,
        ...payload,
      });
      database.updateClient(clientId, {
        lastContactedAt: payload.timestamp,
        accountStatus: payload.eventType === "Won" ? "won" : payload.eventType === "Lost" ? "lost" : payload.eventType === "Proposal sent" ? "proposal" : undefined,
      });
    });
    return;
  }

  if (request.method === "POST" && /^\/api\/accounts\/[^/]+\/audit-score$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/accounts/".length, -"/audit-score".length));
    const payload = auditScoreSchema.parse(await parseBody(request));
    await commitMutation(response, () => {
      database.upsertAuditScore(clientId, payload.criterion, payload.score, payload.note);
    });
    return;
  }

  if (request.method === "PATCH" && /^\/api\/accounts\/[^/]+\/audit-analysis$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/accounts/".length, -"/audit-analysis".length));
    const payload = auditAnalysisSchema.parse(await parseBody(request));
    await commitMutation(response, () => {
      database.updateAuditAnalysis(clientId, payload);
    });
    return;
  }

  if (request.method === "POST" && /^\/api\/accounts\/[^/]+\/tasks$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/accounts/".length, -"/tasks".length));
    const payload = taskSchema.parse(await parseBody(request));
    const task: ClientTask = {
      id: `TASK-${uniqueId(clientId, payload.title, String(Date.now()))}`,
      title: payload.title,
      description: payload.description,
      status: payload.status,
      priority: payload.priority,
      dueDate: payload.dueDate,
      owner: payload.owner,
      lane: payload.lane,
      createdAt: new Date().toISOString(),
    };
    await commitMutation(response, () => {
      database.insertTask(clientId, task);
    });
    return;
  }

  if (request.method === "DELETE" && /^\/api\/tasks\/[^/]+$/.test(pathname)) {
    const taskId = decodeURIComponent(pathname.slice("/api/tasks/".length));
    await commitMutation(response, () => {
      database.deleteTask(taskId);
    });
    return;
  }

  if (request.method === "POST" && /^\/api\/accounts\/[^/]+\/contacts$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/accounts/".length, -"/contacts".length));
    const payload = contactSchema.parse(await parseBody(request));
    const contact: ClientContact = {
      id: `CON-${uniqueId(clientId, payload.fullName, String(Date.now()))}`,
      fullName: payload.fullName,
      role: payload.role,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      linkedin: payload.linkedin ?? null,
      isPrimary: payload.isPrimary,
      notes: payload.notes,
      status: payload.status,
    };
    await commitMutation(response, () => {
      database.insertContact(clientId, contact);
    });
    return;
  }

  if (request.method === "PATCH" && /^\/api\/contacts\/[^/]+$/.test(pathname)) {
    const contactId = decodeURIComponent(pathname.slice("/api/contacts/".length));
    const payload = contactPatchSchema.parse(await parseBody(request));
    await commitMutation(response, () => {
      database.updateContact(contactId, payload);
    });
    return;
  }

  if (request.method === "DELETE" && /^\/api\/contacts\/[^/]+$/.test(pathname)) {
    const contactId = decodeURIComponent(pathname.slice("/api/contacts/".length));
    await commitMutation(response, () => {
      database.deleteContact(contactId);
    });
    return;
  }

  if (request.method === "POST" && /^\/api\/accounts\/[^/]+\/proposal$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/accounts/".length, -"/proposal".length));
    const payload = proposalSchema.parse(await parseBody(request));
    const proposal: ClientProposal = {
      id: `PROP-${uniqueId(clientId, payload.packageName, String(Date.now()))}`,
      title: payload.title,
      status: payload.status,
      packageName: payload.packageName,
      price: payload.price,
      probability: payload.probability,
      nextStep: payload.nextStep,
      scope: payload.scope,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await commitMutation(response, () => {
      database.insertProposal(clientId, proposal);
      database.updateClient(clientId, {
        accountStatus: payload.status === "accepted" ? "won" : "proposal",
        closeProbability: payload.probability,
        valueEstimate: payload.price,
      });
    });
    return;
  }

  if (request.method === "PATCH" && /^\/api\/accounts\/[^/]+\/memory$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/accounts/".length, -"/memory".length));
    const payload = memoryPatchSchema.parse(await parseBody(request));
    await commitMutation(response, () => {
      database.upsertStructuredMemory(clientId, payload);
    });
    return;
  }

  if (request.method === "POST" && /^\/api\/accounts\/[^/]+\/notes$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/accounts/".length, -"/notes".length));
    const payload = noteSchema.parse(await parseBody(request));
    await commitMutation(response, () => {
      database.addNote(clientId, payload.body);
    });
    return;
  }

  if (request.method === "DELETE" && /^\/api\/notes\/[^/]+$/.test(pathname)) {
    const noteId = decodeURIComponent(pathname.slice("/api/notes/".length));
    await commitMutation(response, () => {
      database.deleteNote(noteId);
    });
    return;
  }

  if (request.method === "POST" && /^\/api\/accounts\/[^/]+\/calls$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/accounts/".length, -"/calls".length));
    const payload = callSchema.parse(await parseBody(request));
    await commitMutation(response, () => {
      database.logCall(clientId, payload);
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/search") {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);
    const query = url.searchParams.get("q") ?? "";
    const statusParam = url.searchParams.get("status") ?? "";
    const priorityParam = url.searchParams.get("priority") ?? "";
    const results = database.searchClients(query, statusParam, priorityParam);
    sendJson(response, 200, {results});
    return;
  }

  if (request.method === "GET" && pathname === "/api/export/csv") {
    const state = database.getState();
    const rows = state.clients.map((client) => ({
      clientId: client.clientId,
      businessName: client.businessName,
      businessType: client.businessType,
      area: client.area,
      websiteUrl: client.websiteUrl ?? "",
      accountStatus: client.accountStatus,
      score: client.audit.totalScore,
      topProblems: client.audit.topProblems.join(" | "),
      email: client.emailAddress ?? "",
      phone: client.phoneNumber ?? "",
      priority: client.followUp.priority,
      dueDate: client.followUp.dueDate,
      dealValue: client.valueEstimate,
      closeProbability: client.closeProbability,
      healthBand: client.healthBand,
    }));
    const csvContent = rows.length
      ? [Object.keys(rows[0]).join(","), ...rows.map((row) => Object.values(row).map((v) => {
          const text = String(v);
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        }).join(","))].join("\n")
      : "";
    response.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=hamid-enterprise-export.csv",
      ...corsHeaders,
    });
    response.end(csvContent);
    return;
  }

  if (request.method === "GET" && pathname === "/api/metrics") {
    sendJson(response, 200, await buildMetricsPayload());
    return;
  }

  if (request.method === "GET" && pathname === "/api/stripe/summary") {
    try {
      const summary = await getStripeSummary();
      const stripe = await getStripeClient();
      let recentCharges: unknown[] = [];
      if (stripe) {
        const createdGte = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 90;
        const charges = await stripe.charges.list({ limit: 50, created: { gte: createdGte } });
        recentCharges = charges.data.map((c) => ({
          id: c.id, amount: c.amount, currency: c.currency, status: c.status,
          description: c.description ?? null, created: c.created,
          customerEmail: (c.billing_details as {email?: string | null})?.email ?? null,
        }));
      }
      sendJson(response, 200, {
        balance: { available: Math.round((summary.availableBalance ?? 0) * 100), pending: Math.round((summary.pendingBalance ?? 0) * 100), currency: summary.currency?.toLowerCase() ?? "gbp" },
        recentCharges,
        totalLast90Days: Math.round((summary.recentCollected ?? 0) * 100),
        chargeCount: summary.recentChargeCount ?? 0,
        configured: summary.configured,
      });
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Stripe error"); }
    return;
  }

  // ── Stripe: invoices ──────────────────────────────────────────────────────
  if (request.method === "GET" && pathname === "/api/stripe/invoices") {
    try {
      const stripe = await getStripeClient();
      if (!stripe) { sendJson(response, 200, []); return; }
      const invoices = await stripe.invoices.list({ limit: 50 });
      sendJson(response, 200, invoices.data.map((inv) => ({
        id: inv.id, number: inv.number ?? null, customerEmail: inv.customer_email ?? null,
        customerName: inv.customer_name ?? null, amount: inv.amount_due, currency: inv.currency,
        status: inv.status ?? "unknown", created: inv.created,
        dueDate: inv.due_date ?? null, invoiceUrl: inv.hosted_invoice_url ?? null,
      })));
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Stripe error"); }
    return;
  }

  // ── Stripe: payment links ─────────────────────────────────────────────────
  if (request.method === "GET" && pathname === "/api/stripe/payment-links") {
    try {
      const stripe = await getStripeClient();
      if (!stripe) { sendJson(response, 200, []); return; }
      const links = await stripe.paymentLinks.list({ limit: 20 });
      sendJson(response, 200, links.data.map((l) => ({
        id: l.id, url: l.url, active: l.active, amount: null, currency: "gbp", description: null, created: 0,
      })));
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Stripe error"); }
    return;
  }

  if (request.method === "POST" && pathname === "/api/stripe/payment-links") {
    try {
      const stripe = await getStripeClient();
      if (!stripe) { sendError(response, 400, "Stripe not configured"); return; }
      const body = await parseBody(request) as { amount?: number; description?: string };
      const price = await stripe.prices.create({
        currency: "gbp", unit_amount: body.amount ?? 100,
        product_data: { name: body.description ?? "Payment" },
      });
      const link = await stripe.paymentLinks.create({ line_items: [{ price: price.id, quantity: 1 }] });
      sendJson(response, 200, { id: link.id, url: link.url, active: link.active });
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Stripe error"); }
    return;
  }

  // ── Stripe: customers ────────────────────────────────────────────────────
  if (request.method === "GET" && pathname === "/api/stripe/customers") {
    try {
      const stripe = await getStripeClient();
      if (!stripe) { sendJson(response, 200, []); return; }
      const customers = await stripe.customers.list({ limit: 50 });
      sendJson(response, 200, customers.data.map((c) => ({
        id: c.id, email: c.email ?? null, name: c.name ?? null,
        created: c.created, totalSpend: 0, currency: "gbp",
      })));
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Stripe error"); }
    return;
  }

  // ── Stripe: create customer ───────────────────────────────────────────────
  if (request.method === "POST" && pathname === "/api/stripe/customers") {
    try {
      const stripe = await getStripeClient();
      if (!stripe) { sendError(response, 400, "Stripe not configured"); return; }
      const body = await parseBody(request) as { email?: string; name?: string; phone?: string; description?: string };
      if (!body.email) { sendError(response, 400, "email required"); return; }
      const customer = await stripe.customers.create({
        email: body.email,
        name: body.name ?? undefined,
        phone: body.phone ?? undefined,
        description: body.description ?? undefined,
      });
      sendJson(response, 201, {
        id: customer.id, email: customer.email ?? null,
        name: customer.name ?? null, created: customer.created,
      });
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Stripe error"); }
    return;
  }

  // ── Stripe: create & send invoice ─────────────────────────────────────────
  if (request.method === "POST" && pathname === "/api/stripe/invoices") {
    try {
      const stripe = await getStripeClient();
      if (!stripe) { sendError(response, 400, "Stripe not configured"); return; }
      const body = await parseBody(request) as {
        customerId?: string;
        description?: string;
        amount?: number;       // in pence
        currency?: string;
        daysUntilDue?: number;
        send?: boolean;
      };
      if (!body.customerId) { sendError(response, 400, "customerId required"); return; }
      if (!body.amount || body.amount < 1) { sendError(response, 400, "amount required (in pence)"); return; }

      // Add an invoice item then create the invoice
      await stripe.invoiceItems.create({
        customer: body.customerId,
        amount: body.amount,
        currency: body.currency ?? "gbp",
        description: body.description ?? "Service",
      });

      const invoice = await stripe.invoices.create({
        customer: body.customerId,
        collection_method: "send_invoice",
        days_until_due: body.daysUntilDue ?? 14,
      });

      // Optionally send immediately
      if (body.send) {
        await stripe.invoices.sendInvoice(invoice.id);
      }

      sendJson(response, 201, {
        id: invoice.id,
        status: invoice.status,
        amount: invoice.amount_due,
        currency: invoice.currency,
        hostedUrl: invoice.hosted_invoice_url ?? null,
        pdf: invoice.invoice_pdf ?? null,
      });
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Stripe error"); }
    return;
  }

  // ── Stripe: products & prices ─────────────────────────────────────────────
  if (request.method === "GET" && pathname === "/api/stripe/products") {
    try {
      const stripe = await getStripeClient();
      if (!stripe) { sendJson(response, 200, []); return; }
      const [products, prices] = await Promise.all([
        stripe.products.list({ limit: 50, active: true }),
        stripe.prices.list({ limit: 100, active: true }),
      ]);
      const pricesByProduct: Record<string, typeof prices.data> = {};
      for (const price of prices.data) {
        const pid = typeof price.product === "string" ? price.product : price.product.id;
        if (!pricesByProduct[pid]) pricesByProduct[pid] = [];
        pricesByProduct[pid].push(price);
      }
      sendJson(response, 200, products.data.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        active: p.active,
        created: p.created,
        prices: (pricesByProduct[p.id] ?? []).map((pr) => ({
          id: pr.id,
          amount: pr.unit_amount ?? null,
          currency: pr.currency,
          interval: pr.recurring?.interval ?? null,
          nickname: pr.nickname ?? null,
        })),
      })));
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Stripe error"); }
    return;
  }

  // ── Stripe: subscriptions ─────────────────────────────────────────────────
  if (request.method === "GET" && pathname === "/api/stripe/subscriptions") {
    try {
      const stripe = await getStripeClient();
      if (!stripe) { sendJson(response, 200, []); return; }
      const subs = await stripe.subscriptions.list({ limit: 50, status: "all" });
      sendJson(response, 200, subs.data.map((s) => ({
        id: s.id,
        status: s.status,
        customerId: typeof s.customer === "string" ? s.customer : s.customer.id,
        cancelAtPeriodEnd: s.cancel_at_period_end,
        amount: s.items.data.reduce((sum, item) => sum + (item.price.unit_amount ?? 0), 0),
        currency: s.items.data[0]?.price.currency ?? "gbp",
        interval: s.items.data[0]?.price.recurring?.interval ?? null,
      })));
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Stripe error"); }
    return;
  }

  // ── AI: scrape ────────────────────────────────────────────────────────────
  if (request.method === "POST" && pathname === "/api/ai/scrape") {
    try {
      const body = await parseBody(request) as { url?: string };
      if (!body.url) { sendError(response, 400, "url required"); return; }
      const result = await scrapeWebsite(body.url);
      const analysis = analyseScrape(body.url, result);
      const text = extractVisibleText(result.html ?? null, result.markdown ?? null).slice(0, 8_000);
      sendJson(response, 200, {
        url: body.url,
        domain: (() => {
          try {
            return new URL(body.url).hostname.replace(/^www\./, "");
          } catch {
            return null;
          }
        })(),
        title: result.metadata?.title as string ?? "",
        metadata: result.metadata,
        text,
        markdown: (result.markdown ?? "").slice(0, 8_000),
        analysis,
      });
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Scrape error"); }
    return;
  }

  // ── AI: search businesses ─────────────────────────────────────────────────
  if (request.method === "POST" && pathname === "/api/ai/search") {
    try {
      const body = await parseBody(request) as { query?: string; location?: string; limit?: number };
      if (!body.query) { sendError(response, 400, "query required"); return; }
      const report = await buildBusinessSearchReport(body.query, body.location ?? "UK", body.limit ?? 8);
      sendJson(response, 200, report);
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Search error"); }
    return;
  }

  if (request.method === "GET" && pathname === "/api/ai/apify/status") {
    sendJson(response, 200, getApifyStatus());
    return;
  }

  if (request.method === "GET" && pathname === "/api/ai/apify/actors") {
    try {
      const url = new URL(request.url ?? "/api/ai/apify/actors", `http://${host}:${port}`);
      const query = url.searchParams.get("q") ?? "google maps reviews";
      const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
      sendJson(response, 200, {
        status: getApifyStatus(),
        actors: await searchApifyActors(query, limit),
      });
    } catch (err) {
      sendJson(response, 200, {
        status: getApifyStatus(),
        actors: [],
        error: err instanceof Error ? err.message : "Apify actor search failed.",
      });
    }
    return;
  }

  if (request.method === "POST" && /^\/api\/ai\/apify\/actors\/.+\/run$/.test(pathname)) {
    const actorId = decodeURIComponent(pathname.slice("/api/ai/apify/actors/".length, -"/run".length));
    try {
      const payload = apifyRunSchema.parse(await parseBody(request));
      const result = await runApifyActor({
        actorId,
        input: payload.input,
        waitForFinishSeconds: payload.waitForFinishSeconds,
      });
      if (payload.clientId) {
        database.addTimelineEvent(payload.clientId, {
          id: `TL-${uniqueId(payload.clientId, "apify", actorId, String(Date.now()))}`,
          eventType: "Apify actor run",
          timestamp: new Date().toISOString(),
          contactName: null,
          notes: `${payload.purpose}: ${actorId} returned ${result.datasetItems.length} dataset item${result.datasetItems.length === 1 ? "" : "s"} with status ${result.run.status}.`,
          duration: null,
          followUpDate: null,
          loggedBy: "LEADGEN",
          metadata: {actorId, runId: result.run.id, status: result.run.status},
        });
      }
      sendJson(response, 200, result);
    } catch (err) {
      sendError(response, 500, err instanceof Error ? err.message : "Apify actor run failed.");
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/ai/kie/models") {
    sendJson(response, 200, {models: listKieModels()});
    return;
  }

  // ── AI: image generation ──────────────────────────────────────────────────
  if (request.method === "POST" && pathname === "/api/ai/images/generate") {
    try {
      const body = await parseBody(request) as {
        prompt?: string;
        title?: string;
        subtitle?: string;
        clientId?: string;
        modelId?: string;
        aspectRatio?: string;
        inputImageUrls?: string[];
        maskUrl?: string | null;
        variants?: number;
      };
      if (!body.prompt) { sendError(response, 400, "prompt required"); return; }
      const slug = (body.clientId ?? `gen-${Date.now()}`).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      const filePath = path.join(outputDir, "images", `${slug}-hero.png`);
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      const asset = await generateKieImageAsset(filePath, {
        modelId: body.modelId ?? "google/nano-banana-pro",
        prompt: body.prompt,
        title: body.title ?? "",
        subtitle: body.subtitle ?? "",
        aspectRatio: body.aspectRatio ?? "16:9",
        inputImageUrls: body.inputImageUrls,
        maskUrl: body.maskUrl,
        variants: body.variants,
      });
      sendJson(response, 200, {
        imageUrl: `/${toOutputRelative(asset.filePath)}`,
        title: body.title ?? "",
        subtitle: body.subtitle ?? "",
        savedPath: filePath,
        sourceUrl: asset.sourceUrl,
        modelId: asset.modelId,
        taskId: asset.taskId,
        live: asset.live,
      });
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Image generation error"); }
    return;
  }

  if (request.method === "POST" && pathname === "/api/ai/videos/generate") {
    try {
      const body = await parseBody(request) as {
        prompt?: string;
        clientId?: string;
        modelId?: string;
        inputImageUrls?: string[];
        duration?: string;
        resolution?: string;
        audio?: boolean;
        cameraFixed?: boolean;
      };
      if (!body.prompt) { sendError(response, 400, "prompt required"); return; }
      if (!body.modelId) { sendError(response, 400, "modelId required"); return; }
      const slug = (body.clientId ?? `video-${Date.now()}`).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      const filePath = path.join(outputDir, "videos", `${slug}-preview.mp4`);
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      const asset = await generateKieVideoAsset(filePath, {
        modelId: body.modelId,
        prompt: body.prompt,
        inputImageUrls: body.inputImageUrls,
        duration: body.duration,
        resolution: body.resolution,
        audio: body.audio,
        cameraFixed: body.cameraFixed,
      });
      sendJson(response, 200, {
        videoUrl: `/${toOutputRelative(asset.filePath)}`,
        savedPath: filePath,
        sourceUrl: asset.sourceUrl,
        modelId: asset.modelId,
        taskId: asset.taskId,
        live: asset.live,
      });
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Video generation error"); }
    return;
  }

  // ── MAIL: templates ───────────────────────────────────────────────────────
  if (request.method === "GET" && pathname === "/api/mail/templates") {
    sendJson(response, 200, Array.from(emailTemplates.values()));
    return;
  }

  if (request.method === "POST" && pathname === "/api/mail/templates") {
    try {
      const body = await parseBody(request) as { name?: string; subject?: string; body?: string };
      if (!body.name || !body.subject || !body.body) { sendError(response, 400, "name, subject, body required"); return; }
      const tpl: EmailTemplate = { id: uniqueId("tpl", body.name, String(Date.now())), name: body.name, subject: body.subject, body: body.body, createdAt: new Date().toISOString() };
      emailTemplates.set(tpl.id, tpl);
      sendJson(response, 201, tpl);
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Error"); }
    return;
  }

  if (request.method === "PUT" && /^\/api\/mail\/templates\/[^/]+$/.test(pathname)) {
    try {
      const id = decodeURIComponent(pathname.slice("/api/mail/templates/".length));
      const existing = emailTemplates.get(id);
      if (!existing) { sendError(response, 404, "Template not found"); return; }
      const body = await parseBody(request) as Partial<EmailTemplate>;
      const updated = { ...existing, ...body, id };
      emailTemplates.set(id, updated);
      sendJson(response, 200, updated);
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Error"); }
    return;
  }

  if (request.method === "DELETE" && /^\/api\/mail\/templates\/[^/]+$/.test(pathname)) {
    const id = decodeURIComponent(pathname.slice("/api/mail/templates/".length));
    emailTemplates.delete(id);
    sendJson(response, 200, { success: true });
    return;
  }

  // ── MAIL: generate template from lead ─────────────────────────────────────
  if (request.method === "GET" && pathname === "/api/mail/generate-template") {
    try {
      const url = new URL(request.url ?? "/", `http://${host}:${port}`);
      const clientId = url.searchParams.get("clientId");
      if (!clientId) { sendError(response, 400, "clientId required"); return; }
      let accountFull;
      try { accountFull = database.getAccountFull(clientId); } catch { sendError(response, 404, "Lead not found"); return; }
      const { createEmail } = await import("@/email");
      const acc = accountFull.account as Record<string, unknown>;
      const analysis = accountFull.auditAnalysis as Record<string, unknown> | undefined;
      const topProblems = analysis?.top_problems_json
        ? (JSON.parse(analysis.top_problems_json as string) as string[])
        : [(String(acc.next_action_notes ?? "the site could be clearer")).split(".")[0]];
      const fakeLead = {
        businessName: String(acc.business_name ?? ""),
        businessType: String(acc.business_type ?? "Business"),
        area: String(acc.area ?? "UK"),
        emailAddress: (acc.email_address as string | null) ?? null,
        audit: { topProblems },
      };
      const { subject, body: emailBody } = createEmail(fakeLead as Parameters<typeof createEmail>[0]);
      sendJson(response, 200, { subject, body: emailBody });
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Error"); }
    return;
  }

  // ── MAIL: send ────────────────────────────────────────────────────────────
  if (request.method === "POST" && pathname === "/api/mail/send") {
    try {
      const body = await parseBody(request) as { to?: string; subject?: string; body?: string; clientId?: string; cc?: string; replyTo?: string };
      if (!body.to || !body.subject || !body.body) { sendError(response, 400, "to, subject, body required"); return; }

      const gmailConfig = getGmailConfig();
      const smtpHost = process.env.SMTP_HOST;
      const smtpConfigured = Boolean(smtpHost && process.env.SMTP_USER && process.env.SMTP_PASS);

      let sent = false;
      let method: "gmail" | "smtp" | "none" = "none";
      let messageId: string | undefined;
      const problems: string[] = [];

      // Preferred: Gmail API (uses the user's OAuth refresh token).
      if (gmailConfig.configured) {
        try {
          const result = await sendViaGmailApi({
            to: body.to,
            subject: body.subject,
            body: body.body,
            from: gmailConfig.userEmail,
            cc: body.cc,
            replyTo: body.replyTo,
          });
          sent = true;
          method = "gmail";
          messageId = result.id;
        } catch (err) {
          problems.push(`Gmail API: ${err instanceof Error ? err.message : "unknown error"}`);
        }
      }

      // Fallback: SMTP.
      if (!sent && smtpConfigured) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
          const nodemailer = require("nodemailer") as any;
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: Number(process.env.SMTP_PORT ?? 587),
            secure: process.env.SMTP_SECURE === "true",
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          });
          const info = await transporter.sendMail({
            from: process.env.SMTP_FROM ?? `Hamid <${gmailConfig.userEmail || "noreply@eliteautomations.co.uk"}>`,
            to: body.to,
            cc: body.cc,
            replyTo: body.replyTo,
            subject: body.subject,
            text: body.body,
          });
          sent = true;
          method = "smtp";
          messageId = info?.messageId;
        } catch (err) {
          problems.push(`SMTP: ${err instanceof Error ? err.message : "unknown error"}`);
        }
      }

      // Log to the account timeline either way (sent or failed) so nothing is silent.
      if (body.clientId) {
        database.addTimelineEvent(body.clientId, {
          id: uniqueId("mail", body.clientId, String(Date.now())),
          eventType: sent ? "Email sent" : "Email draft logged",
          notes: sent
            ? `[${method}] ${body.subject}${messageId ? ` (msg ${messageId})` : ""}`
            : `Draft saved — send failed: ${problems.join(" / ") || "no transport configured"}`,
          loggedBy: "H/OS Mail",
          contactName: null,
          duration: null,
          followUpDate: null,
          timestamp: new Date().toISOString(),
        });
      }

      if (!sent) {
        const reason = problems.length
          ? problems.join(" / ")
          : "Email was not sent. Connect Gmail or set SMTP_HOST/SMTP_USER/SMTP_PASS.";
        sendError(response, 502, reason);
        return;
      }

      sendJson(response, 200, {
        success: true,
        sent: true,
        method,
        messageId,
        account: gmailConfig.userEmail || null,
        logged: Boolean(body.clientId),
        note: method === "gmail" ? `Sent via Gmail API from ${gmailConfig.userEmail}` : `Sent via SMTP (${smtpHost})`,
      });
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Error"); }
    return;
  }

  // ── MAIL: campaign ────────────────────────────────────────────────────────
  if (request.method === "POST" && pathname === "/api/mail/campaign") {
    try {
      const body = await parseBody(request) as {
        subject?: string; body?: string;
        recipients?: Array<{ email: string; name: string; clientId: string }>;
      };
      if (!body.subject || !body.body || !body.recipients?.length) {
        sendError(response, 400, "subject, body, recipients required"); return;
      }
      const results = body.recipients.map((r) => {
        try {
          if (r.clientId) {
            database.addTimelineEvent(r.clientId, {
              id: uniqueId("campaign", r.clientId, String(Date.now())),
              eventType: "email",
              notes: `Campaign email sent: ${body.subject}`,
              loggedBy: "H/OS Mail Campaign",
              contactName: null,
              duration: null,
              followUpDate: null,
              timestamp: new Date().toISOString(),
            });
          }
          return { name: r.name, email: r.email, ok: true };
        } catch {
          return { name: r.name, email: r.email, ok: false };
        }
      });
      sendJson(response, 200, { results, note: "Logged to timeline. Configure SMTP_HOST to send real email." });
    } catch (err) { sendError(response, 500, err instanceof Error ? err.message : "Error"); }
    return;
  }

  if (request.method === "GET" && pathname === "/api/pipeline/results") {
    sendJson(response, 200, await buildPipelinePayload());
    return;
  }

  if (request.method === "GET" && pathname === "/api/output/text") {
    const url = new URL(request.url ?? "/api/output/text", `http://${host}:${port}`);
    const filePath = url.searchParams.get("path");
    if (!filePath) {
      sendError(response, 400, "Missing file path.");
      return;
    }
    const relative = toOutputRelative(filePath);
    const absolute = path.resolve(outputDir, relative);
    if (!absolute.startsWith(path.resolve(outputDir))) {
      sendError(response, 403, "Forbidden");
      return;
    }
    const content = await fsp.readFile(absolute, "utf8");
    sendJson(response, 200, {content, href: `http://${host}:${port}/${relative}`});
    return;
  }

  if (request.method === "GET" && pathname === "/api/mail/drafts") {
    sendJson(response, 200, {drafts: database.getMailDrafts()});
    return;
  }

  if (request.method === "GET" && pathname === "/api/ops/today-batch") {
    sendJson(response, 200, {accounts: database.getTodayBatch()});
    return;
  }

  if (request.method === "GET" && pathname === "/api/ops/call-sheet") {
    sendJson(response, 200, {accounts: database.getCallSheet()});
    return;
  }

  if (request.method === "GET" && pathname === "/api/state") {
    sendJson(response, 200, await buildDashboardState());
    return;
  }

  if (request.method === "POST" && pathname === "/api/import/pipeline") {
    await commitMutation(response, async () => {
      await hydrateFromPipelineIfPresent();
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/backup") {
    const backupPath = database.backup();
    sendJson(response, 200, {success: true, backupPath});
    return;
  }

  if (request.method === "POST" && pathname === "/api/clients") {
    const payload = clientCreateSchema.parse(await parseBody(request));
    await commitMutation(response, () => {
      database.createClient({
        ...payload,
        priority: normalizePriorityInput(payload.priority),
      });
    });
    return;
  }

  if (request.method === "PATCH" && /^\/api\/clients\/[^/]+$/.test(pathname)) {
    const clientId = decodeURIComponent(pathname.slice("/api/clients/".length));
    const payload = clientPatchSchema.parse(await parseBody(request));
    await commitMutation(response, () => {
      database.updateClient(clientId, {
        ...payload,
        followUpPriority: normalizePriorityInput(payload.priority ?? payload.followUpPriority),
      });
    });
    return;
  }

  if (request.method === "POST" && /^\/api\/clients\/[^/]+\/contacts$/.test(pathname)) {
    const clientId = clientIdFromUrl(pathname, "/contacts");
    const payload = contactSchema.parse(await parseBody(request));
    const contact: ClientContact = {
      id: `CON-${uniqueId(clientId, payload.fullName, String(Date.now()))}`,
      fullName: payload.fullName,
      role: payload.role,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      linkedin: payload.linkedin ?? null,
      isPrimary: payload.isPrimary,
      notes: payload.notes,
      status: payload.status,
    };
    await commitMutation(response, () => {
      database.insertContact(clientId, contact);
    });
    return;
  }

  if (request.method === "POST" && /^\/api\/clients\/[^/]+\/activities$/.test(pathname)) {
    const clientId = clientIdFromUrl(pathname, "/activities");
    const payload = activitySchema.parse(await parseBody(request));
    const activity: OutreachActivity = {
      id: `ACT-${uniqueId(clientId, payload.type, String(Date.now()))}`,
      type: payload.type,
      status: payload.status,
      title: payload.title,
      summary: payload.summary,
      owner: payload.owner,
      createdAt: new Date().toISOString(),
      scheduledFor: payload.scheduledFor,
      completedAt: payload.completedAt,
      linkedFiles: payload.linkedFiles,
      linkedChannels: payload.linkedChannels,
      eventSource: payload.eventSource,
      metadata: payload.metadata,
    };
    await commitMutation(response, () => {
      database.insertActivity(clientId, activity, payload.eventSource);
    });
    return;
  }

  if (request.method === "POST" && /^\/api\/clients\/[^/]+\/events$/.test(pathname)) {
    const clientId = clientIdFromUrl(pathname, "/events");
    const payload = eventSchema.parse(await parseBody(request));
    const now = new Date().toISOString();
    const activity: OutreachActivity = {
      id: `EVT-${uniqueId(clientId, payload.channel, payload.status, String(Date.now()))}`,
      type: payload.channel === "call" ? "cold-call" : "email",
      status: payload.status,
      title: payload.title ?? `${payload.channel === "call" ? "Call" : "Email"} ${payload.status}`,
      summary: payload.summary,
      owner: brand.ownerName,
      createdAt: now,
      scheduledFor: null,
      completedAt: ["sent", "delivered", "replied", "booked", "won", "lost"].includes(payload.status) ? now : null,
      linkedFiles: [],
      linkedChannels: [payload.channel],
      eventSource: payload.channel,
      metadata: {channel: payload.channel},
    };
    await commitMutation(response, () => {
      database.insertActivity(clientId, activity, payload.channel);
      database.updateClient(clientId, {
        lastContactedAt: now,
        accountStatus:
          payload.status === "replied"
            ? "replied"
            : payload.status === "won"
              ? "won"
              : payload.channel === "email" || payload.channel === "call"
                ? "contacted"
                : undefined,
      });
    });
    return;
  }

  if (request.method === "POST" && /^\/api\/clients\/[^/]+\/tasks$/.test(pathname)) {
    const clientId = clientIdFromUrl(pathname, "/tasks");
    const payload = taskSchema.parse(await parseBody(request));
    const task: ClientTask = {
      id: `TASK-${uniqueId(clientId, payload.title, String(Date.now()))}`,
      ...payload,
      createdAt: new Date().toISOString(),
    };
    await commitMutation(response, () => {
      database.insertTask(clientId, task);
    });
    return;
  }

  if (request.method === "PATCH" && /^\/api\/tasks\/[^/]+$/.test(pathname)) {
    const taskId = decodeURIComponent(pathname.slice("/api/tasks/".length));
    const payload = taskPatchSchema.parse(await parseBody(request));
    await commitMutation(response, () => {
      database.updateTask(taskId, payload);
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/memories") {
    const payload = memorySchema.parse(await parseBody(request));
    const memory: ClientMemory = {
      id: `MEM-${uniqueId(payload.clientId ?? "global", payload.title, String(Date.now()))}`,
      clientId: payload.clientId,
      kind: payload.kind,
      title: payload.title,
      note: payload.note,
      tags: payload.tags,
      source: payload.source,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await commitMutation(response, () => {
      database.insertMemory(memory);
    });
    return;
  }

  if (request.method === "DELETE" && /^\/api\/memories\/[^/]+$/.test(pathname)) {
    const memoryId = decodeURIComponent(pathname.slice("/api/memories/".length));
    await commitMutation(response, () => {
      database.deleteMemory(memoryId);
    });
    return;
  }

  if (request.method === "POST" && /^\/api\/clients\/[^/]+\/proposals$/.test(pathname)) {
    const clientId = clientIdFromUrl(pathname, "/proposals");
    const payload = proposalSchema.parse(await parseBody(request));
    const proposal: ClientProposal = {
      id: `PROP-${uniqueId(clientId, payload.packageName, String(Date.now()))}`,
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await commitMutation(response, () => {
      database.insertProposal(clientId, proposal);
      database.updateClient(clientId, {
        accountStatus: payload.status === "accepted" ? "won" : "proposal",
        closeProbability: payload.probability,
        valueEstimate: payload.price,
      });
    });
    return;
  }

  if (request.method === "PATCH" && /^\/api\/proposals\/[^/]+$/.test(pathname)) {
    const proposalId = decodeURIComponent(pathname.slice("/api/proposals/".length));
    const payload = proposalPatchSchema.parse(await parseBody(request));
    await commitMutation(response, () => {
      database.updateProposal(proposalId, payload);
      const state = database.getState();
      const client = state.clients.find((item) => item.proposals.some((proposal) => proposal.id === proposalId));
      if (client) {
        database.updateClient(client.clientId, {
          accountStatus:
            payload.status === "accepted"
              ? "won"
              : payload.status === "lost"
                ? "lost"
                : payload.status
                  ? "proposal"
                  : undefined,
          closeProbability: payload.probability,
          valueEstimate: payload.price,
        });
      }
    });
    return;
  }

  if (request.method === "POST" && /^\/api\/clients\/[^/]+\/comments$/.test(pathname)) {
    const clientId = clientIdFromUrl(pathname, "/comments");
    const payload = commentSchema.parse(await parseBody(request));
    const comment: ClientComment = {
      id: `COM-${uniqueId(clientId, payload.body, String(Date.now()))}`,
      author: payload.author,
      body: payload.body,
      createdAt: new Date().toISOString(),
      type: payload.type,
    };
    await commitMutation(response, () => {
      database.insertComment(clientId, comment);
    });
    return;
  }

  // ── ElevenLabs agent management ─────────────────────────────────────────────

  if (request.method === "GET" && pathname === "/api/elevenlabs/agents") {
    try {
      if (!isElevenLabsConfigured()) {
        sendJson(response, 200, { agents: [] });
        return;
      }
      const agents = await getElevenLabsAgents();
      sendJson(response, 200, { agents });
    } catch (err) {
      sendError(response, 500, String(err));
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/elevenlabs/voices") {
    try {
      if (!isElevenLabsConfigured()) {
        sendJson(response, 200, { voices: [] });
        return;
      }
      const voices = await getElevenLabsVoices();
      sendJson(response, 200, { voices });
    } catch (err) {
      sendError(response, 500, String(err));
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/elevenlabs/conversations") {
    const url = new URL(request.url ?? "/api/elevenlabs/conversations", `http://${host}:${port}`);
    const agentId = url.searchParams.get("agentId") ?? "";
    try {
      if (!isElevenLabsConfigured() || !agentId) {
        sendJson(response, 200, { conversations: [] });
        return;
      }
      const conversations = await getElevenLabsConversations(agentId, 50);
      sendJson(response, 200, { conversations });
    } catch (err) {
      sendError(response, 500, String(err));
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/elevenlabs/agents/save") {
    try {
      const body = await parseBody(request) as {
        agentId?: string;
        name: string;
        prompt: string;
        firstMessage: string;
        voiceId: string;
        language?: string;
      };
      if (!body.name || !body.prompt) {
        sendError(response, 400, "name and prompt are required");
        return;
      }
      if (!isElevenLabsConfigured()) {
        sendError(response, 503, "ELEVENLABS_API_KEY not configured");
        return;
      }
      let agent;
      if (body.agentId) {
        agent = await updateElevenLabsAgent(body.agentId, {
          name: body.name,
          prompt: body.prompt,
          firstMessage: body.firstMessage,
          voiceId: body.voiceId,
          language: body.language,
        });
      } else {
        agent = await createElevenLabsAgent({
          name: body.name,
          prompt: body.prompt,
          firstMessage: body.firstMessage,
          voiceId: body.voiceId,
          language: body.language,
        });
      }
      sendJson(response, 200, agent);
    } catch (err) {
      sendError(response, 500, String(err));
    }
    return;
  }

  // ── Overnight automation pipeline ────────────────────────────────────────────

  if (request.method === "GET" && pathname === "/api/automation/readiness") {
    sendJson(response, 200, buildAutomationReadinessPayload());
    return;
  }

  if (request.method === "GET" && pathname === "/api/automation/hourly") {
    sendJson(response, 200, hourlyAutopilotPayload());
    return;
  }

  if (request.method === "POST" && pathname === "/api/automation/hourly") {
    const body = hourlyAutomationSchema.parse(await parseBody(request));
    hourlyAutopilotConfig = {
      ...hourlyAutopilotConfig,
      ...(body.enabled !== undefined ? {enabled: body.enabled} : {}),
      ...(body.intervalMinutes !== undefined ? {intervalMinutes: body.intervalMinutes} : {}),
      ...(body.searchQuery !== undefined ? {searchQuery: body.searchQuery} : {}),
      ...(body.location !== undefined ? {location: body.location} : {}),
      ...(body.maxLeads !== undefined ? {maxLeads: body.maxLeads} : {}),
      ...(body.minScore !== undefined ? {minScore: body.minScore} : {}),
      ...(body.generateImages !== undefined ? {generateImages: body.generateImages} : {}),
      ...(body.sendEmails !== undefined ? {sendEmails: body.sendEmails} : {}),
    };
    await saveHourlyAutopilotConfig();
    scheduleHourlyAutopilot();
    if (body.runNow) {
      void runHourlyAutopilot("manual").catch((error) => {
        console.error("[Hourly autopilot] Manual run failed:", error);
      });
    }
    sendJson(response, 200, hourlyAutopilotPayload());
    return;
  }

  if (request.method === "GET" && pathname === "/api/automation/status") {
    const pipeline = await import("@/automation/overnight-pipeline");
    const status = pipeline.getPipelineStatus();
    sendJson(response, 200, status ?? { status: "idle", steps: [], leadResults: [] });
    return;
  }

  if (request.method === "GET" && pathname === "/api/automation/history") {
    const url = new URL(request.url ?? "/api/automation/history", `http://${host}:${port}`);
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
    const pipeline = await import("@/automation/overnight-pipeline");
    sendJson(response, 200, {
      generatedAt: new Date().toISOString(),
      runs: pipeline.getPipelineHistory(Number.isFinite(limit) ? limit : 20),
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/automation/run") {
    const body = await parseBody(request) as {
      searchQuery?: string;
      location?: string;
      maxLeads?: number;
      minScore?: number;
      generateImages?: boolean;
      runBrowserAudit?: boolean;
      sendEmails?: boolean;
      emailSubject?: string;
      emailBody?: string;
    };
    if (!body.searchQuery) {
      sendError(response, 400, "searchQuery is required");
      return;
    }
    const pipeline = await import("@/automation/overnight-pipeline");
    const current = pipeline.getPipelineStatus();
    if (current?.status === "running") {
      sendError(response, 409, "Pipeline is already running. Abort it first.");
      return;
    }
    const config = {
      searchQuery: body.searchQuery,
      location: body.location,
      maxLeads: body.maxLeads ?? 10,
      minScore: body.minScore ?? 40,
      generateImages: body.generateImages !== false,
      runBrowserAudit: body.runBrowserAudit !== false,
      sendEmails: body.sendEmails === true,
      emailSubject: body.emailSubject,
      emailBody: body.emailBody,
      rateDelayMs: 3000,
    };
    // Fire and forget — pipeline runs in background
    pipeline.runOvernightPipeline(config, database).catch((err) => {
      console.error("[Pipeline] Fatal error:", err);
    });
    await new Promise(resolve => setTimeout(resolve, 150));
    const started = pipeline.getPipelineStatus();
    sendJson(response, 200, started ?? { status: "running" });
    return;
  }

  if (request.method === "POST" && pathname === "/api/automation/abort") {
    const pipeline = await import("@/automation/overnight-pipeline");
    pipeline.abortPipeline();
    sendJson(response, 200, { ok: true, message: "Abort signal sent" });
    return;
  }

  // ── Tunnel management ────────────────────────────────────────────────────
  if (request.method === "GET" && pathname === "/api/tunnel/status") {
    sendJson(response, 200, getTunnelState());
    return;
  }
  if (request.method === "POST" && pathname === "/api/tunnel/start") {
    startTunnel()
      .then((s) => sendJson(response, 200, s))
      .catch((e) => sendError(response, 500, String(e)));
    return;
  }
  if (request.method === "POST" && pathname === "/api/tunnel/stop") {
    stopTunnel();
    sendJson(response, 200, { ok: true });
    return;
  }

  // ── Integration control plane ─────────────────────────────────────────────
  if (request.method === "GET" && pathname === "/api/integrations/status") {
    sendJson(response, 200, integrationStatusPayload());
    return;
  }

  if (request.method === "POST" && pathname === "/api/integrations/sync") {
    const payload = integrationSyncSchema.parse(await parseBody(request));
    const providers = payload.provider
      ? [payload.provider]
      : (["gmail", "plaid", "revenuecat", "appstore"] as const);
    const results = [];
    for (const provider of providers) {
      results.push(await syncIntegrationProvider(provider));
    }
    sendJson(response, 200, {
      generatedAt: new Date().toISOString(),
      results,
      status: integrationStatusPayload(),
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/plaid/link-token") {
    try {
      sendJson(response, 200, await createPlaidLinkToken());
    } catch (error) {
      sendError(response, 400, error instanceof Error ? error.message : "Plaid link token failed");
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/plaid/exchange-public-token") {
    try {
      const payload = plaidExchangeSchema.parse(await parseBody(request));
      const result = await exchangePlaidPublicToken(payload.publicToken);
      sendJson(response, 200, {
        ok: true,
        itemId: result.item_id,
        message: "Plaid access token exchanged. Store PLAID_ACCESS_TOKEN securely in .env.local before syncing transactions.",
      });
    } catch (error) {
      sendError(response, 400, error instanceof Error ? error.message : "Plaid public token exchange failed");
    }
    return;
  }

  // ── System health ─────────────────────────────────────────────────────────
  if (request.method === "GET" && pathname === "/api/system/health") {
    const integrationStatus = integrationStatusPayload();
    const connectorByProvider = new Map(integrationStatus.connectors.map((connector) => [connector.provider, connector]));
    const services = {
      twilio: {
        connected: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
        label: "Twilio",
        enables: "Outbound/inbound calls + SMS",
      },
      elevenlabs: {
        connected: !!process.env.ELEVENLABS_API_KEY,
        label: "ElevenLabs",
        enables: "AI voice agent (agent_1201kp6qhf3zfz9actd3d8k7dv1q)",
      },
      firecrawl: {
        connected: !!process.env.FIRECRAWL_API_KEY,
        label: "Firecrawl",
        enables: "Web scraping + lead discovery",
      },
      stripe: {
        connected: !!(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY),
        label: "Stripe",
        enables: "Invoicing + payment links",
      },
      kie: {
        connected: !!process.env.KIE_API_KEY,
        label: "KIE.ai",
        enables: "Hero image + video generation",
      },
      openai: {
        connected: !!process.env.OPENAI_API_KEY,
        label: "OpenAI",
        enables: "AI analysis + email drafting",
      },
      openclaw: {
        connected: !!(process.env.OPENCLAW_GATEWAY_URL || process.env.OPENCLAW_API_URL),
        label: "OpenClaw",
        enables: "Agent orchestration + memory",
      },
      gmail: {
        connected: connectorByProvider.get("gmail")?.connected ?? false,
        label: "Gmail",
        enables: "Live inbox, replies, outreach tracking, and message history",
      },
      apify: {
        connected: connectorByProvider.get("apify")?.connected ?? false,
        label: "Apify / Actors",
        enables: "Review scraping, Google Maps actors, and lead enrichment",
      },
      plaid: {
        connected: connectorByProvider.get("plaid")?.connected ?? false,
        label: "Plaid Banking",
        enables: "Bank balances, transactions, runway, and cashflow",
      },
      revenuecat: {
        connected: connectorByProvider.get("revenuecat")?.connected ?? false,
        label: "RevenueCat",
        enables: "App subscriptions, customers, and mobile revenue",
      },
      appstore: {
        connected: connectorByProvider.get("appstore")?.connected ?? false,
        label: "App Store Connect",
        enables: "Apple app downloads, sales reports, and app operations",
      },
    };
    const tunnel = getTunnelState();
    sendJson(response, 200, {
      services,
      integrations: integrationStatus,
      tunnel,
      version: "HAMID.OS v2.1",
      uptime: process.uptime(),
    });
    return;
  }

  // ── Call status callback ──────────────────────────────────────────────────
  if (request.method === "POST" && pathname === "/api/calls/status") {
    const body = await parseBody(request);
    console.log("[Twilio Status Callback]", body);
    sendJson(response, 200, { ok: true });
    return;
  }

  // ── SMS inbound webhook ───────────────────────────────────────────────────
  if (request.method === "POST" && pathname === "/api/sms/webhook") {
    const body = await parseBody(request);
    console.log("[Twilio SMS Webhook]", body);
    const from = String((body as Record<string, unknown>).From ?? "");
    const messageBody = String((body as Record<string, unknown>).Body ?? "").trim();
    const matched = from ? findAccountByPhone(from) : null;
    if (matched?.account && messageBody) {
      database.addTimelineEvent(matched.account.clientId, {
        id: `TL-${uniqueId(matched.account.clientId, "sms-inbound", String(Date.now()))}`,
        eventType: "Reply received",
        timestamp: new Date().toISOString(),
        contactName: (matched.contact?.fullName as string | undefined) ?? null,
        notes: `Inbound SMS from ${from}\n\n${messageBody}`,
        duration: null,
        followUpDate: null,
        loggedBy: "Twilio SMS",
        metadata: {
          messageSid: (body as Record<string, unknown>).MessageSid ?? null,
          from,
        },
      });
      database.addNote(
        matched.account.clientId,
        `Inbound SMS from ${from}\n\n${messageBody}`,
      );
    }
    sendJson(response, 200, { ok: true });
    return;
  }

  sendError(response, 404, "API route not found");
}

const server = http.createServer(async (request, response) => {
  const startTime = Date.now();
  response.on("finish", () => {
    const duration = Date.now() - startTime;
    const method = request.method ?? "?";
    const url = request.url ?? "/";
    const status = response.statusCode;
    if (url !== "/events" && url !== "/favicon.ico") {
      console.log(`[${new Date().toISOString()}] ${method} ${url} ${status} ${duration}ms`);
    }
  });
  try {
    const clientIp = request.socket.remoteAddress ?? "unknown";
    if (!checkRateLimit(clientIp)) {
      sendError(response, 429, "Too many requests. Please slow down.");
      return;
    }

    const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);

    if (requestUrl.pathname === "/events") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });
      response.write(": connected\n\n");
      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }

    if (requestUrl.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204, corsHeaders);
      response.end();
      return;
    }

    if (requestUrl.pathname.startsWith("/api/")) {
      await handleApi(request, response, requestUrl.pathname);
      return;
    }

    if (requestUrl.pathname === "/" || requestUrl.pathname === "/dashboard") {
      await serveFrontend(response, "/");
      return;
    }

    await serveFrontend(response, requestUrl.pathname);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(response, 400, `Validation failed: ${error.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`).join("; ")}`);
    } else if (error instanceof Error && error.message.includes("not found")) {
      sendError(response, 404, error.message);
    } else if (error instanceof Error && (error.message.includes("Invalid JSON") || error.message.includes("exceeds"))) {
      sendError(response, 400, error.message);
    } else {
      sendError(response, 500, error instanceof Error ? error.message : "Unexpected error");
    }
  }
});

async function boot() {
  server.listen(port, host, () => {
    console.log(`Dashboard live at http://${host}:${port}`);
    console.log(`SQLite CRM active at ${outputFiles.crmDatabase}`);
    console.log("Watching output/ for pipeline updates...");
  });

  void (async () => {
    try {
      await loadHourlyAutopilotConfig();
      scheduleHourlyAutopilot();
      await hydrateFromPipelineIfPresent();
      openClawService.start();
      await refreshDashboardFile();
    } catch (error) {
      console.error("Startup hydration failed:", error);
    }
  })();

  fs.watch(outputDir, {recursive: true}, async (_eventType, filename) => {
    if (!filename) return;
    const basename = path.basename(filename);
    if (basename === path.basename(outputFiles.crmJson)) {
      await hydrateFromPipelineIfPresent();
      await refreshDashboardFile();
      broadcastRefresh();
      return;
    }

    if (basename !== path.basename(outputFiles.crmDatabase)) {
      broadcastRefresh();
    }
  });
}

openClawService.subscribe((event) => {
  for (const client of openClawStreamClients) {
    client.write(`event: activity\ndata: ${JSON.stringify(event)}\n\n`);
  }
});

function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down...`);
  for (const client of clients) {
    client.end();
  }
  for (const client of openClawStreamClients) {
    client.end();
  }
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5_000);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

boot().catch((error) => {
  console.error(error);
  process.exit(1);
});
