import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, leads, projectFiles, projectNotes, projects, tasks } from "@/db/schema";
import { clampProgress, toInt } from "@/lib/server/projects";

export const dynamic = "force-dynamic";

const taskTotalSql = sql<number>`(SELECT count(*)::int FROM ${tasks} WHERE ${tasks.projectId} = ${projects.id})`;
const taskDoneSql = sql<number>`(SELECT count(*)::int FROM ${tasks} WHERE ${tasks.projectId} = ${projects.id} AND ${tasks.status} = 'done')`;
const fileCountSql = sql<number>`(SELECT count(*)::int FROM ${projectFiles} WHERE ${projectFiles.projectId} = ${projects.id})`;
const noteCountSql = sql<number>`(SELECT count(*)::int FROM ${projectNotes} WHERE ${projectNotes.projectId} = ${projects.id})`;

export async function GET(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const leadId = Number(new URL(request.url).searchParams.get("leadId"));
  const base = db
    .select({
      id: projects.id,
      leadId: projects.leadId,
      name: projects.name,
      status: projects.status,
      stage: projects.stage,
      progress: projects.progress,
      autoProgress: projects.autoProgress,
      value: projects.value,
      paid: projects.paid,
      dueDate: projects.dueDate,
      siteUrl: projects.siteUrl,
      notes: projects.notes,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      taskTotal: taskTotalSql,
      taskDone: taskDoneSql,
      fileCount: fileCountSql,
      noteCount: noteCountSql,
      lead: {
        id: leads.id,
        businessName: leads.businessName,
        phone: leads.phone,
        city: leads.city,
        category: leads.category,
      },
    })
    .from(projects)
    .leftJoin(leads, eq(projects.leadId, leads.id));

  const rows = Number.isFinite(leadId)
    ? await base.where(eq(projects.leadId, leadId)).orderBy(desc(projects.createdAt))
    : await base.orderBy(desc(projects.createdAt));

  return NextResponse.json({ projects: rows });
}

const DEFAULT_TASKS: Array<{ name: string; stage: string; priority: string }> = [
  { name: "Kickoff call & requirements", stage: "Planning", priority: "high" },
  { name: "Collect logo, photos & brand assets", stage: "Planning", priority: "high" },
  { name: "Sitemap & page list", stage: "Planning", priority: "medium" },
  { name: "Homepage design", stage: "Design", priority: "high" },
  { name: "Inner page designs", stage: "Design", priority: "medium" },
  { name: "Build pages", stage: "Development", priority: "high" },
  { name: "Mobile responsive pass", stage: "Development", priority: "high" },
  { name: "Write & place content", stage: "Content", priority: "medium" },
  { name: "Contact form + WhatsApp button", stage: "Development", priority: "medium" },
  { name: "Client review round", stage: "Testing", priority: "high" },
  { name: "Speed & SEO basics", stage: "Testing", priority: "medium" },
  { name: "Domain, hosting & go live", stage: "Launch", priority: "urgent" },
];

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as Record<string, unknown>;
  const leadId = Number(body.leadId);
  const name = String(body.name ?? "").trim();
  if (!Number.isFinite(leadId) || !name) {
    return NextResponse.json({ error: "leadId and name are required" }, { status: 400 });
  }
  const [project] = await db
    .insert(projects)
    .values({
      leadId,
      name,
      status: String(body.status ?? "planning"),
      stage: String(body.stage ?? "Planning"),
      progress: clampProgress(body.progress ?? 0),
      value: toInt(body.value),
      paid: toInt(body.paid),
      dueDate: (String(body.dueDate ?? "").trim() || null) as string | null,
      siteUrl: (String(body.siteUrl ?? "").trim() || null) as string | null,
      notes: (String(body.notes ?? "").trim() || null) as string | null,
    })
    .returning();

  if (body.withStarterTasks) {
    await db.insert(tasks).values(
      DEFAULT_TASKS.map((t, i) => ({
        projectId: project.id,
        name: t.name,
        priority: t.priority,
        status: "todo",
        position: i,
        description: `${t.stage} stage`,
      })),
    );
  }

  await db.insert(activities).values({
    leadId,
    type: "system",
    summary: `Project created: ${name}`,
  });

  return NextResponse.json({ project }, { status: 201 });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  const body = (await request.json()) as Record<string, unknown>;

  const [existing] = await db.select().from(projects).where(eq(projects.id, id));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.status !== undefined) patch.status = String(body.status);
  if (body.stage !== undefined) patch.stage = String(body.stage);
  if (body.progress !== undefined) {
    patch.progress = clampProgress(body.progress);
    // Manually setting progress switches the project out of auto mode.
    if (body.autoProgress === undefined) patch.autoProgress = false;
  }
  if (body.autoProgress !== undefined) patch.autoProgress = Boolean(body.autoProgress);
  if (body.value !== undefined) patch.value = toInt(body.value);
  if (body.paid !== undefined) patch.paid = toInt(body.paid);
  if (body.dueDate !== undefined) patch.dueDate = String(body.dueDate).trim() || null;
  if (body.siteUrl !== undefined) patch.siteUrl = String(body.siteUrl).trim() || null;
  if (body.notes !== undefined) patch.notes = String(body.notes).trim() || null;

  const [project] = await db.update(projects).set(patch).where(eq(projects.id, id)).returning();

  if (body.stage !== undefined && project.stage !== existing.stage) {
    await db.insert(activities).values({
      leadId: project.leadId,
      type: "system",
      summary: `${project.name}: stage → ${project.stage}`,
    });
  }
  if (body.paid !== undefined && project.paid !== existing.paid) {
    const delta = project.paid - existing.paid;
    await db.insert(activities).values({
      leadId: project.leadId,
      type: "system",
      summary: `Payment recorded: ${delta > 0 ? "+" : ""}${delta.toLocaleString()} ETB on ${project.name}`,
    });
  }

  return NextResponse.json({ project });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(projects).where(eq(projects.id, id));
  return NextResponse.json({ ok: true });
}
