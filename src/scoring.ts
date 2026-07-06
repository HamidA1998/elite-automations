import {load} from "cheerio";

import type {AuditCategory, FirecrawlScrapeResult, Lead, LeadAudit} from "@/types";
import {normalizeWhitespace} from "@/text";

const ctaTerms = ["contact", "book", "call", "quote", "appointment", "enquiry", "enquire", "get started"];
const trustTerms = ["testimonial", "review", "award", "accredit", "certified", "trusted", "years experience"];

function containsAny(input: string, terms: string[]) {
  const lower = input.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(10, Math.round(value)));
}

function scorePageSpeed(html: string | null, markdown: string | null) {
  const size = (html?.length ?? 0) + (markdown?.length ?? 0);
  if (size < 80_000) return 8;
  if (size < 180_000) return 6;
  if (size < 320_000) return 4;
  return 2;
}

function scoreSeo($: ReturnType<typeof load>, html: string | null) {
  let score = 0;
  if ($("title").text().trim()) score += 4;
  if ($('meta[name="description"]').attr("content")?.trim()) score += 3;
  if ($("h1").first().text().trim()) score += 3;
  return clampScore(score);
}

export function auditLead(lead: Lead, scrape: FirecrawlScrapeResult): LeadAudit {
  const html = scrape.html ?? "";
  const markdown = scrape.markdown ?? "";
  const text = normalizeWhitespace(`${markdown}\n${html}`);
  const $ = load(html);

  const scores: Record<AuditCategory, number> = {
    designQuality: clampScore(
      2 +
        (html.includes("viewport") ? 2 : 0) +
        ($("img").length > 3 ? 2 : 0) +
        (html.includes("font-display") || html.includes("grid") || html.includes("flex") ? 2 : 0)
    ),
    mobileResponsiveness: clampScore((html.includes("viewport") ? 6 : 2) + (html.includes("@media") ? 3 : 0)),
    pageSpeed: scorePageSpeed(scrape.html, scrape.markdown),
    clearHeadline: clampScore(($("h1").first().text().trim().length > 20 ? 8 : 3) + (lead.businessType ? 1 : 0)),
    callToAction: clampScore((containsAny(text, ctaTerms) ? 7 : 2) + ($("button, a").length > 5 ? 1 : 0)),
    contactVisibility: clampScore((text.match(/(?:\+44|0)\s?(?:\d\s?){9,10}/g) ? 5 : 0) + (text.includes("@") ? 2 : 0) + (text.includes("address") ? 2 : 0)),
    trustSignals: clampScore((containsAny(text, trustTerms) ? 6 : 1) + ($("blockquote").length > 0 ? 2 : 0)),
    seoBasics: scoreSeo($, scrape.html),
    contentQuality: clampScore(text.length > 2000 ? 8 : text.length > 900 ? 5 : 2),
    googleReviewsOnWebsite: clampScore(text.toLowerCase().includes("google review") ? 8 : 0),
  };

  const scoreEntries = Object.entries(scores).sort((a, b) => a[1] - b[1]);
  const topProblems = scoreEntries.slice(0, 3).map(([key]) => {
    switch (key as AuditCategory) {
      case "designQuality":
        return "The design feels dated and doesn't signal a premium, current business.";
      case "mobileResponsiveness":
        return "The mobile experience looks weak or lacks clear responsive signals.";
      case "pageSpeed":
        return "The page appears heavy, which can hurt load speed and conversions.";
      case "clearHeadline":
        return "The homepage doesn't immediately explain what the business does.";
      case "callToAction":
        return "The site lacks a strong, obvious next step for visitors.";
      case "contactVisibility":
        return "Phone, email, or address details are not visible enough.";
      case "trustSignals":
        return "Trust-building proof like testimonials or accreditations is thin.";
      case "seoBasics":
        return "Basic SEO structure is weak or incomplete.";
      case "contentQuality":
        return "The content is thin and not persuasive enough.";
      case "googleReviewsOnWebsite":
        return "Google review proof is missing from the website.";
    }
  });

  const totalScore = Object.values(scores).reduce((sum, value) => sum + value, 0);

  return {
    leadId: lead.id,
    websiteUrl: lead.websiteUrl,
    scores,
    totalScore,
    topProblems,
    notes: [
      `Homepage text length: ${text.length} characters`,
      `Detected ${$("img").length} images and ${$("button, a").length} clickable elements`,
    ],
    scrapeMarkdown: scrape.markdown,
    scrapeHtml: scrape.html,
    metadata: scrape.metadata,
  };
}
