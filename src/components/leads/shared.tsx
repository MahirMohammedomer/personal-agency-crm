"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { LEAD_STATUSES, STATUS_STYLES, TIER_LABELS, TIER_STYLES, type LeadStatus } from "@/lib/types";
import type { Lead } from "@/lib/types";
import {
  avatarGradient,
  buildLeadInfoText,
  cn,
  copyText,
  ensureUrl,
  initials,
  mapsHref,
  socialUrl,
  telegramHref,
  telHref,
  whatsappHref,
} from "@/lib/utils";

export function LeadAvatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white",
        avatarGradient(name),
      )}
      style={{ width: size, height: size, fontSize: size * 0.34, fontWeight: 600 }}
    >
      {initials(name) || "?"}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status as LeadStatus] ?? STATUS_STYLES.New;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium",
        style.chip,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {status}
    </span>
  );
}

export function StatusSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (status: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={cn("field h-8 py-0 text-[12.5px]", className)}
    >
      {LEAD_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function TierBadge({ tier, showLabel }: { tier: number | null; showLabel?: boolean }) {
  if (!tier) {
    return (
      <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-subtle ring-1 ring-line">
        No tier
      </span>
    );
  }
  return (
    <span
      title={TIER_LABELS[tier]}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
        TIER_STYLES[tier] ?? TIER_STYLES[5],
      )}
    >
      {tier === 1 ? "🔥" : ""} Tier {tier}
      {showLabel ? <span className="font-normal opacity-70">· {TIER_LABELS[tier]}</span> : null}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="text-[12px] text-subtle">No score</span>;
  }
  const tone =
    score >= 85
      ? "text-emerald-600 dark:text-emerald-300 bg-emerald-500/10"
      : score >= 65
        ? "text-amber-600 dark:text-amber-300 bg-amber-500/10"
        : "text-muted bg-surface-muted";
  return (
    <span className={cn("rounded-lg px-2 py-0.5 text-[12px] font-semibold tabular-nums", tone)}>
      {score}
    </span>
  );
}

export function RatingLine({
  rating,
  reviews,
  className,
}: {
  rating: number | null;
  reviews: number | null;
  className?: string;
}) {
  if (rating === null && reviews === null) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12.5px] text-muted", className)}>
      <span className="text-amber-500">★</span>
      {rating !== null ? rating.toFixed(1) : "—"}
      {reviews !== null ? (
        <span className="text-subtle">· {reviews.toLocaleString()} reviews</span>
      ) : null}
    </span>
  );
}

export function WebsiteFlag({ website }: { website: string | null }) {
  const url = ensureUrl(website);
  return url ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-600 dark:text-sky-300">
      🌐 Has website
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-300">
      ❌ No website
    </span>
  );
}

const actionClass =
  "inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-2.5 text-[12.5px] font-medium text-ink transition-all hover:border-line-strong hover:bg-surface-muted active:scale-[0.97]";

export function QuickActions({
  lead,
  onLogActivity,
  compact,
  copyExtras,
}: {
  lead: Lead;
  onLogActivity?: (type: string, summary: string) => void;
  compact?: boolean;
  copyExtras?: Parameters<typeof buildLeadInfoText>[1];
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const tel = telHref(lead.phone);
  const wa = whatsappHref(lead.phone);
  // Prefer saved Telegram username/link; fall back to phone deep-link (like WhatsApp)
  const tgUsername = socialUrl("telegram", lead.telegram);
  const tgPhone = telegramHref(lead.phone);
  const tg = tgUsername ?? tgPhone;
  const maps = mapsHref(lead);
  const site = ensureUrl(lead.website);
  const socials = (
    [
      ["Instagram", "📸", socialUrl("instagram", lead.instagram)],
      ["Facebook", "📘", socialUrl("facebook", lead.facebook)],
      ["TikTok", "🎵", socialUrl("tiktok", lead.tiktok)],
      ["LinkedIn", "💼", socialUrl("linkedin", lead.linkedin)],
    ] as const
  ).filter((s) => Boolean(s[2]));

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const ok = await copyText(buildLeadInfoText(lead, copyExtras));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast("All info copied to clipboard", "success");
    } else {
      toast("Could not access clipboard", "error");
    }
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button onClick={handleCopy} className={actionClass} title="Copy all info to clipboard">
        {copied ? "✓ Copied" : "📋 Copy All"}
      </button>

      {tel ? (
        <a
          href={tel}
          onClick={(e) => {
            stop(e);
            onLogActivity?.("call", `Called ${lead.businessName}`);
          }}
          className={actionClass}
          title={lead.phone ?? "Call"}
        >
          📞 {compact ? "" : "Call"}
        </a>
      ) : null}

      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => {
            stop(e);
            onLogActivity?.("whatsapp", `WhatsApp opened for ${lead.businessName}`);
          }}
          className={actionClass}
          title="Open WhatsApp"
        >
          💬 {compact ? "" : "WhatsApp"}
        </a>
      ) : null}

      {tg ? (
        <a
          href={tg}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => {
            stop(e);
            onLogActivity?.("message", `Telegram opened for ${lead.businessName}`);
          }}
          className={actionClass}
          title={tgUsername ? "Open Telegram (username)" : "Open Telegram (by phone)"}
        >
          ✈️ {compact ? "" : "Telegram"}
        </a>
      ) : null}

      {maps ? (
        <a
          href={maps}
          target="_blank"
          rel="noreferrer noopener"
          onClick={stop}
          className={actionClass}
          title="Open in Google Maps"
        >
          📍 {compact ? "" : "Maps"}
        </a>
      ) : null}

      {site ? (
        <a
          href={site}
          target="_blank"
          rel="noreferrer noopener"
          onClick={stop}
          className={actionClass}
          title={site}
        >
          🌐 {compact ? "" : "Website"}
        </a>
      ) : null}

      {socials.map(([label, icon, url]) => (
        <a
          key={label}
          href={url as string}
          target="_blank"
          rel="noreferrer noopener"
          onClick={stop}
          className={actionClass}
          title={label}
        >
          {icon} {compact ? "" : label}
        </a>
      ))}

      {lead.email ? (
        <a
          href={`mailto:${lead.email}`}
          onClick={(e) => {
            stop(e);
            onLogActivity?.("email", `Emailed ${lead.businessName}`);
          }}
          className={actionClass}
          title={lead.email}
        >
          ✉️ {compact ? "" : "Email"}
        </a>
      ) : null}
    </div>
  );
}
