"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActivityModal, FollowUpModal, LeadFormModal } from "@/components/leads/modals";
import { Modal } from "@/components/ui/modal";
import { Button, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiGet, apiPost } from "@/lib/api";
import type { Lead, ProjectWithLead } from "@/lib/types";
import { cn } from "@/lib/utils";

type Action = "lead" | "followup" | "note" | "activity" | "task" | "project" | null;

const ACTIONS: Array<{ key: Exclude<Action, null>; label: string; icon: string; hint: string }> = [
  { key: "lead", label: "Add lead", icon: "☰", hint: "New business" },
  { key: "followup", label: "Add follow-up", icon: "◷", hint: "Remind me" },
  { key: "note", label: "Add note", icon: "📝", hint: "On a lead" },
  { key: "activity", label: "Log activity", icon: "📞", hint: "Call, WhatsApp…" },
  { key: "task", label: "Add task", icon: "✓", hint: "On a project" },
  { key: "project", label: "Add project", icon: "◈", hint: "New website" },
];

export function QuickAdd() {
  const router = useRouter();
  const { toast } = useToast();
  const [menu, setMenu] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const [lead, setLead] = useState<Lead | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing) return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setMenu((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pick = (key: Exclude<Action, null>) => {
    setMenu(false);
    if (key === "project") {
      router.push("/projects");
      toast("Use “+ New project” to pick the client", "info");
      return;
    }
    setAction(key);
  };

  return (
    <>
      <div className="fixed right-4 bottom-[76px] z-40 lg:right-6 lg:bottom-6">
        {menu ? (
          <>
            <div className="fixed inset-0 -z-10" onClick={() => setMenu(false)} />
            <div className="animate-pop-in mb-2 w-[210px] overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-2xl">
              {ACTIONS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => pick(a.key)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-muted"
                >
                  <span className="w-4 text-center text-[13px] text-subtle">{a.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">{a.label}</span>
                    <span className="block text-[11px] text-subtle">{a.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
        <button
          onClick={() => setMenu((v) => !v)}
          title="Quick add (n)"
          className={cn(
            "flex h-13 w-13 items-center justify-center rounded-2xl bg-accent text-2xl text-white shadow-lg transition-transform active:scale-95",
            "h-13 w-13",
            menu && "rotate-45",
          )}
          style={{ height: 52, width: 52 }}
        >
          +
        </button>
      </div>

      <LeadFormModal
        open={action === "lead"}
        onClose={() => setAction(null)}
        onSaved={(created) => {
          setAction(null);
          router.push(`/leads/${created.id}`);
        }}
      />

      <LeadPicker
        open={action === "followup" || action === "note" || action === "activity"}
        title={
          action === "followup"
            ? "Follow up with…"
            : action === "note"
              ? "Add a note to…"
              : "Log activity for…"
        }
        onClose={() => setAction(null)}
        onPick={(picked) => {
          setLead(picked);
          if (action === "note") setAction("note");
        }}
        selected={lead}
        footerAction={
          action === "note" && lead ? (
            <NoteComposer
              leadId={lead.id}
              onDone={() => {
                setAction(null);
                setLead(null);
              }}
            />
          ) : null
        }
      />

      <FollowUpModal
        open={action === "followup" && Boolean(lead)}
        leadId={lead?.id ?? null}
        leadName={lead?.businessName}
        onClose={() => {
          setAction(null);
          setLead(null);
        }}
      />

      <ActivityModal
        open={action === "activity" && Boolean(lead)}
        leadId={lead?.id ?? null}
        leadName={lead?.businessName}
        onClose={() => {
          setAction(null);
          setLead(null);
        }}
      />

      <TaskQuickModal open={action === "task"} onClose={() => setAction(null)} />
    </>
  );
}

function LeadPicker({
  open,
  title,
  onClose,
  onPick,
  selected,
  footerAction,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onPick: (lead: Lead) => void;
  selected: Lead | null;
  footerAction?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Lead[]>([]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) return setResults([]);
    const t = setTimeout(async () => {
      try {
        const data = await apiGet<{ leads: Lead[] }>(
          `/api/leads?q=${encodeURIComponent(query.trim())}&pageSize=7`,
        );
        setResults(data.leads);
      } catch {
        setResults([]);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  if (!open || (selected && !footerAction)) return null;

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      {selected && footerAction ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-surface-muted/50 p-2.5 text-[13.5px] font-medium">
            {selected.businessName}
          </div>
          {footerAction}
        </div>
      ) : (
        <>
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a business…"
          />
          <div className="mt-2 space-y-1">
            {results.map((l) => (
              <button
                key={l.id}
                onClick={() => onPick(l)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-surface-muted"
              >
                <span className="flex-1 truncate">{l.businessName}</span>
                <span className="text-[11.5px] text-subtle">{l.city ?? ""}</span>
              </button>
            ))}
            {query.trim().length >= 2 && !results.length ? (
              <p className="px-2 py-3 text-center text-[12.5px] text-subtle">No matches.</p>
            ) : null}
          </div>
        </>
      )}
    </Modal>
  );
}

function NoteComposer({ leadId, onDone }: { leadId: number; onDone: () => void }) {
  const { toast } = useToast();
  const [body, setBody] = useState("");
  return (
    <div className="space-y-3">
      <textarea
        autoFocus
        className="field min-h-[90px] resize-y"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Owner said to call again Friday…"
      />
      <Button
        variant="primary"
        size="md"
        className="w-full"
        onClick={async () => {
          if (!body.trim()) return;
          await apiPost("/api/notes", { leadId, body });
          toast("Note added", "success");
          onDone();
        }}
      >
        Save note
      </Button>
    </div>
  );
}

function TaskQuickModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectWithLead[]>([]);
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    apiGet<{ projects: ProjectWithLead[] }>("/api/projects")
      .then((d) => {
        setProjects(d.projects);
        setProjectId(d.projects[0] ? String(d.projects[0].id) : "");
      })
      .catch(() => undefined);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add task"
      size="sm"
      footer={
        <>
          <Button size="md" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="md"
            variant="primary"
            onClick={async () => {
              if (!projectId || !name.trim()) return toast("Pick a project and name", "error");
              await apiPost("/api/tasks", { projectId: Number(projectId), name });
              toast("Task added", "success");
              onClose();
            }}
          >
            Add task
          </Button>
        </>
      }
    >
      {projects.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-subtle">
          Create a project first, then add tasks to it.
        </p>
      ) : (
        <div className="space-y-3">
          <select
            className="field"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Task name"
          />
        </div>
      )}
    </Modal>
  );
}
