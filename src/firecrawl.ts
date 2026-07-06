import {firecrawl} from "@/config";
import {localScrapeWebsite, localSearchBusinesses} from "@/local-web";
import type {FirecrawlScrapeResult, SearchHit} from "@/types";
import {delay} from "@/utils";

type SearchResponse = {
  success: boolean;
  data?: {
    web?: SearchHit[];
  };
};

type ScrapeResponse = {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: Record<string, unknown>;
  };
};

export interface FirecrawlReviewSource {
  label: string;
  source: "google" | "trustpilot" | "facebook" | "yell" | "tripadvisor" | "other";
  url: string;
  snippet: string;
}

export interface FirecrawlBusinessRecord {
  name: string;
  url: string | null;
  domain: string | null;
  description: string;
  location: string | null;
  trustSignals: string[];
  reviewSources: FirecrawlReviewSource[];
  contactSignals: {
    emailHints: string[];
    phoneHints: string[];
  };
  sourceTitle: string;
  sourceSnippet: string;
}

export interface FirecrawlBusinessSearchReport {
  query: string;
  location: string;
  operatorBrief: {
    headline: string;
    marketView: string;
    recommendation: string;
    reviewCoverage: string;
  };
  businesses: FirecrawlBusinessRecord[];
}

export interface FirecrawlScrapeAnalysis {
  headline: string;
  designRead: string;
  trustRead: string;
  conversionRead: string;
  contentRead: string;
  recommendedActions: string[];
  extracted: {
    headings: string[];
    callsToAction: string[];
    emails: string[];
    phones: string[];
    reviewMentions: string[];
    trustSignals: string[];
  };
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_REGEX = /(?:\+44\s?7\d{3}|\(?0\d{3,4}\)?)\s?\d{3}\s?\d{3,4}/g;

async function firecrawlRequest<T>(path: string, body: Record<string, unknown>) {
  if (!firecrawl.apiKey) {
    throw new Error("FIRECRAWL_API_KEY is missing.");
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${firecrawl.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawl.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });

      const data = (await response.json()) as T & {error?: string; message?: string};
      if (!response.ok) {
        const msg = data.error ?? data.message ?? `Firecrawl request failed for ${path}.`;
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(msg);
          await delay(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        throw new Error(msg);
      }

      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES - 1) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error(`Firecrawl request failed for ${path} after ${MAX_RETRIES} attempts.`);
}

function dedupe<T>(values: T[]) {
  return Array.from(new Set(values));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  };

  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return namedEntities[normalized] ?? match;
  });
}

function extractHtmlBody(html: string) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch?.[1] ?? html;
}

function parseDomain(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function classifyReviewSource(url: string): FirecrawlReviewSource["source"] {
  const domain = parseDomain(url) ?? "";
  if (domain.includes("google.")) return "google";
  if (domain.includes("trustpilot.")) return "trustpilot";
  if (domain.includes("facebook.")) return "facebook";
  if (domain.includes("yell.")) return "yell";
  if (domain.includes("tripadvisor.")) return "tripadvisor";
  return "other";
}

function buildTrustSignals(text: string, url: string | null) {
  const lower = text.toLowerCase();
  const signals: string[] = [];
  if (lower.includes("testimonial")) signals.push("Testimonials published");
  if (lower.includes("case stud")) signals.push("Case study language present");
  if (lower.includes("award")) signals.push("Awards or accolades mentioned");
  if (lower.includes("years of experience")) signals.push("Experience proof on page");
  if (lower.includes("trustpilot")) signals.push("Trustpilot mentions discovered");
  if (lower.includes("google review") || lower.includes("5 star")) signals.push("Google review or rating language present");
  if (lower.includes("book now") || lower.includes("free quote") || lower.includes("call now")) signals.push("Commercial CTA language present");
  const domain = parseDomain(url);
  if (domain) signals.push(`Primary domain: ${domain}`);
  return dedupe(signals).slice(0, 5);
}

function extractSignalMatches(text: string, regex: RegExp) {
  const matches = text.match(regex) ?? [];
  return dedupe(matches.map((item) => normalizeWhitespace(item))).slice(0, 6);
}

function analyseContent(text: string, metadata: Record<string, unknown>, url: string) {
  const headings = dedupe(
    String(metadata.title ?? "")
      .split(/[|·-]/)
      .map((item) => normalizeWhitespace(item))
      .filter(Boolean),
  ).slice(0, 5);
  const lower = text.toLowerCase();
  const callsToAction = dedupe(
    ["book now", "get a quote", "call now", "contact us", "free consultation", "request a callback"]
      .filter((cta) => lower.includes(cta))
      .map((cta) => cta.replace(/\b\w/g, (character) => character.toUpperCase())),
  );
  const trustSignals = buildTrustSignals(text, url);
  const reviewMentions = dedupe(
    text
      .split(/[\n.]/)
      .map((line) => normalizeWhitespace(line))
      .filter((line) => /review|rating|trustpilot|testimonial|5 star/i.test(line) && line.length < 180),
  ).slice(0, 6);

  return {
    headings,
    callsToAction,
    emails: extractSignalMatches(text, EMAIL_REGEX),
    phones: extractSignalMatches(text, PHONE_REGEX),
    reviewMentions,
    trustSignals,
  };
}

function buildScrapeNarrative(url: string, metadata: Record<string, unknown>, extracted: FirecrawlScrapeAnalysis["extracted"], text: string): FirecrawlScrapeAnalysis {
  const lower = text.toLowerCase();
  const title = String(metadata.title ?? parseDomain(url) ?? "Website");

  const designRead = extracted.headings.length
    ? `The site has a recognisable structure around ${extracted.headings.slice(0, 2).join(" and ")}, which gives us enough signal to judge the offer.`
    : "The structure feels light on clear sections, which usually points to weaker visual hierarchy and a less deliberate landing experience.";

  const trustRead = extracted.trustSignals.length
    ? `Trust proof is partially visible through ${extracted.trustSignals.slice(0, 2).join(" and ").toLowerCase()}.`
    : "There is little visible trust proof in the scraped content, so reviews, experience, and proof points should be strengthened.";

  const conversionRead = extracted.callsToAction.length
    ? `The site does include conversion language such as ${extracted.callsToAction.slice(0, 2).join(" and ")}, but the offer still needs to be judged against clearer booking and callback flows.`
    : "The scrape did not surface a strong booking or enquiry flow, which usually means the site is leaving conversions on the table.";

  const contentRead = lower.includes("about") || lower.includes("service")
    ? "There is enough service and company language to extract a usable commercial narrative for outreach."
    : "The content is thin enough that the sales story would benefit from a sharper headline, clearer offer framing, and stronger proof.";

  const recommendedActions = dedupe([
    extracted.callsToAction.length ? "" : "Add one primary conversion path with a clear quote or booking CTA above the fold.",
    extracted.trustSignals.length ? "" : "Surface reviews, credentials, and outcome proof much earlier in the page.",
    extracted.phones.length || extracted.emails.length ? "" : "Make phone and email contact methods far more visible on the main pages.",
    lower.includes("mobile") ? "" : "Audit the mobile journey manually and tighten layout, speed, and thumb-friendly calls to action.",
  ].filter(Boolean)).slice(0, 4);

  return {
    headline: `${title} can be repositioned with a stronger trust-and-conversion story.`,
    designRead,
    trustRead,
    conversionRead,
    contentRead,
    recommendedActions,
    extracted,
  };
}

function trimSnippet(hit: SearchHit) {
  return normalizeWhitespace((hit.description ?? hit.markdown ?? "").slice(0, 240));
}

function buildLocalSearchQuery(query: string, location: string) {
  const haystack = `${query} ${location}`.toLowerCase();
  const hasUkSignal = /\buk\b|united kingdom|greater manchester|england|scotland|wales|northern ireland/.test(haystack);
  const locationSignal = location.trim() ? ` ${location.trim()}` : "";
  return hasUkSignal ? `${query}${locationSignal}` : `${query}${locationSignal} UK`;
}

function locationRelevance(hit: SearchHit, location: string) {
  const blob = normalizeWhitespace([
    hit.title,
    hit.description,
    hit.url,
    hit.markdown,
    Object.values(hit.metadata ?? {}).join(" "),
  ].filter(Boolean).join(" ")).toLowerCase();
  const locationTokens = location.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 3);
  const hasLocationToken = locationTokens.some((token) => blob.includes(token));
  const hasUkSignal = /\buk\b|united kingdom|greater manchester|england|\.co\.uk|manchester[, ]+uk|manchester[, ]+england/.test(blob);
  const hasUsFalsePositive = /richmond[, ]+va|virginia|united states|usa|23224|yelp\.com\/search\?/.test(blob);
  if (hasUsFalsePositive && !hasUkSignal) return -10;
  if (hasLocationToken && hasUkSignal) return 4;
  if (hasLocationToken) return 2;
  if (hasUkSignal) return 1;
  return 0;
}

async function fetchReviewSources(name: string, location: string): Promise<FirecrawlReviewSource[]> {
  const reviewHits = await searchBusinesses(`"${name}" ${location} reviews`, location, 6);
  return reviewHits
    .filter((hit) => hit.url)
    .map((hit) => ({
      label: String(hit.title ?? parseDomain(hit.url) ?? "Review source"),
      source: classifyReviewSource(hit.url as string),
      url: hit.url as string,
      snippet: trimSnippet(hit),
    }))
    .slice(0, 4);
}

export async function searchBusinesses(query: string, location: string, limit: number) {
  try {
    const targetedQuery = buildLocalSearchQuery(query, location);
    const response = await firecrawlRequest<SearchResponse>("/search", {
      query: targetedQuery,
      location,
      country: firecrawl.country,
      limit: Math.max(limit * 3, limit),
      ignoreInvalidURLs: true,
    });

    return (response.data?.web ?? [])
      .map((hit) => ({hit, relevance: locationRelevance(hit, location)}))
      .filter(({relevance}) => relevance >= 0)
      .sort((a, b) => b.relevance - a.relevance)
      .map(({hit}) => hit)
      .slice(0, limit);
  } catch (error) {
    console.warn(`Firecrawl search unavailable, using local discovery: ${error instanceof Error ? error.message : error}`);
    return localSearchBusinesses(query, location, limit);
  }
}

export async function buildBusinessSearchReport(query: string, location: string, limit: number): Promise<FirecrawlBusinessSearchReport> {
  const hits = await searchBusinesses(query, location, limit);
  const topHits = hits.slice(0, limit);

  const businesses = await Promise.all(
    topHits.map(async (hit) => {
      const name = String(hit.metadata?.["og:title"] ?? hit.title ?? hit.url ?? "Unknown business");
      const description = trimSnippet(hit);
      const textBlob = normalizeWhitespace(`${name} ${description} ${hit.markdown ?? ""}`);
      const reviewSources = await fetchReviewSources(name, location).catch(() => []);

      return {
        name,
        url: hit.url ?? null,
        domain: parseDomain(hit.url),
        description,
        location,
        trustSignals: buildTrustSignals(textBlob, hit.url ?? null),
        reviewSources,
        contactSignals: {
          emailHints: extractSignalMatches(textBlob, EMAIL_REGEX),
          phoneHints: extractSignalMatches(textBlob, PHONE_REGEX),
        },
        sourceTitle: String(hit.title ?? name),
        sourceSnippet: description,
      } satisfies FirecrawlBusinessRecord;
    }),
  );

  const reviewCoverage = businesses.reduce((sum, business) => sum + business.reviewSources.length, 0);
  const domains = dedupe(businesses.map((business) => business.domain).filter(Boolean));
  const trustHeavy = businesses.filter((business) => business.trustSignals.length >= 2).length;

  return {
    query,
    location,
    operatorBrief: {
      headline: `${businesses.length} live results gathered for ${query} around ${location}.`,
      marketView: domains.length
        ? `The current sample spans ${domains.length} distinct domains, which is enough to spot who looks established versus who still looks under-optimised.`
        : "The result set is still shallow, so widen the search term or location to improve market coverage.",
      recommendation: trustHeavy
        ? "Prioritise the entries with weaker trust and contact signals first. They are more likely to respond to a strong audit-led pitch."
        : "Most visible results are light on trust proof, so this is a good segment for a proof-heavy audit and demo offer.",
      reviewCoverage: reviewCoverage
        ? `${reviewCoverage} external review or reputation sources were found across the current result set.`
        : "No external review sources were surfaced automatically, so a manual Google Business Profile check is still worth doing.",
    },
    businesses,
  };
}

export async function scrapeWebsite(url: string): Promise<FirecrawlScrapeResult> {
  try {
    const response = await firecrawlRequest<ScrapeResponse>("/scrape", {
      url,
      formats: ["markdown", "html"],
      onlyMainContent: false,
    });

    const markdown = response.data?.markdown ?? null;
    const html = response.data?.html ?? null;
    const metadata = response.data?.metadata ?? {};

    return {markdown, html, metadata};
  } catch (error) {
    console.warn(`Firecrawl scrape unavailable for ${url}, using local crawler: ${error instanceof Error ? error.message : error}`);
    return localScrapeWebsite(url);
  }
}

export function extractVisibleText(html: string | null, markdown: string | null) {
  if (markdown?.trim()) {
    return markdown;
  }

  if (!html) {
    return "";
  }

  return normalizeWhitespace(
    decodeHtmlEntities(
      extractHtmlBody(html)
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

export function analyseScrape(url: string, result: FirecrawlScrapeResult) {
  const text = normalizeWhitespace(extractVisibleText(result.html, result.markdown)).slice(0, 12_000);
  const extracted = analyseContent(text, result.metadata, url);
  return buildScrapeNarrative(url, result.metadata, extracted, text);
}
