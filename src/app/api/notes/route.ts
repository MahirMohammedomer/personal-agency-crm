import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { leadNotes } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const leadId = Number(new URL(request.url).searchParams.get("leadId"));
  if (!Number.isFinite(leadId)) return NextResponse.json({ notes: [] });
  const notes = await db
    .select()
    .from(leadNotes)
    .where(eq(leadNotes.leadId, leadId))
    .orderBy(desc(leadNotes.createdAt));
  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as { leadId?: number; body?: string };
  const leadId = Number(body.leadId);
  const text = (body.body ?? "").trim();
  if (!Number.isFinite(leadId) || !text) {
    return NextResponse.json({ error: "leadId and body are required" }, { status: 400 });
  }
  const [note] = await db.insert(leadNotes).values({ leadId, body: text }).returning();
  return NextResponse.json({ note }, { status: 201 });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(leadNotes).where(eq(leadNotes.id, id));
  return NextResponse.json({ ok: true });
}
