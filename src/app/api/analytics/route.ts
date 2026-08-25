import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, leads, projects } from "@/db/schema";

export const dynamic = "force-dynamic";

/** Statuses that prove a lead reached at least this funnel depth. */
const REACHED: Record<string, string[]> = {
  contacted: [
    "Contacted",
    "Replied",
    "Interested",
    "Not Interested",
    "Follow-up",
    "Meeting",
    "Proposal",
    "Won",
    "Lost",
  ],
  replied: ["Replied", "Interested", "Not Interested", "Meeting", "Proposal", "Won", "Lost"],
  interested: ["Interested", "Meeting", "Proposal", "Won"],
  meeting: ["Meeting", "Proposal", "Won"],
  proposal: ["Proposal", "Won"],
  won: ["Won"],
};

const reachedCount = (key: keyof typeof REACHED) => {
  const list = sql.join(
    REACHED[key].map((s) => sql`${s}`),
    sql`, `,
  );
  return sql<number>`count(*) FILTER (WHERE ${leads.status} IN (${list}))::int`;
};

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const [
    byStatus,
    byTier,
    byCategory,
    byCity,
    monthly,
    revenueMonthly,
    revenueByNiche,
    activityMix,
    totals,
    projectTotals,
    projectStages,
  ] = await Promise.all([
    db
      .select({ key: leads.status, value: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.archived, false))
      .groupBy(leads.status),
    db
      .select({
        key: leads.tier,
        value: sql<number>`count(*)::int`,
        contacted: reachedCount("contacted"),
        replied: reachedCount("replied"),
        meetings: reachedCount("meeting"),
        won: sql<number>`count(*) FILTER (WHERE ${leads.status} = 'Won')::int`,
        lost: sql<number>`count(*) FILTER (WHERE ${leads.status} IN ('Lost','Not Interested'))::int`,
        wonValue: sql<number>`coalesce(sum(${leads.potentialValue}) FILTER (WHERE ${leads.status} = 'Won'),0)::int`,
      })
      .from(leads)
      .where(eq(leads.archived, false))
      .groupBy(leads.tier)
      .orderBy(sql`${leads.tier} asc nulls last`),
    db
      .select({
        key: sql<string>`coalesce(nullif(btrim(${leads.category}),''),'Uncategorized')`,
        value: sql<number>`count(*)::int`,
        contacted: reachedCount("contacted"),
        replied: reachedCount("replied"),
        meetings: reachedCount("meeting"),
        won: sql<number>`count(*) FILTER (WHERE ${leads.status} = 'Won')::int`,
        wonValue: sql<number>`coalesce(sum(${leads.potentialValue}) FILTER (WHERE ${leads.status} = 'Won'),0)::int`,
      })
      .from(leads)
      .where(eq(leads.archived, false))
      .groupBy(sql`coalesce(nullif(btrim(${leads.category}),''),'Uncategorized')`)
      .orderBy(desc(sql`count(*)`))
      .limit(12),
    db
      .select({
        key: sql<string>`coalesce(nullif(btrim(${leads.city}),''),'Unknown')`,
        value: sql<number>`count(*)::int`,
        won: sql<number>`count(*) FILTER (WHERE ${leads.status} = 'Won')::int`,
      })
      .from(leads)
      .where(eq(leads.archived, false))
      .groupBy(sql`coalesce(nullif(btrim(${leads.city}),''),'Unknown')`)
      .orderBy(desc(sql`count(*)`))
      .limit(8),
    db
      .select({
        key: sql<string>`to_char(date_trunc('month', ${leads.createdAt}), 'Mon YY')`,
        value: sql<number>`count(*)::int`,
        won: sql<number>`count(*) FILTER (WHERE ${leads.status} = 'Won')::int`,
      })
      .from(leads)
      .groupBy(
        sql`date_trunc('month', ${leads.createdAt})`,
        sql`to_char(date_trunc('month', ${leads.createdAt}), 'Mon YY')`,
      )
      .orderBy(sql`date_trunc('month', ${leads.createdAt})`)
      .limit(12),
    db
      .select({
        key: sql<string>`to_char(date_trunc('month', ${projects.createdAt}), 'Mon YY')`,
        value: sql<number>`coalesce(sum(${projects.value}),0)::int`,
        paid: sql<number>`coalesce(sum(${projects.paid}),0)::int`,
      })
      .from(projects)
      .groupBy(
        sql`date_trunc('month', ${projects.createdAt})`,
        sql`to_char(date_trunc('month', ${projects.createdAt}), 'Mon YY')`,
      )
      .orderBy(sql`date_trunc('month', ${projects.createdAt})`)
      .limit(12),
    db
      .select({
        key: sql<string>`coalesce(nullif(btrim(${leads.category}),''),'Uncategorized')`,
        value: sql<number>`coalesce(sum(${projects.value}),0)::int`,
        paid: sql<number>`coalesce(sum(${projects.paid}),0)::int`,
        projects: sql<number>`count(*)::int`,
      })
      .from(projects)
      .leftJoin(leads, eq(projects.leadId, leads.id))
      .groupBy(sql`coalesce(nullif(btrim(${leads.category}),''),'Uncategorized')`)
      .orderBy(desc(sql`coalesce(sum(${projects.value}),0)`))
      .limit(8),
    db
      .select({ key: activities.type, value: sql<number>`count(*)::int` })
      .from(activities)
      .groupBy(activities.type)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        withWebsite: sql<number>`count(*) FILTER (WHERE coalesce(btrim(${leads.website}),'') <> '')::int`,
        withPhone: sql<number>`count(*) FILTER (WHERE coalesce(btrim(${leads.phone}),'') <> '')::int`,
        withSocial: sql<number>`count(*) FILTER (WHERE coalesce(btrim(${leads.facebook}),'') <> '' OR coalesce(btrim(${leads.instagram}),'') <> '' OR coalesce(btrim(${leads.tiktok}),'') <> '' OR coalesce(btrim(${leads.telegram}),'') <> '')::int`,
        contacted: reachedCount("contacted"),
        replied: reachedCount("replied"),
        interested: reachedCount("interested"),
        meetings: reachedCount("meeting"),
        proposals: reachedCount("proposal"),
        won: sql<number>`count(*) FILTER (WHERE ${leads.status} = 'Won')::int`,
        lost: sql<number>`count(*) FILTER (WHERE ${leads.status} IN ('Lost','Not Interested'))::int`,
        avgScore: sql<number>`coalesce(round(avg(${leads.leadScore}))::int, 0)`,
        pipelineValue: sql<number>`coalesce(sum(${leads.potentialValue}) FILTER (WHERE ${leads.status} NOT IN ('Lost','Not Interested','Won')),0)::int`,
        wonValue: sql<number>`coalesce(sum(${leads.potentialValue}) FILTER (WHERE ${leads.status} = 'Won'),0)::int`,
      })
      .from(leads)
      .where(eq(leads.archived, false)),
    db
      .select({
        projects: sql<number>`count(*)::int`,
        active: sql<number>`count(*) FILTER (WHERE ${projects.stage} <> 'Completed')::int`,
        value: sql<number>`coalesce(sum(${projects.value}),0)::int`,
        paid: sql<number>`coalesce(sum(${projects.paid}),0)::int`,
      })
      .from(projects),
    db
      .select({ key: projects.stage, value: sql<number>`count(*)::int` })
      .from(projects)
      .groupBy(projects.stage),
  ]);

  return NextResponse.json({
    byStatus,
    byTier,
    byCategory,
    byCity,
    monthly,
    revenueMonthly,
    revenueByNiche,
    activityMix,
    projectStages,
    totals: totals[0],
    projectTotals: projectTotals[0],
  });
}
