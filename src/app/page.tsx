"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FollowUpModal } from "@/components/leads/modals";
import { LeadAvatar, ScoreBadge, StatusPill, TierBadge } from "@/components/leads/shared";
import { Button, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import {
  ACTIVITY_ICONS,
  STAGE_STYLES,
  type FollowUpWithLead,
  type Lead,
  type ProjectStage,
} from "@/lib/types";
import {
  addDaysISO,
  buildLeadInfoText,
  cn,
  copyText,
  daysBetween,
  formatETB,
  formatNumber,
  mapsHref,
  relativeDay,
  telHref,
  timeAgo,
  todayISO,
  whatsappHref,
} from "@/lib/utils";

type DashboardData = {
  counts: {
    total: number;
    tier1: number;
    newLeads: number;
    contacted: number;
    replied: number;
    interested: number;
    meetings: number;
    proposals: number;
    clients: number;
    noWebsite: number;
    potentialRevenue: number;
    activeProjects: number;
    totalProjects: number;
    paidRevenue: number;
    projectValue: number;
    outstanding: number;
    openTasks: number;
    tasksDueToday: number;
    tasksOverdue: number;
  };
  followUps: FollowUpWithLead[];
  recentActivity: Array<{
    id: number;
    leadId: number;
    type: string;
    summary: string;
    occurredAt: string;
    businessName: string | null;
  }>;
  topPriority: Lead[];
  toContact: Lead[];
  replied: Lead[];
  dueTasks: Array<{
    id: number;
    name: string;
    status: string;
    priority: string;
    dueDate: string | null;
    projectId: number;
    projectName: string | null;
    clientName: string | null;
  }>;
  activeProjects: Array<{
    id: number;
    name: string;
    stage: string;
    progress: number;
    dueDate: string | null;
    value: number;
    paid: number;
    clientName: string | null;
    taskOpen: number;
  }>;
  outstandingProjects: Array<{
    id: number;
    name: string;
    value: number;
    paid: number;
    dueDate: string | null;
    clientName: string | null;
    leadId: number;
    clientPhone: string | null;
  }>;
};

export default function DashboardPage() {
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiGet<DashboardData>("/api/dashboard"));
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const today = todayISO();
  const grouped = useMemo(() => {
    const pending = data?.followUps ?? [];
    return {
      overdue: pending.filter((f) => daysBetween(today, f.dueDate) < 0),
      today: pending.filter((f) => f.dueDate === today),
      upcoming: pending.filter((f) => daysBetween(today, f.dueDate) > 0),
    };
  }, [data, today]);

  const followUpAction = async (id: number, patch: Record<string, unknown>, message: string) => {
    try {
      await apiPatch(`/api/followups?id=${id}`, patch);
      toast(message, "success");
      void load();
    } catch (error) {
      toast((error as Error).message, "error");
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[82px]" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!data) return null;
  const c = data.counts;
  const empty = c.total === 0;

  const stats = [
    { label: "Total leads", value: formatNumber(c.total), href: "/leads" },
    { label: "Tier 1", value: formatNumber(c.tier1), href: "/leads?tier=1", accent: "text-rose-500" },
    { label: "To contact", value: formatNumber(c.newLeads), href: "/leads?status=New" },
    {
      label: "Replied",
      value: formatNumber(c.replied + c.interested),
      href: "/leads?status=Interested",
      accent: "text-emerald-500",
    },
    { label: "Clients", value: formatNumber(c.clients), href: "/clients" },
    { label: "Active projects", value: formatNumber(c.activeProjects), href: "/projects" },
    {
      label: "Open tasks",
      value: formatNumber(c.openTasks),
      href: "/projects",
      accent: c.tasksOverdue ? "text-rose-500" : undefined,
    },
    {
      label: "Outstanding",
      value: formatETB(c.outstanding, true),
      href: "/projects",
      accent: c.outstanding ? "text-amber-500" : undefined,
    },
  ];

  const workCount =
    grouped.overdue.length +
    grouped.today.length +
    data.dueTasks.filter((t) => t.dueDate && daysBetween(today, t.dueDate) <= 0).length;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={`${greeting} 👋`}
        subtitle={
          empty
            ? "Import your business list to get started."
            : workCount > 0
              ? `${workCount} thing${workCount === 1 ? "" : "s"} need you today.`
              : new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
        }
        actions={
          <>
            <Link href="/import">
              <Button size="md" variant="secondary">
                ⬆ Import
              </Button>
            </Link>
            <Link href="/leads?new=1">
              <Button size="md" variant="primary">
                + New lead
              </Button>
            </Link>
          </>
        }
      />

      {empty ? (
        <EmptyState
          icon="📥"
          title="Your CRM is empty"
          description="Import an Excel or CSV list of Ethiopian businesses. Your lead scores and tiers are imported exactly as written — the app never changes them."
          action={
            <Link href="/import">
              <Button variant="primary" size="md">
                Import your first list
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {stats.map((stat) => (
              <Link key={stat.label} href={stat.href}>
                <Card hover className="p-4">
                  <div className="text-[11.5px] font-medium text-subtle">{stat.label}</div>
                  <div
                    className={cn(
                      "mt-1.5 text-[20px] leading-none font-semibold tracking-[-0.02em] tabular-nums",
                      stat.accent,
                    )}
                  >
                    {stat.value}
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Today */}
          <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold">What should I do right now?</h2>
                  <Link href="/follow-ups" className="text-[12.5px] text-accent hover:underline">
                    All follow-ups →
                  </Link>
                </div>

                {grouped.overdue.length + grouped.today.length + data.dueTasks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-line py-10 text-center">
                    <div className="mb-2 text-2xl">🌤</div>
                    <p className="text-[13.5px] font-medium">Nothing is due today</p>
                    <p className="mt-1 text-[12.5px] text-subtle">
                      Good time to work through your top priority leads below.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <FollowUpGroup
                      title="⚠️ Overdue follow-ups"
                      tone="danger"
                      items={grouped.overdue}
                      onAction={followUpAction}
                    />
                    <FollowUpGroup
                      title="⏰ Follow-ups due today"
                      tone="warn"
                      items={grouped.today}
                      onAction={followUpAction}
                    />

                    {data.dueTasks.length ? (
                      <div>
                        <div className="mb-2 text-[11px] font-semibold tracking-wide text-indigo-500 uppercase">
                          ✅ Tasks due · {data.dueTasks.length}
                        </div>
                        <div className="space-y-2">
                          {data.dueTasks.map((task) => {
                            const overdue = task.dueDate
                              ? daysBetween(today, task.dueDate) < 0
                              : false;
                            return (
                              <div
                                key={task.id}
                                className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-muted/40 p-3 transition-colors hover:bg-surface-muted"
                              >
                                <button
                                  onClick={async () => {
                                    await apiPatch(`/api/tasks?id=${task.id}`, { status: "done" });
                                    toast("Task completed", "success");
                                    void load();
                                  }}
                                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border border-line-strong text-[9px] transition-colors hover:border-emerald-500"
                                  title="Mark done"
                                />
                                <Link
                                  href={`/projects/${task.projectId}`}
                                  className="min-w-0 flex-1"
                                >
                                  <span className="block truncate text-[13.5px] font-medium hover:text-accent">
                                    {task.name}
                                  </span>
                                  <span className="block truncate text-[11.5px] text-subtle">
                                    {task.projectName}
                                    {task.clientName ? ` · ${task.clientName}` : ""}
                                  </span>
                                </Link>
                                <span
                                  className={cn(
                                    "text-[11.5px]",
                                    overdue ? "font-medium text-rose-500" : "text-subtle",
                                  )}
                                >
                                  {task.dueDate ? relativeDay(task.dueDate) : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </Card>

              {/* Leads to contact + replies */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <LeadStrip
                  title="📞 Leads to contact"
                  emptyText="No new leads waiting."
                  leads={data.toContact}
                  href="/leads?status=New"
                  onFollowUp={setFollowUpLead}
                  onCopy={async (lead) => {
                    const ok = await copyText(buildLeadInfoText(lead));
                    toast(ok ? "All info copied" : "Clipboard blocked", ok ? "success" : "error");
                  }}
                  onLog={async (lead, type, summary) => {
                    await apiPost("/api/activities", { leadId: lead.id, type, summary });
                    if (lead.status === "New") {
                      await apiPatch(`/api/leads/${lead.id}`, { status: "Contacted" });
                    }
                    void load();
                  }}
                />
                <LeadStrip
                  title="💬 Replied & interested"
                  emptyText="No replies yet — keep reaching out."
                  leads={data.replied}
                  href="/leads?status=Interested"
                  onFollowUp={setFollowUpLead}
                  onCopy={async (lead) => {
                    const ok = await copyText(buildLeadInfoText(lead));
                    toast(ok ? "All info copied" : "Clipboard blocked", ok ? "success" : "error");
                  }}
                  onLog={async (lead, type, summary) => {
                    await apiPost("/api/activities", { leadId: lead.id, type, summary });
                    void load();
                  }}
                />
              </div>

              {/* Active projects */}
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold">🚧 Active projects</h2>
                  <Link href="/projects" className="text-[12.5px] text-accent hover:underline">
                    All projects →
                  </Link>
                </div>
                {data.activeProjects.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-subtle">
                    No active projects. Win a client and create a project to track the build.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {data.activeProjects.map((p) => {
                      const style = STAGE_STYLES[p.stage as ProjectStage] ?? STAGE_STYLES.Planning;
                      const daysLeft = p.dueDate ? daysBetween(today, p.dueDate) : null;
                      return (
                        <Link
                          key={p.id}
                          href={`/projects/${p.id}`}
                          className="block rounded-xl border border-line bg-surface-muted/40 p-3 transition-colors hover:bg-surface-muted"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-[13.5px] font-medium">{p.name}</span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                                style.chip,
                              )}
                            >
                              {p.stage}
                            </span>
                            <span className="ml-auto text-[12px] font-medium tabular-nums">
                              {p.progress}%
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                              style={{ width: `${p.progress}%` }}
                            />
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11.5px] text-subtle">
                            <span>{p.clientName}</span>
                            <span>{p.taskOpen} open tasks</span>
                            {daysLeft !== null ? (
                              <span className={daysLeft < 0 ? "font-medium text-rose-500" : ""}>
                                {daysLeft < 0
                                  ? `${Math.abs(daysLeft)}d overdue`
                                  : `${daysLeft}d left`}
                              </span>
                            ) : null}
                            <span className="ml-auto">
                              {formatETB(p.paid, true)} / {formatETB(p.value, true)}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Right rail */}
            <div className="space-y-5">
              {/* Outstanding payments */}
              {data.outstandingProjects.length ? (
                <Card className="p-5">
                  <h2 className="mb-3 text-[15px] font-semibold">💰 Outstanding payments</h2>
                  <div className="space-y-2">
                    {data.outstandingProjects.map((p) => {
                      const balance = Math.max(p.value - p.paid, 0);
                      const wa = whatsappHref(p.clientPhone);
                      return (
                        <div
                          key={p.id}
                          className="rounded-xl border border-line bg-surface-muted/40 p-3"
                        >
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/projects/${p.id}`}
                              className="min-w-0 flex-1 truncate text-[13px] font-medium hover:text-accent"
                            >
                              {p.clientName ?? p.name}
                            </Link>
                            <span className="text-[13px] font-semibold text-amber-500 tabular-nums">
                              {formatETB(balance, true)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11.5px] text-subtle">
                            <span className="truncate">{p.name}</span>
                            {wa ? (
                              <a
                                href={wa}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-auto shrink-0 text-accent hover:underline"
                              >
                                💬 Remind
                              </a>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ) : null}

              {/* Top priority */}
              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold">🔥 Top priority</h2>
                  <Link href="/leads?sort=score_desc" className="text-[12.5px] text-accent hover:underline">
                    All →
                  </Link>
                </div>
                {data.topPriority.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-subtle">No open leads.</p>
                ) : (
                  <div className="space-y-2">
                    {data.topPriority.map((lead) => (
                      <Link
                        key={lead.id}
                        href={`/leads/${lead.id}`}
                        className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-muted/40 p-2.5 transition-colors hover:bg-surface-muted"
                      >
                        <LeadAvatar name={lead.businessName} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">
                            {lead.businessName}
                          </span>
                          <span className="block truncate text-[11.5px] text-subtle">
                            {[lead.category, lead.city].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <ScoreBadge score={lead.leadScore} />
                          <TierBadge tier={lead.tier} />
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>

              {/* Recent activity */}
              <Card className="p-5">
                <h2 className="mb-4 text-[15px] font-semibold">Recent activity</h2>
                {!data.recentActivity.length ? (
                  <p className="py-6 text-center text-[13px] text-subtle">Nothing logged yet.</p>
                ) : (
                  <ol className="relative space-y-4 border-l border-line pl-4">
                    {data.recentActivity.map((item) => (
                      <li key={item.id} className="relative">
                        <span className="absolute top-1 -left-[22px] flex h-4 w-4 items-center justify-center rounded-full bg-surface text-[9px] ring-1 ring-line">
                          {ACTIVITY_ICONS[item.type] ?? "•"}
                        </span>
                        <div className="text-[13px] leading-snug">{item.summary}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-subtle">
                          <Link href={`/leads/${item.leadId}`} className="hover:text-accent">
                            {item.businessName ?? "Lead"}
                          </Link>
                          <span>·</span>
                          <span>{timeAgo(item.occurredAt)}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </div>
          </div>
        </>
      )}

      <FollowUpModal
        open={Boolean(followUpLead)}
        leadId={followUpLead?.id ?? null}
        leadName={followUpLead?.businessName}
        onClose={() => setFollowUpLead(null)}
        onCreated={load}
      />
    </div>
  );
}

function FollowUpGroup({
  title,
  items,
  tone,
  onAction,
}: {
  title: string;
  items: FollowUpWithLead[];
  tone: "danger" | "warn";
  onAction: (id: number, patch: Record<string, unknown>, message: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div>
      <div
        className={cn(
          "mb-2 text-[11px] font-semibold tracking-wide uppercase",
          tone === "danger" ? "text-rose-500" : "text-amber-500",
        )}
      >
        {title} · {items.length}
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const tel = telHref(item.lead?.phone);
          const wa = whatsappHref(item.lead?.phone);
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-muted/40 p-3 transition-colors hover:bg-surface-muted"
            >
              <LeadAvatar name={item.lead?.businessName ?? "?"} size={34} />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/leads/${item.leadId}`}
                  className="block truncate text-[13.5px] font-medium hover:text-accent"
                >
                  {item.lead?.businessName ?? "Unknown lead"}
                </Link>
                <div className="truncate text-[12px] text-subtle">
                  {item.note || "Follow up"} · {relativeDay(item.dueDate)}
                </div>
              </div>
              {item.lead?.tier ? <TierBadge tier={item.lead.tier} /> : null}
              {item.lead?.status ? (
                <span className="hidden sm:block">
                  <StatusPill status={item.lead.status} />
                </span>
              ) : null}
              <div className="flex items-center gap-1">
                {tel ? (
                  <a
                    href={tel}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[12.5px] hover:bg-surface"
                    title={item.lead?.phone ?? "Call"}
                  >
                    📞
                  </a>
                ) : null}
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[12.5px] hover:bg-surface"
                    title="WhatsApp"
                  >
                    💬
                  </a>
                ) : null}
                <Button size="xs" onClick={() => onAction(item.id, { status: "done" }, "Done")}>
                  ✓
                </Button>
                <Button
                  size="xs"
                  onClick={() => onAction(item.id, { dueDate: addDaysISO(1) }, "Moved to tomorrow")}
                  title="Tomorrow"
                >
                  +1d
                </Button>
                <Button
                  size="xs"
                  onClick={() => onAction(item.id, { dueDate: addDaysISO(3) }, "Moved 3 days")}
                  title="In 3 days"
                >
                  +3d
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeadStrip({
  title,
  leads,
  href,
  emptyText,
  onCopy,
  onLog,
  onFollowUp,
}: {
  title: string;
  leads: Lead[];
  href: string;
  emptyText: string;
  onCopy: (lead: Lead) => void;
  onLog: (lead: Lead, type: string, summary: string) => void;
  onFollowUp: (lead: Lead) => void;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <Link href={href} className="text-[12.5px] text-accent hover:underline">
          All →
        </Link>
      </div>
      {leads.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-subtle">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => {
            const tel = telHref(lead.phone);
            const wa = whatsappHref(lead.phone);
            const maps = mapsHref(lead);
            const btn =
              "inline-flex h-7 w-7 items-center justify-center rounded-lg text-[12.5px] transition-colors hover:bg-surface";
            return (
              <div key={lead.id} className="rounded-xl border border-line bg-surface-muted/40 p-2.5">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="min-w-0 flex-1 truncate text-[13px] font-medium hover:text-accent"
                  >
                    {lead.businessName}
                  </Link>
                  <ScoreBadge score={lead.leadScore} />
                  <TierBadge tier={lead.tier} />
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-subtle">
                  {[lead.category, lead.city].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="mt-1.5 flex items-center gap-0.5">
                  <button onClick={() => onCopy(lead)} className={btn} title="Copy all info">
                    📋
                  </button>
                  {tel ? (
                    <a
                      href={tel}
                      className={btn}
                      title={lead.phone ?? "Call"}
                      onClick={() => onLog(lead, "call", `Called ${lead.businessName}`)}
                    >
                      📞
                    </a>
                  ) : null}
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noreferrer"
                      className={btn}
                      title="WhatsApp"
                      onClick={() => onLog(lead, "whatsapp", `WhatsApp sent to ${lead.businessName}`)}
                    >
                      💬
                    </a>
                  ) : null}
                  {maps ? (
                    <a href={maps} target="_blank" rel="noreferrer" className={btn} title="Maps">
                      📍
                    </a>
                  ) : null}
                  <button
                    onClick={() => onFollowUp(lead)}
                    className={cn(btn, "ml-auto")}
                    title="Schedule follow-up"
                  >
                    ◷
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
