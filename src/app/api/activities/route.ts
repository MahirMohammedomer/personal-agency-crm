import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, leads } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const params = new URL(request.url).searchParams;
  const leadId = Number(params.get("leadId"));
  const limit = Math.min(Number(params.get("limit") ?? 20), 100);

  if (Number.isFinite(leadId)) {
    const rows = await db
      .select()
      .from(activities)
      .where(eq(activities.leadId, leadId))
      .orderBy(desc(activities.occurredAt));
    return NextResponse.json({ activities: rows });
  }

  const rows = await db
    .select({
      id: activities.id,
      leadId: activities.leadId,
      type: activities.type,
      summary: activities.summary,
      detail: activities.detail,
      occurredAt: activities.occurredAt,
      createdAt: activities.createdAt,
      businessName: leads.businessName,
    })
    .from(activities)
    .leftJoin(leads, eq(activities.leadId, leads.id))
    .orderBy(desc(activities.occurredAt), desc(activities.id))
    .limit(limit);
  return NextResponse.json({ activities: rows });
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as {
    leadId?: number;
    type?: string;
    summary?: string;
    detail?: string;
    occurredAt?: string;
    touchLastContacted?: boolean;
  };
  const leadId = Number(body.leadId);
  const summary = (body.summary ?? "").trim();
  if (!Number.isFinite(leadId) || !summary) {
    return NextResponse.json({ error: "leadId and summary are required" }, { status: 400 });
  }
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  const [activity] = await db
    .insert(activities)
    .values({
      leadId,
      type: body.type ?? "other",
      summary,
      detail: body.detail?.trim() || null,
      occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
    })
    .returning();

  if (["call", "whatsapp", "email", "meeting", "message"].includes(activity.type)) {
    await db
      .update(leads)
      .set({ lastContactedAt: activity.occurredAt, updatedAt: new Date() })
      .where(eq(leads.id, leadId));
  }

  return NextResponse.json({ activity }, { status: 201 });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(activities).where(eq(activities.id, id));
  return NextResponse.json({ ok: true });
}
