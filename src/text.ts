export function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.find((value) => value && value.trim()) ?? null;
}

export function normalizeWhitespace(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

export function extractEmails(input: string) {
  return [...new Set(input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])];
}

export function extractPhones(input: string) {
  return [...new Set(input.match(/(?:\+44|0)\s?(?:\d\s?){9,10}/g) ?? [])].map((value) => normalizeWhitespace(value));
}

export function extractRating(input: string) {
  const match = input.match(/([1-5](?:\.\d)?)\s*(?:stars?|rating)/i) ?? input.match(/rated\s*([1-5](?:\.\d)?)/i);
  return match ? Number.parseFloat(match[1]) : null;
}

export function extractReviewCount(input: string) {
  const match = input.match(/(\d[\d,]*)\s+reviews?/i);
  return match ? Number.parseInt(match[1].replace(/,/g, ""), 10) : null;
}

export function trimText(input: string, limit: number) {
  const cleaned = normalizeWhitespace(input);
  if (cleaned.length <= limit) {
    return cleaned;
  }
  return `${cleaned.slice(0, limit - 1).trim()}…`;
}
