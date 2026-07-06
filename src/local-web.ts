import type {FirecrawlScrapeResult, SearchHit} from "@/types";

const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT = "EliteAutomationsLocalCrawler/1.0 (public business audit; contact: eliteautomations.co.uk)";

type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

function withTimeout(timeoutMs = REQUEST_TIMEOUT_MS) {
  return AbortSignal.timeout(timeoutMs);
}

function isSearchHit(hit: SearchHit | null): hit is SearchHit {
  return hit !== null;
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

function extractTitle(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? normalizeWhitespace(decodeHtmlEntities(title.replace(/<[^>]+>/g, " "))) : null;
}

function extractMetaDescription(html: string) {
  const match = html.match(/<meta\s+[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  return match?.[1] ? normalizeWhitespace(decodeHtmlEntities(match[1])) : null;
}

function htmlToText(html: string) {
  return normalizeWhitespace(
    decodeHtmlEntities(
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(?:p|div|section|article|header|footer|li|h[1-6])>/gi, "\n")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function normalizeWebsiteUrl(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function buildAddress(tags: Record<string, string>) {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
    tags["addr:postcode"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function tagsForBusinessType(businessType: string) {
  const value = businessType.toLowerCase();
  if (value.includes("dent")) return ['["amenity"="dentist"]', '["healthcare"="dentist"]'];
  if (value.includes("restaurant") || value.includes("takeaway")) return ['["amenity"="restaurant"]', '["amenity"="fast_food"]'];
  if (value.includes("barber")) return ['["shop"="hairdresser"]'];
  if (value.includes("beauty") || value.includes("nail")) return ['["shop"="beauty"]'];
  if (value.includes("estate") || value.includes("letting")) return ['["office"="estate_agent"]'];
  if (value.includes("accountant")) return ['["office"="accountant"]'];
  if (value.includes("solicitor") || value.includes("law")) return ['["office"="lawyer"]'];
  if (value.includes("garage") || value.includes("mechanic") || value.includes("mot")) return ['["shop"="car_repair"]'];
  if (value.includes("gym") || value.includes("personal trainer")) return ['["leisure"="fitness_centre"]'];
  if (value.includes("physio") || value.includes("chiropractor")) return ['["healthcare"="physiotherapist"]', '["healthcare"="chiropractor"]'];
  if (value.includes("optician")) return ['["shop"="optician"]'];
  if (value.includes("vet")) return ['["amenity"="veterinary"]'];
  return ['["name"]'];
}

async function geocodeLocation(location: string) {
  const params = new URLSearchParams({
    q: location,
    format: "jsonv2",
    limit: "1",
    countrycodes: "gb",
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    signal: withTimeout(),
  });
  if (!response.ok) {
    throw new Error(`Nominatim geocode failed with HTTP ${response.status}.`);
  }
  const results = (await response.json()) as NominatimResult[];
  const first = results[0];
  if (!first) {
    throw new Error(`No geocoding result found for ${location}.`);
  }
  return {
    lat: Number.parseFloat(first.lat),
    lon: Number.parseFloat(first.lon),
    label: first.display_name ?? location,
  };
}

async function overpassSearch(lat: number, lon: number, businessType: string, limit: number) {
  const selectors = tagsForBusinessType(businessType)
    .map((tagSelector) => `node${tagSelector}(around:9000,${lat},${lon});way${tagSelector}(around:9000,${lat},${lon});relation${tagSelector}(around:9000,${lat},${lon});`)
    .join("");
  const query = `[out:json][timeout:25];(${selectors});out center tags ${Math.max(limit * 5, 25)};`;
  const params = new URLSearchParams({data: query});
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: params,
    signal: withTimeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Overpass search failed with HTTP ${response.status}.`);
  }
  const payload = (await response.json()) as OverpassResponse;
  return payload.elements ?? [];
}

export async function localSearchBusinesses(query: string, location: string, limit: number): Promise<SearchHit[]> {
  const businessType = query.replace(/\s+in\s+.+$/i, "").trim() || query;
  const geo = await geocodeLocation(location);
  const elements = await overpassSearch(geo.lat, geo.lon, businessType, limit);
  const seen = new Set<string>();

  return elements
    .map<SearchHit | null>((element) => {
      const tags = element.tags ?? {};
      const name = tags.name?.trim();
      if (!name) return null;
      const website = normalizeWebsiteUrl(tags.website ?? tags["contact:website"]);
      const phone = tags.phone ?? tags["contact:phone"];
      const email = tags.email ?? tags["contact:email"];
      const address = buildAddress(tags);
      const description = normalizeWhitespace(
        [
          tags.description,
          address,
          phone ? `Phone: ${phone}` : "",
          email ? `Email: ${email}` : "",
          website ? `Website: ${website}` : "",
        ].filter(Boolean).join(" "),
      );
      const key = `${name.toLowerCase()}|${website ?? address ?? element.id}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        title: name,
        description,
        url: website ?? undefined,
        markdown: description,
        metadata: {
          source: "local-overpass",
          osmType: element.type,
          osmId: element.id,
          lat: element.lat ?? element.center?.lat,
          lon: element.lon ?? element.center?.lon,
          address,
          phone,
          email,
          location: geo.label,
        },
      } satisfies SearchHit;
    })
    .filter(isSearchHit)
    .slice(0, limit);
}

export async function localScrapeWebsite(url: string): Promise<FirecrawlScrapeResult> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": USER_AGENT,
    },
    redirect: "follow",
    signal: withTimeout(),
  });
  if (!response.ok) {
    throw new Error(`Local website fetch failed for ${url} with HTTP ${response.status}.`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error(`Local website fetch did not return HTML for ${url}.`);
  }
  const html = await response.text();
  const title = extractTitle(html);
  const description = extractMetaDescription(html);
  return {
    html,
    markdown: htmlToText(html),
    metadata: {
      title,
      description,
      source: "local-direct-fetch",
      finalUrl: response.url,
      contentType,
    },
  };
}
