"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ActivityModal, FollowUpModal, LeadFormModal } from "@/components/leads/modals";
import {
  LeadAvatar,
  QuickActions,
  RatingLine,
  ScoreBadge,
  StatusSelect,
  TierBadge,
  WebsiteFlag,
} from "@/components/leads/shared";
import { ContactsPanel } from "@/components/leads/ContactsPanel";
import { ConfirmDialog } from "@/components/ui/modal";
import { Button, Card, Input, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import {
  ACTIVITY_ICONS,
  PROJECT_STAGES,
  STAGE_STYLES,
  TIER_LABELS,
  type ProjectStage,
  type Activity,
  type Contact,
  type FollowUp,
  type Lead,
  type LeadNote,
  type Project,
} from "@/lib/types";
import {
  addDaysISO,
  cn,
  formatDate,
  formatDateTime,
  formatETB,
  paymentStatus,
  relativeDay,
  timeAgo,
} from "@/lib/utils";

type Detail = {
  lead: Lead;
  notes: LeadNote[];
  activities: Activity[];
  followUps: FollowUp[];
  projects: Project[];
  contacts: Contact[];
};

export default function LeadProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const leadId = Number(params.id);

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await apiGet<Detail>(`/api/leads/${leadId}`);
      setData(result);
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [leadId, toast]);

  useEffect(() => {
    if (Number.isFinite(leadId)) void load();
  }, [leadId, load]);

  const patchLead = async (patch: Partial<Lead> | Record<string, unknown>) => {
    try {
      await apiPatch(`/api/leads/${leadId}`, patch);
      void load();
    } catch (error) {
      toast((error as Error).message, "error");
    }
  };

  const addNote = async () => {
    const body = noteText.trim();
    if (!body) return;
    try {
      await apiPost("/api/notes", { leadId, body });
      setNoteText("");
      toast("Note added", "success");
      void load();
    } catch (error) {
      toast((error as Error).message, "error");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-muted">Lead not found.</p>
        <Link href="/leads" className="mt-3 inline-block text-sm text-accent hover:underline">
          ← Back to leads
        </Link>
      </Card>
    );
  }

  const { lead, notes, activities, followUps, projects, contacts } = data;
  const pendingFollowUps = followUps.filter((f) => f.status === "pending");

  return (
    <div className="animate-fade-up">
      <div className="mb-4 flex items-center gap-2 text-[12.5px] text-subtle">
        <Link href="/leads" className="hover:text-accent">
          ← Leads
        </Link>
        <span>/</span>
        <span className="text-muted">{lead.businessName}</span>
      </div>

      {/* Hero */}
      <Card className="mb-5 overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <LeadAvatar name={lead.businessName} size={56} />
            <div className="min-w-0 flex-1">
              <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.02em]">
                {lead.businessName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                <span>{lead.category ?? "No category"}</span>
                {lead.city ? <span>· {lead.city}</span> : null}
                {lead.address ? <span className="text-subtle">· {lead.address}</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RatingLine rating={lead.rating} reviews={lead.reviewCount} />
                <WebsiteFlag website={lead.website} />
                {lead.contactPerson ? (
                  <span className="text-[12.5px] text-muted">👤 {lead.contactPerson}</span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusSelect value={lead.status} onChange={(status) => patchLead({ status })} />
              <Button onClick={() => setEditOpen(true)}>✎ Edit</Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} title="Delete lead">
                🗑
              </Button>
            </div>
          </div>

          <QuickActions
            lead={lead}
            copyExtras={{
              contacts,
              notes: notes.map((n) => n.body),
              projects: projects.map((p) => ({
                name: p.name,
                stage: p.stage,
                progress: p.progress,
                value: p.value,
                paid: p.paid,
              })),
            }}
            onLogActivity={async (type, summary) => {
              await apiPost("/api/activities", { leadId, type, summary });
              void load();
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setFollowUpOpen(true)}>
              ◷ Schedule follow-up
            </Button>
            <Button onClick={() => setActivityOpen(true)}>＋ Log activity</Button>
            {lead.status !== "Won" ? (
              <Button
                onClick={() => {
                  void patchLead({ status: "Won" });
                  toast("Marked as client 🎉", "success");
                }}
              >
                ★ Mark as client (Won)
              </Button>
            ) : (
              <Button onClick={() => setProjectOpen(true)}>◈ Add project</Button>
            )}
          </div>
        </div>

        {/* Priority strip */}
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          <PriorityCell label="Lead score (manual)">
            <InlineNumber
              value={lead.leadScore}
              placeholder="—"
              onSave={(v) => patchLead({ leadScore: v })}
              render={(v) => <ScoreBadge score={v} />}
            />
          </PriorityCell>
          <PriorityCell label="Tier (manual)">
            <select
              value={lead.tier?.toString() ?? ""}
              onChange={(e) =>
                patchLead({ tier: e.target.value === "" ? null : Number(e.target.value) })
              }
              className="field h-8 py-0 text-[13px]"
            >
              <option value="">No tier</option>
              {[1, 2, 3, 4, 5].map((t) => (
                <option key={t} value={t}>
                  Tier {t} — {TIER_LABELS[t]}
                </option>
              ))}
            </select>
          </PriorityCell>
          <PriorityCell label="Potential value">
            <InlineNumber
              value={lead.potentialValue}
              placeholder="0"
              onSave={(v) => patchLead({ potentialValue: v })}
              render={(v) => (
                <span className="text-[14px] font-semibold">{v ? formatETB(v) : "—"}</span>
              )}
            />
          </PriorityCell>
          <PriorityCell label="Last contacted">
            <span className="text-[13px] text-muted">
              {lead.lastContactedAt ? timeAgo(lead.lastContactedAt) : "Never"}
            </span>
          </PriorityCell>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Notes */}
          <Card className="p-5">
            <h2 className="mb-3 text-[15px] font-semibold">Notes</h2>
            <div className="flex gap-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void addNote();
                }}
                placeholder="Owner said to contact him again Friday…  (⌘+Enter to save)"
                className="field min-h-[64px] flex-1 resize-y"
              />
              <Button variant="primary" size="md" onClick={addNote} className="self-end">
                Add
              </Button>
            </div>
            {lead.notes ? (
              <div className="mt-4 rounded-xl border border-dashed border-line bg-surface-muted/40 p-3">
                <div className="mb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">
                  Imported notes
                </div>
                <p className="text-[13px] whitespace-pre-wrap text-muted">{lead.notes}</p>
              </div>
            ) : null}
            <div className="mt-4 space-y-2">
              {notes.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-subtle">No notes yet.</p>
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
                          await apiDelete(`/api/notes?id=${note.id}`);
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

          {/* Activity timeline */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Activity history</h2>
              <Button size="sm" onClick={() => setActivityOpen(true)}>
                ＋ Log
              </Button>
            </div>
            {activities.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-subtle">
                No activity yet — log a call or WhatsApp message to start the timeline.
              </p>
            ) : (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {activities.map((item) => (
                  <li key={item.id} className="group relative">
                    <span className="absolute top-0.5 -left-[27px] flex h-5 w-5 items-center justify-center rounded-full bg-surface text-[10px] ring-1 ring-line">
                      {ACTIVITY_ICONS[item.type] ?? "•"}
                    </span>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-medium">{item.summary}</div>
                        {item.detail ? (
                          <p className="mt-0.5 text-[12.5px] whitespace-pre-wrap text-muted">
                            {item.detail}
                          </p>
                        ) : null}
                        <div className="mt-0.5 text-[11.5px] text-subtle">
                          {formatDateTime(item.occurredAt)}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          await apiDelete(`/api/activities?id=${item.id}`);
                          void load();
                        }}
                        className="text-[11.5px] text-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose-500"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {/* Follow-ups */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Follow-ups</h2>
              <Button size="sm" onClick={() => setFollowUpOpen(true)}>
                ＋ New
              </Button>
            </div>
            {pendingFollowUps.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-subtle">Nothing scheduled.</p>
            ) : (
              <div className="space-y-2">
                {pendingFollowUps.map((f) => (
                  <div key={f.id} className="rounded-xl border border-line bg-surface-muted/40 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">{relativeDay(f.dueDate)}</span>
                      <span className="text-[11.5px] text-subtle">{formatDate(f.dueDate)}</span>
                    </div>
                    {f.note ? <p className="mt-1 text-[12.5px] text-muted">{f.note}</p> : null}
                    <div className="mt-2 flex gap-1.5">
                      <Button
                        size="xs"
                        onClick={async () => {
                          await apiPatch(`/api/followups?id=${f.id}`, { status: "done" });
                          void load();
                        }}
                      >
                        ✓ Done
                      </Button>
                      <Button
                        size="xs"
                        onClick={async () => {
                          await apiPatch(`/api/followups?id=${f.id}`, { dueDate: addDaysISO(3) });
                          void load();
                        }}
                      >
                        +3d
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={async () => {
                          await apiPatch(`/api/followups?id=${f.id}`, { status: "cancelled" });
                          void load();
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <ContactsPanel leadId={leadId} contacts={contacts} onChange={load} />

          {/* Tags */}
          <Card className="p-5">
            <h2 className="mb-3 text-[15px] font-semibold">Tags</h2>
            <div className="flex flex-wrap gap-1.5">
              {lead.tags?.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-lg bg-accent/10 px-2 py-1 text-[12px] text-accent"
                >
                  {tag}
                  <button
                    onClick={() => patchLead({ tags: lead.tags.filter((t) => t !== tag) })}
                    className="opacity-60 hover:opacity-100"
                  >
                    ✕
                  </button>
                </span>
              ))}
              {!lead.tags?.length ? <span className="text-[12.5px] text-subtle">No tags</span> : null}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    void patchLead({ tags: [...new Set([...lead.tags, tagInput.trim()])] });
                    setTagInput("");
                  }
                }}
                placeholder="Add tag + Enter"
                className="h-8 py-0 text-[13px]"
              />
            </div>
          </Card>

          {/* Contact & links */}
          <Card className="p-5">
            <h2 className="mb-3 text-[15px] font-semibold">Details</h2>
            <dl className="space-y-2 text-[13px]">
              <DetailRow label="Phone" value={lead.phone} />
              <DetailRow label="Phone 2" value={lead.phone2} />
              <DetailRow label="Email" value={lead.email} />
              <DetailRow label="Website" value={lead.website} link />
              <DetailRow label="Google Maps" value={lead.mapsUrl} link />
              <DetailRow label="Instagram" value={lead.instagram} link />
              <DetailRow label="Facebook" value={lead.facebook} link />
              <DetailRow label="TikTok" value={lead.tiktok} link />
              <DetailRow label="Telegram" value={lead.telegram} link />
              <DetailRow label="LinkedIn" value={lead.linkedin} link />
              <DetailRow label="Source" value={lead.source} />
              <DetailRow label="Added" value={formatDate(lead.createdAt)} />
              {Object.entries(lead.customFields ?? {}).map(([k, v]) => (
                <DetailRow key={k} label={k} value={v} />
              ))}
            </dl>
          </Card>

          {/* Projects */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Projects & payments</h2>
              <Button size="sm" onClick={() => setProjectOpen(true)}>
                ＋ New
              </Button>
            </div>
            {projects.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-subtle">
                No project yet. Add one when they sign.
              </p>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => {
                  const status = paymentStatus(p.value, p.paid, p.dueDate);
                  const stageStyle =
                    STAGE_STYLES[p.stage as ProjectStage] ?? STAGE_STYLES.Planning;
                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="block rounded-xl border border-line bg-surface-muted/40 p-3 transition-colors hover:bg-surface-muted"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13.5px] font-medium">{p.name}</span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                            stageStyle.chip,
                          )}
                        >
                          {p.stage}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] tabular-nums text-subtle">{p.progress}%</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
                        <span className="text-muted">
                          {formatETB(p.paid)} / {formatETB(p.value)}
                        </span>
                        <span
                          className={cn(
                            status === "Paid"
                              ? "text-emerald-500"
                              : status === "Overdue"
                                ? "text-rose-500"
                                : "text-amber-500",
                          )}
                        >
                          {status}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      <LeadFormModal
        open={editOpen}
        lead={lead}
        onClose={() => setEditOpen(false)}
        onSaved={() => void load()}
      />
      <FollowUpModal
        open={followUpOpen}
        leadId={leadId}
        leadName={lead.businessName}
        onClose={() => setFollowUpOpen(false)}
        onCreated={load}
      />
      <ActivityModal
        open={activityOpen}
        leadId={leadId}
        leadName={lead.businessName}
        onClose={() => setActivityOpen(false)}
        onCreated={load}
      />
      <ProjectModal
        open={projectOpen}
        leadId={leadId}
        defaultName={`${lead.businessName} website`}
        defaultValue={lead.potentialValue ?? 0}
        onClose={() => setProjectOpen(false)}
        onSaved={load}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this lead?"
        message="This permanently removes the business and all its notes, activities, follow-ups and projects."
        confirmLabel="Delete permanently"
        destructive
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await apiDelete(`/api/leads/${leadId}`);
          toast("Lead deleted", "success");
          router.push("/leads");
        }}
      />
    </div>
  );
}

function PriorityCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface px-5 py-3.5">
      <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}

function InlineNumber({
  value,
  onSave,
  render,
  placeholder,
}: {
  value: number | null;
  onSave: (value: number | null) => void;
  render: (value: number | null) => React.ReactNode;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "");

  useEffect(() => {
    setDraft(value?.toString() ?? "");
  }, [value]);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="rounded-lg text-left transition-opacity hover:opacity-70"
        title="Click to edit"
      >
        {render(value)}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      placeholder={placeholder}
      inputMode="numeric"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const parsed = draft.trim() === "" ? null : Number(draft.replace(/[^\d.-]/g, ""));
        onSave(Number.isFinite(parsed as number) ? (parsed as number) : null);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      className="field h-8 w-28 py-0 text-[13px]"
    />
  );
}

function DetailRow({
  label,
  value,
  link,
}: {
  label: string;
  value: string | null | undefined;
  link?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <dt className="w-24 shrink-0 text-[12px] text-subtle">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">
        {link ? (
          <a
            href={/^https?:/i.test(value) ? value : `https://${value}`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent hover:underline"
          >
            {value.replace(/^https?:\/\//, "").slice(0, 42)}
            {value.length > 50 ? "…" : ""}
          </a>
        ) : (
          <span className="text-ink">{value}</span>
        )}
      </dd>
    </div>
  );
}

function ProjectModal({
  open,
  onClose,
  leadId,
  defaultName,
  defaultValue,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  leadId: number;
  defaultName: string;
  defaultValue: number;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(defaultName);
  const [value, setValue] = useState(String(defaultValue || ""));
  const [paid, setPaid] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setValue(String(defaultValue || ""));
      setPaid("0");
      setDueDate("");
    }
  }, [open, defaultName, defaultValue]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="animate-fade-in absolute inset-0 bg-black/35 backdrop-blur-[3px]" onClick={onClose} />
      <div className="animate-pop-in relative z-10 w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <h2 className="text-[17px] font-semibold">New project</h2>
        <p className="mt-1 mb-4 text-[12.5px] text-muted">
          The standard 12-step website checklist is added automatically.
        </p>
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-[11px] tracking-wide text-subtle uppercase">Project name</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-[11px] tracking-wide text-subtle uppercase">Value (ETB)</div>
              <Input value={value} inputMode="numeric" onChange={(e) => setValue(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-[11px] tracking-wide text-subtle uppercase">Paid (ETB)</div>
              <Input value={paid} inputMode="numeric" onChange={(e) => setPaid(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] tracking-wide text-subtle uppercase">Due date</div>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button size="md" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="md"
            variant="primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await apiPost("/api/projects", {
                  leadId,
                  name,
                  value,
                  paid,
                  dueDate,
                  withStarterTasks: true,
                });
                toast("Project created", "success");
                onSaved();
                onClose();
              } catch (error) {
                toast((error as Error).message, "error");
              } finally {
                setSaving(false);
              }
            }}
          >
            Create project
          </Button>
        </div>
      </div>
    </div>
  );
}
