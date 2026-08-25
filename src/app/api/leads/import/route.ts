import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { activities, leads } from "@/db/schema";
import { normalizeLeadPayload } from "@/lib/server/leads";
import { buildDedupeKey, normalizeMapsKey } from "@/lib/utils";
import type { ImportRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type Decision = "skip" | "update" | "create";

function keysFor(row: ImportRow) {
  return {
    mapsKey: normalizeMapsKey(row.mapsUrl ?? null),
    dedupeKey: buildDedupeKey({
      businessName: row.businessName,
      phone: row.phone,
      address: row.address,
      city: row.city,
    }),
  };
}

async function findExisting(rows: ImportRow[]) {
  const mapsKeys = new Set<string>();
  const dedupeKeys = new Set<string>();
  const rowKeys = rows.map((row) => {
    const k = keysFor(row);
    if (k.mapsKey) mapsKeys.add(k.mapsKey);
    if (k.dedupeKey) dedupeKeys.add(k.dedupeKey);
    return k;
  });

  const conditions = [];
  if (mapsKeys.size) conditions.push(inArray(leads.mapsKey, [...mapsKeys]));
  if (dedupeKeys.size) conditions.push(inArray(leads.dedupeKey, [...dedupeKeys]));
  const existingRows = conditions.length
    ? await db
        .select()
        .from(leads)
        .where(conditions.length === 1 ? conditions[0] : or(...conditions))
    : [];

  const byMaps = new Map<string, (typeof existingRows)[number]>();
  const byDedupe = new Map<string, (typeof existingRows)[number]>();
  for (const lead of existingRows) {
    if (lead.mapsKey && !byMaps.has(lead.mapsKey)) byMaps.set(lead.mapsKey, lead);
    if (lead.dedupeKey && !byDedupe.has(lead.dedupeKey)) byDedupe.set(lead.dedupeKey, lead);
  }
  return { rowKeys, byMaps, byDedupe };
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as {
    mode?: "analyze" | "commit";
    rows?: ImportRow[];
    decisions?: Record<string, Decision>;
    defaultDecision?: Decision;
    source?: string;
  };

  const rows = (body.rows ?? []).filter((r) => (r.businessName ?? "").trim() !== "");
  if (!rows.length) {
    return NextResponse.json({ error: "No valid rows (business name required)" }, { status: 400 });
  }

  const { rowKeys, byMaps, byDedupe } = await findExisting(rows);

  if (body.mode === "analyze") {
    const duplicates: Array<{
      index: number;
      matchedBy: "maps" | "identity" | "file";
      existing: (typeof leads.$inferSelect) | null;
      incoming: ImportRow;
    }> = [];
    const seenMaps = new Set<string>();
    const seenDedupe = new Set<string>();

    rows.forEach((row, index) => {
      const { mapsKey, dedupeKey } = rowKeys[index];
      const existing =
        (mapsKey ? byMaps.get(mapsKey) : undefined) ??
        (dedupeKey ? byDedupe.get(dedupeKey) : undefined);
      if (existing) {
        duplicates.push({
          index,
          matchedBy: mapsKey && byMaps.get(mapsKey) ? "maps" : "identity",
          existing,
          incoming: row,
        });
        return;
      }
      if ((mapsKey && seenMaps.has(mapsKey)) || (dedupeKey && seenDedupe.has(dedupeKey))) {
        duplicates.push({ index, matchedBy: "file", existing: null, incoming: row });
        return;
      }
      if (mapsKey) seenMaps.add(mapsKey);
      if (dedupeKey) seenDedupe.add(dedupeKey);
    });

    return NextResponse.json({
      total: rows.length,
      duplicates,
      newCount: rows.length - duplicates.length,
    });
  }

  /* -------------------------------- commit -------------------------------- */
  const decisions = body.decisions ?? {};
  const defaultDecision: Decision = body.defaultDecision ?? "skip";
  const source = body.source ?? "import";

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const seenMaps = new Set<string>();
  const seenDedupe = new Set<string>();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const { mapsKey, dedupeKey } = rowKeys[index];
    const existing =
      (mapsKey ? byMaps.get(mapsKey) : undefined) ??
      (dedupeKey ? byDedupe.get(dedupeKey) : undefined);
    const inFileDup =
      (mapsKey && seenMaps.has(mapsKey)) || (dedupeKey && seenDedupe.has(dedupeKey));
    const decision: Decision = decisions[String(index)] ?? defaultDecision;

    if (existing || inFileDup) {
      if (decision === "skip") {
        skipped += 1;
        continue;
      }
      if (decision === "update" && existing) {
        const payload = normalizeLeadPayload({ ...row, source });
        const merged: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(payload)) {
          if (key === "tags") {
            const incomingTags = (value as string[]) ?? [];
            merged.tags = [...new Set([...(existing.tags ?? []), ...incomingTags])];
            continue;
          }
          if (key === "customFields") {
            merged.customFields = {
              ...(existing.customFields ?? {}),
              ...((value as Record<string, string>) ?? {}),
            };
            continue;
          }
          // Never wipe existing data with empty imported values.
          if (value === null || value === undefined || value === "") continue;
          merged[key] = value;
        }
        if (row.notes && existing.notes && !existing.notes.includes(row.notes)) {
          merged.notes = `${existing.notes}\n${row.notes}`;
        }
        await db
          .update(leads)
          .set({ ...merged, updatedAt: new Date() })
          .where(eq(leads.id, existing.id));
        await db.insert(activities).values({
          leadId: existing.id,
          type: "system",
          summary: "Updated from import (existing data preserved)",
        });
        updated += 1;
        if (mapsKey) seenMaps.add(mapsKey);
        if (dedupeKey) seenDedupe.add(dedupeKey);
        continue;
      }
      if (decision !== "create") {
        skipped += 1;
        continue;
      }
    }

    const payload = normalizeLeadPayload({ ...row, source });
    const [inserted] = await db
      .insert(leads)
      .values({
        businessName: (row.businessName ?? "").trim(),
        ...payload,
      })
      .returning({ id: leads.id });
    await db.insert(activities).values({
      leadId: inserted.id,
      type: "system",
      summary: "Imported from file",
    });
    created += 1;
    if (mapsKey) seenMaps.add(mapsKey);
    if (dedupeKey) seenDedupe.add(dedupeKey);
  }

  return NextResponse.json({ ok: true, created, updated, skipped });
}
