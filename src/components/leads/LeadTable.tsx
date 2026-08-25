"use client";

import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import type { Lead } from "@/lib/types";
import {
  buildLeadInfoText,
  cn,
  copyText,
  ensureUrl,
  hasSocial,
  mapsHref,
  socialUrl,
  telegramHref,
  telHref,
  whatsappHref,
  formatETB,
} from "@/lib/utils";
import { ScoreBadge, StatusPill, TierBadge } from "./shared";

const HEAD = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-subtle";
const CELL = "px-3 py-2.5 align-middle";

export function LeadTable({
  leads,
  selected,
  onToggle,
  onToggleAll,
  onQuickEdit,
  sort,
  onSortChange,
}: {
  leads: Lead[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onQuickEdit: (lead: Lead, patch: Partial<Lead>) => void;
  sort: string;
  onSortChange: (sort: string) => void;
}) {
  const { toast } = useToast();
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));

  const sortButton = (label: string, key: string) => (
    <button
      onClick={() => onSortChange(key)}
      className={cn(
        "transition-colors hover:text-ink",
        sort === key ? "text-accent" : "text-subtle",
      )}
    >
      {label}
      {sort === key ? " ↓" : ""}
    </button>
  );

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-surface-muted/60">
            <tr className="border-b border-line">
              <th className={cn(HEAD, "w-9")}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="h-4 w-4 accent-[rgb(var(--accent))]"
                  aria-label="Select all"
                />
              </th>
              <th className={HEAD}>{sortButton("Business", "name_asc")}</th>
              <th className={HEAD}>Niche</th>
              <th className={HEAD}>Location</th>
              <th className={cn(HEAD, "text-right")}>{sortButton("Rating", "rating_desc")}</th>
              <th className={cn(HEAD, "text-right")}>{sortButton("Reviews", "reviews_desc")}</th>
              <th className={HEAD}>Website</th>
              <th className={cn(HEAD, "text-right")}>{sortButton("Score", "score_desc")}</th>
              <th className={HEAD}>{sortButton("Tier", "tier_asc")}</th>
              <th className={HEAD}>Phone</th>
              <th className={HEAD}>Social</th>
              <th className={HEAD}>Status</th>
              <th className={cn(HEAD, "text-right")}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <Row
                key={lead.id}
                lead={lead}
                selected={selected.has(lead.id)}
                onToggle={onToggle}
                onQuickEdit={onQuickEdit}
                onCopy={async () => {
                  const ok = await copyText(buildLeadInfoText(lead));
                  toast(ok ? "All info copied" : "Clipboard blocked", ok ? "success" : "error");
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  lead,
  selected,
  onToggle,
  onQuickEdit,
  onCopy,
}: {
  lead: Lead;
  selected: boolean;
  onToggle: (id: number) => void;
  onQuickEdit: (lead: Lead, patch: Partial<Lead>) => void;
  onCopy: () => void;
}) {
  const [scoreEdit, setScoreEdit] = useState(false);
  const [score, setScore] = useState(lead.leadScore?.toString() ?? "");
  const site = ensureUrl(lead.website);
  const tel = telHref(lead.phone);
  const wa = whatsappHref(lead.phone);
  const tg = socialUrl("telegram", lead.telegram) ?? telegramHref(lead.phone);
  const maps = mapsHref(lead);

  const iconBtn =
    "inline-flex h-7 w-7 items-center justify-center rounded-lg text-[13px] transition-colors hover:bg-surface-muted";

  return (
    <tr
      className={cn(
        "border-b border-line/70 transition-colors last:border-0 hover:bg-surface-muted/50",
        selected && "bg-accent/5",
      )}
    >
      <td className={CELL}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(lead.id)}
          className="h-4 w-4 accent-[rgb(var(--accent))]"
          aria-label={`Select ${lead.businessName}`}
        />
      </td>
      <td className={cn(CELL, "max-w-[220px]")}>
        <Link
          href={`/leads/${lead.id}`}
          className="block truncate font-medium hover:text-accent"
          title={lead.businessName}
        >
          {lead.businessName}
        </Link>
        {lead.potentialValue ? (
          <span className="text-[11px] text-subtle">{formatETB(lead.potentialValue, true)}</span>
        ) : null}
      </td>
      <td className={cn(CELL, "max-w-[140px] truncate text-muted")}>{lead.category ?? "—"}</td>
      <td className={cn(CELL, "max-w-[140px] truncate text-muted")}>{lead.city ?? "—"}</td>
      <td className={cn(CELL, "text-right tabular-nums")}>
        {lead.rating !== null ? (
          <span>
            <span className="text-amber-500">★</span> {lead.rating.toFixed(1)}
          </span>
        ) : (
          <span className="text-subtle">—</span>
        )}
      </td>
      <td className={cn(CELL, "text-right tabular-nums text-muted")}>
        {lead.reviewCount !== null ? lead.reviewCount.toLocaleString() : "—"}
      </td>
      <td className={CELL}>
        {site ? (
          <span className="text-[11.5px] text-sky-600 dark:text-sky-300">Has site</span>
        ) : (
          <span className="text-[11.5px] text-rose-500">None</span>
        )}
      </td>
      <td className={cn(CELL, "text-right")}>
        {scoreEdit ? (
          <input
            autoFocus
            value={score}
            onChange={(e) => setScore(e.target.value)}
            onBlur={() => {
              const parsed = score.trim() === "" ? null : Number(score);
              onQuickEdit(lead, {
                leadScore: Number.isFinite(parsed as number) ? (parsed as number) : null,
              });
              setScoreEdit(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setScoreEdit(false);
            }}
            className="field h-7 w-14 py-0 text-right text-[12.5px]"
          />
        ) : (
          <button onClick={() => setScoreEdit(true)} title="Click to edit score">
            <ScoreBadge score={lead.leadScore} />
          </button>
        )}
      </td>
      <td className={CELL}>
        <select
          value={lead.tier?.toString() ?? ""}
          onChange={(e) =>
            onQuickEdit(lead, { tier: e.target.value === "" ? null : Number(e.target.value) })
          }
          className="field h-7 w-[86px] py-0 text-[12px]"
          title="Set tier manually"
        >
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map((t) => (
            <option key={t} value={t}>
              Tier {t}
            </option>
          ))}
        </select>
      </td>
      <td className={cn(CELL, "whitespace-nowrap text-muted")}>{lead.phone ?? "—"}</td>
      <td className={CELL}>
        {hasSocial(lead) ? (
          <span className="text-[11.5px] text-emerald-600 dark:text-emerald-300">Yes</span>
        ) : (
          <span className="text-[11.5px] text-subtle">—</span>
        )}
      </td>
      <td className={CELL}>
        <StatusPill status={lead.status} />
      </td>
      <td className={cn(CELL, "text-right whitespace-nowrap")}>
        <button onClick={onCopy} className={iconBtn} title="Copy all info">
          📋
        </button>
        {tel ? (
          <a href={tel} className={iconBtn} title={`Call ${lead.phone}`}>
            📞
          </a>
        ) : null}
        {wa ? (
          <a href={wa} target="_blank" rel="noreferrer" className={iconBtn} title="WhatsApp">
            💬
          </a>
        ) : null}
        {tg ? (
          <a href={tg} target="_blank" rel="noreferrer" className={iconBtn} title="Telegram">
            ✈️
          </a>
        ) : null}
        {maps ? (
          <a href={maps} target="_blank" rel="noreferrer" className={iconBtn} title="Google Maps">
            📍
          </a>
        ) : null}
        {site ? (
          <a href={site} target="_blank" rel="noreferrer" className={iconBtn} title={site}>
            🌐
          </a>
        ) : null}
        <Link href={`/leads/${lead.id}`} className={iconBtn} title="Open profile">
          →
        </Link>
      </td>
    </tr>
  );
}

export function TierQuickBadge({ tier }: { tier: number | null }) {
  return <TierBadge tier={tier} />;
}
