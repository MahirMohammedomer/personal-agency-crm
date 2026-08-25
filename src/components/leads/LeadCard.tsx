"use client";

import Link from "next/link";
import { useState } from "react";
import type { Lead } from "@/lib/types";
import { cn, formatETB } from "@/lib/utils";
import {
  LeadAvatar,
  QuickActions,
  RatingLine,
  ScoreBadge,
  StatusPill,
  TierBadge,
  WebsiteFlag,
} from "./shared";

export function LeadCard({
  lead,
  selected,
  onToggleSelect,
  onQuickEdit,
  onFollowUp,
  onLogActivity,
}: {
  lead: Lead;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
  onQuickEdit?: (lead: Lead, patch: Partial<Lead>) => void;
  onFollowUp?: (lead: Lead) => void;
  onLogActivity?: (leadId: number, type: string, summary: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [score, setScore] = useState(lead.leadScore?.toString() ?? "");
  const [tier, setTier] = useState(lead.tier?.toString() ?? "");

  const commit = () => {
    const parsedScore = score.trim() === "" ? null : Number(score);
    const parsedTier = tier.trim() === "" ? null : Number(tier);
    onQuickEdit?.(lead, {
      leadScore: Number.isFinite(parsedScore as number) ? (parsedScore as number) : null,
      tier: Number.isFinite(parsedTier as number) ? (parsedTier as number) : null,
    });
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "card card-hover group relative flex flex-col gap-3.5 p-4",
        selected && "ring-2 ring-accent/45",
      )}
    >
      <div className="flex items-start gap-3">
        {onToggleSelect ? (
          <input
            type="checkbox"
            checked={Boolean(selected)}
            onChange={() => onToggleSelect(lead.id)}
            className="mt-1.5 h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
            aria-label={`Select ${lead.businessName}`}
          />
        ) : (
          <LeadAvatar name={lead.businessName} />
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/leads/${lead.id}`}
            className="block truncate text-[15px] leading-tight font-semibold tracking-[-0.01em] hover:text-accent"
          >
            {lead.businessName}
          </Link>
          <div className="mt-1 truncate text-[12.5px] text-muted">
            {[lead.category, lead.city].filter(Boolean).join(" · ") || "No category"}
          </div>
          <RatingLine rating={lead.rating} reviews={lead.reviewCount} className="mt-1.5" />
        </div>
        <StatusPill status={lead.status} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TierBadge tier={lead.tier} />
        <span className="inline-flex items-center gap-1 text-[12px] text-subtle">
          Score <ScoreBadge score={lead.leadScore} />
        </span>
        <WebsiteFlag website={lead.website} />
        {lead.potentialValue ? (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
            {formatETB(lead.potentialValue, true)}
          </span>
        ) : null}
        <button
          onClick={() => setEditing((v) => !v)}
          className="ml-auto text-[11.5px] text-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:text-accent"
          title="Quick edit score & tier"
        >
          ✎ score/tier
        </button>
      </div>

      {editing ? (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-muted/60 p-2">
          <label className="text-[11px] text-subtle">Score</label>
          <input
            value={score}
            onChange={(e) => setScore(e.target.value)}
            inputMode="numeric"
            className="field h-8 w-16 py-0 text-[13px]"
            placeholder="—"
          />
          <label className="text-[11px] text-subtle">Tier</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="field h-8 w-24 py-0 text-[13px]"
          >
            <option value="">None</option>
            {[1, 2, 3, 4, 5].map((t) => (
              <option key={t} value={t}>
                Tier {t}
              </option>
            ))}
          </select>
          <button
            onClick={commit}
            className="ml-auto h-8 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-white"
          >
            Save
          </button>
        </div>
      ) : null}

      {lead.tags?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {lead.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted"
            >
              {tag}
            </span>
          ))}
          {lead.tags.length > 5 ? (
            <span className="text-[11px] text-subtle">+{lead.tags.length - 5}</span>
          ) : null}
        </div>
      ) : null}

      <div className="border-t border-line pt-3">
        <QuickActions
          lead={lead}
          onLogActivity={(type, summary) => onLogActivity?.(lead.id, type, summary)}
        />
      </div>

      {onFollowUp ? (
        <button
          onClick={() => onFollowUp(lead)}
          className="absolute top-3 right-3 rounded-lg px-1.5 py-1 text-[12px] text-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-muted hover:text-accent"
          title="Schedule follow-up"
        >
          ◷
        </button>
      ) : null}
    </div>
  );
}
