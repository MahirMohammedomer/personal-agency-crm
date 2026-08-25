"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button, Card, EmptyState, Input, Label, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import {
  PROJECT_STAGES,
  STAGE_STYLES,
  type Lead,
  type ProjectStage,
  type ProjectWithLead,
} from "@/lib/types";
import {
  buildProjectInfoText,
  cn,
  copyText,
  daysBetween,
  formatDate,
  formatETB,
  paymentStatus,
  todayISO,
} from "@/lib/utils";

export default function ProjectsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ projects: ProjectWithLead[] }>("/api/projects");
      setProjects(data.projects);
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const value = projects.reduce((s, p) => s + p.value, 0);
    const paid = projects.reduce((s, p) => s + p.paid, 0);
    const active = projects.filter((p) => p.stage !== "Completed").length;
    const openTasks = projects.reduce((s, p) => s + ((p.taskTotal ?? 0) - (p.taskDone ?? 0)), 0);
    return { value, paid, outstanding: Math.max(value - paid, 0), active, openTasks };
  }, [projects]);

  const filtered = useMemo(() => {
    if (filter === "all") return projects;
    if (filter === "active") return projects.filter((p) => p.stage !== "Completed");
    if (filter === "completed") return projects.filter((p) => p.stage === "Completed");
    if (["Unpaid", "Partially Paid", "Paid", "Overdue"].includes(filter)) {
      return projects.filter((p) => paymentStatus(p.value, p.paid, p.dueDate) === filter);
    }
    return projects.filter((p) => p.stage === filter);
  }, [projects, filter]);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Projects"
        subtitle="Every website you are building — stage, progress, tasks and payments."
        actions={
          <Button size="md" variant="primary" onClick={() => setCreating(true)}>
            + New project
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Active", value: String(totals.active) },
          { label: "Open tasks", value: String(totals.openTasks) },
          { label: "Total value", value: formatETB(totals.value, true) },
          { label: "Paid", value: formatETB(totals.paid, true), accent: "text-emerald-500" },
          {
            label: "Outstanding",
            value: formatETB(totals.outstanding, true),
            accent: totals.outstanding ? "text-amber-500" : undefined,
          },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-[11.5px] text-subtle">{s.label}</div>
            <div className={cn("mt-1 text-[20px] font-semibold tabular-nums", s.accent)}>
              {s.value}
            </div>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {["active", "all", ...PROJECT_STAGES, "Unpaid", "Partially Paid", "Overdue", "Paid"].map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-[12.5px] capitalize transition-colors",
                filter === f
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-line text-muted hover:text-ink",
              )}
            >
              {f}
            </button>
          ),
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : !filtered.length ? (
        <EmptyState
          icon="◈"
          title={projects.length ? "No projects in this view" : "No projects yet"}
          description={
            projects.length
              ? "Try another filter."
              : "Create a project when a client signs — then track stages, tasks, files and payments in one place."
          }
          action={
            <Button variant="primary" size="md" onClick={() => setCreating(true)}>
              New project
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onStage={async (stage) => {
                await apiPatch(`/api/projects?id=${project.id}`, { stage });
                void load();
              }}
              onCopy={async () => {
                const ok = await copyText(
                  buildProjectInfoText({
                    project,
                    clientName: project.lead?.businessName,
                    clientPhone: project.lead?.phone,
                    taskTotal: project.taskTotal,
                    taskDone: project.taskDone,
                  }),
                );
                toast(ok ? "Project info copied" : "Clipboard blocked", ok ? "success" : "error");
              }}
            />
          ))}
        </div>
      )}

      <NewProjectModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          void load();
        }}
      />
    </div>
  );
}

function ProjectCard({
  project,
  onStage,
  onCopy,
}: {
  project: ProjectWithLead;
  onStage: (stage: string) => void;
  onCopy: () => void;
}) {
  const status = paymentStatus(project.value, project.paid, project.dueDate);
  const stageStyle = STAGE_STYLES[project.stage as ProjectStage] ?? STAGE_STYLES.Planning;
  const daysLeft = project.dueDate ? daysBetween(todayISO(), project.dueDate) : null;
  const remainingTasks = (project.taskTotal ?? 0) - (project.taskDone ?? 0);

  return (
    <Card hover className="flex flex-col gap-3.5 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/projects/${project.id}`}
            className="block truncate text-[15px] font-semibold hover:text-accent"
          >
            {project.name}
          </Link>
          <div className="mt-0.5 truncate text-[12.5px] text-muted">
            {project.lead ? (
              <Link href={`/leads/${project.leadId}`} className="hover:text-accent">
                {project.lead.businessName}
              </Link>
            ) : (
              "Unknown client"
            )}
            {project.dueDate ? ` · due ${formatDate(`${project.dueDate}T00:00:00`)}` : ""}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium",
            stageStyle.chip,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", stageStyle.dot)} />
          {project.stage}
        </span>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-[12px]">
          <span className="font-medium tabular-nums">{project.progress}% complete</span>
          {daysLeft !== null ? (
            <span className={cn(daysLeft < 0 ? "font-medium text-rose-500" : "text-subtle")}>
              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
            </span>
          ) : null}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
        <span className="text-muted">
          ✓ {project.taskDone ?? 0}/{project.taskTotal ?? 0} tasks
          {remainingTasks > 0 ? (
            <span className="text-subtle"> · {remainingTasks} left</span>
          ) : null}
        </span>
        <span className="text-muted">📎 {project.fileCount ?? 0}</span>
        <span className="text-muted">📝 {project.noteCount ?? 0}</span>
        <span className="ml-auto font-medium">
          {formatETB(project.paid)} / {formatETB(project.value)}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            status === "Paid"
              ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"
              : status === "Overdue"
                ? "bg-rose-500/12 text-rose-600 dark:text-rose-300"
                : status === "Partially Paid"
                  ? "bg-amber-500/12 text-amber-600 dark:text-amber-300"
                  : "bg-zinc-500/12 text-zinc-600 dark:text-zinc-300",
          )}
        >
          {status}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
        <Button size="sm" onClick={onCopy} title="Copy all project info">
          📋 Copy All
        </Button>
        <Link href={`/projects/${project.id}`}>
          <Button size="sm" variant="primary">
            Open project →
          </Button>
        </Link>
        <select
          value={project.stage}
          onChange={(e) => onStage(e.target.value)}
          className="field ml-auto h-8 w-[130px] py-0 text-[12.5px]"
          title="Change stage"
        >
          {PROJECT_STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </Card>
  );
}

function NewProjectModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    value: "",
    paid: "0",
    dueDate: "",
    stage: "Planning",
  });
  const [withStarterTasks, setWithStarterTasks] = useState(true);
  const [leadQuery, setLeadQuery] = useState("");
  const [leadResults, setLeadResults] = useState<Lead[]>([]);
  const [lead, setLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ name: "", value: "", paid: "0", dueDate: "", stage: "Planning" });
    setLead(null);
    setLeadQuery("");
    setLeadResults([]);
    setWithStarterTasks(true);
  }, [open]);

  useEffect(() => {
    if (leadQuery.trim().length < 2) {
      setLeadResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await apiGet<{ leads: Lead[] }>(
          `/api/leads?q=${encodeURIComponent(leadQuery.trim())}&pageSize=6`,
        );
        setLeadResults(data.leads);
      } catch {
        setLeadResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [leadQuery]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New project"
      description="A project is one website you are building for a client."
      size="md"
      footer={
        <>
          <Button size="md" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="md"
            variant="primary"
            disabled={saving}
            onClick={async () => {
              if (!lead) return toast("Pick the client first", "error");
              if (!form.name.trim()) return toast("Project name is required", "error");
              setSaving(true);
              try {
                await apiPost("/api/projects", { ...form, leadId: lead.id, withStarterTasks });
                if (lead.status !== "Won") {
                  await apiPatch(`/api/leads/${lead.id}`, { status: "Won" });
                }
                toast("Project created", "success");
                onSaved();
              } catch (error) {
                toast((error as Error).message, "error");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Creating…" : "Create project"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Client</Label>
          {lead ? (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-muted/50 p-2.5">
              <span className="flex-1 truncate text-[13.5px] font-medium">{lead.businessName}</span>
              <button onClick={() => setLead(null)} className="text-[12px] text-subtle hover:text-ink">
                Change
              </button>
            </div>
          ) : (
            <>
              <Input
                value={leadQuery}
                onChange={(e) => setLeadQuery(e.target.value)}
                placeholder="Search a lead or client…"
              />
              <div className="mt-1.5 space-y-1">
                {leadResults.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => {
                      setLead(l);
                      setForm((f) => ({
                        ...f,
                        name: f.name || `${l.businessName} website`,
                        value: f.value || String(l.potentialValue ?? ""),
                      }));
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-surface-muted"
                  >
                    <span className="flex-1 truncate">{l.businessName}</span>
                    <span className="text-[11.5px] text-subtle">{l.status}</span>
                  </button>
                ))}
                {leadQuery.trim().length >= 2 && !leadResults.length ? (
                  <p className="px-2 py-2 text-[12px] text-subtle">No matching business.</p>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div>
          <Label>Project name</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Value (ETB)</Label>
            <Input
              value={form.value}
              inputMode="numeric"
              placeholder="35000"
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            />
          </div>
          <div>
            <Label>Paid so far (ETB)</Label>
            <Input
              value={form.paid}
              inputMode="numeric"
              onChange={(e) => setForm((f) => ({ ...f, paid: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Stage</Label>
            <select
              className="field"
              value={form.stage}
              onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
            >
              {PROJECT_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Deadline</Label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-line bg-surface-muted/40 p-3 text-[13px]">
          <input
            type="checkbox"
            checked={withStarterTasks}
            onChange={(e) => setWithStarterTasks(e.target.checked)}
            className="h-4 w-4 accent-[rgb(var(--accent))]"
          />
          <span>
            Add the standard website checklist
            <span className="block text-[11.5px] text-subtle">
              12 tasks from kickoff to launch — edit or delete any of them
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
