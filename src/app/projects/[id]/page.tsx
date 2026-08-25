"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { QuickActions } from "@/components/leads/shared";
import { TaskBoard, TaskPriorityPicker } from "@/components/projects/TaskBoard";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Button, Card, Input, Label, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import {
  ACTIVITY_ICONS,
  FILE_CATEGORIES,
  FILE_CATEGORY_LABELS,
  PROJECT_STAGES,
  STAGE_STYLES,
  TASK_STATUS_LABELS,
  type Activity,
  type Contact,
  type Lead,
  type Project,
  type ProjectFile,
  type ProjectNote,
  type ProjectStage,
  type Task,
  type TaskStatus,
} from "@/lib/types";
import {
  buildProjectInfoText,
  cn,
  copyText,
  daysBetween,
  fileIcon,
  formatBytes,
  formatDate,
  formatDateTime,
  formatETB,
  paymentStatus,
  todayISO,
} from "@/lib/utils";

type Detail = {
  project: Project;
  lead: Lead | null;
  tasks: Task[];
  notes: ProjectNote[];
  files: ProjectFile[];
  contacts: Contact[];
  activities: Activity[];
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const projectId = Number(params.id);

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tasks" | "files" | "notes" | "activity">("tasks");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [deleteProject, setDeleteProject] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await apiGet<Detail>(`/api/projects/${projectId}`);
      setData(result);
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    if (Number.isFinite(projectId)) void load();
  }, [projectId, load]);

  const patchProject = async (patch: Record<string, unknown>, silent = false) => {
    try {
      await apiPatch(`/api/projects?id=${projectId}`, patch);
      if (!silent) toast("Project updated", "success");
      void load();
    } catch (error) {
      toast((error as Error).message, "error");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-muted">Project not found.</p>
        <Link href="/projects" className="mt-3 inline-block text-sm text-accent hover:underline">
          ← Back to projects
        </Link>
      </Card>
    );
  }

  const { project, lead, tasks, notes, files, contacts, activities } = data;
  const done = tasks.filter((t) => t.status === "done").length;
  const remaining = tasks.length - done;
  const payStatus = paymentStatus(project.value, project.paid, project.dueDate);
  const balance = Math.max(project.value - project.paid, 0);
  const daysLeft = project.dueDate ? daysBetween(todayISO(), project.dueDate) : null;
  const stageStyle = STAGE_STYLES[project.stage as ProjectStage] ?? STAGE_STYLES.Planning;

  const copyAll = async () => {
    const ok = await copyText(
      buildProjectInfoText({
        project,
        clientName: lead?.businessName,
        clientPhone: lead?.phone,
        taskTotal: tasks.length,
        taskDone: done,
        notes: notes.map((n) => n.body),
      }),
    );
    toast(ok ? "Project info copied" : "Clipboard blocked", ok ? "success" : "error");
  };

  const addNote = async () => {
    const body = noteText.trim();
    if (!body) return;
    await apiPost("/api/project-notes", { projectId, body });
    setNoteText("");
    toast("Note added", "success");
    void load();
  };

  return (
    <div className="animate-fade-up">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[12.5px] text-subtle">
        <Link href="/projects" className="hover:text-accent">
          ← Projects
        </Link>
        <span>/</span>
        <span className="text-muted">{project.name}</span>
      </div>

      {/* Overview */}
      <Card className="mb-5 overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.02em]">
                  {project.name}
                </h1>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium",
                    stageStyle.chip,
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", stageStyle.dot)} />
                  {project.stage}
                </span>
              </div>
              {lead ? (
                <Link
                  href={`/leads/${lead.id}`}
                  className="mt-1 inline-block text-[13px] text-muted hover:text-accent"
                >
                  {lead.businessName}
                  {lead.city ? ` · ${lead.city}` : ""}
                </Link>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={copyAll} title="Copy all project info">
                📋 Copy All
              </Button>
              <Button onClick={() => setPaymentOpen(true)}>💰 Record payment</Button>
              <Button onClick={() => setSettingsOpen(true)}>✎ Edit</Button>
              <Button variant="ghost" onClick={() => setDeleteProject(true)} title="Delete project">
                🗑
              </Button>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <span className="text-[28px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                {project.progress}%
              </span>
              <span className="text-[13px] text-muted">complete</span>
              <label className="ml-auto flex items-center gap-2 text-[11.5px] text-subtle">
                <input
                  type="checkbox"
                  checked={project.autoProgress}
                  onChange={(e) => patchProject({ autoProgress: e.target.checked }, true)}
                  className="h-3.5 w-3.5 accent-[rgb(var(--accent))]"
                />
                Auto from tasks
              </label>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={project.progress}
              onChange={(e) => patchProject({ progress: e.target.value }, true)}
              className="mt-2 w-full accent-[rgb(var(--accent))]"
              title="Drag to set progress manually"
            />
          </div>

          {/* Stage picker */}
          <div>
            <div className="mb-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">
              Current stage
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_STAGES.map((stage) => (
                <button
                  key={stage}
                  onClick={() => patchProject({ stage }, true)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[12.5px] transition-colors",
                    project.stage === stage
                      ? "border-accent/50 bg-accent/10 font-medium text-accent"
                      : "border-line text-muted hover:border-line-strong hover:text-ink",
                  )}
                >
                  {stage}
                </button>
              ))}
            </div>
          </div>

          {lead ? (
            <div className="border-t border-line pt-4">
              <QuickActions lead={lead} compact />
            </div>
          ) : null}
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Deadline">
            <span
              className={cn(
                "text-[14px] font-semibold",
                daysLeft !== null && daysLeft < 0 ? "text-rose-500" : "",
              )}
            >
              {project.dueDate ? formatDate(`${project.dueDate}T00:00:00`) : "—"}
            </span>
            {daysLeft !== null ? (
              <span className="block text-[11px] text-subtle">
                {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`}
              </span>
            ) : null}
          </Stat>
          <Stat label="Tasks">
            <span className="text-[14px] font-semibold">
              {done}/{tasks.length}
            </span>
            <span className="block text-[11px] text-subtle">{remaining} remaining</span>
          </Stat>
          <Stat label="Project value">
            <span className="text-[14px] font-semibold">{formatETB(project.value)}</span>
          </Stat>
          <Stat label="Paid">
            <span className="text-[14px] font-semibold text-emerald-600 dark:text-emerald-300">
              {formatETB(project.paid)}
            </span>
            <span className="block text-[11px] text-subtle">{formatETB(balance)} remaining</span>
          </Stat>
          <Stat label="Payment">
            <span
              className={cn(
                "text-[13px] font-semibold",
                payStatus === "Paid"
                  ? "text-emerald-500"
                  : payStatus === "Overdue"
                    ? "text-rose-500"
                    : "text-amber-500",
              )}
            >
              {payStatus}
            </span>
          </Stat>
          <Stat label="Files · Notes">
            <span className="text-[14px] font-semibold">
              {files.length} · {notes.length}
            </span>
          </Stat>
        </div>
      </Card>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-1 rounded-xl border border-line p-1">
        {(
          [
            ["tasks", `Tasks (${tasks.length})`],
            ["files", `Files (${files.length})`],
            ["notes", `Notes (${notes.length})`],
            ["activity", "Client activity"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              tab === key ? "bg-surface-muted text-ink" : "text-subtle hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "tasks" ? (
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-[13px] text-muted">
                No tasks yet. Add one below, or load the standard website checklist.
              </p>
              <Button
                variant="primary"
                size="md"
                className="mt-3"
                onClick={async () => {
                  const starter = [
                    ["Kickoff call & requirements", "high"],
                    ["Collect logo, photos & brand assets", "high"],
                    ["Sitemap & page list", "medium"],
                    ["Homepage design", "high"],
                    ["Inner page designs", "medium"],
                    ["Build pages", "high"],
                    ["Mobile responsive pass", "high"],
                    ["Write & place content", "medium"],
                    ["Contact form + WhatsApp button", "medium"],
                    ["Client review round", "high"],
                    ["Speed & SEO basics", "medium"],
                    ["Domain, hosting & go live", "urgent"],
                  ] as const;
                  for (const [name, priority] of starter) {
                    await apiPost("/api/tasks", { projectId, name, priority });
                  }
                  toast("Website checklist added", "success");
                  void load();
                }}
              >
                Load website checklist
              </Button>
            </Card>
          ) : null}
          <TaskBoard
            tasks={tasks}
            onMove={async (taskId, status) => {
              setData((prev) =>
                prev
                  ? {
                      ...prev,
                      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
                    }
                  : prev,
              );
              await apiPatch(`/api/tasks?id=${taskId}`, { status });
              void load();
            }}
            onReorder={async (order) => {
              await apiPatch("/api/tasks", { order });
              void load();
            }}
            onEdit={setEditingTask}
            onToggleDone={async (task) => {
              await apiPatch(`/api/tasks?id=${task.id}`, {
                status: task.status === "done" ? "todo" : "done",
              });
              void load();
            }}
            onQuickAdd={async (name, status) => {
              await apiPost("/api/tasks", { projectId, name, status });
              void load();
            }}
            onDelete={setDeleteTask}
          />
          {tasks.some((t) => t.status === "done") ? (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const res = await apiDelete<{ removed: number }>(
                    `/api/tasks?clearDone=true&projectId=${projectId}`,
                  );
                  toast(`Cleared ${res.removed} completed tasks`, "success");
                  void load();
                }}
              >
                Clear completed tasks
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "files" ? (
        <FilesPanel projectId={projectId} files={files} onChange={load} />
      ) : null}

      {tab === "notes" ? (
        <Card className="p-5">
          <div className="flex gap-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void addNote();
              }}
              placeholder="Client wants the homepage to use the second design…  (⌘+Enter to save)"
              className="field min-h-[70px] flex-1 resize-y"
            />
            <Button variant="primary" size="md" onClick={addNote} className="self-end">
              Add
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {notes.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-subtle">
                No project notes yet. These are separate from the client&apos;s lead notes.
              </p>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="group rounded-xl border border-line bg-surface-muted/40 p-3"
                >
                  <p className="text-[13.5px] whitespace-pre-wrap">{note.body}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-subtle">
                    {formatDateTime(note.createdAt)}
                    <button
                      onClick={async () => {
                        await apiDelete(`/api/project-notes?id=${note.id}`);
                        void load();
                      }}
                      className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      ) : null}

      {tab === "activity" ? (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Client communication</h2>
            {lead ? (
              <Link href={`/leads/${lead.id}`} className="text-[12.5px] text-accent hover:underline">
                Open client profile →
              </Link>
            ) : null}
          </div>
          {contacts.length ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-line bg-surface-muted/40 px-3 py-2 text-[12.5px]"
                >
                  <span className="font-medium">{c.name}</span>
                  {c.role ? <span className="text-subtle"> — {c.role}</span> : null}
                  {c.phone ? <div className="text-[11.5px] text-muted">{c.phone}</div> : null}
                </div>
              ))}
            </div>
          ) : null}
          {activities.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-subtle">No activity logged yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-line pl-5">
              {activities.map((item) => (
                <li key={item.id} className="relative">
                  <span className="absolute top-0.5 -left-[27px] flex h-5 w-5 items-center justify-center rounded-full bg-surface text-[10px] ring-1 ring-line">
                    {ACTIVITY_ICONS[item.type] ?? "•"}
                  </span>
                  <div className="text-[13.5px] font-medium">{item.summary}</div>
                  {item.detail ? (
                    <p className="mt-0.5 text-[12.5px] text-muted">{item.detail}</p>
                  ) : null}
                  <div className="mt-0.5 text-[11.5px] text-subtle">
                    {formatDateTime(item.occurredAt)}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      ) : null}

      <TaskModal
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSaved={() => {
          setEditingTask(null);
          void load();
        }}
      />

      <PaymentModal
        open={paymentOpen}
        project={project}
        onClose={() => setPaymentOpen(false)}
        onSaved={() => {
          setPaymentOpen(false);
          void load();
        }}
      />

      <ProjectSettingsModal
        open={settingsOpen}
        project={project}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => {
          setSettingsOpen(false);
          void load();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTask)}
        title="Delete this task?"
        message={deleteTask?.name ?? ""}
        confirmLabel="Delete task"
        destructive
        onClose={() => setDeleteTask(null)}
        onConfirm={async () => {
          if (!deleteTask) return;
          await apiDelete(`/api/tasks?id=${deleteTask.id}`);
          void load();
        }}
      />

      <ConfirmDialog
        open={deleteProject}
        title="Delete this project?"
        message="Tasks, files and project notes will be removed. The client lead and its history stay untouched."
        confirmLabel="Delete project"
        destructive
        onClose={() => setDeleteProject(false)}
        onConfirm={async () => {
          await apiDelete(`/api/projects?id=${projectId}`);
          toast("Project deleted", "success");
          router.push("/projects");
        }}
      />
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="mb-1 text-[10.5px] font-semibold tracking-wide text-subtle uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}

/* --------------------------------- Files --------------------------------- */

function FilesPanel({
  projectId,
  files,
  onChange,
}: {
  projectId: number;
  files: ProjectFile[];
  onChange: () => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("other");
  const [dragActive, setDragActive] = useState(false);
  const [filter, setFilter] = useState("all");
  const [removing, setRemoving] = useState<ProjectFile | null>(null);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("projectId", String(projectId));
      form.append("category", category);
      for (const file of Array.from(list)) form.append("file", file);
      const res = await fetch("/api/project-files", { method: "POST", body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Upload failed");
      }
      toast(`Uploaded ${list.length} file${list.length > 1 ? "s" : ""}`, "success");
      onChange();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setUploading(false);
    }
  };

  const shown = filter === "all" ? files : files.filter((f) => f.category === filter);
  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            void upload(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragActive ? "border-accent bg-accent/5" : "border-line",
          )}
        >
          <div className="mb-2 text-3xl">📎</div>
          <p className="text-[13.5px] font-medium">Drop logos, mockups, content or documents</p>
          <p className="mt-1 text-[12px] text-subtle">Up to 8 MB per file</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="field h-8 w-auto py-0 text-[12.5px]"
            >
              {FILE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {FILE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                void upload(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              size="md"
              variant="primary"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Choose files"}
            </Button>
          </div>
        </div>
      </Card>

      {files.length ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {["all", ...FILE_CATEGORIES].map((c) => {
              const count = c === "all" ? files.length : files.filter((f) => f.category === c).length;
              if (c !== "all" && !count) return null;
              return (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[12px] transition-colors",
                    filter === c
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-line text-muted hover:text-ink",
                  )}
                >
                  {c === "all" ? "All" : FILE_CATEGORY_LABELS[c as keyof typeof FILE_CATEGORY_LABELS]}{" "}
                  {count}
                </button>
              );
            })}
            <span className="ml-auto text-[11.5px] text-subtle">
              {files.length} files · {formatBytes(totalSize)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((file) => (
              <Card key={file.id} hover className="group flex items-center gap-3 p-3">
                {file.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/project-files/${file.id}`}
                    alt={file.name}
                    className="h-12 w-12 shrink-0 rounded-lg border border-line object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-xl">
                    {fileIcon(file.mimeType, file.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium" title={file.name}>
                    {file.name}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-subtle">
                    {FILE_CATEGORY_LABELS[file.category as keyof typeof FILE_CATEGORY_LABELS] ??
                      file.category}{" "}
                    · {formatBytes(file.size)} · {formatDate(file.createdAt)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <a
                    href={`/api/project-files/${file.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[12.5px] hover:bg-surface-muted"
                    title="Open"
                  >
                    ↗
                  </a>
                  <a
                    href={`/api/project-files/${file.id}?download=true`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[12.5px] hover:bg-surface-muted"
                    title="Download"
                  >
                    ⬇
                  </a>
                  <button
                    onClick={() => setRemoving(file)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[12.5px] text-subtle hover:bg-surface-muted hover:text-rose-500"
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={Boolean(removing)}
        title="Delete this file?"
        message={`${removing?.name ?? ""} will be permanently removed from this project.`}
        confirmLabel="Delete file"
        destructive
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          await apiDelete(`/api/project-files?id=${removing.id}`);
          toast("File deleted", "success");
          onChange();
        }}
      />
    </div>
  );
}

/* ------------------------------- Task modal ------------------------------ */

function TaskModal({
  task,
  onClose,
  onSaved,
}: {
  task: Task | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "todo",
    priority: "medium",
    dueDate: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!task) return;
    setForm({
      name: task.name,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ?? "",
      notes: task.notes ?? "",
    });
  }, [task]);

  if (!task) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit task"
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
              if (!form.name.trim()) return toast("Task name is required", "error");
              setSaving(true);
              try {
                await apiPatch(`/api/tasks?id=${task.id}`, form);
                toast("Task saved", "success");
                onSaved();
              } catch (error) {
                toast((error as Error).message, "error");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save task"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Task name</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <Label>Description</Label>
          <textarea
            className="field min-h-[64px] resize-y"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Status</Label>
            <select
              className="field"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Due date</Label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <Label>Priority</Label>
          <TaskPriorityPicker
            value={form.priority}
            onChange={(priority) => setForm((f) => ({ ...f, priority }))}
          />
        </div>
        <div>
          <Label>Notes</Label>
          <textarea
            className="field min-h-[64px] resize-y"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ Payment modal ---------------------------- */

function PaymentModal({
  open,
  project,
  onClose,
  onSaved,
}: {
  open: boolean;
  project: Project;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const balance = Math.max(project.value - project.paid, 0);

  useEffect(() => {
    if (open) setAmount("");
  }, [open]);

  const record = async (value: number) => {
    setSaving(true);
    try {
      await apiPatch(`/api/projects?id=${project.id}`, {
        paid: Math.min(project.paid + value, Math.max(project.value, project.paid + value)),
      });
      toast(`Recorded ${formatETB(value)}`, "success");
      onSaved();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a payment"
      description={`${formatETB(project.paid)} of ${formatETB(project.value)} received · ${formatETB(
        balance,
      )} remaining`}
      size="sm"
      footer={
        <>
          <Button size="md" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="md"
            variant="primary"
            disabled={saving}
            onClick={() => {
              const value = Number(amount.replace(/[^\d.-]/g, ""));
              if (!Number.isFinite(value) || value <= 0) return toast("Enter an amount", "error");
              void record(Math.round(value));
            }}
          >
            Record payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "50% deposit", value: Math.round(project.value / 2) },
            { label: "Full balance", value: balance },
            { label: "10,000", value: 10000 },
            { label: "5,000", value: 5000 },
          ]
            .filter((p) => p.value > 0)
            .map((p) => (
              <Button key={p.label} size="sm" onClick={() => setAmount(String(p.value))}>
                {p.label}
              </Button>
            ))}
        </div>
        <div>
          <Label>Amount (ETB)</Label>
          <Input
            value={amount}
            inputMode="numeric"
            placeholder="17500"
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <p className="text-[12px] text-subtle">
          This adds to the total already received and is logged on the client&apos;s timeline.
        </p>
      </div>
    </Modal>
  );
}

/* -------------------------- Project settings modal ------------------------ */

function ProjectSettingsModal({
  open,
  project,
  onClose,
  onSaved,
}: {
  open: boolean;
  project: Project;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: project.name,
    value: String(project.value),
    paid: String(project.paid),
    dueDate: project.dueDate ?? "",
    siteUrl: project.siteUrl ?? "",
    stage: project.stage,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        name: project.name,
        value: String(project.value),
        paid: String(project.paid),
        dueDate: project.dueDate ?? "",
        siteUrl: project.siteUrl ?? "",
        stage: project.stage,
      });
    }
  }, [open, project]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit project"
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
              if (!form.name.trim()) return toast("Project name is required", "error");
              setSaving(true);
              try {
                await apiPatch(`/api/projects?id=${project.id}`, form);
                toast("Project updated", "success");
                onSaved();
              } catch (error) {
                toast((error as Error).message, "error");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
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
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            />
          </div>
          <div>
            <Label>Paid (ETB)</Label>
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
        <div>
          <Label>Live site URL</Label>
          <Input
            value={form.siteUrl}
            placeholder="https://client.et"
            onChange={(e) => setForm((f) => ({ ...f, siteUrl: e.target.value }))}
          />
        </div>
      </div>
    </Modal>
  );
}
