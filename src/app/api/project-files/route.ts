import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectFiles } from "@/db/schema";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per file — plenty for logos, mockups and docs.

const CATEGORIES = ["logo", "image", "brand", "content", "document", "design", "other"];

export async function GET(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const projectId = Number(new URL(request.url).searchParams.get("projectId"));
  if (!Number.isFinite(projectId)) return NextResponse.json({ files: [] });
  const files = await db
    .select({
      id: projectFiles.id,
      projectId: projectFiles.projectId,
      name: projectFiles.name,
      mimeType: projectFiles.mimeType,
      size: projectFiles.size,
      category: projectFiles.category,
      createdAt: projectFiles.createdAt,
    })
    .from(projectFiles)
    .where(eq(projectFiles.projectId, projectId))
    .orderBy(desc(projectFiles.createdAt));
  return NextResponse.json({ files });
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const form = await request.formData();
  const projectId = Number(form.get("projectId"));
  const category = String(form.get("category") ?? "other");
  const entries = form.getAll("file").filter((f): f is File => f instanceof File);

  if (!Number.isFinite(projectId) || !entries.length) {
    return NextResponse.json({ error: "projectId and at least one file required" }, { status: 400 });
  }

  const saved: Array<{ id: number; name: string }> = [];
  for (const file of entries) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `${file.name} is larger than 8 MB` },
        { status: 413 },
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const [row] = await db
      .insert(projectFiles)
      .values({
        projectId,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        category: CATEGORIES.includes(category) ? category : "other",
        data: buffer.toString("base64"),
      })
      .returning({ id: projectFiles.id, name: projectFiles.name });
    saved.push(row);
  }

  return NextResponse.json({ ok: true, files: saved }, { status: 201 });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const id = Number(new URL(request.url).searchParams.get("id"));
  const body = (await request.json()) as { category?: string; name?: string };
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (body.category && CATEGORIES.includes(body.category)) patch.category = body.category;
  if (body.name?.trim()) patch.name = body.name.trim();
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  await db.update(projectFiles).set(patch).where(eq(projectFiles.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(projectFiles).where(eq(projectFiles.id, id));
  return NextResponse.json({ ok: true });
}
