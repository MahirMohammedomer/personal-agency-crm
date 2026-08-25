"use client";

import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_STYLES,
  TASK_STATUSES,
  TASK_STATUS_DOTS,
  TASK_STATUS_LABELS,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/types";
import { cn, daysBetween, relativeDay, todayISO } from "@/lib/utils";

export function TaskBoard({
  tasks,
  onMove,
  onReorder,
  onEdit,
  onToggleDone,
  onQuickAdd,
  onDelete,
}: {
  tasks: Task[];
  onMove: (taskId: number, status: TaskStatus) => void;
  onReorder: (order: number[]) => void;
  onEdit: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  onQuickAdd: (name: string, status: TaskStatus) => void;
  onDelete: (task: Task) => void;
}) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [adding, setAdding] = useState<TaskStatus | null>(null);
  const [draft, setDraft] = useState("");

  const handleDrop = (status: TaskStatus, beforeId?: number) => {
    if (dragId === null) return;
    const task = tasks.find((t) => t.id === dragId);
    if (!task) return;

    if (task.status !== status) onMove(dragId, status);

    const column = tasks.filter((t) => t.status === status && t.id !== dragId);
    const index = beforeId ? column.findIndex((t) => t.id === beforeId) : column.length;
    const next = [...column];
    next.splice(index < 0 ? column.length : index, 0, task);
    onReorder(next.map((t) => t.id));
    setDragId(null);
    setDragOver(null);
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUSES.map((status) => {
        const column = tasks.filter((t) => t.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(status);
            }}
            onDragLeave={() => setDragOver((p) => (p === status ? null : p))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(status);
            }}
            className={cn(
              "flex min-h-[220px] flex-col rounded-2xl border border-line bg-surface-muted/40 transition-colors",
              dragOver === status && "drag-over",
            )}
          >
            <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
              <span className={cn("h-2 w-2 rounded-full", TASK_STATUS_DOTS[status])} />
              <span className="text-[12px] font-semibold tracking-wide uppercase">
                {TASK_STATUS_LABELS[status]}
              </span>
              <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted">
                {column.length}
              </span>
            </div>

            <div className="flex-1 space-y-2 p-2">
              {column.length === 0 && adding !== status ? (
                <div className="rounded-xl border border-dashed border-line py-6 text-center text-[12px] text-subtle">
                  Drop tasks here
                </div>
              ) : null}

              {column.map((task) => {
                const overdue =
                  task.dueDate && task.status !== "done"
                    ? daysBetween(todayISO(), task.dueDate) < 0
                    : false;
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(task.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDragId(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDrop(status, task.id);
                    }}
                    className={cn(
                      "group card cursor-grab p-2.5 active:cursor-grabbing",
                      dragId === task.id && "dragging",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => onToggleDone(task)}
                        title={task.status === "done" ? "Reopen task" : "Mark done"}
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border text-[9px] transition-colors",
                          task.status === "done"
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-line-strong hover:border-emerald-500",
                        )}
                      >
                        {task.status === "done" ? "✓" : ""}
                      </button>
                      <button
                        onClick={() => onEdit(task)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span
                          className={cn(
                            "block text-[13px] leading-snug font-medium",
                            task.status === "done" && "text-subtle line-through",
                          )}
                        >
                          {task.name}
                        </span>
                        {task.description ? (
                          <span className="mt-0.5 block truncate text-[11.5px] text-subtle">
                            {task.description}
                          </span>
                        ) : null}
                      </button>
                      <button
                        onClick={() => onDelete(task)}
                        className="text-[11px] text-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose-500"
                        title="Delete task"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10.5px] font-medium",
                          TASK_PRIORITY_STYLES[task.priority as TaskPriority] ??
                            TASK_PRIORITY_STYLES.medium,
                        )}
                      >
                        {TASK_PRIORITY_LABELS[task.priority as TaskPriority] ?? task.priority}
                      </span>
                      {task.dueDate ? (
                        <span
                          className={cn(
                            "text-[11px]",
                            overdue ? "font-medium text-rose-500" : "text-subtle",
                          )}
                        >
                          ◷ {relativeDay(task.dueDate)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {adding === status ? (
                <div className="card p-2">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && draft.trim()) {
                        onQuickAdd(draft.trim(), status);
                        setDraft("");
                      }
                      if (e.key === "Escape") {
                        setAdding(null);
                        setDraft("");
                      }
                    }}
                    onBlur={() => {
                      if (draft.trim()) onQuickAdd(draft.trim(), status);
                      setAdding(null);
                      setDraft("");
                    }}
                    placeholder="Task name + Enter"
                    className="field h-8 py-0 text-[12.5px]"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setAdding(status)}
                  className="w-full rounded-xl px-2 py-1.5 text-left text-[12px] text-subtle transition-colors hover:bg-surface-muted hover:text-ink"
                >
                  + Add task
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TaskPriorityPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TASK_PRIORITIES.map((p) => (
        <Button
          key={p}
          size="sm"
          variant={value === p ? "primary" : "secondary"}
          onClick={() => onChange(p)}
        >
          {TASK_PRIORITY_LABELS[p]}
        </Button>
      ))}
    </div>
  );
}
