import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, leadNotes, leads, projectNotes, projects, tasks } from "@/db/schema";

export const dynamic = "force-dynamic";

export type SearchHit = {
  kind: "lead" | "client" | "project" | "task" | "contact" | "note";
  id: number;
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
};

export async function GET(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  const term = `%${q}%`;

  const [leadRows, projectRows, taskRows, contactRows, leadNoteRows, projectNoteRows] =
    await Promise.all([
      db
        .select({
          id: leads.id,
          businessName: leads.businessName,
          category: leads.category,
          city: leads.city,
          status: leads.status,
          tier: leads.tier,
          phone: leads.phone,
        })
        .from(leads)
        .where(
          or(
            ilike(leads.businessName, term),
            ilike(leads.phone, term),
            ilike(leads.phone2, term),
            ilike(leads.email, term),
            ilike(leads.contactPerson, term),
            ilike(leads.category, term),
            ilike(leads.city, term),
            ilike(leads.notes, term),
            sql`${leads.tags}::text ILIKE ${term}`,
          ),
        )
        .orderBy(sql`${leads.leadScore} desc nulls last`)
        .limit(8),
      db
        .select({
          id: projects.id,
          name: projects.name,
          stage: projects.stage,
          progress: projects.progress,
          clientName: leads.businessName,
        })
        .from(projects)
        .leftJoin(leads, eq(projects.leadId, leads.id))
        .where(or(ilike(projects.name, term), ilike(leads.businessName, term)))
        .limit(6),
      db
        .select({
          id: tasks.id,
          name: tasks.name,
          status: tasks.status,
          projectId: tasks.projectId,
          projectName: projects.name,
        })
        .from(tasks)
        .leftJoin(projects, eq(tasks.projectId, projects.id))
        .where(or(ilike(tasks.name, term), ilike(tasks.description, term)))
        .limit(6),
      db
        .select({
          id: contacts.id,
          name: contacts.name,
          role: contacts.role,
          phone: contacts.phone,
          leadId: contacts.leadId,
          businessName: leads.businessName,
        })
        .from(contacts)
        .leftJoin(leads, eq(contacts.leadId, leads.id))
        .where(or(ilike(contacts.name, term), ilike(contacts.phone, term), ilike(contacts.email, term)))
        .limit(6),
      db
        .select({
          id: leadNotes.id,
          body: leadNotes.body,
          leadId: leadNotes.leadId,
          businessName: leads.businessName,
        })
        .from(leadNotes)
        .leftJoin(leads, eq(leadNotes.leadId, leads.id))
        .where(ilike(leadNotes.body, term))
        .limit(5),
      db
        .select({
          id: projectNotes.id,
          body: projectNotes.body,
          projectId: projectNotes.projectId,
          projectName: projects.name,
        })
        .from(projectNotes)
        .leftJoin(projects, eq(projectNotes.projectId, projects.id))
        .where(ilike(projectNotes.body, term))
        .limit(5),
    ]);

  const results: SearchHit[] = [
    ...leadRows.map((l) => ({
      kind: (l.status === "Won" ? "client" : "lead") as SearchHit["kind"],
      id: l.id,
      title: l.businessName,
      subtitle: [l.category, l.city, l.phone].filter(Boolean).join(" · ") || "No details",
      href: `/leads/${l.id}`,
      meta: l.tier ? `Tier ${l.tier}` : l.status,
    })),
    ...projectRows.map((p) => ({
      kind: "project" as const,
      id: p.id,
      title: p.name,
      subtitle: `${p.clientName ?? "Unknown client"} · ${p.stage}`,
      href: `/projects/${p.id}`,
      meta: `${p.progress}%`,
    })),
    ...taskRows.map((t) => ({
      kind: "task" as const,
      id: t.id,
      title: t.name,
      subtitle: t.projectName ?? "Task",
      href: `/projects/${t.projectId}`,
      meta: t.status.replace("_", " "),
    })),
    ...contactRows.map((c) => ({
      kind: "contact" as const,
      id: c.id,
      title: c.name,
      subtitle: [c.role, c.businessName, c.phone].filter(Boolean).join(" · "),
      href: `/leads/${c.leadId}`,
    })),
    ...leadNoteRows.map((n) => ({
      kind: "note" as const,
      id: n.id,
      title: n.body.slice(0, 70),
      subtitle: `Note · ${n.businessName ?? "Lead"}`,
      href: `/leads/${n.leadId}`,
    })),
    ...projectNoteRows.map((n) => ({
      kind: "note" as const,
      id: n.id,
      title: n.body.slice(0, 70),
      subtitle: `Project note · ${n.projectName ?? "Project"}`,
      href: `/projects/${n.projectId}`,
    })),
  ];

  return NextResponse.json({ results });
}
