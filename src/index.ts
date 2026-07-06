import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

import {areas, brand, businessTypes, outputFiles, pipeline} from "@/config";
import {EliteOpsDatabase} from "@/database";
import {createDashboardHtml} from "@/dashboard";
import {createDemoHtml} from "@/demo";
import {createEmail} from "@/email";
import {extractVisibleText, scrapeWebsite, searchBusinesses} from "@/firecrawl";
import {generateImageAsset} from "@/kie";
import {auditLead} from "@/scoring";
import {extractEmails, extractPhones, extractRating, extractReviewCount, firstNonEmpty, normalizeWhitespace, trimText} from "@/text";
import type {AuditCategory, ClientRecord, DashboardData, Lead, OutreachActivity, QualifiedLead} from "@/types";
import {chunk, ensureDir, slugify, toCsv, uniqueId, writeJson, writeText} from "@/utils";

const scoreLabels: Record<AuditCategory, string> = {
  designQuality: "Design quality",
  mobileResponsiveness: "Mobile responsiveness",
  pageSpeed: "Page speed",
  clearHeadline: "Headline clarity",
  callToAction: "Call to action",
  contactVisibility: "Contact visibility",
  trustSignals: "Trust signals",
  seoBasics: "SEO basics",
  contentQuality: "Content quality",
  googleReviewsOnWebsite: "Google reviews on site",
};

function formatDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function buildClientId(index: number) {
  return `EA-${new Date().getFullYear()}-${String(index + 1).padStart(4, "0")}`;
}

async function createLocalImagePlaceholder(filePath: string, title: string, subtitle: string) {
  const safeTitle = title.replace(/[<>&"]/g, "");
  const safeSubtitle = subtitle.replace(/[<>&"]/g, "");
  await writeText(
    filePath,
    `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="#11100f"/>
  <rect x="72" y="72" width="1776" height="936" rx="42" fill="#070607" stroke="#d8b76a" stroke-width="3"/>
  <text x="140" y="420" fill="#f5f1e8" font-family="Arial, Helvetica, sans-serif" font-size="76" font-weight="700">${safeTitle}</text>
  <text x="140" y="535" fill="#76d6ce" font-family="Arial, Helvetica, sans-serif" font-size="48">${safeSubtitle}</text>
  <text x="140" y="640" fill="#9d978c" font-family="Arial, Helvetica, sans-serif" font-size="34">Local preview asset generated without paid image credits</text>
</svg>`
  );
}

function createActivity(index: number, type: OutreachActivity["type"], status: OutreachActivity["status"], title: string, summary: string, linkedFiles: string[], scheduledFor: string | null = null): OutreachActivity {
  return {
    id: `ACT-${String(index + 1).padStart(4, "0")}`,
    type,
    status,
    title,
    summary,
    owner: brand.ownerName,
    createdAt: formatDate(),
    scheduledFor,
    completedAt: status === "prepared" || status === "queued" ? null : formatDate(),
    linkedFiles,
    linkedChannels: type === "cold-call" ? ["phone"] : type === "email" ? ["email"] : ["internal"],
  };
}

function buildClientRecord(lead: QualifiedLead, index: number): ClientRecord {
  const scoreEntries = Object.entries(lead.audit.scores) as Array<[AuditCategory, number]>;
  const strengths = scoreEntries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, value]) => `${scoreLabels[key]} is comparatively stronger at ${value}/10.`);
  const weaknesses = scoreEntries
    .sort((a, b) => a[1] - b[1])
    .slice(0, 4)
    .map(([key, value]) => `${scoreLabels[key]} is currently weak at ${value}/10.`);
  const recommendedActions = [
    `Lead with a clearer ${lead.businessType.toLowerCase()} value proposition above the fold.`,
    "Surface a direct phone / booking CTA in the header and hero immediately.",
    "Add stronger local proof: reviews, testimonials, outcomes, and service-specific credibility.",
    "Use the demo site and preview video as the first outreach assets, then follow with a direct call.",
  ];

  const outreachActivities: OutreachActivity[] = [
    createActivity(index * 10, "audit", "prepared", "Website audit completed", `Completed a structured website audit for ${lead.businessName} and logged the lowest-scoring categories.`, [outputFiles.leadsQualified]),
    createActivity(index * 10 + 1, "demo", "prepared", "Demo website produced", `Built a premium single-page demo site tailored to ${lead.businessName}.`, [lead.demoFile]),
    createActivity(index * 10 + 2, "video", "prepared", "Preview video staged", `Prepared a Remotion preview video brief and linked it to the client record.`, [lead.videoFile]),
    createActivity(index * 10 + 3, "email", "queued", "Cold email ready", `Personalised cold email draft is ready for review or send.`, [lead.emailFile], formatDate(1)),
    createActivity(index * 10 + 4, "cold-call", "prepared", "Cold call briefing queued", `Prepared talking points around the top three website issues and free demo offer.`, [lead.demoFile, lead.emailFile], formatDate(2)),
    createActivity(index * 10 + 5, "follow-up", "prepared", "Follow-up scheduled", `Follow-up reminder created if no response arrives after initial outreach.`, [lead.emailFile], formatDate(5)),
  ];

  return {
    ...lead,
    clientId: buildClientId(index),
    accountStatus: "ready-to-send",
    strengths,
    weaknesses,
    recommendedActions,
    outreachActivities,
    followUp: {
      priority: lead.audit.totalScore <= 25 ? "high" : lead.audit.totalScore <= 40 ? "medium" : "low",
      nextStep: "Send email with demo + video, then call within 48 hours if no reply.",
      dueDate: formatDate(2),
    },
    artifacts: {
      demoFile: lead.demoFile,
      emailFile: lead.emailFile,
      videoFile: lead.videoFile,
      heroImage: lead.imageAssets.hero,
      servicesImage: lead.imageAssets.services,
    },
    contactSummary: `${lead.businessName} (${lead.businessType}) in ${lead.area}${lead.emailAddress ? ` • ${lead.emailAddress}` : ""}${lead.phoneNumber ? ` • ${lead.phoneNumber}` : ""}`,
    contacts: [],
    tasks: [],
    memories: [],
    proposals: [],
    comments: [],
    assets: [],
    owner: brand.ownerName,
    lastContactedAt: null,
    closeProbability: lead.audit.totalScore <= 20 ? 72 : lead.audit.totalScore <= 35 ? 58 : 44,
    valueEstimate: lead.audit.totalScore <= 20 ? 3200 : lead.audit.totalScore <= 35 ? 2400 : 1800,
    healthBand: lead.audit.totalScore <= 20 ? "critical" : lead.audit.totalScore <= 35 ? "weak" : lead.audit.totalScore <= 50 ? "workable" : "stable",
    objections: [],
    enrichment: {
      googleRating: lead.googleRating,
      reviewCount: lead.reviewCount,
      sourceUrl: lead.sourceUrl,
    },
    aiSummary: {
      headline: `${lead.businessName} is a strong redesign candidate with a score of ${lead.audit.totalScore}/100.`,
      nextBestAction: "Send the demo and video, then call within 48 hours if there is no reply.",
      risk: `Primary risk areas are ${lead.audit.topProblems.slice(0, 2).join(" and ").toLowerCase()}.`,
      talkingPoint: lead.audit.topProblems[0] ?? "Lead with the free demo and speed of delivery.",
      momentum: "No live outreach has been logged yet.",
    },
  };
}

async function discoverLeads() {
  const leads = new Map<string, Lead>();

  for (const area of areas) {
    for (const businessType of businessTypes) {
      const query = `${businessType} in ${area}`;
      console.log(`Searching: ${query}`);
      let hits;
      try {
        hits = await searchBusinesses(query, area, pipeline.maxPerQuery);
        console.log(`Found ${hits.length} raw hits for ${query}.`);
      } catch (error) {
        console.warn(`Search failed for ${query}:`, error instanceof Error ? error.message : error);
        continue;
      }

      for (const hit of hits) {
        const sourceText = normalizeWhitespace(`${hit.title ?? ""} ${hit.description ?? ""} ${hit.markdown ?? ""}`);
        const websiteUrl = hit.url ?? null;
        const businessName = firstNonEmpty(hit.title?.split("|")[0], hit.title?.split("-")[0], websiteUrl?.replace(/^https?:\/\//, "").split("/")[0]) ?? `${businessType} lead`;
        const id = uniqueId(area, businessType, businessName, websiteUrl ?? "");
        if (leads.has(id)) continue;

        const emails = extractEmails(sourceText);
        const phones = extractPhones(sourceText);
        leads.set(id, {
          id,
          businessName: normalizeWhitespace(businessName),
          businessType,
          area,
          websiteUrl,
          phoneNumber: phones[0] ?? null,
          emailAddress: emails[0] ?? null,
          googleRating: extractRating(sourceText),
          reviewCount: extractReviewCount(sourceText),
          address: null,
          sourceUrl: hit.url ?? null,
          sourceTitle: hit.title ?? null,
          sourceDescription: hit.description ?? null,
        });
      }
    }
  }

  return [...leads.values()];
}

async function enrichAndQualify(leads: Lead[]) {
  const qualified: QualifiedLead[] = [];

  for (const lead of leads) {
    console.log(`Auditing: ${lead.businessName}${lead.websiteUrl ? ` (${lead.websiteUrl})` : ""}`);
    const slug = slugify(lead.businessName || lead.id);
    const heroFile = path.join(outputFiles.images, `${slug}-hero.jpg`);
    const servicesFile = path.join(outputFiles.images, `${slug}-services.jpg`);
    const demoFile = path.join(outputFiles.demos, `${slug}-demo.html`);
    const videoFile = path.join(outputFiles.videos, `${slug}-preview.mp4`);
    const emailFile = path.join(outputFiles.emails, `${slug}-email.txt`);

    let audit;
    if (!lead.websiteUrl) {
      audit = {
        leadId: lead.id,
        websiteUrl: null,
        scores: {
          designQuality: 0,
          mobileResponsiveness: 0,
          pageSpeed: 0,
          clearHeadline: 0,
          callToAction: 0,
          contactVisibility: 0,
          trustSignals: 0,
          seoBasics: 0,
          contentQuality: 0,
          googleReviewsOnWebsite: 0,
        },
        totalScore: 0,
        topProblems: ["No website found.", "No mobile experience present.", "No conversion path online."],
        notes: ["Lead qualified because no website was found."],
        scrapeMarkdown: null,
        scrapeHtml: null,
        metadata: {},
      };
    } else {
      try {
        const scrape = await scrapeWebsite(lead.websiteUrl);
        const visibleText = extractVisibleText(scrape.html, scrape.markdown);
        lead.phoneNumber = lead.phoneNumber ?? extractPhones(visibleText)[0] ?? null;
        lead.emailAddress = lead.emailAddress ?? extractEmails(visibleText)[0] ?? null;
        lead.googleRating = lead.googleRating ?? extractRating(visibleText);
        lead.reviewCount = lead.reviewCount ?? extractReviewCount(visibleText);
        audit = auditLead(lead, scrape);
      } catch (error) {
        console.warn(`Audit failed for ${lead.businessName}:`, error instanceof Error ? error.message : error);
        continue;
      }
    }

    if (audit.totalScore > pipeline.maxQualifyingScore && lead.websiteUrl) {
      console.log(`Skipped ${lead.businessName}: score ${audit.totalScore}/100 is above the qualifying threshold of ${pipeline.maxQualifyingScore}.`);
      continue;
    }

    const heroPrompt = `Photorealistic premium hero image for ${lead.businessName}, a ${lead.businessType.toLowerCase()} in ${lead.area}. Commercial-grade 4K photography, cinematic lighting, trustworthy, modern, polished, local business marketing visual.`;
    const servicesPrompt = `Photorealistic services background image for ${lead.businessName}, ${lead.businessType.toLowerCase()} in ${lead.area}. Premium commercial photography, detailed environment, clean composition, 4K, suitable for a website services section.`;

    if (pipeline.skipImages) {
      console.log(`Skipping generated images for ${lead.businessName} because PIPELINE_SKIP_IMAGES is enabled.`);
      await createLocalImagePlaceholder(heroFile, lead.businessName, "Hero image concept");
      await createLocalImagePlaceholder(servicesFile, lead.businessName, "Services image concept");
    } else {
      await generateImageAsset(heroFile, heroPrompt, lead.businessName, "Hero image concept");
      await generateImageAsset(servicesFile, servicesPrompt, lead.businessName, "Services image concept");
    }

    const qualifiedLead: QualifiedLead = {
      ...lead,
      audit,
      imageAssets: {hero: heroFile, services: servicesFile},
      demoFile,
      videoFile,
      emailFile,
    };

    await writeText(demoFile, createDemoHtml(qualifiedLead));
    const email = createEmail(qualifiedLead);
    await writeText(emailFile, email.body);
    await writeJson(path.join(outputFiles.remotionData, `${slug}.json`), {
      videoFile,
      props: {
        businessName: qualifiedLead.businessName,
        area: qualifiedLead.area,
        topProblems: qualifiedLead.audit.topProblems,
        heroImagePath: pathToFileURL(qualifiedLead.imageAssets.hero).toString(),
        brandName: brand.businessName,
        domain: brand.domain,
        phoneNumber: qualifiedLead.phoneNumber ?? brand.domain,
      },
    });

    qualified.push(qualifiedLead);
    console.log(`Qualified ${lead.businessName}: score ${audit.totalScore}/100.`);
    if (qualified.length >= pipeline.maxQualified) {
      break;
    }
  }

  return qualified.sort((a, b) => a.audit.totalScore - b.audit.totalScore);
}

function createSummary(leadsFound: Lead[], clients: ClientRecord[]) {
  const table = [
    "| Client ID | Business | Type | Area | Score | Top 3 problems | Status | Email | Phone | Demo | Video |",
    "| --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- |",
    ...clients.map(
      (lead) =>
        `| ${lead.clientId} | ${lead.businessName} | ${lead.businessType} | ${lead.area} | ${lead.audit.totalScore} | ${lead.audit.topProblems.map((item: string) => trimText(item, 64)).join("<br>")} | ${lead.accountStatus} | ${lead.emailAddress ?? "N/A"} | ${lead.phoneNumber ?? "N/A"} | ${path.basename(lead.demoFile)} | ${path.basename(lead.videoFile)} |`
    ),
  ].join("\n");

  const batches = chunk(clients, 10)
    .map((group: ClientRecord[], index: number) => `Day ${index + 1}: ${group.map((lead: ClientRecord) => `${lead.clientId} ${lead.businessName}`).join(", ")}`)
    .join("\n");

  return `# Outreach Summary

- Total businesses found: ${leadsFound.length}
- Total qualified leads: ${clients.length}

## Ranked leads

${table}

## Daily outreach plan

${batches || "No qualified leads yet."}
`;
}

function buildDashboardData(leads: Lead[], clients: ClientRecord[]): DashboardData {
  return {
    generatedAt: new Date().toISOString(),
    owner: brand.ownerName,
    brand: brand.businessName,
    metrics: {
      totalProspects: leads.length,
      qualifiedLeads: clients.length,
      demosBuilt: clients.filter((client) => Boolean(client.demoFile)).length,
      emailDraftsReady: clients.filter((client) => client.outreachActivities.some((item) => item.type === "email")).length,
      videosPrepared: clients.filter((client) => Boolean(client.videoFile)).length,
      highPriorityFollowUps: clients.filter((client) => client.followUp.priority === "high").length,
      overdueTasks: 0,
      repliedAccounts: clients.filter((client) => client.accountStatus === "replied").length,
      proposalStage: clients.filter((client) => client.accountStatus === "proposal").length,
      weightedPipeline: clients.reduce((sum, client) => sum + client.valueEstimate * (client.closeProbability / 100), 0),
      liveActivityCount: clients.reduce((sum, client) => sum + client.outreachActivities.length, 0),
      avgScore: clients.length ? Math.round(clients.reduce((sum, client) => sum + client.audit.totalScore, 0) / clients.length) : 0,
      bookedRate: clients.length ? Math.round((clients.filter((client) => ["proposal", "won"].includes(client.accountStatus)).length / clients.length) * 100) : 0,
    },
    clients,
  };
}

async function main() {
  console.log("Pipeline starting.");
  await Promise.all(Object.values(outputFiles).map((filePath) => ensureDir(path.extname(filePath) ? path.dirname(filePath) : filePath)));
  console.log("Output directories ready.");
  await fs.rm(outputFiles.remotionData, {recursive: true, force: true});
  await ensureDir(outputFiles.remotionData);
  console.log("Remotion data directory reset.");

  const leads = await discoverLeads();
  await writeJson(outputFiles.leadsRaw, leads);

  const qualified = await enrichAndQualify(leads);
  const clients = qualified.map((lead, index) => buildClientRecord(lead, index));
  const dashboardData = buildDashboardData(leads, clients);
  await writeJson(outputFiles.leadsQualified, clients);
  await writeText(
    outputFiles.leadsQualifiedCsv,
    clients.length
      ? toCsv(
          clients.map((lead) => ({
            clientId: lead.clientId,
            businessName: lead.businessName,
            businessType: lead.businessType,
            area: lead.area,
            websiteUrl: lead.websiteUrl,
            accountStatus: lead.accountStatus,
            score: lead.audit.totalScore,
            topProblems: lead.audit.topProblems.join(" | "),
            email: lead.emailAddress,
            phone: lead.phoneNumber,
            demoFile: lead.demoFile,
            videoFile: lead.videoFile,
            nextStep: lead.followUp.nextStep,
            followUpDue: lead.followUp.dueDate,
          }))
        )
      : "clientId,businessName,businessType,area,websiteUrl,accountStatus,score,topProblems,email,phone,demoFile,videoFile,nextStep,followUpDue\n"
  );
  await writeJson(outputFiles.crmJson, dashboardData);
  await writeText(outputFiles.outreachSummary, createSummary(leads, clients));
  const database = new EliteOpsDatabase();
  database.syncPipelineData(dashboardData);
  await writeText(outputFiles.dashboardHtml, createDashboardHtml(database.getState(), outputFiles.dashboardHtml));

  console.log(`Discovered ${leads.length} leads and qualified ${qualified.length}.`);
  console.log(`Dashboard written to ${outputFiles.dashboardHtml}.`);
  console.log(`Next step: run "npm run videos:render" to render the MP4 previews.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
