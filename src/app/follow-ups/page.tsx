"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LeadAvatar, StatusPill, TierBadge } from "@/components/leads/shared";
import { Modal } from "@/components/ui/modal";
import { Button, Card, EmptyState, Input, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { FollowUpWithLead, Lead } from "@/lib/types";
import { addDaysISO, cn, daysBetween, formatDate, relativeDay, telHref, todayISO, whatsappHref } from "@/lib/utils";

export default function FollowUpsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<FollowUpWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ followUps: FollowUpWithLead[] }>("/api/followups");
      setItems(data.followUps);
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
  const groups = useMemo(() => {
    const pending = items.filter((f) => f.status === "pending");
    return {
      overdue: pending.filter((f) => daysBetween(today, f.dueDate) < 0),
      today: pending.filter((f) => f.dueDate === today),
      upcoming: pending.filter((f) => daysBetween(today, f.dueDate) > 0),
      closed: items.filter((f) => f.status !== "pending"),
    };
  }, [items, today]);

  const act = async (id: number, patch: Record<string, unknown>, message: string) => {
    try {
      await apiPatch(`/api/followups?id=${id}`, patch);
      toast(message, "success");
      void load();
    } catch (error) {
      toast((error as Error).message, "error");
    }
  };

  const remove = async (id: number) => {
    await apiDelete(`/api/followups?id=${id}`);
    toast("Follow-up deleted", "success");
    void load();
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Follow-ups"
        subtitle={`${groups.overdue.length} overdue · ${groups.today.length} today · ${groups.upcoming.length} upcoming`}
        actions={
          <>
            <Button size="md" onClick={() => setShowDone((v) => !v)}>
              {showDone ? "Hide" : "Show"} completed
            </Button>
            <Button size="md" variant="primary" onClick={() => setNewOpen(true)}>
              + New follow-up
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !items.length ? (
        <EmptyState
          icon="◷"
          title="No follow-ups yet"
          description="Schedule a follow-up from any lead — “tomorrow”, “in 3 days” or a specific date."
          action={
            <Button variant="primary" size="md" onClick={() => setNewOpen(true)}>
              Schedule one
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <Group
            title="Overdue"
            tone="danger"
            items={groups.overdue}
            onAct={act}
            onRemove={remove}
          />
          <Group title="Today" tone="warn" items={groups.today} onAct={act} onRemove={remove} />
          <Group
            title="Upcoming"
            tone="muted"
            items={groups.upcoming}
            onAct={act}
            onRemove={remove}
          />
          {showDone ? (
            <Group
              title="Completed & cancelled"
              tone="muted"
              items={groups.closed}
              onAct={act}
              onRemove={remove}
              closed
            />
          ) : null}
        </div>
      )}

      <NewFollowUpModal open={newOpen} onClose={() => setNewOpen(false)} onCreated={load} />
    </div>
  );
}

function Group({
  title,
  items,
  tone,
  onAct,
  onRemove,
  closed,
}: {
  title: string;
  items: FollowUpWithLead[];
  tone: "danger" | "warn" | "muted";
  onAct: (id: number, patch: Record<string, unknown>, message: string) => void;
  onRemove: (id: number) => void;
  closed?: boolean;
}) {
  if (!items.length) return null;
  const toneClass =
    tone === "danger" ? "text-rose-500" : tone === "warn" ? "text-amber-500" : "text-subtle";
  return (
    <section>
      <h2 className={cn("mb-2.5 text-[11.5px] font-semibold tracking-wide uppercase", toneClass)}>
        {title} · {items.length}
      </h2>
      <div className="space-y-2">
        {items.map((item) => {
          const tel = telHref(item.lead?.phone);
          const wa = whatsappHref(item.lead?.phone);
          return (
            <Card key={item.id} className="flex flex-wrap items-center gap-3 p-3.5" hover>
              <LeadAvatar name={item.lead?.businessName ?? "?"} size={38} />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/leads/${item.leadId}`}
                  className="block truncate text-[14px] font-medium hover:text-accent"
                >
                  {item.lead?.businessName ?? "Unknown lead"}
                </Link>
                <div className="truncate text-[12px] text-muted">
                  {item.note || "Follow up"}
                </div>
                <div className="mt-0.5 text-[11.5px] text-subtle">
                  {relativeDay(item.dueDate)} · {formatDate(`${item.dueDate}T00:00:00`)}
                  {closed ? ` · ${item.status}` : ""}
                </div>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                {item.lead?.tier ? <TierBadge tier={item.lead.tier} /> : null}
                {item.lead?.status ? <StatusPill status={item.lead.status} /> : null}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {tel ? (
                  <a
                    href={tel}
                    className="inline-flex h-8 items-center rounded-[10px] border border-line px-2.5 text-[12.5px] hover:bg-surface-muted"
                    title={item.lead?.phone ?? ""}
                  >
                    📞
                  </a>
                ) : null}
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center rounded-[10px] border border-line px-2.5 text-[12.5px] hover:bg-surface-muted"
                    title="WhatsApp"
                  >
                    💬
                  </a>
                ) : null}
                {!closed ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => onAct(item.id, { status: "done" }, "Follow-up completed")}
                    >
                      ✓ Done
                    </Button>
                    <select
                      className="field h-8 w-[120px] py-0 text-[12px]"
                      defaultValue=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        onAct(
                          item.id,
                          { dueDate: addDaysISO(Number(e.target.value)) },
                          "Rescheduled",
                        );
                        e.target.value = "";
                      }}
                    >
                      <option value="">Reschedule…</option>
                      <option value="0">Today</option>
                      <option value="1">Tomorrow</option>
                      <option value="3">In 3 days</option>
                      <option value="7">In 1 week</option>
                      <option value="14">In 2 weeks</option>
                    </select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onAct(item.id, { status: "cancelled" }, "Cancelled")}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => onRemove(item.id)}>
                    Delete
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function NewFollowUpModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [date, setDate] = useState(addDaysISO(1));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setSelected(null);
    setDate(addDaysISO(1));
    setNote("");
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await apiGet<{ leads: Lead[] }>(
          `/api/leads?q=${encodeURIComponent(query.trim())}&pageSize=6`,
        );
        setResults(data.leads);
      } catch {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const submit = async () => {
    if (!selected) return toast("Pick a lead first", "error");
    setSaving(true);
    try {
      await apiPost("/api/followups", { leadId: selected.id, dueDate: date, note });
      toast("Follow-up scheduled", "success");
      onCreated();
      onClose();
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
      title="New follow-up"
      size="sm"
      footer={
        <>
          <Button size="md" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" variant="primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Schedule"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
            Lead
          </div>
          {selected ? (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-muted/50 p-2.5">
              <span className="flex-1 truncate text-[13.5px] font-medium">
                {selected.businessName}
              </span>
              <button
                onClick={() => setSelected(null)}
                className="text-[12px] text-subtle hover:text-ink"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a business…"
              />
              <div className="mt-2 space-y-1">
                {results.map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => setSelected(lead)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-surface-muted"
                  >
                    <span className="flex-1 truncate">{lead.businessName}</span>
                    <span className="text-[11.5px] text-subtle">{lead.city ?? ""}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "Today", value: todayISO() },
            { label: "Tomorrow", value: addDaysISO(1) },
            { label: "In 3 days", value: addDaysISO(3) },
            { label: "In 1 week", value: addDaysISO(7) },
          ].map((p) => (
            <button
              key={p.label}
              onClick={() => setDate(p.value)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-[12.5px]",
                date === p.value
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-line text-muted hover:text-ink",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <textarea
          className="field min-h-[70px] resize-y"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What is this follow-up about?"
        />
      </div>
    </Modal>
  );
}
