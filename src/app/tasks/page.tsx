"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Clock, Filter, Plus } from "lucide-react";
import { Button, Card, EmptyState, Input, PageHeader, Skeleton } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_STYLES,
  TASK_STATUS_LABELS,
  type Project,
  type TaskWithProject,
} from "@/lib/types";
import { cn, daysBetween, formatDateShort, relativeDay, todayISO } from "@/lib/utils";

type Bucket = "overdue" | "today" | "week" | "later" | "done";
type ProjectOption = Pick<Project, "id" | "name"> & { lead?: { businessName: string | null } | null };

export default function TasksPage() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"open" | "done" | "all">("open");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", projectId: "", priority: "medium", dueDate: todayISO() });

  const load = useCallback(async () => {
    try {
      const [taskRes, projectRes] = await Promise.all([
        apiGet<{ tasks: TaskWithProject[] }>("/api/tasks"),
        apiGet<{ projects: ProjectOption[] }>("/api/projects"),
      ]);
      setTasks(taskRes.tasks ?? []);
      setProjects(projectRes.projects ?? []);
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (tab === "open" && task.status === "done") return false;
      if (tab === "done" && task.status !== "done") return false;
      if (priority && task.priority !== priority) return false;
      if (!needle) return true;
      return `${task.name} ${task.projectName ?? ""} ${task.clientName ?? ""}`.toLowerCase().includes(needle);
    });
  }, [tasks, tab, priority, query]);

  const buckets = useMemo(() => {
    const out: Record<Bucket, TaskWithProject[]> = { overdue: [], today: [], week: [], later: [], done: [] };
    for (const task of filtered) {
      if (task.status === "done") {
        out.done.push(task);
        continue;
      }
      if (!task.dueDate) {
        out.later.push(task);
        continue;
      }
      const diff = daysBetween(today, task.dueDate);
      if (diff < 0) out.overdue.push(task);
      else if (diff === 0) out.today.push(task);
      else if (diff <= 7) out.week.push(task);
      else out.later.push(task);
    }
    return out;
  }, [filtered, today]);

  const toggleDone = async (task: TaskWithProject) => {
    const next = task.status === "done" ? "todo" : "done";
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    try {
      await apiPatch(`/api/tasks?id=${task.id}`, { status: next });
    } catch (error) {
      toast((error as Error).message, "error");
      void load();
    }
  };

  const cyclePriority = async (task: TaskWithProject) => {
    const index = TASK_PRIORITIES.indexOf(task.priority as (typeof TASK_PRIORITIES)[number]);
    const next = TASK_PRIORITIES[(index + 1) % TASK_PRIORITIES.length];
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, priority: next } : t)));
    try {
      await apiPatch(`/api/tasks?id=${task.id}`, { priority: next });
    } catch (error) {
      toast((error as Error).message, "error");
      void load();
    }
  };

  const createTask = async () => {
    if (!draft.name.trim() || !draft.projectId) {
      toast("Pick a project and give the task a name", "error");
      return;
    }
    try {
      await apiPost("/api/tasks", {
        projectId: Number(draft.projectId),
        name: draft.name.trim(),
        priority: draft.priority,
        dueDate: draft.dueDate || null,
        status: "todo",
      });
      toast("Task added", "success");
      setCreating(false);
      setDraft({ name: "", projectId: "", priority: "medium", dueDate: todayISO() });
      void load();
    } catch (error) {
      toast((error as Error).message, "error");
    }
  };

  const openCount = tasks.filter((t) => t.status !== "done").length;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Tasks"
        subtitle={`${openCount} open task${openCount === 1 ? "" : "s"} across your projects`}
        actions={
          <Button variant="primary" size="md" onClick={() => setCreating(true)} disabled={!projects.length}>
            <Plus className="h-4 w-4" /> New task
          </Button>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 gap-1 rounded-xl bg-surface-muted p-1">
            {(["open", "done", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "min-h-9 flex-1 rounded-lg px-3 text-[13px] font-medium capitalize transition",
                  tab === value ? "bg-surface text-ink shadow-sm" : "text-muted",
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            className="sm:max-w-[220px]"
            enterKeyHint="search"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="field h-10 w-full sm:w-[150px]"
          >
            <option value="">All priorities</option>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="✅"
          title={tab === "done" ? "Nothing completed yet" : "No tasks match"}
          description={
            tab === "done"
              ? "Tasks you complete will show up here."
              : "Change the filters, or add a task for one of your projects."
          }
          action={
            projects.length ? (
              <Button variant="primary" size="md" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> New task
              </Button>
            ) : (
              <Link href="/projects">
                <Button variant="secondary" size="md">
                  Create a project first
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-5">
          {(
            [
              ["overdue", "Overdue", "text-rose-600 dark:text-rose-400"],
              ["today", "Today", "text-amber-600 dark:text-amber-400"],
              ["week", "Next 7 days", "text-muted"],
              ["later", "Later / no date", "text-muted"],
              ["done", "Completed", "text-emerald-600 dark:text-emerald-400"],
            ] as const
          ).map(([key, label, tone]) => {
            const list = buckets[key as Bucket];
            if (!list.length) return null;
            return (
              <section key={key}>
                <h2 className={cn("mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide", tone)}>
                  <Filter className="h-3.5 w-3.5" />
                  {label}
                  <span className="text-subtle">· {list.length}</span>
                </h2>
                <ul className="space-y-2">
                  {list.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={() => void toggleDone(task)}
                      onPriority={() => void cyclePriority(task)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New task"
        description="Tasks live inside a project, so you always know what they belong to."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void createTask()}>
              Add task
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-subtle">
              Task
            </label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Collect logo + photos"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-subtle">
              Project
            </label>
            <select
              value={draft.projectId}
              onChange={(e) => setDraft((d) => ({ ...d, projectId: e.target.value }))}
              className="field h-10"
            >
              <option value="">Choose a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.lead?.businessName ? ` · ${p.lead.businessName}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-subtle">
                Priority
              </label>
              <select
                value={draft.priority}
                onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}
                className="field h-10"
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-subtle">
                Due date
              </label>
              <Input
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onPriority,
}: {
  task: TaskWithProject;
  onToggle: () => void;
  onPriority: () => void;
}) {
  const done = task.status === "done";
  const overdue = task.dueDate ? daysBetween(todayISO(), task.dueDate) < 0 && !done : false;
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
      <button
        type="button"
        onClick={onToggle}
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-subtle transition active:scale-95"
        aria-label={done ? "Mark as not done" : "Mark as done"}
      >
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className={cn("text-[14px] font-medium leading-snug", done ? "text-subtle line-through" : "text-ink")}>
          {task.name}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
          {task.projectId ? (
            <Link href={`/projects/${task.projectId}`} className="truncate hover:underline">
              {task.projectName ?? "Project"}
            </Link>
          ) : (
            <span>No project</span>
          )}
          {task.clientName && <span className="truncate">{task.clientName}</span>}
          {task.dueDate && (
            <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-rose-500")}>
              <Clock className="h-3 w-3" />
              {relativeDay(task.dueDate)} · {formatDateShort(`${task.dueDate}T00:00:00`)}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={onPriority}
          title="Change priority"
          className={cn(
            "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
            TASK_PRIORITY_STYLES[task.priority as keyof typeof TASK_PRIORITY_STYLES] ??
              "bg-surface-muted text-muted",
          )}
        >
          {TASK_PRIORITY_LABELS[task.priority as keyof typeof TASK_PRIORITY_LABELS] ?? task.priority}
        </button>
        <span className="text-[10.5px] text-subtle">
          {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status}
        </span>
      </div>
    </li>
  );
}
