import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { and, asc, eq, inArray, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads, projects, tasks } from "@/db/schema";
import { syncProjectProgress } from "@/lib/server/projects";

export const dynamic = "force-dynamic";

const VALID_STATUS = ["todo", "in_progress", "review", "done"];
const VALID_PRIORITY = ["low", "medium", "high", "urgent"];

export async function GET(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const params = new URL(request.url).searchParams;
  const projectId = Number(params.get("projectId"));

  if (Number.isFinite(projectId)) {
    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(tasks.position), asc(tasks.id));
    return NextResponse.json({ tasks: rows });
  }

  const openOnly = params.get("open") === "true";
  const base = db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      name: tasks.name,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      notes: tasks.notes,
      position: tasks.position,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      projectName: projects.name,
      clientName: leads.businessName,
      leadId: projects.leadId,
    })
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(leads, eq(projects.leadId, leads.id));

  const rows = openOnly
    ? await base
        .where(sql`${tasks.status} <> 'done'`)
        .orderBy(sql`${tasks.dueDate} asc nulls last`, asc(tasks.id))
    : await base.orderBy(sql`${tasks.dueDate} asc nulls last`, asc(tasks.id));

  return NextResponse.json({ tasks: rows });
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as Record<string, unknown>;
  const projectId = Number(body.projectId);
  const name = String(body.name ?? "").trim();
  if (!Number.isFinite(projectId) || !name) {
    return NextResponse.json({ error: "projectId and name are required" }, { status: 400 });
  }
  const status = VALID_STATUS.includes(String(body.status)) ? String(body.status) : "todo";
  const priority = VALID_PRIORITY.includes(String(body.priority))
    ? String(body.priority)
    : "medium";

  const [{ value: maxPos } = { value: 0 }] = await db
    .select({ value: max(tasks.position) })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));

  const [task] = await db
    .insert(tasks)
    .values({
      projectId,
      name,
      description: (String(body.description ?? "").trim() || null) as string | null,
      status,
      priority,
      dueDate: (String(body.dueDate ?? "").trim() || null) as string | null,
      notes: (String(body.notes ?? "").trim() || null) as string | null,
      position: (maxPos ?? 0) + 1,
      completedAt: status === "done" ? new Date() : null,
    })
    .returning();

  await syncProjectProgress(projectId);
  return NextResponse.json({ task }, { status: 201 });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const params = new URL(request.url).searchParams;
  const rawId = params.get("id");
  const id = rawId === null ? NaN : Number(rawId);
  const body = (await request.json()) as Record<string, unknown>;

  // Bulk reorder: { order: [taskId, ...] }
  if (Array.isArray(body.order)) {
    const ids = (body.order as unknown[]).map(Number).filter(Number.isFinite);
    if (!ids.length) return NextResponse.json({ error: "order required" }, { status: 400 });
    for (let i = 0; i < ids.length; i += 1) {
      await db.update(tasks).set({ position: i }).where(eq(tasks.id, ids[i]));
    }
    return NextResponse.json({ ok: true });
  }

  if (!Number.isFinite(id)) return NextResponse.json({ error: "id required" }, { status: 400 });

  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.description !== undefined)
    patch.description = String(body.description).trim() || null;
  if (body.status !== undefined && VALID_STATUS.includes(String(body.status))) {
    patch.status = String(body.status);
    patch.completedAt = String(body.status) === "done" ? new Date() : null;
  }
  if (body.priority !== undefined && VALID_PRIORITY.includes(String(body.priority))) {
    patch.priority = String(body.priority);
  }
  if (body.dueDate !== undefined) patch.dueDate = String(body.dueDate).trim() || null;
  if (body.notes !== undefined) patch.notes = String(body.notes).trim() || null;
  if (body.position !== undefined) patch.position = Number(body.position) || 0;

  const [task] = await db.update(tasks).set(patch).where(eq(tasks.id, id)).returning();
  await syncProjectProgress(task.projectId);
  return NextResponse.json({ task });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const params = new URL(request.url).searchParams;
  const id = Number(params.get("id"));
  const projectId = Number(params.get("projectId"));
  const clearDone = params.get("clearDone") === "true";

  if (clearDone && Number.isFinite(projectId)) {
    const removed = await db
      .delete(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.status, "done")))
      .returning({ id: tasks.id });
    await syncProjectProgress(projectId);
    return NextResponse.json({ ok: true, removed: removed.length });
  }

  if (!Number.isFinite(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  const [removed] = await db.delete(tasks).where(inArray(tasks.id, [id])).returning();
  if (removed) await syncProjectProgress(removed.projectId);
  return NextResponse.json({ ok: true });
}
