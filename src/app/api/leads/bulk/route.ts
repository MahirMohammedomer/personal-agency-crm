import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, leads } from "@/db/schema";
import { parseTier } from "@/lib/import-mapping";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as {
    ids?: number[];
    action?: string;
    value?: unknown;
  };
  const ids = (body.ids ?? []).map(Number).filter(Number.isFinite);
  if (!ids.length) return NextResponse.json({ error: "No leads selected" }, { status: 400 });

  const action = body.action;
  const now = new Date();

  switch (action) {
    case "status": {
      const status = String(body.value ?? "").trim();
      if (!status) return NextResponse.json({ error: "Status required" }, { status: 400 });
      await db.update(leads).set({ status, updatedAt: now }).where(inArray(leads.id, ids));
      await db
        .insert(activities)
        .values(
          ids.map((leadId) => ({
            leadId,
            type: "status",
            summary: `Status changed to ${status}`,
          })),
        );
      break;
    }
    case "tier": {
      const tier = body.value === null ? null : parseTier(String(body.value));
      await db.update(leads).set({ tier, updatedAt: now }).where(inArray(leads.id, ids));
      break;
    }
    case "addTags": {
      const tags = (Array.isArray(body.value) ? body.value : [body.value])
        .map((t) => String(t).trim())
        .filter(Boolean);
      if (!tags.length) return NextResponse.json({ error: "Tags required" }, { status: 400 });
      await db
        .update(leads)
        .set({
          tags: sql`(
            SELECT coalesce(jsonb_agg(DISTINCT t.value), '[]'::jsonb)
            FROM jsonb_array_elements_text(${leads.tags} || ${JSON.stringify(tags)}::jsonb) AS t(value)
          )`,
          updatedAt: now,
        })
        .where(inArray(leads.id, ids));
      break;
    }
    case "removeTags": {
      const tags = (Array.isArray(body.value) ? body.value : [body.value])
        .map((t) => String(t).trim())
        .filter(Boolean);
      await db
        .update(leads)
        .set({
          tags: sql`(
            SELECT coalesce(jsonb_agg(t.value), '[]'::jsonb)
            FROM jsonb_array_elements_text(${leads.tags}) AS t(value)
            WHERE NOT (${JSON.stringify(tags)}::jsonb ? t.value)
          )`,
          updatedAt: now,
        })
        .where(inArray(leads.id, ids));
      break;
    }
    case "archive":
    case "unarchive": {
      await db
        .update(leads)
        .set({ archived: action === "archive", updatedAt: now })
        .where(inArray(leads.id, ids));
      break;
    }
    case "delete": {
      await db.delete(leads).where(inArray(leads.id, ids));
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, affected: ids.length });
}
