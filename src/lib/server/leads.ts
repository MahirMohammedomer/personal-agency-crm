import { and, eq, gte, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { activities, leads } from "@/db/schema";
import { buildDedupeKey, ensureUrl, normalizeMapsKey } from "@/lib/utils";
import { parseNumeric, parseTags, parseTier } from "@/lib/import-mapping";
import { LEAD_STATUSES } from "@/lib/types";

export type LeadInput = Record<string, unknown>;

const TEXT_FIELDS = [
  "businessName",
  "category",
  "address",
  "city",
  "phone",
  "phone2",
  "email",
  "mapsUrl",
  "website",
  "facebook",
  "instagram",
  "tiktok",
  "telegram",
  "linkedin",
  "notes",
  "contactPerson",
  "source",
] as const;

const NUMBER_FIELDS = ["reviewCount", "leadScore", "potentialValue"] as const;

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/** Normalizes an arbitrary payload into a lead column map. Never derives score/tier. */
export function normalizeLeadPayload(input: LeadInput) {
  const out: Record<string, unknown> = {};

  for (const field of TEXT_FIELDS) {
    if (field in input) out[field] = str(input[field]);
  }
  for (const field of NUMBER_FIELDS) {
    if (field in input) {
      const n = parseNumeric(str(input[field]));
      out[field] = n === null ? null : Math.round(n);
    }
  }
  if ("rating" in input) {
    const n = parseNumeric(str(input.rating));
    out.rating = n === null ? null : Math.round(n * 100) / 100;
  }
  if ("tier" in input) {
    out.tier = parseTier(str(input.tier));
  }
  if ("status" in input) {
    const raw = str(input.status);
    const match = LEAD_STATUSES.find((s) => s.toLowerCase() === (raw ?? "").toLowerCase());
    out.status = match ?? (raw ? raw : "New");
  }
  if ("tags" in input) {
    const value = input.tags;
    out.tags = Array.isArray(value)
      ? value.map((t) => String(t).trim()).filter(Boolean)
      : parseTags(str(value));
  }
  if ("customFields" in input && input.customFields && typeof input.customFields === "object") {
    const entries = Object.entries(input.customFields as Record<string, unknown>)
      .map(([k, v]) => [k.trim(), str(v) ?? ""] as const)
      .filter(([k, v]) => k !== "" && v !== "");
    out.customFields = Object.fromEntries(entries);
  }
  if ("archived" in input) out.archived = Boolean(input.archived);
  if ("lastContactedAt" in input) {
    const v = str(input.lastContactedAt);
    out.lastContactedAt = v ? new Date(v) : null;
  }

  const name = (out.businessName as string | null) ?? str(input.businessName);
  out.mapsKey = normalizeMapsKey((out.mapsUrl as string | null) ?? str(input.mapsUrl));
  out.dedupeKey = buildDedupeKey({
    businessName: name,
    phone: (out.phone as string | null) ?? str(input.phone),
    address: (out.address as string | null) ?? str(input.address),
    city: (out.city as string | null) ?? str(input.city),
  });

  return out;
}

export async function logActivity(
  leadId: number,
  type: string,
  summary: string,
  detail?: string | null,
  occurredAt?: Date,
) {
  await db.insert(activities).values({
    leadId,
    type,
    summary,
    detail: detail ?? null,
    occurredAt: occurredAt ?? new Date(),
  });
}

export type LeadQuery = {
  q?: string;
  status?: string[];
  tier?: string[];
  category?: string[];
  city?: string[];
  tags?: string[];
  scoreMin?: number;
  scoreMax?: number;
  ratingMin?: number;
  reviewsMin?: number;
  hasWebsite?: "yes" | "no";
  hasPhone?: "yes" | "no";
  hasSocial?: "yes" | "no";
  archived?: boolean;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export function parseLeadQuery(searchParams: URLSearchParams): LeadQuery {
  const multi = (key: string) =>
    searchParams
      .getAll(key)
      .flatMap((v) => v.split(","))
      .map((v) => v.trim())
      .filter(Boolean);
  const num = (key: string) => {
    const raw = searchParams.get(key);
    if (raw === null || raw === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };
  const tri = (key: string) => {
    const v = searchParams.get(key);
    return v === "yes" || v === "no" ? v : undefined;
  };
  return {
    q: searchParams.get("q")?.trim() || undefined,
    status: multi("status"),
    tier: multi("tier"),
    category: multi("category"),
    city: multi("city"),
    tags: multi("tags"),
    scoreMin: num("scoreMin"),
    scoreMax: num("scoreMax"),
    ratingMin: num("ratingMin"),
    reviewsMin: num("reviewsMin"),
    hasWebsite: tri("hasWebsite"),
    hasPhone: tri("hasPhone"),
    hasSocial: tri("hasSocial"),
    archived: searchParams.get("archived") === "true",
    sort: searchParams.get("sort") ?? "score_desc",
    page: num("page") ?? 1,
    pageSize: Math.min(num("pageSize") ?? 50, 5000),
  };
}

const nonEmpty = (col: AnyPgColumn) => and(isNotNull(col), sql`btrim(${col}) <> ''`);

export function buildLeadWhere(query: LeadQuery): SQL | undefined {
  const conditions: (SQL | undefined)[] = [eq(leads.archived, Boolean(query.archived))];

  if (query.q) {
    const term = `%${query.q}%`;
    conditions.push(
      or(
        ilike(leads.businessName, term),
        ilike(leads.category, term),
        ilike(leads.city, term),
        ilike(leads.address, term),
        ilike(leads.phone, term),
        ilike(leads.email, term),
        ilike(leads.contactPerson, term),
        ilike(leads.notes, term),
        sql`${leads.tags}::text ILIKE ${term}`,
      ),
    );
  }
  if (query.status?.length) conditions.push(inArray(leads.status, query.status));
  if (query.tier?.length) {
    const tiers = query.tier.filter((t) => t !== "none").map(Number).filter(Number.isFinite);
    const includeNone = query.tier.includes("none");
    const parts: (SQL | undefined)[] = [];
    if (tiers.length) parts.push(inArray(leads.tier, tiers));
    if (includeNone) parts.push(isNull(leads.tier));
    if (parts.length) conditions.push(or(...parts.filter(Boolean) as SQL[]));
  }
  if (query.category?.length) conditions.push(inArray(leads.category, query.category));
  if (query.city?.length) conditions.push(inArray(leads.city, query.city));
  if (query.tags?.length) {
    conditions.push(
      or(...query.tags.map((t) => sql`${leads.tags} @> ${JSON.stringify([t])}::jsonb`)),
    );
  }
  if (query.scoreMin !== undefined) conditions.push(gte(leads.leadScore, query.scoreMin));
  if (query.scoreMax !== undefined) conditions.push(sql`${leads.leadScore} <= ${query.scoreMax}`);
  if (query.ratingMin !== undefined) conditions.push(gte(leads.rating, query.ratingMin));
  if (query.reviewsMin !== undefined) conditions.push(gte(leads.reviewCount, query.reviewsMin));

  if (query.hasWebsite === "yes") conditions.push(nonEmpty(leads.website));
  if (query.hasWebsite === "no")
    conditions.push(or(isNull(leads.website), sql`btrim(${leads.website}) = ''`));
  if (query.hasPhone === "yes") conditions.push(nonEmpty(leads.phone));
  if (query.hasPhone === "no")
    conditions.push(or(isNull(leads.phone), sql`btrim(${leads.phone}) = ''`));

  const socialExpr = sql`(coalesce(btrim(${leads.facebook}),'') <> '' OR coalesce(btrim(${leads.instagram}),'') <> '' OR coalesce(btrim(${leads.tiktok}),'') <> '' OR coalesce(btrim(${leads.telegram}),'') <> '' OR coalesce(btrim(${leads.linkedin}),'') <> '')`;
  if (query.hasSocial === "yes") conditions.push(socialExpr);
  if (query.hasSocial === "no") conditions.push(sql`NOT ${socialExpr}`);

  const filtered = conditions.filter(Boolean) as SQL[];
  return filtered.length ? and(...filtered) : undefined;
}

export const SCORE_DESC = sql`${leads.leadScore} desc nulls last`;
export const TIER_ASC = sql`${leads.tier} asc nulls last`;

export function buildLeadOrder(sort: string | undefined): SQL[] {
  switch (sort) {
    case "score_asc":
      return [sql`${leads.leadScore} asc nulls last`, sql`${leads.businessName} asc`];
    case "name_asc":
      return [sql`${leads.businessName} asc`];
    case "name_desc":
      return [sql`${leads.businessName} desc`];
    case "rating_desc":
      return [sql`${leads.rating} desc nulls last`];
    case "reviews_desc":
      return [sql`${leads.reviewCount} desc nulls last`];
    case "tier_asc":
      return [TIER_ASC, SCORE_DESC];
    case "created_desc":
      return [sql`${leads.createdAt} desc`];
    case "created_asc":
      return [sql`${leads.createdAt} asc`];
    case "updated_desc":
      return [sql`${leads.updatedAt} desc`];
    default:
      return [SCORE_DESC, TIER_ASC];
  }
}

export function isEmptyValue(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

export { ensureUrl };
