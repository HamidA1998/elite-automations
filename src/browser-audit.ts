import fs from "node:fs/promises";
import path from "node:path";

import {outputDir} from "@/config";
import {extractVisibleText} from "@/firecrawl";
import {slugify} from "@/utils";

export interface BrowserAuditEvidence {
  title: string;
  finalUrl: string;
  screenshotPath: string;
  loadMs: number;
  consoleErrors: string[];
  failedRequests: Array<{url: string; error: string}>;
  headings: string[];
  buttons: string[];
  links: Array<{text: string; href: string}>;
  forms: number;
  metaDescription: string;
  emails: string[];
  phones: string[];
  pagesVisited: Array<{url: string; title: string; textSample: string}>;
}

export interface BrowserAuditResult {
  clientId: string;
  url: string;
  auditedAt: string;
  evidence: BrowserAuditEvidence;
  scores: Record<string, number>;
  flaws: string[];
  opportunities: string[];
  plan: string[];
  summary: string;
}

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+44\s?7\d{3}|\(?0\d{3,5}\)?|\+44\s?\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;

function unique(values: string[], limit = 12) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}

function score(condition: boolean, good = 9, bad = 3) {
  return condition ? good : bad;
}

function compactText(value: string, limit = 220) {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function localPathForScreenshot(clientId: string, url: string) {
  const hostname = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "website";
    }
  })();
  return path.join(outputDir, "browser-audits", clientId, `${slugify(hostname)}-${Date.now()}.png`);
}

function internalUrlCandidates(origin: string, links: Array<{text: string; href: string}>) {
  const preferred = ["service", "about", "contact", "book", "price", "quote", "portfolio", "project"];
  const candidates = links
    .filter((link) => {
      try {
        const url = new URL(link.href);
        return url.origin === origin;
      } catch {
        return false;
      }
    })
    .sort((a, b) => {
      const aText = `${a.text} ${a.href}`.toLowerCase();
      const bText = `${b.text} ${b.href}`.toLowerCase();
      const aScore = preferred.some((term) => aText.includes(term)) ? 0 : 1;
      const bScore = preferred.some((term) => bText.includes(term)) ? 0 : 1;
      return aScore - bScore;
    });
  return unique(candidates.map((candidate) => candidate.href), 3);
}

function buildScores(evidence: BrowserAuditEvidence) {
  const text = `${evidence.title} ${evidence.metaDescription} ${evidence.headings.join(" ")} ${evidence.buttons.join(" ")}`.toLowerCase();
  const hasContact = evidence.emails.length > 0 || evidence.phones.length > 0 || /contact|call|quote|enquir/.test(text);
  const hasCTA = evidence.buttons.some((button) => /book|call|quote|contact|enquir|start|get/i.test(button));
  const hasTrust = /review|testimonial|rated|award|guarantee|insured|qualified|years|portfolio|case stud/.test(text);
  const hasUsefulHeading = evidence.headings.some((heading) => heading.length > 18);
  const loadedFastEnough = evidence.loadMs < 3500;
  const lowErrors = evidence.consoleErrors.length + evidence.failedRequests.length < 4;
  const hasForms = evidence.forms > 0;
  const hasEnoughPages = evidence.pagesVisited.length >= 2;

  return {
    designQuality: score(hasUsefulHeading && hasCTA, 8, 4),
    mobileResponsiveness: 7,
    pageSpeed: score(loadedFastEnough && lowErrors, 8, 4),
    clearHeadline: score(hasUsefulHeading, 8, 3),
    callToAction: score(hasCTA, 9, 3),
    contactVisibility: score(hasContact, 9, 2),
    trustSignals: score(hasTrust, 8, 3),
    seoBasics: score(Boolean(evidence.title && evidence.metaDescription), 8, 4),
    contentQuality: score(hasEnoughPages && evidence.headings.length >= 3, 8, 4),
    googleReviewsOnWebsite: score(/google|review|testimonial/i.test(text), 7, 2),
  };
}

function buildPlan(evidence: BrowserAuditEvidence, scores: Record<string, number>) {
  const flaws: string[] = [];
  const opportunities: string[] = [];
  const plan: string[] = [];

  if (scores.clearHeadline <= 4) flaws.push("The first screen does not clearly explain the offer or why someone should choose the business.");
  if (scores.callToAction <= 4) flaws.push("The site does not push visitors toward a clear booking, quote, or call action.");
  if (scores.contactVisibility <= 4) flaws.push("Contact routes are not visible enough for a ready-to-buy visitor.");
  if (scores.trustSignals <= 4) flaws.push("Trust proof is too light: reviews, guarantees, credentials, and project proof need to be more obvious.");
  if (scores.pageSpeed <= 5) flaws.push("The site produced slow-load or technical error signals during the browser run.");
  if (evidence.forms === 0) flaws.push("No obvious enquiry form was detected, which can lose quieter visitors who do not want to call.");

  opportunities.push("Build a sharper hero section with a direct promise, location signal, and high-friction problem solved.");
  opportunities.push("Add conversion blocks for quote requests, phone calls, service-area pages, and proof from previous work.");
  opportunities.push("Create a follow-up automation that captures every enquiry and reminds the business to respond fast.");
  opportunities.push("Use the audit evidence to send a personalised outreach email with two concrete fixes and a demo offer.");

  plan.push("Create a premium demo homepage showing a stronger headline, quote CTA, proof strip, services, gallery, reviews, and fast contact section.");
  plan.push("Draft a cold email that references the weakest two audit points and offers the demo as a no-pressure visual example.");
  plan.push("If they reply, offer a build package with website rebuild, enquiry tracking, missed-call capture, and follow-up automation.");

  return {
    flaws: flaws.length ? flaws : ["No critical flaw was detected, but the site can still be sharpened for conversion."],
    opportunities,
    plan,
  };
}

export async function runBrowserAudit(input: {
  clientId: string;
  websiteUrl: string;
  businessName: string;
  businessType: string;
  area: string;
}): Promise<BrowserAuditResult> {
  const {chromium} = await import("playwright");
  const browser = await chromium.launch({headless: true});
  const context = await browser.newContext({
    viewport: {width: 1440, height: 1200},
    userAgent: "EliteAutomationsAuditBot/1.0 (+https://eliteautomations.co.uk)",
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const failedRequests: Array<{url: string; error: string}> = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    failedRequests.push({url: request.url(), error: request.failure()?.errorText ?? "request failed"});
  });

  const startedAt = Date.now();
  try {
    await page.goto(input.websiteUrl, {waitUntil: "domcontentloaded", timeout: 45_000});
    await page.waitForLoadState("networkidle", {timeout: 12_000}).catch(() => undefined);
    const loadMs = Date.now() - startedAt;
    const finalUrl = page.url();
    const title = await page.title();
    const screenshotPath = localPathForScreenshot(input.clientId, finalUrl);
    await fs.mkdir(path.dirname(screenshotPath), {recursive: true});
    await page.screenshot({path: screenshotPath, fullPage: true});

    const pageData = await page.evaluate(`(() => {
      const text = document.body?.innerText ?? "";
      const anchors = Array.from(document.querySelectorAll("a[href]")).map((el) => el.getAttribute("href") ?? "").filter(Boolean);
      return {
        text,
        headings: Array.from(document.querySelectorAll("h1,h2,h3")).map((el) => (el.textContent ?? "").trim()).filter(Boolean).slice(0, 24),
        buttons: Array.from(document.querySelectorAll("button,a")).map((el) => (el.textContent ?? "").trim()).filter(Boolean).slice(0, 80),
        links: Array.from(document.querySelectorAll("a[href]")).map((el) => ({
          text: (el.textContent ?? "").trim(),
          href: el.href,
        })).filter((link) => link.href).slice(0, 120),
        forms: document.querySelectorAll("form,input,textarea,select").length,
        metaDescription: document.querySelector("meta[name='description']")?.getAttribute("content") ?? "",
        anchors,
      };
    })()`) as {
      text: string;
      headings: string[];
      buttons: string[];
      links: Array<{text: string; href: string}>;
      forms: number;
      metaDescription: string;
      anchors: string[];
    };

    const origin = new URL(finalUrl).origin;
    const pagesVisited: BrowserAuditEvidence["pagesVisited"] = [{
      url: finalUrl,
      title,
      textSample: compactText(pageData.text, 500),
    }];

    for (const url of internalUrlCandidates(origin, pageData.links)) {
      if (pagesVisited.some((visited) => visited.url === url)) continue;
      try {
        await page.goto(url, {waitUntil: "domcontentloaded", timeout: 20_000});
        const visitedTitle = await page.title();
        const html = await page.content();
        pagesVisited.push({
          url: page.url(),
          title: visitedTitle,
          textSample: compactText(extractVisibleText(html, null), 500),
        });
      } catch {
        // Keep the homepage audit useful even if secondary navigation fails.
      }
    }

    const evidence: BrowserAuditEvidence = {
      title,
      finalUrl,
      screenshotPath,
      loadMs,
      consoleErrors: unique(consoleErrors, 12),
      failedRequests: failedRequests.slice(0, 12),
      headings: unique(pageData.headings, 18),
      buttons: unique(pageData.buttons, 24),
      links: pageData.links.slice(0, 40),
      forms: pageData.forms,
      metaDescription: pageData.metaDescription,
      emails: unique(pageData.text.match(EMAIL_PATTERN) ?? [], 8),
      phones: unique(pageData.text.match(PHONE_PATTERN) ?? [], 8),
      pagesVisited,
    };
    const scores = buildScores(evidence);
    const plan = buildPlan(evidence, scores);
    const lowestScores = Object.entries(scores).sort((a, b) => a[1] - b[1]).slice(0, 3);

    return {
      clientId: input.clientId,
      url: input.websiteUrl,
      auditedAt: new Date().toISOString(),
      evidence,
      scores,
      ...plan,
      summary: `${input.businessName} was audited like a live buyer journey. Weakest areas: ${lowestScores.map(([key, value]) => `${key} ${value}/10`).join(", ")}.`,
    };
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}
