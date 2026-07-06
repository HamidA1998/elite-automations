import path from "node:path";

const requireEnv = (name: string, fallback?: string) => {
  const value = process.env[name];
  if (value !== undefined && value !== "") return value;
  if (fallback !== undefined) return fallback;
  return "";
};

const parseListEnv = (name: string, fallback: string[]) => {
  const value = process.env[name];
  if (!value) return fallback;
  const items = value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
};

const defaultAreas = [
  "Chadderton, Greater Manchester",
  "Oldham, Greater Manchester",
  "Rochdale, Greater Manchester",
  "Bury, Greater Manchester",
  "Stockport, Greater Manchester",
  "Bolton, Greater Manchester",
  "Salford, Greater Manchester",
  "Manchester City Centre",
  "Ashton-under-Lyne, Greater Manchester",
  "Middleton, Greater Manchester",
  "Failsworth, Greater Manchester",
  "Droylsden, Greater Manchester",
];

const defaultBusinessTypes = [
  "Restaurants and takeaways",
  "Dental practices and dentists",
  "Hair salons and barbers",
  "Beauty salons and nail bars",
  "Plumbers",
  "Electricians",
  "Builders and construction companies",
  "Roofing companies",
  "Landscaping and gardening companies",
  "Car garages and mechanics",
  "MOT centres",
  "Solicitors and law firms",
  "Accountants",
  "Estate agents",
  "Letting agents",
  "Cleaning companies",
  "Removal companies",
  "Gyms and personal trainers",
  "Physiotherapists and chiropractors",
  "Opticians",
  "Vets",
  "Driving instructors",
  "Wedding photographers",
  "Printing companies",
  "Signage companies",
];

export const areas = parseListEnv("PIPELINE_AREAS", defaultAreas);
export const businessTypes = parseListEnv("PIPELINE_BUSINESS_TYPES", defaultBusinessTypes);

export const rootDir = process.cwd();
export const outputDir = path.join(rootDir, "output");
export const outputFiles = {
  leadsRaw: path.join(outputDir, "leads-raw.json"),
  leadsQualified: path.join(outputDir, "leads-qualified.json"),
  leadsQualifiedCsv: path.join(outputDir, "leads-qualified.csv"),
  crmJson: path.join(outputDir, "outreach-crm.json"),
  dashboardHtml: path.join(outputDir, "outreach-dashboard.html"),
  outreachSummary: path.join(outputDir, "outreach-summary.md"),
  crmDatabase: path.join(outputDir, "elite-ops.sqlite"),
  images: path.join(outputDir, "images"),
  demos: path.join(outputDir, "demos"),
  videos: path.join(outputDir, "videos"),
  emails: path.join(outputDir, "emails"),
  remotionData: path.join(outputDir, "remotion-data"),
};

export const firecrawl = {
  apiKey: process.env.FIRECRAWL_API_KEY ?? "",
  baseUrl: requireEnv("FIRECRAWL_BASE_URL", "https://api.firecrawl.dev/v2"),
  country: "UK",
};

export const kie = {
  apiKey: process.env.KIE_API_KEY ?? "",
  baseUrl: requireEnv("KIE_BASE_URL", "https://api.kie.ai"),
  model: "google/nano-banana-pro",
};

export const brand = {
  ownerName: requireEnv("ELITE_NAME", "Hamid"),
  businessName: requireEnv("ELITE_BRAND", "Hamid Enterprise"),
  domain: requireEnv("ELITE_DOMAIN", "eliteautomations.co.uk"),
};

export const pipeline = {
  maxPerQuery: Number.parseInt(requireEnv("PIPELINE_MAX_PER_QUERY", "8"), 10),
  maxQualified: Number.parseInt(requireEnv("PIPELINE_MAX_QUALIFIED", "10"), 10),
  maxQualifyingScore: Number.parseInt(requireEnv("PIPELINE_MAX_QUALIFYING_SCORE", "50"), 10),
  skipImages: ["1", "true", "yes"].includes(requireEnv("PIPELINE_SKIP_IMAGES", "").toLowerCase()),
};
