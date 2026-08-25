import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  activities,
  contacts,
  leads,
  projectFiles,
  projectNotes,
  projects,
  tasks,
} from "@/db/schema";
import { syncProjectProgress } from "@/lib/server/projects";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await syncProjectProgress(projectId);

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [[lead], taskRows, noteRows, fileRows, contactRows, activityRows] = await Promise.all([
    db.select().from(leads).where(eq(leads.id, project.leadId)),
    db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(tasks.position), asc(tasks.id)),
    db
      .select()
      .from(projectNotes)
      .where(eq(projectNotes.projectId, projectId))
      .orderBy(desc(projectNotes.createdAt)),
    db
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
      .orderBy(desc(projectFiles.createdAt)),
    db.select().from(contacts).where(eq(contacts.leadId, project.leadId)).orderBy(desc(contacts.isPrimary), asc(contacts.id)),
    db
      .select()
      .from(activities)
      .where(eq(activities.leadId, project.leadId))
      .orderBy(desc(activities.occurredAt), desc(activities.id))
      .limit(12),
  ]);

  return NextResponse.json({
    project,
    lead: lead ?? null,
    tasks: taskRows,
    notes: noteRows,
    files: fileRows,
    contacts: contactRows,
    activities: activityRows,
  });
}
