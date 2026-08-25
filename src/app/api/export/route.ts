import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import {
  activities,
  appSettings,
  contacts,
  followUps,
  leadNotes,
  leads,
  projectFiles,
  projectNotes,
  projects,
  tasks,
} from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const scope = new URL(request.url).searchParams.get("scope") ?? "all";

  if (scope === "leads") {
    const rows = await db.select().from(leads).orderBy(asc(leads.id));
    return NextResponse.json({ leads: rows });
  }

  const [
    leadRows,
    noteRows,
    activityRows,
    followUpRows,
    projectRows,
    taskRows,
    projectNoteRows,
    contactRows,
    fileRows,
    settingRows,
  ] = await Promise.all([
    db.select().from(leads).orderBy(asc(leads.id)),
    db.select().from(leadNotes).orderBy(asc(leadNotes.id)),
    db.select().from(activities).orderBy(asc(activities.id)),
    db.select().from(followUps).orderBy(asc(followUps.id)),
    db.select().from(projects).orderBy(asc(projects.id)),
    db.select().from(tasks).orderBy(asc(tasks.id)),
    db.select().from(projectNotes).orderBy(asc(projectNotes.id)),
    db.select().from(contacts).orderBy(asc(contacts.id)),
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
      .orderBy(asc(projectFiles.id)),
    db.select().from(appSettings),
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    version: 2,
    leads: leadRows,
    notes: noteRows,
    activities: activityRows,
    followUps: followUpRows,
    projects: projectRows,
    tasks: taskRows,
    projectNotes: projectNoteRows,
    contacts: contactRows,
    files: fileRows,
    settings: settingRows,
  });
}
