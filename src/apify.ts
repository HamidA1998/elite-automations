import {z} from "zod";

import {localActors, runLocalActor} from "@/local-actors";

const APIFY_BASE_URL = process.env.APIFY_BASE_URL ?? "https://api.apify.com/v2";
const APIFY_TOKEN = process.env.APIFY_TOKEN ?? process.env.APIFY_API_TOKEN ?? process.env.APIFY_API_KEY ?? "";

const apifyStoreResponseSchema = z.object({
  data: z.object({
    items: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  }).passthrough(),
}).passthrough();

const apifyRunResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    actId: z.string().optional(),
    status: z.string(),
    startedAt: z.string().optional(),
    finishedAt: z.string().optional(),
    defaultDatasetId: z.string().optional(),
    buildId: z.string().optional(),
  }).passthrough(),
}).passthrough();

const apifyDatasetResponseSchema = z.array(z.record(z.string(), z.unknown()));

export interface ApifyActorSummary {
  id: string;
  name: string;
  title: string;
  username: string | null;
  description: string;
  url: string;
  categories: string[];
}

export function getApifyStatus() {
  return {
    configured: Boolean(APIFY_TOKEN),
    baseUrl: APIFY_BASE_URL,
    missingEnv: APIFY_TOKEN ? [] : ["APIFY_TOKEN or APIFY_API_TOKEN"],
    localFallbackReady: true,
    localActors: localActors.map((actor) => actor.id),
  };
}

async function apifyFetch<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  if (!APIFY_TOKEN) {
    throw new Error("Apify is not configured. Add APIFY_TOKEN or APIFY_API_TOKEN to .env.local.");
  }
  const response = await fetch(`${APIFY_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${APIFY_TOKEN}`,
      ...(init?.body ? {"Content-Type": "application/json"} : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Apify request failed: ${JSON.stringify(payload)}`);
  }
  return schema.parse(payload);
}

function normalizeActor(item: Record<string, unknown>): ApifyActorSummary {
  const username = typeof item.username === "string" ? item.username : null;
  const name = String(item.name ?? item.id ?? "unknown-actor");
  const id = String(item.id ?? (username ? `${username}~${name}` : name));
  return {
    id,
    name,
    title: String(item.title ?? name),
    username,
    description: String(item.description ?? item.readme ?? ""),
    url: username ? `https://apify.com/${username}/${name}` : `https://apify.com/actors/${id}`,
    categories: Array.isArray(item.categories) ? item.categories.map(String) : [],
  };
}

export async function searchApifyActors(query = "google maps reviews", limit = 20) {
  if (!APIFY_TOKEN) {
    const normalizedQuery = query.toLowerCase();
    return localActors
      .filter((actor) => `${actor.id} ${actor.title} ${actor.description} ${actor.categories.join(" ")}`.toLowerCase().includes(normalizedQuery) || normalizedQuery.includes("local"))
      .slice(0, limit);
  }
  const params = new URLSearchParams({
    search: query,
    limit: String(Math.min(Math.max(limit, 1), 50)),
  });
  const payload = await apifyFetch(`/store?${params.toString()}`, apifyStoreResponseSchema);
  return payload.data.items.map(normalizeActor);
}

export async function runApifyActor(options: {
  actorId: string;
  input: Record<string, unknown>;
  waitForFinishSeconds?: number;
}) {
  if (!APIFY_TOKEN || options.actorId.startsWith("elite/") || options.actorId.startsWith("local-")) {
    return runLocalActor(options.actorId, options.input);
  }
  const waitForFinish = Math.min(Math.max(options.waitForFinishSeconds ?? 30, 0), 120);
  const params = new URLSearchParams({waitForFinish: String(waitForFinish)});
  const encodedActorId = encodeURIComponent(options.actorId);
  const run = await apifyFetch(
    `/acts/${encodedActorId}/runs?${params.toString()}`,
    apifyRunResponseSchema,
    {
      method: "POST",
      body: JSON.stringify(options.input),
    },
  );
  let datasetItems: Array<Record<string, unknown>> = [];
  if (run.data.defaultDatasetId && run.data.status === "SUCCEEDED") {
    const datasetId = encodeURIComponent(run.data.defaultDatasetId);
    datasetItems = await apifyFetch(`/datasets/${datasetId}/items?clean=true&limit=100`, apifyDatasetResponseSchema);
  }
  return {
    run: run.data,
    datasetItems,
  };
}
