import {localScrapeWebsite, localSearchBusinesses} from "@/local-web";

export const localActors = [
  {
    id: "elite/local-business-discovery",
    name: "local-business-discovery",
    title: "Elite Local Business Discovery",
    username: "elite",
    description: "Find local UK businesses through open public map data without Apify credits.",
    url: "local://elite/local-business-discovery",
    categories: ["local", "lead-generation", "open-data"],
  },
  {
    id: "elite/local-website-scrape",
    name: "local-website-scrape",
    title: "Elite Local Website Scrape",
    username: "elite",
    description: "Fetch a public website directly and extract HTML, text, and metadata without Firecrawl credits.",
    url: "local://elite/local-website-scrape",
    categories: ["local", "crawler", "audit"],
  },
];

function createRun(actorId: string, status: "SUCCEEDED" | "FAILED") {
  const now = new Date().toISOString();
  return {
    id: `local-${Date.now()}`,
    actId: actorId,
    status,
    startedAt: now,
    finishedAt: now,
    defaultDatasetId: `local-dataset-${Date.now()}`,
    buildId: "local",
  };
}

export async function runLocalActor(actorId: string, input: Record<string, unknown>) {
  if (actorId === "elite/local-business-discovery" || actorId === "local-business-discovery") {
    const query = String(input.query ?? input.businessType ?? "Dental practices and dentists");
    const location = String(input.location ?? input.area ?? "Oldham, Greater Manchester");
    const limit = Number.parseInt(String(input.limit ?? "10"), 10);
    const hits = await localSearchBusinesses(query, location, Number.isFinite(limit) ? limit : 10);
    return {
      run: createRun(actorId, "SUCCEEDED"),
      datasetItems: hits.map((hit) => ({
        title: hit.title ?? null,
        description: hit.description ?? null,
        url: hit.url ?? null,
        markdown: hit.markdown ?? null,
        metadata: hit.metadata ?? {},
      })),
    };
  }

  if (actorId === "elite/local-website-scrape" || actorId === "local-website-scrape") {
    const url = String(input.url ?? "");
    if (!url) {
      throw new Error("Local website scrape requires input.url.");
    }
    const result = await localScrapeWebsite(url);
    return {
      run: createRun(actorId, "SUCCEEDED"),
      datasetItems: [
        {
          url,
          markdown: result.markdown,
          html: result.html,
          metadata: result.metadata,
        },
      ],
    };
  }

  throw new Error(`Unknown local actor: ${actorId}`);
}
