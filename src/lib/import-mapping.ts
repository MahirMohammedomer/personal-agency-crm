import { IMPORT_FIELDS, type ImportFieldKey } from "./types";

const MATCHERS: Array<{ key: ImportFieldKey; patterns: RegExp[] }> = [
  {
    key: "businessName",
    patterns: [/^business.?name$/, /^name$/, /^company/, /^business$/, /^title$/, /shop.?name/],
  },
  {
    key: "category",
    patterns: [/categor/, /niche/, /industry/, /business.?type/, /^type$/, /sector/],
  },
  { key: "city", patterns: [/^city$/, /^location$/, /^town$/, /^area$/, /region/, /sub.?city/] },
  { key: "address", patterns: [/address/, /^street/, /full.?address/, /^located/] },
  {
    key: "phone",
    patterns: [/^phone$/, /phone.?(1|number)/, /^tel/, /mobile/, /contact.?number/, /^whatsapp$/],
  },
  { key: "phone2", patterns: [/phone.?2/, /second.?phone/, /alt.*phone/, /other.?phone/] },
  { key: "email", patterns: [/e.?mail/] },
  { key: "rating", patterns: [/rating/, /stars?/, /^score.?google/] },
  { key: "reviewCount", patterns: [/reviews?/, /review.?count/, /^ratings?.?count/, /^votes/] },
  {
    key: "mapsUrl",
    patterns: [/maps/, /google.?url/, /gmaps/, /map.?link/, /google.?maps.?url/],
  },
  { key: "website", patterns: [/website/, /web.?site/, /^url$/, /^site$/, /domain/, /webpage/] },
  { key: "facebook", patterns: [/facebook/, /^fb$/, /fb.?page/, /fb.?url/] },
  { key: "instagram", patterns: [/instagram/, /^ig$/, /insta/] },
  { key: "tiktok", patterns: [/tik.?tok/] },
  { key: "telegram", patterns: [/telegram/, /^tg$/] },
  { key: "linkedin", patterns: [/linked.?in/] },
  {
    key: "leadScore",
    patterns: [/lead.?score/, /^score$/, /priority.?score/, /^points$/, /^rank.?score/],
  },
  { key: "tier", patterns: [/^tier$/, /priority.?tier/, /^priority$/, /^grade$/, /^class$/] },
  { key: "status", patterns: [/^status$/, /lead.?status/, /^stage$/, /pipeline/] },
  { key: "tags", patterns: [/^tags?$/, /labels?/, /keywords?/] },
  { key: "notes", patterns: [/notes?/, /comment/, /remark/, /description/] },
  {
    key: "contactPerson",
    patterns: [/contact.?person/, /owner/, /manager/, /contact.?name/, /^person$/],
  },
  {
    key: "potentialValue",
    patterns: [/potential.?value/, /deal.?value/, /^value$/, /budget/, /estimate/, /price/],
  },
];

/** Guess which canonical field each spreadsheet header maps to. */
export function autoMapColumns(headers: string[]): Record<string, ImportFieldKey | "" | "custom"> {
  const result: Record<string, ImportFieldKey | "" | "custom"> = {};
  const taken = new Set<ImportFieldKey>();
  for (const header of headers) {
    const norm = header.trim().toLowerCase().replace(/[\s_-]+/g, " ").trim();
    const compact = norm.replace(/\s+/g, "");
    let matched: ImportFieldKey | "" = "";
    for (const matcher of MATCHERS) {
      if (taken.has(matcher.key)) continue;
      if (
        matcher.patterns.some((p) => p.test(norm) || p.test(compact)) ||
        compact === matcher.key.toLowerCase()
      ) {
        matched = matcher.key;
        break;
      }
    }
    if (matched) {
      taken.add(matched);
      result[header] = matched;
    } else {
      result[header] = "custom";
    }
  }
  return result;
}

export const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  IMPORT_FIELDS.map((f) => [f.key, f.label]),
);

export function cleanCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export function parseNumeric(value: string | undefined | null): number | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value)
    .replace(/[^\d.,-]/g, "")
    .replace(/,/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseTier(value: string | undefined | null): number | null {
  if (!value) return null;
  const n = parseNumeric(value);
  if (n !== null && n >= 1 && n <= 5) return Math.round(n);
  const m = String(value).match(/([1-5])/);
  return m ? Number(m[1]) : null;
}

export function parseTags(value: string | undefined | null): string[] {
  if (!value) return [];
  return String(value)
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 24);
}
