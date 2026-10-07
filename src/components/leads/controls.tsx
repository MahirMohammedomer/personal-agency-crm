"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge, Dropdown, MenuItem, MenuLabel } from "@/components/ui/ui";
import { useToast } from "@/components/ui/toast";
import { apiPatch } from "@/lib/api";
import { cn, googleImagesUrl, googleSearchUrl } from "@/lib/utils";
import { LEAD_STATUSES, TIER_LABELS, TIER_STYLES, STATUS_STYLES, type Lead, type LeadStatus } from "@/lib/types";

/** Persist a single-field edit from anywhere in the list UI. */
function useLeadPatch(lead: Lead, onSaved?: (patch: Partial<Lead>) => void) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  return {
    saving,
    save: async (patch: Partial<Lead>, message = "Saved") => {
      setSaving(true);
      try {
        const result = await apiPatch<{ lead: Lead }>(`/api/leads/${lead.id}`, patch);
        onSaved?.(result?.lead ?? patch);
        toast(message, "success");
      } catch (error) {
        toast((error as Error).message || "Could not save", "error");
      } finally {
        setSaving(false);
      }
    },
  };
}

export function TierBadge({
  lead,
  size = "sm",
  editable = true,
  onSaved,
}: {
  lead: Lead;
  size?: "xs" | "sm";
  editable?: boolean;
  onSaved?: (tier: number | null) => void;
}) {
  const { save } = useLeadPatch(lead, (patch) => onSaved?.(patch.tier ?? null));
  const tier = lead.tier ?? 3;
  const badge = (
    <Badge
      className={cn(
        "gap-1 font-semibold",
        TIER_STYLES[tier] ?? TIER_STYLES[5],
        size === "xs" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tier === 1 ? "bg-rose-500" : "bg-current opacity-70")} />
      T{tier}
    </Badge>
  );

  if (!editable) return badge;

  return (
    <Dropdown
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className="rounded-full transition hover:opacity-80"
          title="Change tier (manual only)"
        >
          {badge}
        </button>
      )}
      panelClassName="w-52"
    >
      {({ close }) => (
        <>
          <MenuLabel>Lead tier</MenuLabel>
          {([1, 2, 3, 4, 5] as const).map((t) => (
            <MenuItem
              key={t}
              className={lead.tier === t ? "bg-surface-muted" : ""}
              onClick={() => {
                void save({ tier: t }, `Tier ${t} set`);
                close();
              }}
            >
              {TIER_LABELS[t]}
            </MenuItem>
          ))}
          <MenuItem
            onClick={() => {
              void save({ tier: null }, "Tier cleared");
              close();
            }}
          >
            No tier
          </MenuItem>
        </>
      )}
    </Dropdown>
  );
}

export function ScoreChip({
  lead,
  editable = true,
  className,
  onSaved,
}: {
  lead: Lead;
  editable?: boolean;
  className?: string;
  onSaved?: (score: number) => void;
}) {
  const { save } = useLeadPatch(lead, (patch) => {
    if (typeof patch.leadScore === "number") onSaved?.(patch.leadScore);
  });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(lead.leadScore ?? 0));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setValue(String(lead.leadScore ?? 0)), [lead.leadScore]);
  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const n = Math.max(0, Math.min(100, Number(value) || 0));
    if (n === (lead.leadScore ?? 0)) {
      setValue(String(lead.leadScore ?? 0));
      return;
    }
    void save({ leadScore: n });
  };

  if (!editable) {
    return (
      <span className={cn("text-[12px] font-semibold tabular-nums text-muted", className)}>
        {lead.leadScore ?? 0}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        value={value}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setEditing(false);
            setValue(String(lead.leadScore ?? 0));
          }
        }}
        className={cn(
          "w-14 rounded-md border border-line-strong bg-surface px-1.5 py-1 text-center text-[13px] font-semibold tabular-nums text-ink outline-none",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title="Edit lead score (manual only)"
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-muted transition hover:bg-surface-muted",
        className,
      )}
    >
      {lead.leadScore ?? 0}
    </button>
  );
}

/** Deal estimate (ETB) on the lead — no project required */
export function ValueEstimate({
  lead,
  className,
  onSaved,
}: {
  lead: Lead;
  className?: string;
  onSaved?: (value: number | null) => void;
}) {
  const { save } = useLeadPatch(lead, (patch) => onSaved?.(patch.potentialValue ?? null));
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(lead.potentialValue ?? ""));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(lead.potentialValue != null ? String(lead.potentialValue) : "");
  }, [lead.potentialValue]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const raw = value.trim();
    const n = raw === "" ? null : Number(raw);
    if (n !== null && (Number.isNaN(n) || n < 0)) {
      setValue(lead.potentialValue != null ? String(lead.potentialValue) : "");
      return;
    }
    if (n === (lead.potentialValue ?? null)) return;
    void save({ potentialValue: n });
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        inputMode="numeric"
        min={0}
        step={1000}
        value={value}
        placeholder="ETB"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setEditing(false);
            setValue(lead.potentialValue != null ? String(lead.potentialValue) : "");
          }
        }}
        className={cn(
          "w-[92px] rounded-md border border-line-strong bg-surface px-1.5 py-1 text-[12.5px] font-semibold tabular-nums text-ink outline-none",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title="Set deal estimate (no project needed)"
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-400",
        className,
      )}
    >
      {lead.potentialValue != null && lead.potentialValue > 0
        ? `ETB ${Number(lead.potentialValue).toLocaleString()}`
        : "Set value"}
    </button>
  );
}

export function StatusSelect({
  lead,
  compact = false,
  className,
  onSaved,
}: {
  lead: Lead;
  compact?: boolean;
  className?: string;
  onSaved?: (status: LeadStatus) => void;
}) {
  const { save } = useLeadPatch(lead, (patch) => {
    if (patch.status) onSaved?.(patch.status as LeadStatus);
  });
  const status = (lead.status as LeadStatus) ?? "New";
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.New;

  return (
    <Dropdown
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition hover:opacity-80",
            style.chip,
            className,
          )}
          title="Change status"
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
          {status}
          {!compact && <ChevronDown className="h-3 w-3 opacity-60" />}
        </button>
      )}
      panelClassName="w-48"
    >
      {({ close }) => (
        <>
          <MenuLabel>Status</MenuLabel>
          {LEAD_STATUSES.map((s) => (
            <MenuItem
              key={s}
              className={status === s ? "bg-surface-muted" : ""}
              onClick={() => {
                void save({ status: s });
                close();
              }}
            >
              {s}
            </MenuItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}

export function WebsiteCell({ lead }: { lead: Lead }) {
  const raw = lead.website?.trim();
  const has = Boolean(raw) && !/^(n\/?a|none|no|-|null)$/i.test(raw as string);
  if (has) {
    const url = /^https?:\/\//i.test(raw as string) ? (raw as string) : `https://${raw}`;
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        onClick={(e) => e.stopPropagation()}
        className="text-[12px] text-emerald-600 hover:underline dark:text-emerald-400"
        title={url}
      >
        ✅ Yes
      </a>
    );
  }
  return (
    <span className="text-[12px] text-rose-500/90 dark:text-rose-400" title="No website">
      ❌ No
    </span>
  );
}

/** Quick “research this business on Google” link used in tables/cards. */
export function ResearchLink({ lead, className }: { lead: Lead; className?: string }) {
  return (
    <Dropdown
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className={cn("rounded-md px-1.5 py-1 text-[12px] text-muted transition hover:bg-surface-muted", className)}
          title="Research"
        >
          🔎
        </button>
      )}
      panelClassName="w-52"
    >
      {({ close }) => (
        <>
          <MenuLabel>Research</MenuLabel>
          <MenuItem
            onClick={() => {
              window.open(googleSearchUrl(lead), "_blank", "noopener");
              close();
            }}
          >
            Google search
          </MenuItem>
          <MenuItem
            onClick={() => {
              window.open(googleImagesUrl(lead), "_blank", "noopener");
              close();
            }}
          >
            Google images
          </MenuItem>
        </>
      )}
    </Dropdown>
  );
}
