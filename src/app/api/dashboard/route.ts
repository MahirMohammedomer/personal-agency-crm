import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, followUps, leads, projects, tasks } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      tier1: sql<number>`count(*) FILTER (WHERE ${leads.tier} = 1)::int`,
      newLeads: sql<number>`count(*) FILTER (WHERE ${leads.status} = 'New')::int`,
      contacted: sql<number>`count(*) FILTER (WHERE ${leads.status} = 'Contacted')::int`,
      replied: sql<number>`count(*) FILTER (WHERE ${leads.status} = 'Replied')::int`,
      interested: sql<number>`count(*) FILTER (WHERE ${leads.status} = 'Interested')::int`,
      meetings: sql<number>`count(*) FILTER (WHERE ${leads.status} = 'Meeting')::int`,
      proposals: sql<number>`count(*) FILTER (WHERE ${leads.status} = 'Proposal')::int`,
      clients: sql<number>`count(*) FILTER (WHERE ${leads.status} = 'Won')::int`,
      noWebsite: sql<number>`count(*) FILTER (WHERE coalesce(btrim(${leads.website}),'') = '')::int`,
      potentialRevenue: sql<number>`coalesce(sum(${leads.potentialValue}) FILTER (WHERE ${leads.status} NOT IN ('Lost','Not Interested','Won')), 0)::int`,
    })
    .from(leads)
    .where(eq(leads.archived, false));

  const [projectTotals] = await db
    .select({
      activeProjects: sql<number>`count(*) FILTER (WHERE ${projects.stage} <> 'Completed')::int`,
      totalProjects: sql<number>`count(*)::int`,
      value: sql<number>`coalesce(sum(${projects.value}),0)::int`,
      paid: sql<number>`coalesce(sum(${projects.paid}),0)::int`,
    })
    .from(projects);

  const [taskCounts] = await db
    .select({
      open: sql<number>`count(*) FILTER (WHERE ${tasks.status} <> 'done')::int`,
      dueToday: sql<number>`count(*) FILTER (WHERE ${tasks.status} <> 'done' AND ${tasks.dueDate} = to_char(CURRENT_DATE,'YYYY-MM-DD'))::int`,
      overdue: sql<number>`count(*) FILTER (WHERE ${tasks.status} <> 'done' AND ${tasks.dueDate} < to_char(CURRENT_DATE,'YYYY-MM-DD'))::int`,
    })
    .from(tasks);

  const followUpRows = await db
    .select({
      id: followUps.id,
      leadId: followUps.leadId,
      dueDate: followUps.dueDate,
      note: followUps.note,
      status: followUps.status,
      completedAt: followUps.completedAt,
      createdAt: followUps.createdAt,
      lead: {
        id: leads.id,
        businessName: leads.businessName,
        phone: leads.phone,
        category: leads.category,
        city: leads.city,
        tier: leads.tier,
        status: leads.status,
        leadScore: leads.leadScore,
      },
    })
    .from(followUps)
    .leftJoin(leads, eq(followUps.leadId, leads.id))
    .where(eq(followUps.status, "pending"))
    .orderBy(asc(followUps.dueDate))
    .limit(200);

  const recentActivity = await db
    .select({
      id: activities.id,
      leadId: activities.leadId,
      type: activities.type,
      summary: activities.summary,
      detail: activities.detail,
      occurredAt: activities.occurredAt,
      businessName: leads.businessName,
    })
    .from(activities)
    .leftJoin(leads, eq(activities.leadId, leads.id))
    .orderBy(desc(activities.occurredAt), desc(activities.id))
    .limit(10);

  const topPriority = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.archived, false),
        inArray(leads.status, ["New", "Contacted", "Replied", "Interested", "Follow-up"]),
      ),
    )
    .orderBy(sql`${leads.leadScore} desc nulls last`, sql`${leads.tier} asc nulls last`)
    .limit(6);

  const toContact = await db
    .select()
    .from(leads)
    .where(and(eq(leads.archived, false), eq(leads.status, "New")))
    .orderBy(sql`${leads.leadScore} desc nulls last`, sql`${leads.tier} asc nulls last`)
    .limit(5);

  const replied = await db
    .select()
    .from(leads)
    .where(and(eq(leads.archived, false), inArray(leads.status, ["Replied", "Interested"])))
    .orderBy(sql`${leads.leadScore} desc nulls last`)
    .limit(5);

  const dueTasks = await db
    .select({
      id: tasks.id,
      name: tasks.name,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      projectId: tasks.projectId,
      projectName: projects.name,
      clientName: leads.businessName,
    })
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(leads, eq(projects.leadId, leads.id))
    .where(
      and(
        sql`${tasks.status} <> 'done'`,
        isNotNull(tasks.dueDate),
        sql`${tasks.dueDate} <= to_char(CURRENT_DATE + 2, 'YYYY-MM-DD')`,
      ),
    )
    .orderBy(asc(tasks.dueDate))
    .limit(8);

  const activeProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      stage: projects.stage,
      progress: projects.progress,
      dueDate: projects.dueDate,
      value: projects.value,
      paid: projects.paid,
      clientName: leads.businessName,
      taskOpen: sql<number>`(SELECT count(*)::int FROM ${tasks} WHERE ${tasks.projectId} = ${projects.id} AND ${tasks.status} <> 'done')`,
    })
    .from(projects)
    .leftJoin(leads, eq(projects.leadId, leads.id))
    .where(sql`${projects.stage} <> 'Completed'`)
    .orderBy(sql`${projects.dueDate} asc nulls last`)
    .limit(6);

  const outstanding = await db
    .select({
      id: projects.id,
      name: projects.name,
      value: projects.value,
      paid: projects.paid,
      dueDate: projects.dueDate,
      clientName: leads.businessName,
      leadId: projects.leadId,
      clientPhone: leads.phone,
    })
    .from(projects)
    .leftJoin(leads, eq(projects.leadId, leads.id))
    .where(sql`${projects.paid} < ${projects.value}`)
    .orderBy(desc(sql`${projects.value} - ${projects.paid}`))
    .limit(6);

  return NextResponse.json({
    counts: {
      ...counts,
      activeProjects: projectTotals?.activeProjects ?? 0,
      totalProjects: projectTotals?.totalProjects ?? 0,
      paidRevenue: projectTotals?.paid ?? 0,
      projectValue: projectTotals?.value ?? 0,
      outstanding: Math.max((projectTotals?.value ?? 0) - (projectTotals?.paid ?? 0), 0),
      openTasks: taskCounts?.open ?? 0,
      tasksDueToday: taskCounts?.dueToday ?? 0,
      tasksOverdue: taskCounts?.overdue ?? 0,
    },
    followUps: followUpRows,
    recentActivity,
    topPriority,
    toContact,
    replied,
    dueTasks,
    activeProjects,
    outstandingProjects: outstanding,
  });
}
