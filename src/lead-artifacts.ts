import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {spawn} from "node:child_process";

import {brand, outputFiles} from "@/config";
import {createDemoHtml} from "@/demo";
import {createEmail} from "@/email";
import {generateImageAsset} from "@/kie";
import type {AuditCategory, LeadAudit, QualifiedLead} from "@/types";
import {slugify, writeJson, writeText} from "@/utils";

type AccountFullRecord = {
  account: Record<string, unknown>;
  auditScores: Array<Record<string, unknown>>;
  auditAnalysis?: Record<string, unknown>;
};

const auditAliases: Record<AuditCategory, string[]> = {
  designQuality: ["design quality", "designquality"],
  mobileResponsiveness: ["mobile responsiveness", "mobileresponsiveness"],
  pageSpeed: ["page speed", "pagespeed"],
  clearHeadline: ["headline clarity", "clear headline", "clearheadline"],
  callToAction: ["call to action", "calltoaction"],
  contactVisibility: ["contact visibility", "contactvisibility"],
  trustSignals: ["trust signals", "trustsignals"],
  seoBasics: ["seo basics", "seobasics"],
  contentQuality: ["content quality", "contentquality"],
  googleReviewsOnWebsite: ["google reviews on site", "google reviews on website", "googlereviewsonwebsite"],
};

async function fileExists(filePath: string | null) {
  if (!filePath) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeCriterionKey(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}

function buildLeadAudit(clientId: string, full: AccountFullRecord): LeadAudit {
  const scores = {} as Record<AuditCategory, number>;

  for (const category of Object.keys(auditAliases) as AuditCategory[]) {
    const row = full.auditScores.find((entry) => {
      const normalized = normalizeCriterionKey(entry.criterion);
      return auditAliases[category].some((alias) => normalized === alias);
    });
    scores[category] = Number(row?.score ?? 0);
  }

  const totalScore = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const topProblems = full.auditAnalysis?.top_problems_json
    ? (JSON.parse(String(full.auditAnalysis.top_problems_json)) as string[])
    : [];
  const notes = full.auditScores
    .map((entry) => String(entry.note ?? "").trim())
    .filter(Boolean);

  return {
    leadId: clientId,
    websiteUrl: (full.account.website_url as string | null) ?? null,
    scores,
    totalScore,
    topProblems: topProblems.length ? topProblems : ["No audit problems recorded yet."],
    notes,
    scrapeMarkdown: null,
    scrapeHtml: null,
    metadata: {},
  };
}

async function ensureLeadImages(lead: QualifiedLead) {
  const heroExists = await fileExists(lead.imageAssets.hero);
  const servicesExists = await fileExists(lead.imageAssets.services);
  if (heroExists && servicesExists) return;

  const heroPrompt = `Photorealistic premium hero image for ${lead.businessName}, a ${lead.businessType.toLowerCase()} in ${lead.area}. Commercial-grade 4K photography, cinematic lighting, trustworthy, modern, polished, local business marketing visual.`;
  const servicesPrompt = `Photorealistic services background image for ${lead.businessName}, ${lead.businessType.toLowerCase()} in ${lead.area}. Premium commercial photography, detailed environment, clean composition, 4K, suitable for a website services section.`;

  if (!heroExists) {
    await generateImageAsset(lead.imageAssets.hero, heroPrompt, lead.businessName, "Hero image concept");
  }
  if (!servicesExists) {
    await generateImageAsset(lead.imageAssets.services, servicesPrompt, lead.businessName, "Services image concept");
  }
}

function buildQualifiedLead(clientId: string, full: AccountFullRecord): QualifiedLead {
  const account = full.account;
  const slug = slugify(String(account.business_name ?? clientId));
  const imageHero = (account.image_hero as string | null) ?? path.join(outputFiles.images, `${slug}-hero.jpg`);
  const imageServices =
    (account.image_services as string | null) ?? path.join(outputFiles.images, `${slug}-services.jpg`);
  const demoFile = (account.demo_file as string | null) ?? path.join(outputFiles.demos, `${slug}-demo.html`);
  const videoFile = (account.video_file as string | null) ?? path.join(outputFiles.videos, `${slug}-preview.mp4`);
  const emailFile = (account.email_file as string | null) ?? path.join(outputFiles.emails, `${slug}-email.txt`);

  return {
    id: clientId,
    businessName: String(account.business_name ?? ""),
    businessType: String(account.business_type ?? ""),
    area: String(account.area ?? ""),
    websiteUrl: (account.website_url as string | null) ?? null,
    phoneNumber: (account.phone_number as string | null) ?? null,
    emailAddress: (account.email_address as string | null) ?? null,
    googleRating: account.google_rating == null ? null : Number(account.google_rating),
    reviewCount: account.review_count == null ? null : Number(account.review_count),
    address: (account.address as string | null) ?? null,
    sourceUrl: null,
    sourceTitle: null,
    sourceDescription: null,
    audit: buildLeadAudit(clientId, full),
    imageAssets: {
      hero: imageHero,
      services: imageServices,
    },
    demoFile,
    videoFile,
    emailFile,
  };
}

export async function regenerateLeadDemo(clientId: string, full: AccountFullRecord) {
  const lead = buildQualifiedLead(clientId, full);
  await ensureLeadImages(lead);
  await writeText(lead.demoFile, createDemoHtml(lead));
  return lead;
}

export async function regenerateLeadEmail(clientId: string, full: AccountFullRecord) {
  const lead = buildQualifiedLead(clientId, full);
  const email = createEmail(lead);
  await writeText(lead.emailFile, email.body);
  return lead;
}

async function renderLeadVideoFile(lead: QualifiedLead) {
  const props = {
    businessName: lead.businessName,
    area: lead.area,
    topProblems: lead.audit.topProblems,
    heroImagePath: pathToFileURL(lead.imageAssets.hero).toString(),
    brandName: brand.businessName,
    domain: brand.domain,
    phoneNumber: lead.phoneNumber ?? brand.domain,
  };

  await writeJson(path.join(outputFiles.remotionData, `${slugify(lead.businessName || lead.id)}.json`), {
    videoFile: lead.videoFile,
    props,
  });

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "npx",
      [
        "remotion",
        "render",
        "src/remotion/index.ts",
        "lead-preview",
        lead.videoFile,
        "--props",
        JSON.stringify(props),
      ],
      {cwd: process.cwd(), stdio: "ignore"},
    );
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Remotion exited with ${code}`))));
    child.on("error", reject);
  });
}

export async function regenerateLeadVideo(clientId: string, full: AccountFullRecord) {
  const lead = buildQualifiedLead(clientId, full);
  await ensureLeadImages(lead);
  await renderLeadVideoFile(lead);
  return lead;
}
