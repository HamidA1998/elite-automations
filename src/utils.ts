import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, {recursive: true});
}

export async function writeJson(filePath: string, data: unknown) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function writeText(filePath: string, content: string) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

export async function writeBinary(filePath: string, data: ArrayBuffer) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, Buffer.from(data));
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function uniqueId(...parts: string[]) {
  return crypto.createHash("sha1").update(parts.join("::")).digest("hex").slice(0, 12);
}

export function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) {
    return "";
  }

  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n") + "\n";
}

export function chunk<T>(items: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
