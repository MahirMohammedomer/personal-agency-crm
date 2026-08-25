import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, contacts, followUps, leadNotes, leads, projects } from "@/db/schema";
import { logActivity, normalizeLeadPayload } from "@/lib/server/leads";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isFinite(leadId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const [notes, acts, fups, projs, contactRows] = await Promise.all([
    db
      .select()
      .from(leadNotes)
      .where(eq(leadNotes.leadId, leadId))
      .orderBy(desc(leadNotes.createdAt)),
    db
      .select()
      .from(activities)
      .where(eq(activities.leadId, leadId))
      .orderBy(desc(activities.occurredAt), desc(activities.id)),
    db
      .select()
      .from(followUps)
      .where(eq(followUps.leadId, leadId))
      .orderBy(asc(followUps.dueDate)),
    db.select().from(projects).where(eq(projects.leadId, leadId)).orderBy(desc(projects.createdAt)),
    db
      .select()
      .from(contacts)
      .where(eq(contacts.leadId, leadId))
      .orderBy(desc(contacts.isPrimary), asc(contacts.id)),
  ]);

  return NextResponse.json({
    lead,
    notes,
    activities: acts,
    followUps: fups,
    projects: projs,
    contacts: contactRows,
  });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const leadId = Number(id);
  const body = (await request.json()) as Record<string, unknown>;

  const [existing] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const values = normalizeLeadPayload({ ...body });
  if ("businessName" in body) {
    const name = String(body.businessName ?? "").trim();
    if (!name) return NextResponse.json({ error: "Business name is required" }, { status: 400 });
    values.businessName = name;
  }

  const [updated] = await db
    .update(leads)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(leads.id, leadId))
    .returning();

  if (body.status && body.status !== existing.status) {
    await logActivity(
      leadId,
      "status",
      `Status changed: ${existing.status} → ${updated.status}`,
      null,
    );
  }
  if (body.tier !== undefined && updated.tier !== existing.tier) {
    await logActivity(
      leadId,
      "system",
      `Tier set to ${updated.tier ? `Tier ${updated.tier}` : "none"}`,
    );
  }
  if (body.leadScore !== undefined && updated.leadScore !== existing.leadScore) {
    await logActivity(leadId, "system", `Lead score set to ${updated.leadScore ?? "none"}`);
  }

  return NextResponse.json({ lead: updated });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const leadId = Number(id);
  const [deleted] = await db.delete(leads).where(eq(leads.id, leadId)).returning();
  if (!deleted) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
