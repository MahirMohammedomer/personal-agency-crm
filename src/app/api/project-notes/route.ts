import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectNotes } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const projectId = Number(new URL(request.url).searchParams.get("projectId"));
  if (!Number.isFinite(projectId)) return NextResponse.json({ notes: [] });
  const notes = await db
    .select()
    .from(projectNotes)
    .where(eq(projectNotes.projectId, projectId))
    .orderBy(desc(projectNotes.createdAt));
  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as { projectId?: number; body?: string };
  const projectId = Number(body.projectId);
  const text = (body.body ?? "").trim();
  if (!Number.isFinite(projectId) || !text) {
    return NextResponse.json({ error: "projectId and body are required" }, { status: 400 });
  }
  const [note] = await db.insert(projectNotes).values({ projectId, body: text }).returning();
  return NextResponse.json({ note }, { status: 201 });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(projectNotes).where(eq(projectNotes.id, id));
  return NextResponse.json({ ok: true });
}
