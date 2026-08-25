"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Label } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiPatch, apiPost } from "@/lib/api";
import { ACTIVITY_TYPES, LEAD_STATUSES, TIER_LABELS, type Lead } from "@/lib/types";
import { addDaysISO, cn, todayISO } from "@/lib/utils";

/* ------------------------------ Lead form ------------------------------- */

type FormState = Record<string, string>;

const NO_STRINGS: string[] = [];

const FIELD_GROUPS: Array<{
  title: string;
  fields: Array<{ key: string; label: string; placeholder?: string; type?: string; wide?: boolean }>;
}> = [
  {
    title: "Business",
    fields: [
      { key: "businessName", label: "Business name", placeholder: "ABC Construction", wide: true },
      { key: "category", label: "Category / niche", placeholder: "Construction" },
      { key: "city", label: "City / location", placeholder: "Addis Ababa" },
      { key: "address", label: "Address", placeholder: "Bole, near Edna Mall", wide: true },
      { key: "contactPerson", label: "Contact person", placeholder: "Ato Bekele" },
    ],
  },
  {
    title: "Contact",
    fields: [
      { key: "phone", label: "Phone", placeholder: "+251 91 234 5678" },
      { key: "phone2", label: "Phone 2", placeholder: "Optional" },
      { key: "email", label: "Email", placeholder: "info@business.et" },
    ],
  },
  {
    title: "Online presence",
    fields: [
      { key: "website", label: "Website", placeholder: "Leave empty if none", wide: true },
      { key: "mapsUrl", label: "Google Maps URL", placeholder: "https://maps.google.com/…", wide: true },
      { key: "facebook", label: "Facebook" },
      { key: "instagram", label: "Instagram" },
      { key: "tiktok", label: "TikTok" },
      { key: "telegram", label: "Telegram" },
      { key: "linkedin", label: "LinkedIn" },
    ],
  },
  {
    title: "Reputation",
    fields: [
      { key: "rating", label: "Rating", placeholder: "4.8", type: "text" },
      { key: "reviewCount", label: "Review count", placeholder: "127", type: "text" },
    ],
  },
];

export function LeadFormModal({
  open,
  onClose,
  lead,
  onSaved,
  customFieldKeys = NO_STRINGS,
  tagPresets = NO_STRINGS,
}: {
  open: boolean;
  onClose: () => void;
  lead?: Lead | null;
  onSaved: (lead: Lead) => void;
  customFieldKeys?: string[];
  tagPresets?: string[];
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>({});
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [newFieldKey, setNewFieldKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base: FormState = {};
    for (const group of FIELD_GROUPS) {
      for (const field of group.fields) {
        const value = lead ? (lead[field.key as keyof Lead] as unknown) : "";
        base[field.key] = value === null || value === undefined ? "" : String(value);
      }
    }
    base.leadScore = lead?.leadScore?.toString() ?? "";
    base.tier = lead?.tier?.toString() ?? "";
    base.status = lead?.status ?? "New";
    base.potentialValue = lead?.potentialValue?.toString() ?? "";
    base.notes = lead?.notes ?? "";
    setForm(base);
    setTags(lead?.tags ?? []);
    const merged: Record<string, string> = {};
    for (const key of customFieldKeys) merged[key] = "";
    setCustom({ ...merged, ...(lead?.customFields ?? {}) });
    setTagInput("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead, customFieldKeys.join("|")]);

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setTagInput("");
  };

  const submit = async () => {
    if (!form.businessName?.trim()) {
      toast("Business name is required", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags,
        customFields: Object.fromEntries(
          Object.entries(custom).filter(([k, v]) => k.trim() && v.trim()),
        ),
      };
      const result = lead
        ? await apiPatch<{ lead: Lead }>(`/api/leads/${lead.id}`, payload)
        : await apiPost<{ lead: Lead }>("/api/leads", payload);
      toast(lead ? "Lead updated" : "Lead created", "success");
      onSaved(result.lead);
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
      title={lead ? "Edit lead" : "New lead"}
      description={
        lead ? "Your score and tier are never changed automatically." : "Add a business manually."
      }
      size="xl"
      footer={
        <>
          <Button size="md" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" variant="primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : lead ? "Save changes" : "Create lead"}
          </Button>
        </>
      }
    >
      <div className="space-y-7">
        {FIELD_GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-3 text-[12px] font-semibold tracking-wide text-subtle uppercase">
              {group.title}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {group.fields.map((field) => (
                <div key={field.key} className={cn(field.wide && "sm:col-span-2")}>
                  <Label>{field.label}</Label>
                  <Input
                    value={form[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(e) => set(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}

        <section>
          <h3 className="mb-3 text-[12px] font-semibold tracking-wide text-subtle uppercase">
            Priority (you control this)
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <Label>Lead score</Label>
              <Input
                value={form.leadScore ?? ""}
                inputMode="numeric"
                placeholder="92"
                onChange={(e) => set("leadScore", e.target.value)}
              />
            </div>
            <div>
              <Label>Tier</Label>
              <select
                className="field"
                value={form.tier ?? ""}
                onChange={(e) => set("tier", e.target.value)}
              >
                <option value="">No tier</option>
                {[1, 2, 3, 4, 5].map((t) => (
                  <option key={t} value={t}>
                    Tier {t} — {TIER_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select
                className="field"
                value={form.status ?? "New"}
                onChange={(e) => set("status", e.target.value)}
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Potential value (ETB)</Label>
              <Input
                value={form.potentialValue ?? ""}
                inputMode="numeric"
                placeholder="35000"
                onChange={(e) => set("potentialValue", e.target.value)}
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-[12px] font-semibold tracking-wide text-subtle uppercase">
            Tags
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-lg bg-accent/10 px-2 py-1 text-[12px] text-accent"
              >
                {tag}
                <button
                  onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  className="opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              placeholder="Add tag + Enter"
              className="field h-8 w-40 py-0 text-[13px]"
            />
          </div>
          {tagPresets.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tagPresets
                .filter((t) => !tags.includes(t))
                .map((preset) => (
                  <button
                    key={preset}
                    onClick={() => addTag(preset)}
                    className="rounded-lg border border-dashed border-line px-2 py-0.5 text-[11.5px] text-subtle hover:border-accent/50 hover:text-accent"
                  >
                    + {preset}
                  </button>
                ))}
            </div>
          ) : null}
        </section>

        <section>
          <h3 className="mb-3 text-[12px] font-semibold tracking-wide text-subtle uppercase">
            Notes
          </h3>
          <textarea
            className="field min-h-[90px] resize-y"
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Anything worth remembering…"
          />
        </section>

        <section>
          <h3 className="mb-3 text-[12px] font-semibold tracking-wide text-subtle uppercase">
            Custom fields
          </h3>
          <div className="space-y-2">
            {Object.entries(custom).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-40 shrink-0 truncate text-[13px] text-muted">{key}</span>
                <Input
                  value={value}
                  onChange={(e) => setCustom((prev) => ({ ...prev, [key]: e.target.value }))}
                />
                <button
                  onClick={() =>
                    setCustom((prev) => {
                      const next = { ...prev };
                      delete next[key];
                      return next;
                    })
                  }
                  className="rounded-lg px-2 py-1 text-subtle hover:text-rose-500"
                  title="Remove field"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                value={newFieldKey}
                onChange={(e) => setNewFieldKey(e.target.value)}
                placeholder="New field name"
                className="w-52"
              />
              <Button
                onClick={() => {
                  const key = newFieldKey.trim();
                  if (!key) return;
                  setCustom((prev) => ({ ...prev, [key]: "" }));
                  setNewFieldKey("");
                }}
              >
                Add field
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}

/* ----------------------------- Follow-up modal --------------------------- */

export function FollowUpModal({
  open,
  onClose,
  leadId,
  leadName,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  leadId: number | null;
  leadName?: string;
  onCreated?: () => void;
}) {
  const { toast } = useToast();
  const [date, setDate] = useState(addDaysISO(1));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(addDaysISO(1));
      setNote("");
    }
  }, [open]);

  const presets = useMemo(
    () => [
      { label: "Today", value: todayISO() },
      { label: "Tomorrow", value: addDaysISO(1) },
      { label: "In 3 days", value: addDaysISO(3) },
      { label: "In 1 week", value: addDaysISO(7) },
      { label: "In 2 weeks", value: addDaysISO(14) },
    ],
    [],
  );

  const submit = async () => {
    if (!leadId) return;
    setSaving(true);
    try {
      await apiPost("/api/followups", { leadId, dueDate: date, note });
      toast("Follow-up scheduled", "success");
      onCreated?.();
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
      title="Schedule follow-up"
      description={leadName}
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
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => setDate(p.value)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-[12.5px] transition-colors",
                date === p.value
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-line text-muted hover:border-line-strong hover:text-ink",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Note</Label>
          <textarea
            className="field min-h-[70px] resize-y"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Owner said to call again Friday…"
          />
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------- Activity modal ---------------------------- */

export function ActivityModal({
  open,
  onClose,
  leadId,
  leadName,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  leadId: number | null;
  leadName?: string;
  onCreated?: () => void;
}) {
  const { toast } = useToast();
  const [type, setType] = useState<string>("call");
  const [summary, setSummary] = useState("");
  const [detail, setDetail] = useState("");
  const [when, setWhen] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setType("call");
      setSummary("");
      setDetail("");
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setWhen(now.toISOString().slice(0, 16));
    }
  }, [open]);

  const submit = async () => {
    if (!leadId) return;
    const finalSummary = summary.trim() || defaultSummary(type);
    setSaving(true);
    try {
      await apiPost("/api/activities", {
        leadId,
        type,
        summary: finalSummary,
        detail,
        occurredAt: when ? new Date(when).toISOString() : undefined,
      });
      toast("Activity logged", "success");
      onCreated?.();
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
      title="Log activity"
      description={leadName}
      size="sm"
      footer={
        <>
          <Button size="md" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" variant="primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Log activity"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {ACTIVITY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-[12.5px] capitalize transition-colors",
                type === t
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-line text-muted hover:border-line-strong hover:text-ink",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div>
          <Label>Summary</Label>
          <Input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={defaultSummary(type)}
          />
        </div>
        <div>
          <Label>Details (optional)</Label>
          <textarea
            className="field min-h-[70px] resize-y"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
        </div>
        <div>
          <Label>When</Label>
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function defaultSummary(type: string) {
  switch (type) {
    case "call":
      return "Called — no answer";
    case "whatsapp":
      return "WhatsApp message sent";
    case "email":
      return "Email sent";
    case "meeting":
      return "Meeting held";
    case "message":
      return "Message sent";
    default:
      return "Note";
  }
}
