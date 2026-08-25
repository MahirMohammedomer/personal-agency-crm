import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const leadId = Number(new URL(request.url).searchParams.get("leadId"));
  if (!Number.isFinite(leadId)) return NextResponse.json({ contacts: [] });
  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.leadId, leadId))
    .orderBy(desc(contacts.isPrimary), asc(contacts.id));
  return NextResponse.json({ contacts: rows });
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as Record<string, unknown>;
  const leadId = Number(body.leadId);
  const name = String(body.name ?? "").trim();
  if (!Number.isFinite(leadId) || !name) {
    return NextResponse.json({ error: "leadId and name are required" }, { status: 400 });
  }
  const isPrimary = Boolean(body.isPrimary);
  if (isPrimary) {
    await db.update(contacts).set({ isPrimary: false }).where(eq(contacts.leadId, leadId));
  }
  const [contact] = await db
    .insert(contacts)
    .values({
      leadId,
      name,
      role: (String(body.role ?? "").trim() || null) as string | null,
      phone: (String(body.phone ?? "").trim() || null) as string | null,
      email: (String(body.email ?? "").trim() || null) as string | null,
      notes: (String(body.notes ?? "").trim() || null) as string | null,
      isPrimary,
    })
    .returning();
  return NextResponse.json({ contact }, { status: 201 });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  const body = (await request.json()) as Record<string, unknown>;

  const [existing] = await db.select().from(contacts).where(eq(contacts.id, id));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.isPrimary) {
    await db
      .update(contacts)
      .set({ isPrimary: false })
      .where(and(eq(contacts.leadId, existing.leadId), ne(contacts.id, id)));
  }

  const patch: Record<string, unknown> = {};
  for (const key of ["name", "role", "phone", "email", "notes"] as const) {
    if (body[key] !== undefined) patch[key] = String(body[key]).trim() || null;
  }
  if (body.isPrimary !== undefined) patch.isPrimary = Boolean(body.isPrimary);
  if (patch.name === null) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const [contact] = await db.update(contacts).set(patch).where(eq(contacts.id, id)).returning();
  return NextResponse.json({ contact });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(contacts).where(eq(contacts.id, id));
  return NextResponse.json({ ok: true });
}
