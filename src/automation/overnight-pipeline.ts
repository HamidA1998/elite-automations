/**
 * Overnight automation pipeline.
 *
 * Steps:
 *  1. Search for businesses with Firecrawl
 *  2. Score each lead
 *  3. Generate hero image with KIE.ai
 *  4. Draft personalised outreach email
 *  5. Send email (if SMTP configured)
 *  6. Log everything to SQLite timeline
 */

import { EliteOpsDatabase } from "@/database";
import { runBrowserAudit } from "@/browser-audit";
import { searchBusinesses, scrapeWebsite } from "@/firecrawl";
import { generateImageAsset } from "@/kie";
import { brand } from "@/config";
import { uniqueId } from "@/utils";
import { createEmail } from "@/email";
import path from "node:path";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import nodemailer from "nodemailer";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PipelineStatus = "idle" | "running" | "completed" | "failed" | "paused";

export interface PipelineStepLog {
  step: string;
  status: "ok" | "skip" | "error";
  message: string;
  timestamp: string;
}

export interface PipelineResult {
  runId: string;
  status: PipelineStatus;
  startedAt: string;
  finishedAt: string | null;
  totalLeads: number;
  processed: number;
  emailsSent: number;
  emailsDrafted: number;
  imagesGenerated: number;
  errors: number;
  steps: PipelineStepLog[];
  leadResults: LeadPipelineResult[];
}

export interface LeadPipelineResult {
  businessName: string;
  url: string;
  score: number;
  clientId: string | null;
  imageGenerated: boolean;
  browserAudited: boolean;
  browserAuditScreenshot: string | null;
  emailSent: boolean;
  emailDrafted: boolean;
  error: string | null;
}

export interface PipelineConfig {
  searchQuery: string;
  location?: string;
  maxLeads?: number;
  minScore?: number;
  generateImages?: boolean;
  runBrowserAudit?: boolean;
  sendEmails?: boolean;
  emailSubject?: string;
  emailBody?: string;
  rateDelayMs?: number;
  requireApprovalBeforeSend?: boolean;
}

// ─── Singleton state (in-memory, server-scoped) ───────────────────────────────

let currentPipeline: PipelineResult | null = null;
let pipelineAbortController: AbortController | null = null;
const pipelineHistoryDir = path.join(process.cwd(), "output", "automation-runs");
const latestPipelinePath = path.join(pipelineHistoryDir, "latest.json");

export function getPipelineStatus(): PipelineResult | null {
  return currentPipeline ?? readPipelineSnapshot(latestPipelinePath);
}

export function getPipelineHistory(limit = 20): PipelineResult[] {
  try {
    if (!fsSync.existsSync(pipelineHistoryDir)) return [];
    return fsSync.readdirSync(pipelineHistoryDir)
      .filter((fileName) => fileName.endsWith(".json") && fileName !== "latest.json")
      .map((fileName) => readPipelineSnapshot(path.join(pipelineHistoryDir, fileName)))
      .filter((run): run is PipelineResult => Boolean(run))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, Math.max(1, Math.min(limit, 100)));
  } catch {
    return [];
  }
}

export function abortPipeline(): void {
  pipelineAbortController?.abort();
}

function readPipelineSnapshot(filePath: string): PipelineResult | null {
  try {
    if (!fsSync.existsSync(filePath)) return null;
    return JSON.parse(fsSync.readFileSync(filePath, "utf8")) as PipelineResult;
  } catch {
    return null;
  }
}

async function persistPipelineSnapshot(result: PipelineResult): Promise<void> {
  try {
    await fs.mkdir(pipelineHistoryDir, {recursive: true});
    const payload = JSON.stringify(result, null, 2);
    const safeRunId = result.runId.replace(/[^a-zA-Z0-9._-]/g, "-");
    await Promise.all([
      fs.writeFile(path.join(pipelineHistoryDir, `${safeRunId}.json`), payload, "utf8"),
      fs.writeFile(latestPipelinePath, payload, "utf8"),
    ]);
  } catch (error) {
    console.error(`[Pipeline ${result.runId}] Failed to persist run snapshot:`, error);
  }
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function runOvernightPipeline(
  config: PipelineConfig,
  database: EliteOpsDatabase,
): Promise<PipelineResult> {
  if (currentPipeline?.status === "running") {
    throw new Error("Pipeline is already running. Abort it first.");
  }

  pipelineAbortController = new AbortController();
  const { signal } = pipelineAbortController;

  const runId = uniqueId("pipe", "run", String(Date.now()));
  const result: PipelineResult = {
    runId,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    totalLeads: 0,
    processed: 0,
    emailsSent: 0,
    emailsDrafted: 0,
    imagesGenerated: 0,
    errors: 0,
    steps: [],
    leadResults: [],
  };
  currentPipeline = result;
  await persistPipelineSnapshot(result);

  const log = (step: string, status: PipelineStepLog["status"], message: string) => {
    result.steps.push({ step, status, message, timestamp: new Date().toISOString() });
    console.log(`[Pipeline ${runId}] ${step}: ${message}`);
    void persistPipelineSnapshot(result);
  };

  try {
    // ── Step 1: Search ────────────────────────────────────────────────────────
    const location = config.location ?? "Greater Manchester";
    log("search", "ok", `Searching: "${config.searchQuery}" in ${location}`);

    const requestedLeads = config.maxLeads ?? 20;
    const rawSearchHits = await searchBusinesses(config.searchQuery, location, Math.min(requestedLeads * 3, 150));
    const skippedDirectoryHits = rawSearchHits.filter((hit) =>
      isDirectoryOrListResult(
        String(hit.metadata?.["og:site_name"] ?? hit.title ?? hit.url ?? "Unknown lead"),
        hit.url ?? "",
      ),
    );
    const searchHits = dedupeHits(rawSearchHits
      .filter((hit) =>
        !isDirectoryOrListResult(
          String(hit.metadata?.["og:site_name"] ?? hit.title ?? hit.url ?? "Unknown lead"),
          hit.url ?? "",
        ),
      ))
      .slice(0, requestedLeads);
    result.totalLeads = searchHits.length;
    log("search", "ok", `Found ${searchHits.length} direct business website candidate${searchHits.length === 1 ? "" : "s"}`);
    if (skippedDirectoryHits.length > 0) {
      log("search", "skip", `Skipped ${skippedDirectoryHits.length} directory/listing result${skippedDirectoryHits.length === 1 ? "" : "s"} before processing`);
    }

    if (searchHits.length === 0) {
      log("search", "skip", "No leads found — pipeline complete");
      result.status = "completed";
      result.finishedAt = new Date().toISOString();
      await persistPipelineSnapshot(result);
      return result;
    }

    // ── Step 2: Process each lead ─────────────────────────────────────────────
    const maxLeads = Math.min(searchHits.length, requestedLeads);
    const delay = config.rateDelayMs ?? 3000;

    for (let i = 0; i < maxLeads; i++) {
      if (signal.aborted) {
        log("abort", "skip", "Pipeline aborted by user");
        result.status = "paused";
        result.finishedAt = new Date().toISOString();
        await persistPipelineSnapshot(result);
        return result;
      }

      const hit = searchHits[i] as {
        title?: string;
        url?: string;
        description?: string;
        metadata?: Record<string, string>;
      };
      const businessName = hit.metadata?.["og:site_name"] ?? hit.title ?? hit.url ?? `Lead ${i + 1}`;
      const url = hit.url ?? "";

      const leadResult: LeadPipelineResult = {
        businessName,
        url,
        score: 0,
        clientId: null,
        imageGenerated: false,
        browserAudited: false,
        browserAuditScreenshot: null,
        emailSent: false,
        emailDrafted: false,
        error: null,
      };
      result.leadResults.push(leadResult);
      let browserAuditFlaws: string[] = [];

      log(`lead[${i}]`, "ok", `Processing: ${businessName}`);

      try {
        if (isDirectoryOrListResult(businessName, url)) {
          leadResult.error = "Skipped directory/listing result; not a direct business website.";
          log(`lead[${i}]`, "skip", `Skipped directory/listing result: ${businessName}`);
          result.processed++;
          continue;
        }

        // ── 2a: Scrape & score ──────────────────────────────────────────────
        let scrapedText = "";
        let extractedEmail: string | null = null;
        let extractedPhone: string | null = null;
        if (url) {
          try {
            const scraped = await withTimeout(scrapeWebsite(url), 45_000, `Scrape timed out for ${url}`);
            scrapedText = (scraped.markdown ?? scraped.html ?? "").slice(0, 2000);
            extractedEmail = extractEmail(scrapedText);
            extractedPhone = extractPhone(scrapedText);
          } catch {
            // non-fatal
          }
        }

        const score = scoreLeadFromContent(businessName, url, scrapedText);
        leadResult.score = score;

        if (score < (config.minScore ?? 40)) {
          log(`lead[${i}]`, "skip", `Score ${score} below threshold — skipping`);
          result.processed++;
          continue;
        }

        // ── 2b: Create/update client record ────────────────────────────────
        const area = location;
        const accounts = database.getAccounts(1, 500);
        const existing = accounts.find(
          (l) =>
            l.businessName?.toLowerCase() === businessName.toLowerCase() ||
            (url && l.websiteUrl === url),
        );

        let clientId: string;
        if (existing) {
          clientId = existing.clientId;
          leadResult.clientId = clientId;
          log(`lead[${i}]`, "ok", `Found existing client: ${clientId}`);
        } else {
          clientId = database.createClient({
            businessName,
            businessType: extractBusinessType(businessName, scrapedText),
            area,
            websiteUrl: url || null,
            emailAddress: extractedEmail,
            phoneNumber: extractedPhone,
            accountStatus: "researched",
            siteScore: score,
            sourceNotes: `Auto-discovered via pipeline run ${runId}`,
          });
          leadResult.clientId = clientId;
          log(`lead[${i}]`, "ok", `Created client record: ${clientId}`);
        }

        // ── 2c: Generate hero image ─────────────────────────────────────────
        if (config.generateImages !== false && clientId) {
          try {
            const outputPath = path.join(process.cwd(), "output", clientId, "hero.png");
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await generateImageAsset(
              outputPath,
              buildImagePrompt(businessName, area),
              businessName,
              area,
            );
            database.updateClient(clientId, { heroImage: `output/${clientId}/hero.png` });
            leadResult.imageGenerated = true;
            result.imagesGenerated++;
            log(`lead[${i}]`, "ok", `Hero image generated`);
          } catch (imgErr) {
            log(`lead[${i}]`, "error", `Image gen failed: ${String(imgErr)}`);
          }
        }

        if (clientId && (extractedEmail || extractedPhone)) {
          database.updateClient(clientId, {
            ...(extractedEmail ? {emailAddress: extractedEmail} : {}),
            ...(extractedPhone ? {phoneNumber: extractedPhone} : {}),
          });
        }

        // ── 2d: Human-style Playwright audit with screenshots and evidence. ─
        if (config.runBrowserAudit !== false && clientId && url) {
          try {
            const audit = await withTimeout(
              runBrowserAudit({
                clientId,
                websiteUrl: url,
                businessName,
                businessType: extractBusinessType(businessName, scrapedText),
                area,
              }),
              90_000,
              `Browser audit timed out for ${url}`,
            );
            database.saveBrowserAudit(clientId, {
              id: uniqueId("ba", clientId, String(Date.now())),
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
            database.addTimelineEvent(clientId, {
              id: uniqueId("tl", "browser-audit", String(Date.now())),
              eventType: "Browser audit completed",
              timestamp: audit.auditedAt,
              contactName: null,
              notes: audit.summary,
              duration: Math.max(1, Math.round(audit.evidence.loadMs / 1000)),
              followUpDate: null,
              loggedBy: "automation",
              metadata: {
                runId,
                screenshotPath: audit.evidence.screenshotPath,
                finalUrl: audit.evidence.finalUrl,
                pagesVisited: audit.evidence.pagesVisited.length,
              },
            });
            const auditEmail = audit.evidence.emails[0];
            const auditPhone = audit.evidence.phones[0];
            if (auditEmail || auditPhone) {
              extractedEmail ??= auditEmail ?? null;
              extractedPhone ??= auditPhone ?? null;
              database.updateClient(clientId, {
                ...(auditEmail ? {emailAddress: auditEmail} : {}),
                ...(auditPhone ? {phoneNumber: auditPhone} : {}),
              });
            }
            browserAuditFlaws = audit.flaws;
            leadResult.browserAudited = true;
            leadResult.browserAuditScreenshot = audit.evidence.screenshotPath;
            log(`lead[${i}]`, "ok", `Browser audit saved: ${audit.evidence.pagesVisited.length} page${audit.evidence.pagesVisited.length === 1 ? "" : "s"} inspected`);
          } catch (auditErr) {
            log(`lead[${i}]`, "error", `Browser audit failed: ${String(auditErr)}`);
          }
        }

        // ── 2e: Draft/log outreach. Sending remains approval/transport gated. ─
        if (config.sendEmails && clientId) {
          try {
            const businessType = extractBusinessType(businessName, scrapedText);
            const topProblems = browserAuditFlaws.length ? browserAuditFlaws.slice(0, 3) : inferTopProblems(scrapedText);
            const email = createEmail({
              businessName,
              businessType,
              area,
              emailAddress: extractedEmail,
              audit: { topProblems },
            } as Parameters<typeof createEmail>[0]);
            const emailSubject = config.emailSubject ?? email.subject;
            const emailBody = appendComplianceFooter(config.emailBody ?? email.body, runId);
            const emailPath = path.join(process.cwd(), "output", clientId, "outreach-email.txt");
            await fs.mkdir(path.dirname(emailPath), { recursive: true });
            await fs.writeFile(emailPath, emailBody, "utf8");
            database.updateClient(clientId, { emailFile: `output/${clientId}/outreach-email.txt` });

            const transportConfigured = Boolean(
              process.env.GMAIL_REFRESH_TOKEN ||
              (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
            );
            const sendAllowed = process.env.AUTOPILOT_ALLOW_COLD_EMAIL_SEND === "true" && config.requireApprovalBeforeSend === false;
            const canSend = Boolean(extractedEmail && transportConfigured && sendAllowed);
            let sentMessageId: string | null = null;
            if (canSend && extractedEmail) {
              sentMessageId = await sendOutreachEmail({
                to: extractedEmail,
                subject: emailSubject,
                body: emailBody,
              });
              leadResult.emailSent = true;
              result.emailsSent++;
              database.updateClient(clientId, {
                accountStatus: "contacted",
                lastContactedAt: new Date().toISOString(),
              });
            }
            database.addTimelineEvent(clientId, {
              id: uniqueId("tl", "pipe", String(Date.now())),
              eventType: sentMessageId ? "Email sent" : canSend ? "Email queued" : "Email draft generated",
              timestamp: new Date().toISOString(),
              contactName: businessName,
              notes: sentMessageId
                ? `[Pipeline] Email sent via approved transport. Subject: ${emailSubject}. Message: ${sentMessageId}`
                : canSend
                  ? `[Pipeline] Approved transport available. Email queued for send review: ${emailSubject}`
                : `[Pipeline] Draft created at output/${clientId}/outreach-email.txt. ${outreachBlockReason(extractedEmail, transportConfigured, sendAllowed)} Subject: ${emailSubject}`,
              duration: null,
              followUpDate: null,
              loggedBy: "automation",
              metadata: {
                runId,
                recipient: extractedEmail,
                subject: emailSubject,
                transportConfigured,
                sendAllowed,
                requiresApproval: !sendAllowed,
                topProblems,
              },
            });
            leadResult.emailDrafted = true;
            result.emailsDrafted++;
            log(
              `lead[${i}]`,
              canSend ? "ok" : "skip",
                sentMessageId
                ? "Email sent via approved transport"
                : canSend
                ? "Email queued for approved transport send"
                : `Email draft logged; ${outreachBlockReason(extractedEmail, transportConfigured, sendAllowed)}`,
            );
          } catch (emailErr) {
            log(`lead[${i}]`, "error", `Email failed: ${String(emailErr)}`);
          }
        }

        result.processed++;

      } catch (leadErr) {
        leadResult.error = String(leadErr);
        result.errors++;
        log(`lead[${i}]`, "error", `Lead processing failed: ${String(leadErr)}`);
      }

      // Rate limit
      if (i < maxLeads - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    result.status = "completed";
    result.finishedAt = new Date().toISOString();
    log("done", "ok", `Pipeline complete. Processed ${result.processed}/${result.totalLeads} leads. ${result.emailsSent} emails. ${result.imagesGenerated} images.`);
    await persistPipelineSnapshot(result);

  } catch (err) {
    result.status = "failed";
    result.finishedAt = new Date().toISOString();
    log("fatal", "error", `Pipeline failed: ${String(err)}`);
    await persistPipelineSnapshot(result);
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreLeadFromContent(businessName: string, url: string, content: string): number {
  let score = 50;
  if (url) score += 10;
  const lower = content.toLowerCase();
  if (lower.includes("contact") || lower.includes("enquire")) score += 5;
  if (lower.includes("about us") || lower.includes("our team")) score += 5;
  if (lower.includes("services") || lower.includes("pricing")) score += 5;
  if (lower.length < 500) score -= 15;
  if (lower.length > 3000) score += 10;
  if (!lower.includes("review") && !lower.includes("testimonial")) score += 5;
  const nameLower = businessName.toLowerCase();
  if (nameLower.includes("ltd") || nameLower.includes("limited")) score += 5;
  if (nameLower.includes("group")) score += 3;
  return Math.min(100, Math.max(0, score));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function isDirectoryOrListResult(title: string, url: string): boolean {
  const haystack = `${title} ${url}`.toLowerCase();
  return [
    "tripadvisor.",
    "yelp.",
    "yell.com",
    "fmb.org.uk",
    "checkatrade.com",
    "ratedpeople.com",
    "mybuilder.com",
    "find-and-update.company-information.service.gov.uk",
    "companies house",
    "gov.uk/company",
    "find-a-builder",
    "browse tradespeople",
    "find-open.",
    "directory",
    "/search?",
    "/search/",
    "the best ",
    "very best",
    "top 10",
    "10 best",
    "best restaurants",
    "restaurants in ",
  ].some((signal) => haystack.includes(signal));
}

function dedupeHits<T extends {url?: string; title?: string; metadata?: Record<string, unknown>}>(hits: T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const hit of hits) {
    const urlKey = hit.url ? normalizeHitUrl(hit.url) : "";
    const nameKey = String(hit.metadata?.["og:site_name"] ?? hit.title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const key = urlKey || nameKey;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(hit);
  }
  return output;
}

function normalizeHitUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return value.toLowerCase().split(/[?#]/)[0]?.replace(/\/$/, "") ?? value.toLowerCase();
  }
}

function extractBusinessType(name: string, content: string): string {
  const lower = (name + " " + content).toLowerCase();
  if (lower.includes("restaurant") || lower.includes("café") || lower.includes("cafe")) return "Restaurant";
  if (lower.includes("salon") || lower.includes("beauty") || lower.includes("hair")) return "Beauty & Wellness";
  if (lower.includes("plumber") || lower.includes("plumbing")) return "Plumbing";
  if (lower.includes("electric")) return "Electrical";
  if (lower.includes("garage") || lower.includes("mechanic")) return "Automotive";
  if (lower.includes("accountant")) return "Accountancy";
  if (lower.includes("solicitor") || lower.includes("law")) return "Legal";
  if (lower.includes("dental") || lower.includes("dentist")) return "Dental";
  if (lower.includes("gym") || lower.includes("fitness")) return "Fitness";
  if (lower.includes("estate agent") || lower.includes("property")) return "Estate Agency";
  return "Local Business";
}

function buildImagePrompt(businessName: string, area: string): string {
  return `Professional hero banner for a local business called "${businessName}" in ${area}. Modern, clean design with dark gradient overlay, suitable for a website homepage. High quality, photorealistic, premium brand feel.`;
}

function extractEmail(content: string): string | null {
  const match = content.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  if (!match) return null;
  const email = match[0].toLowerCase();
  if (/example\.com|domain\.com|yourname|test@/.test(email)) return null;
  return email;
}

function extractPhone(content: string): string | null {
  const match = content.match(/(?:\+44\s?7\d{3}|\+44\s?\d{2,4}|\(?0\d{3,4}\)?)\s?\d{3}\s?\d{3,4}/);
  return match?.[0]?.trim() ?? null;
}

function inferTopProblems(content: string): string[] {
  const lower = content.toLowerCase();
  const problems = [
    lower.includes("book now") || lower.includes("get a quote") || lower.includes("contact us")
      ? ""
      : "there is no obvious booking or quote action visible in the scraped content",
    lower.includes("review") || lower.includes("testimonial") || lower.includes("trustpilot") || lower.includes("5 star")
      ? ""
      : "review proof and trust signals are not prominent enough",
    lower.includes("automation") || lower.includes("online booking") || lower.includes("callback")
      ? ""
      : "there may be missed opportunities to automate enquiries, bookings, or missed-call follow-up",
  ].filter(Boolean);
  return problems.length ? problems : ["the site could convert more local visitors with a clearer offer, stronger proof, and faster enquiry flow"];
}

function appendComplianceFooter(body: string, runId: string) {
  const footer = [
    "",
    "---",
    "This is a business enquiry from Elite Automations about improving your website, enquiry flow, or automation setup.",
    "If this is not relevant, reply 'unsubscribe' and we will not contact you again.",
    `${brand.businessName} | ${brand.domain} | Reference: ${runId}`,
  ].join("\n");
  return body.includes("unsubscribe") ? body : `${body.trim()}\n${footer}\n`;
}

function outreachBlockReason(email: string | null, transportConfigured: boolean, sendAllowed: boolean) {
  if (!email) return "No recipient email was found, so nothing was sent.";
  if (!transportConfigured) return "Gmail/SMTP transport is not configured, so nothing was sent.";
  if (!sendAllowed) return "AUTOPILOT_ALLOW_COLD_EMAIL_SEND is not enabled, so this requires approval before sending.";
  return "Queued.";
}

async function sendOutreachEmail(input: {to: string; subject: string; body: string}) {
  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {
    const accessToken = await getGmailAccessToken();
    const from = process.env.GMAIL_USER_EMAIL || process.env.SMTP_FROM || "me";
    const raw = Buffer.from([
      `From: ${from}`,
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      input.body,
    ].join("\r\n"), "utf8").toString("base64url");
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({raw}),
    });
    const payload = await response.json().catch(() => ({})) as {id?: string; error?: unknown};
    if (!response.ok) {
      throw new Error(`Gmail send failed (${response.status}): ${JSON.stringify(payload)}`);
    }
    return payload.id ?? "gmail-message";
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM ?? `Hamid <noreply@${brand.domain}>`,
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
    return info.messageId;
  }

  throw new Error("No Gmail or SMTP transport is configured.");
}

async function getGmailAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID ?? "",
      client_secret: process.env.GMAIL_CLIENT_SECRET ?? "",
      refresh_token: process.env.GMAIL_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
  });
  const payload = await response.json().catch(() => ({})) as {access_token?: string};
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google OAuth token refresh failed: ${JSON.stringify(payload)}`);
  }
  return payload.access_token;
}
