import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, followUps, leads } from "@/db/schema";

export const dynamic = "force-dynamic";

const leadShape = {
  id: leads.id,
  businessName: leads.businessName,
  phone: leads.phone,
  category: leads.category,
  city: leads.city,
  tier: leads.tier,
  status: leads.status,
  leadScore: leads.leadScore,
};

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const rows = await db
    .select({
      id: followUps.id,
      leadId: followUps.leadId,
      dueDate: followUps.dueDate,
      note: followUps.note,
      status: followUps.status,
      completedAt: followUps.completedAt,
      createdAt: followUps.createdAt,
      lead: leadShape,
    })
    .from(followUps)
    .leftJoin(leads, eq(followUps.leadId, leads.id))
    .orderBy(asc(followUps.dueDate), asc(followUps.id));

  return NextResponse.json({ followUps: rows });
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as {
    leadId?: number;
    dueDate?: string;
    note?: string;
  };
  const leadId = Number(body.leadId);
  const dueDate = (body.dueDate ?? "").trim();
  if (!Number.isFinite(leadId) || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return NextResponse.json({ error: "leadId and dueDate (YYYY-MM-DD) required" }, { status: 400 });
  }
  const [followUp] = await db
    .insert(followUps)
    .values({ leadId, dueDate, note: body.note?.trim() || null })
    .returning();
  await db.insert(activities).values({
    leadId,
    type: "system",
    summary: `Follow-up scheduled for ${dueDate}`,
    detail: body.note?.trim() || null,
  });
  return NextResponse.json({ followUp }, { status: 201 });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const id = Number(new URL(request.url).searchParams.get("id"));
  const body = (await request.json()) as { status?: string; dueDate?: string; note?: string };
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id required" }, { status: 400 });

  const [existing] = await db.select().from(followUps).where(eq(followUps.id, id));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (body.status) {
    patch.status = body.status;
    patch.completedAt = body.status === "done" ? new Date() : null;
  }
  if (body.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) patch.dueDate = body.dueDate;
  if (body.note !== undefined) patch.note = body.note.trim() || null;

  const [updated] = await db.update(followUps).set(patch).where(eq(followUps.id, id)).returning();

  if (body.status === "done") {
    await db.insert(activities).values({
      leadId: existing.leadId,
      type: "system",
      summary: "Follow-up completed",
      detail: existing.note,
    });
  } else if (body.dueDate && body.dueDate !== existing.dueDate) {
    await db.insert(activities).values({
      leadId: existing.leadId,
      type: "system",
      summary: `Follow-up rescheduled to ${body.dueDate}`,
    });
  }

  return NextResponse.json({ followUp: updated });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(followUps).where(eq(followUps.id, id));
  return NextResponse.json({ ok: true });
}
