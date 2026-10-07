"use client";

import { memo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/ui";
import { QuickActions } from "@/components/common/QuickActions";
import { ScoreChip, StatusSelect, TierBadge, ValueEstimate, WebsiteCell } from "./controls";
import { cn, dueLabel, telHref, timeAgo } from "@/lib/utils";
import type { Lead } from "@/lib/types";

const ROW_H = 58;

/** 8 columns — enough info without breaking the row. */
const COLS =
  "grid-cols-[36px_minmax(160px,1.6fr)_112px_96px_118px_64px_90px_minmax(104px,auto)]";

type SortKey = string;

function sortFor(column: "business" | "status" | "score" | "rating" | "created" | "updated", current: SortKey) {
  switch (column) {
    case "business":
      return current === "name_asc" ? "name_desc" : "name_asc";
    case "score":
      return current === "score_desc" ? "score_asc" : "score_desc";
    case "rating":
      return "rating_desc";
    case "status":
      return "tier_asc";
    case "created":
      return "created_desc";
    case "updated":
      return "updated_desc";
  }
}

function SortHeader({
  label,
  column,
  sort,
  onSortChange,
  className,
}: {
  label: string;
  column: "business" | "status" | "score" | "rating" | "created" | "updated";
  sort: SortKey;
  onSortChange: (value: string) => void;
  className?: string;
}) {
  const activeKey = sortFor(column, sort);
  const active = sort === activeKey || sort === sortFor(column, activeKey);
  const Icon = !active ? ChevronsUpDown : sort === sortFor(column, sortFor(column, sort)) ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSortChange(sortFor(column, sort))}
      className={cn(
        "flex items-center gap-1 text-left text-[10px] font-semibold uppercase tracking-wider transition hover:text-ink",
        active ? "text-ink" : "text-subtle",
        className,
      )}
      title={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      <Icon className={cn("h-3 w-3 shrink-0", active ? "opacity-90" : "opacity-40")} />
    </button>
  );
}

export function LeadTable({
  leads,
  selected,
  sort,
  onSortChange,
  onToggle,
  onToggleAll,
  onQuickEdit,
  onOpen,
}: {
  leads: Lead[];
  selected: Set<number>;
  sort: SortKey;
  onSortChange: (value: string) => void;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onQuickEdit?: (lead: Lead, patch: Partial<Lead>) => Promise<void> | void;
  onOpen?: (id: number) => void;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
    getItemKey: (index) => leads[index]?.id ?? index,
  });
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const someSelected = selected.size > 0 && !allSelected;

  const open = (id: number) => (onOpen ? onOpen(id) : router.push(`/leads/${id}`));

  const patch = (lead: Lead, value: Partial<Lead>) => {
    void onQuickEdit?.(lead, value);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div ref={scrollRef} className="max-h-[max(300px,calc(100dvh-300px))] min-h-[220px] overflow-auto overscroll-contain">
        <div className="min-w-[860px]">
          <div
            className={cn(
              "sticky top-0 z-10 grid items-center gap-2 border-b border-line bg-surface-muted px-3 py-2.5",
              COLS,
            )}
          >
            <Checkbox checked={allSelected} className={someSelected ? "opacity-60" : ""} onChange={onToggleAll} />
            <SortHeader label="Business" column="business" sort={sort} onSortChange={onSortChange} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Status</span>
            <SortHeader label="Score" column="score" sort={sort} onSortChange={onSortChange} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Phone</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Web</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Last</span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-wider text-subtle">Actions</span>
          </div>

          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="text-[15px] font-medium text-ink">No leads match</div>
              <p className="mt-1 text-[13px] text-muted">Adjust filters or import a new batch.</p>
            </div>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((row) => {
                const lead = leads[row.index];
                if (!lead) return null;
                return (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    selected={selected.has(lead.id)}
                    onToggle={onToggle}
                    onOpen={open}
                    onPatch={patch}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: ROW_H,
                      transform: `translateY(${row.start}px)`,
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const LeadRow = memo(function LeadRow({
  lead,
  selected,
  onToggle,
  onOpen,
  onPatch,
  style,
}: {
  lead: Lead;
  selected: boolean;
  onToggle: (id: number) => void;
  onOpen: (id: number) => void;
  onPatch: (lead: Lead, patch: Partial<Lead>) => void;
  style: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      onClick={() => onOpen(lead.id)}
      className={cn(
        "grid cursor-pointer items-center gap-2 border-b border-line/70 px-3 transition hover:bg-surface-muted/70",
        COLS,
        selected && "bg-surface-muted",
      )}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onChange={() => onToggle(lead.id)} />
      </div>

      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-ink">{lead.businessName || "(unnamed)"}</div>
        <div className="truncate text-[10.5px] text-muted">
          {lead.category || "—"}
          {lead.city ? ` · ${lead.city}` : ""}
        </div>
      </div>

      <div onClick={(e) => e.stopPropagation()} className="min-w-0">
        <StatusSelect lead={lead} compact onSaved={() => undefined} />
      </div>

      <div className="flex min-w-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <ScoreChip lead={lead} />
        <TierBadge lead={lead} size="xs" />
      </div>

      <div className="truncate text-[12px]" onClick={(e) => e.stopPropagation()}>
        {lead.phone ? (
          <a href={telHref(lead.phone) ?? undefined} className="text-muted hover:underline">
            {lead.phone}
          </a>
        ) : (
          <span className="text-subtle">—</span>
        )}
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <WebsiteCell lead={lead} />
      </div>

      <div className="truncate text-[11px]">
        {lead.lastContactedAt ? (
          <span className="text-muted" title="Last contact">
            {timeAgo(lead.lastContactedAt)}
          </span>
        ) : (
          <span className="text-subtle">—</span>
        )}
      </div>

      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <QuickActions lead={lead} size="sm" show={["message", "research", "copy"]} onChange={onPatch} />
      </div>
    </div>
  );
});
