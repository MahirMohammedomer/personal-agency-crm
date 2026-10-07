"use client";

import { useRouter } from "next/navigation";
import { CalendarPlus, Clock3, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Checkbox } from "@/components/ui/ui";
import { ScoreChip, StatusSelect, TierBadge, ValueEstimate, WebsiteCell } from "./controls";
import { cn, mapsHref, telHref, timeAgo, whatsappHref } from "@/lib/utils";
import type { Lead } from "@/lib/types";

/**
 * Touch-first lead card used on phones and small tablets.
 * Every action is a real ≥40px tap target — no hover-only affordances.
 */
export function LeadCard({
  lead,
  selected,
  onToggleSelect,
  onFollowUp,
  onOpen,
  onQuickEdit,
  onLogActivity,
}: {
  lead: Lead;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
  onFollowUp?: (lead: Lead) => void;
  onOpen?: () => void;
  onQuickEdit?: (lead: Lead, patch: Partial<Lead>) => Promise<void> | void;
  /** Optional audit trail — logs the touchpoint when you tap Call / WhatsApp. */
  onLogActivity?: (leadId: number, type: string, summary: string) => void;
}) {
  const router = useRouter();
  const open = () => (onOpen ? onOpen() : router.push(`/leads/${lead.id}`));
  const tel = telHref(lead.phone);
  const wa = whatsappHref(lead.phone);
  const maps = mapsHref(lead);

  const patch = (value: Partial<Lead>) => {
    void onQuickEdit?.(lead, value);
  };

  return (
    <div
      className={cn(
        "rounded-2xl border bg-surface shadow-sm transition active:scale-[0.995]",
        selected ? "border-accent/60 ring-1 ring-accent/30" : "border-line",
      )}
    >
      <div className="flex items-start gap-2.5 p-3.5 pb-2">
        {onToggleSelect && (
          <div className="pt-1" onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={Boolean(selected)} onChange={() => onToggleSelect(lead.id)} />
          </div>
        )}
        <button type="button" onClick={open} className="min-w-0 flex-1 text-left">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-ink">
            {lead.businessName || "(unnamed)"}
          </h3>
          <p className="mt-0.5 truncate text-[12px] text-muted">
            {lead.category || "Uncategorised"}
            {lead.city ? ` · ${lead.city}` : lead.address ? ` · ${lead.address}` : ""}
          </p>
        </button>
        <span className="shrink-0 text-right text-[11px] text-subtle">
          {lead.lastContactedAt ? timeAgo(lead.lastContactedAt) : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-3.5" onClick={(e) => e.stopPropagation()}>
        <StatusSelect lead={lead} />
        <TierBadge lead={lead} />
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted">
          Score <ScoreChip lead={lead} className="p-0" />
        </span>
        <ValueEstimate lead={lead} />
        <WebsiteCell lead={lead} />
      </div>

      {lead.tags?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 px-3.5">
          {lead.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[10.5px] font-medium text-muted"
            >
              {t}
            </span>
          ))}
          {lead.tags.length > 4 && <span className="text-[10.5px] text-subtle">+{lead.tags.length - 4}</span>}
        </div>
      )}

      {lead.phone && (
        <div className="mt-2 flex items-center gap-1.5 px-3.5 text-[11.5px] text-muted">
          <Clock3 className="h-3 w-3 shrink-0" />
          {lead.lastContactedAt ? `Last contact ${timeAgo(lead.lastContactedAt)}` : "Never contacted"}
        </div>
      )}

      {/* Touch action row — big, glove-friendly targets */}
      <div className="mt-2.5 flex items-stretch gap-1.5 border-t border-line px-2.5 py-2.5">
        {tel && (
          <a
            href={tel}
            onClick={() => onLogActivity?.(lead.id, "call", `Called ${lead.businessName}`)}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent/10 text-[13.5px] font-semibold text-accent active:bg-accent/20"
          >
            <Phone className="h-4 w-4" /> Call
          </a>
        )}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() => onLogActivity?.(lead.id, "whatsapp", `WhatsApp opened for ${lead.businessName}`)}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 text-[13.5px] font-semibold text-emerald-600 active:bg-emerald-500/20 dark:text-emerald-400"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        )}
        {lead.email && (
          <a
            href={`mailto:${lead.email}`}
            className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-muted"
            title={`Email ${lead.email}`}
          >
            <Mail className="h-4 w-4" />
          </a>
        )}
        {maps && (
          <a
            href={maps}
            target="_blank"
            rel="noreferrer noopener"
            className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-muted"
            title="Open in Maps"
          >
            <MapPin className="h-4 w-4" />
          </a>
        )}
        {onFollowUp && (
          <button
            type="button"
            onClick={() => onFollowUp(lead)}
            className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-muted"
            title="Schedule follow-up"
          >
            <CalendarPlus className="h-4 w-4" />
          </button>
        )}
      </div>

      {lead.archived && onQuickEdit && (
        <button
          type="button"
          onClick={() => patch({ archived: false })}
          className="w-full rounded-b-2xl bg-surface-muted py-2 text-[12px] font-medium text-muted"
        >
          Archived · tap to restore
        </button>
      )}
    </div>
  );
}
