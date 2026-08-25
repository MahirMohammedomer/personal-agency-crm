import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { count, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import {
  buildLeadOrder,
  buildLeadWhere,
  logActivity,
  normalizeLeadPayload,
  parseLeadQuery,
} from "@/lib/server/leads";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const url = new URL(request.url);
  const query = parseLeadQuery(url.searchParams);
  const where = buildLeadWhere(query);
  const page = Math.max(query.page ?? 1, 1);
  const pageSize = query.pageSize ?? 50;

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(where)
      .orderBy(...buildLeadOrder(query.sort))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(leads).where(where),
  ]);

  let facets: { categories: string[]; cities: string[]; tags: string[] } | undefined;
  if (url.searchParams.get("facets") === "true") {
    const [cats, cities, tagRows] = await Promise.all([
      db
        .select({ value: leads.category })
        .from(leads)
        .where(sql`coalesce(btrim(${leads.category}),'') <> ''`)
        .groupBy(leads.category)
        .orderBy(leads.category),
      db
        .select({ value: leads.city })
        .from(leads)
        .where(sql`coalesce(btrim(${leads.city}),'') <> ''`)
        .groupBy(leads.city)
        .orderBy(leads.city),
      db.execute<{ tag: string }>(
        sql`SELECT DISTINCT jsonb_array_elements_text(${leads.tags}) AS tag FROM ${leads} ORDER BY tag`,
      ),
    ]);
    facets = {
      categories: cats.map((c) => c.value).filter(Boolean) as string[],
      cities: cities.map((c) => c.value).filter(Boolean) as string[],
      tags: (tagRows.rows ?? []).map((r) => r.tag).filter(Boolean),
    };
  }

  return NextResponse.json({
    leads: rows,
    total: totals[0]?.value ?? 0,
    page,
    pageSize,
    facets,
  });
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as Record<string, unknown>;
  if (!body.businessName || String(body.businessName).trim() === "") {
    return NextResponse.json({ error: "Business name is required" }, { status: 400 });
  }
  const values = normalizeLeadPayload(body);
  const [created] = await db
    .insert(leads)
    .values({
      businessName: String(body.businessName).trim(),
      ...values,
    })
    .returning();

  await logActivity(created.id, "system", "Lead created");
  return NextResponse.json({ lead: created }, { status: 201 });
}
