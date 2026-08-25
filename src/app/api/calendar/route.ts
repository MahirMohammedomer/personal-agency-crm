import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, followUps, leads, projects, tasks } from "@/db/schema";

export const dynamic = "force-dynamic";

export type CalendarEvent = {
  id: string;
  date: string;
  type: "followup" | "task" | "project" | "meeting";
  title: string;
  subtitle: string;
  href: string;
  done: boolean;
  meta?: string;
};

export async function GET(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "1900-01-01";
  const to = params.get("to") ?? "2999-12-31";

  const [followUpRows, taskRows, projectRows, meetingRows] = await Promise.all([
    db
      .select({
        id: followUps.id,
        dueDate: followUps.dueDate,
        note: followUps.note,
        status: followUps.status,
        leadId: followUps.leadId,
        businessName: leads.businessName,
      })
      .from(followUps)
      .leftJoin(leads, eq(followUps.leadId, leads.id))
      .where(and(gte(followUps.dueDate, from), lte(followUps.dueDate, to))),
    db
      .select({
        id: tasks.id,
        dueDate: tasks.dueDate,
        name: tasks.name,
        status: tasks.status,
        priority: tasks.priority,
        projectId: tasks.projectId,
        projectName: projects.name,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(isNotNull(tasks.dueDate), gte(tasks.dueDate, from), lte(tasks.dueDate, to))),
    db
      .select({
        id: projects.id,
        dueDate: projects.dueDate,
        name: projects.name,
        stage: projects.stage,
        progress: projects.progress,
        clientName: leads.businessName,
      })
      .from(projects)
      .leftJoin(leads, eq(projects.leadId, leads.id))
      .where(and(isNotNull(projects.dueDate), gte(projects.dueDate, from), lte(projects.dueDate, to))),
    db
      .select({
        id: activities.id,
        occurredAt: activities.occurredAt,
        summary: activities.summary,
        leadId: activities.leadId,
        businessName: leads.businessName,
      })
      .from(activities)
      .leftJoin(leads, eq(activities.leadId, leads.id))
      .where(
        and(
          eq(activities.type, "meeting"),
          sql`to_char(${activities.occurredAt}, 'YYYY-MM-DD') BETWEEN ${from} AND ${to}`,
        ),
      ),
  ]);

  const events: CalendarEvent[] = [
    ...followUpRows.map((f) => ({
      id: `f-${f.id}`,
      date: f.dueDate,
      type: "followup" as const,
      title: f.businessName ?? "Follow-up",
      subtitle: f.note || "Follow up",
      href: `/leads/${f.leadId}`,
      done: f.status !== "pending",
      meta: f.status,
    })),
    ...taskRows.map((t) => ({
      id: `t-${t.id}`,
      date: t.dueDate as string,
      type: "task" as const,
      title: t.name,
      subtitle: t.projectName ?? "Task",
      href: `/projects/${t.projectId}`,
      done: t.status === "done",
      meta: t.priority,
    })),
    ...projectRows.map((p) => ({
      id: `p-${p.id}`,
      date: p.dueDate as string,
      type: "project" as const,
      title: `${p.name} deadline`,
      subtitle: p.clientName ?? "Project",
      href: `/projects/${p.id}`,
      done: p.progress >= 100 || p.stage === "Completed",
      meta: `${p.progress}%`,
    })),
    ...meetingRows.map((m) => ({
      id: `m-${m.id}`,
      date: new Date(m.occurredAt).toISOString().slice(0, 10),
      type: "meeting" as const,
      title: m.summary,
      subtitle: m.businessName ?? "Meeting",
      href: `/leads/${m.leadId}`,
      done: new Date(m.occurredAt).getTime() < Date.now(),
    })),
  ];

  events.sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ events });
}
