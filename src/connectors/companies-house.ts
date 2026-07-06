/**
 * Companies House (UK) connector.
 *
 * Free registry API from https://developer.company-information.service.gov.uk
 * Key: `COMPANIES_HOUSE_API_KEY` (basic auth, user = key, password = empty).
 *
 * This is a tier-1 enrichment source per the enterprise roadmap: every UK
 * business lead should carry company number, years active, filings status,
 * and officer count before it reaches the scoring rubric.
 */

import {env, missingEnvFor} from "@/env";

export interface CompaniesHouseCompany {
  companyNumber: string;
  name: string;
  status: string;
  type: string;
  incorporatedOn: string | null;
  sicCodes: string[];
  address?: string;
  nextAccountsDue?: string | null;
  nextConfirmationDue?: string | null;
  officersCount?: number;
  yearsActive?: number;
}

export interface CompaniesHouseOfficer {
  name: string;
  role: string;
  appointedOn: string | null;
  resignedOn: string | null;
  nationality?: string;
  occupation?: string;
}

const BASE_URL = "https://api.company-information.service.gov.uk";

function requireKey(): string {
  const missing = missingEnvFor("companies-house");
  if (missing.length > 0) {
    throw new Error(`Companies House missing ${missing.join(", ")}`);
  }
  return env.COMPANIES_HOUSE_API_KEY as string;
}

function authHeader(apiKey: string): string {
  // Companies House uses HTTP basic auth with the API key as username.
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

async function apiGet<T>(path: string): Promise<T> {
  const key = requireKey();
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {Authorization: authHeader(key), Accept: "application/json"},
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Companies House ${response.status}: ${body || response.statusText}`);
  }
  return (await response.json()) as T;
}

function yearsBetween(startIso: string | null): number | undefined {
  if (!startIso) return undefined;
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return undefined;
  const diffMs = Date.now() - start;
  return Math.max(0, Math.round(diffMs / (365.25 * 86_400_000)));
}

/**
 * Free-text search (name or number). Returns the top candidates — callers
 * should pick by matching post-code or exact legal name.
 */
export async function searchCompanies(query: string, limit = 5): Promise<CompaniesHouseCompany[]> {
  interface Item {
    company_number: string;
    title: string;
    company_status?: string;
    company_type?: string;
    date_of_creation?: string;
    address_snippet?: string;
  }
  interface Search {items?: Item[]}
  const data = await apiGet<Search>(`/search/companies?q=${encodeURIComponent(query)}&items_per_page=${limit}`);
  return (data.items ?? []).map((item) => ({
    companyNumber: item.company_number,
    name: item.title,
    status: item.company_status ?? "unknown",
    type: item.company_type ?? "unknown",
    incorporatedOn: item.date_of_creation ?? null,
    sicCodes: [],
    address: item.address_snippet,
    yearsActive: yearsBetween(item.date_of_creation ?? null),
  }));
}

/** Full profile by exact company number. */
export async function getCompanyProfile(companyNumber: string): Promise<CompaniesHouseCompany> {
  interface Profile {
    company_number: string;
    company_name: string;
    company_status: string;
    type: string;
    date_of_creation?: string;
    sic_codes?: string[];
    registered_office_address?: Record<string, string | undefined>;
    accounts?: {next_due?: string};
    confirmation_statement?: {next_due?: string};
  }
  const profile = await apiGet<Profile>(`/company/${encodeURIComponent(companyNumber)}`);
  const address = profile.registered_office_address
    ? [
        profile.registered_office_address.address_line_1,
        profile.registered_office_address.address_line_2,
        profile.registered_office_address.locality,
        profile.registered_office_address.postal_code,
      ]
        .filter(Boolean)
        .join(", ")
    : undefined;
  return {
    companyNumber: profile.company_number,
    name: profile.company_name,
    status: profile.company_status,
    type: profile.type,
    incorporatedOn: profile.date_of_creation ?? null,
    sicCodes: profile.sic_codes ?? [],
    address,
    nextAccountsDue: profile.accounts?.next_due ?? null,
    nextConfirmationDue: profile.confirmation_statement?.next_due ?? null,
    yearsActive: yearsBetween(profile.date_of_creation ?? null),
  };
}

export async function getOfficers(companyNumber: string): Promise<CompaniesHouseOfficer[]> {
  interface Item {
    name: string;
    officer_role: string;
    appointed_on?: string;
    resigned_on?: string;
    nationality?: string;
    occupation?: string;
  }
  interface Officers {items?: Item[]; total_results?: number}
  const data = await apiGet<Officers>(`/company/${encodeURIComponent(companyNumber)}/officers`);
  return (data.items ?? []).map((item) => ({
    name: item.name,
    role: item.officer_role,
    appointedOn: item.appointed_on ?? null,
    resignedOn: item.resigned_on ?? null,
    nationality: item.nationality,
    occupation: item.occupation,
  }));
}

/**
 * Convenience: best-effort enrichment given just a business name.
 * Picks the first active match.
 */
export async function enrichByName(name: string): Promise<CompaniesHouseCompany | null> {
  const candidates = await searchCompanies(name, 5);
  if (candidates.length === 0) return null;
  const active = candidates.find((c) => c.status === "active") ?? candidates[0];
  // Enrich first result with a full profile for filings info.
  try {
    const profile = await getCompanyProfile(active.companyNumber);
    return profile;
  } catch {
    return active;
  }
}

export const companiesHouseConnector = {
  provider: "companies-house" as const,
  label: "Companies House (UK)",
  enables: "Company identity, years active, officers, filings status",
  missingEnv: () => missingEnvFor("companies-house"),
};
