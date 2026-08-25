"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LeadAvatar, QuickActions } from "@/components/leads/shared";
import { Button, Card, EmptyState, Input, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiGet } from "@/lib/api";
import { STAGE_STYLES, type Lead, type ProjectStage, type ProjectWithLead } from "@/lib/types";
import { cn, formatETB, paymentStatus } from "@/lib/utils";

export default function ClientsPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<ProjectWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leadData, projectData] = await Promise.all([
        apiGet<{ leads: Lead[] }>("/api/leads?status=Won&pageSize=500&sort=updated_desc"),
        apiGet<{ projects: ProjectWithLead[] }>("/api/projects"),
      ]);
      setClients(leadData.leads);
      setProjects(projectData.projects);
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.businessName, c.category, c.city].filter(Boolean).some((v) =>
        String(v).toLowerCase().includes(q),
      ),
    );
  }, [clients, query]);

  const totals = useMemo(() => {
    const value = projects.reduce((s, p) => s + p.value, 0);
    const paid = projects.reduce((s, p) => s + p.paid, 0);
    return { value, paid, outstanding: Math.max(value - paid, 0) };
  }, [projects]);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} won lead${clients.length === 1 ? "" : "s"} · ${formatETB(
          totals.paid,
          true,
        )} collected · ${formatETB(totals.outstanding, true)} outstanding`}
        actions={
          <div className="w-56">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients…"
            />
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : !filtered.length ? (
        <EmptyState
          icon="★"
          title={query ? "No clients match" : "No clients yet"}
          description={
            query
              ? "Try a different search."
              : "When a lead says yes, open their profile and mark them as Won — they will show up here."
          }
          action={
            <Link href="/leads?status=Interested">
              <Button variant="primary" size="md">
                See interested leads
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((client) => {
            const theirs = projects.filter((p) => p.leadId === client.id);
            const value = theirs.reduce((s, p) => s + p.value, 0);
            const paid = theirs.reduce((s, p) => s + p.paid, 0);
            const pct = value ? Math.min((paid / value) * 100, 100) : 0;
            return (
              <Card key={client.id} hover className="flex flex-col gap-3.5 p-4">
                <div className="flex items-start gap-3">
                  <LeadAvatar name={client.businessName} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/leads/${client.id}`}
                      className="block truncate text-[15px] font-semibold hover:text-accent"
                    >
                      {client.businessName}
                    </Link>
                    <div className="truncate text-[12.5px] text-muted">
                      {[client.category, client.city].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
                    Client
                  </span>
                </div>

                {theirs.length ? (
                  <div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-muted">
                        {theirs.length} project{theirs.length === 1 ? "" : "s"}
                      </span>
                      <span className="font-medium">
                        {formatETB(paid)} / {formatETB(value)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-2 space-y-1">
                      {theirs.slice(0, 3).map((p) => {
                        const status = paymentStatus(p.value, p.paid, p.dueDate);
                        const stageStyle =
                          STAGE_STYLES[p.stage as ProjectStage] ?? STAGE_STYLES.Planning;
                        return (
                          <Link
                            key={p.id}
                            href={`/projects/${p.id}`}
                            className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-[11.5px] hover:bg-surface-muted"
                          >
                            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", stageStyle.dot)} />
                            <span className="truncate text-muted">{p.name}</span>
                            <span className="ml-auto shrink-0 text-subtle">{p.progress}%</span>
                            <span
                              className={cn(
                                "shrink-0",
                                status === "Paid"
                                  ? "text-emerald-500"
                                  : status === "Overdue"
                                    ? "text-rose-500"
                                    : "text-amber-500",
                              )}
                            >
                              {status}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-line px-3 py-3 text-center text-[12px] text-subtle">
                    No project yet ·{" "}
                    <Link href={`/leads/${client.id}`} className="text-accent hover:underline">
                      add one
                    </Link>
                  </div>
                )}

                <div className="border-t border-line pt-3">
                  <QuickActions lead={client} compact />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
