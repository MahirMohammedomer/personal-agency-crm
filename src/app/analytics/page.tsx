"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiGet } from "@/lib/api";
import { STAGE_STYLES, TIER_LABELS, type ProjectStage } from "@/lib/types";
import { cn, formatETB, formatNumber } from "@/lib/utils";

type Bucket = { key: string; value: number };
type NicheRow = {
  key: string;
  value: number;
  contacted: number;
  replied: number;
  meetings: number;
  won: number;
  wonValue: number;
};
type TierRow = {
  key: number | null;
  value: number;
  contacted: number;
  replied: number;
  meetings: number;
  won: number;
  lost: number;
  wonValue: number;
};

type Analytics = {
  byStatus: Bucket[];
  byTier: TierRow[];
  byCategory: NicheRow[];
  byCity: Array<{ key: string; value: number; won: number }>;
  monthly: Array<{ key: string; value: number; won: number }>;
  revenueMonthly: Array<{ key: string; value: number; paid: number }>;
  revenueByNiche: Array<{ key: string; value: number; paid: number; projects: number }>;
  activityMix: Bucket[];
  projectStages: Bucket[];
  totals: {
    total: number;
    withWebsite: number;
    withPhone: number;
    withSocial: number;
    contacted: number;
    replied: number;
    interested: number;
    meetings: number;
    proposals: number;
    won: number;
    lost: number;
    avgScore: number;
    pipelineValue: number;
    wonValue: number;
  };
  projectTotals: { projects: number; active: number; value: number; paid: number };
};

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Analytics>("/api/analytics")
      .then(setData)
      .catch((error) => toast((error as Error).message, "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!data || !data.totals?.total) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Numbers that help you decide where to prospect." />
        <EmptyState
          icon="◭"
          title="Nothing to analyse yet"
          description="Import leads and start contacting businesses — your funnel, niche performance and revenue will appear here."
          action={
            <Link href="/import" className="text-sm text-accent hover:underline">
              Import leads →
            </Link>
          }
        />
      </div>
    );
  }

  const t = data.totals;
  const pt = data.projectTotals;
  const outstanding = Math.max(pt.value - pt.paid, 0);
  const conversion = t.total ? (t.won / t.total) * 100 : 0;
  const replyRate = t.contacted ? (t.replied / t.contacted) * 100 : 0;

  const funnel = [
    { label: "Total leads", value: t.total },
    { label: "Contacted", value: t.contacted },
    { label: "Replied", value: t.replied },
    { label: "Interested", value: t.interested },
    { label: "Meeting", value: t.meetings },
    { label: "Proposal", value: t.proposals },
    { label: "Won", value: t.won },
  ];

  const headline = [
    { label: "Total leads", value: formatNumber(t.total) },
    { label: "Contacted", value: formatNumber(t.contacted) },
    { label: "Replies", value: formatNumber(t.replied) },
    { label: "Meetings", value: formatNumber(t.meetings) },
    { label: "Won clients", value: formatNumber(t.won), accent: "text-emerald-500" },
    { label: "Lost / no", value: formatNumber(t.lost), accent: "text-rose-500" },
    { label: "Active projects", value: formatNumber(pt.active) },
    {
      label: "Conversion",
      value: `${conversion.toFixed(1)}%`,
      accent: "text-accent",
    },
  ];

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Analytics"
        subtitle="Where your leads come from, what converts, and what you are owed."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {headline.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-[11.5px] text-subtle">{s.label}</div>
            <div className={cn("mt-1 text-[20px] font-semibold tabular-nums", s.accent)}>
              {s.value}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Funnel */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold">Conversion funnel</h2>
            <span className="text-[12px] text-subtle">
              Reply rate {replyRate.toFixed(1)}% · Lead → client {conversion.toFixed(1)}%
            </span>
          </div>
          <p className="mb-4 text-[12px] text-subtle">
            Percentages show share of all leads, and step-to-step drop-off.
          </p>
          <div className="space-y-2">
            {funnel.map((stage, i) => {
              const pctOfTotal = t.total ? (stage.value / t.total) * 100 : 0;
              const prev = i > 0 ? funnel[i - 1].value : stage.value;
              const stepPct = prev ? (stage.value / prev) * 100 : 0;
              return (
                <div key={stage.label} className="flex items-center gap-3">
                  <span className="w-[86px] shrink-0 text-[12px] text-muted">{stage.label}</span>
                  <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-surface-muted">
                    <div
                      className="h-full rounded-lg bg-gradient-to-r from-indigo-500/80 to-violet-500/80 transition-all duration-700"
                      style={{ width: `${Math.max(pctOfTotal, stage.value ? 3 : 0)}%` }}
                    />
                    <span className="absolute inset-y-0 left-2.5 flex items-center text-[11.5px] font-medium text-ink mix-blend-luminosity">
                      {formatNumber(stage.value)}
                    </span>
                  </div>
                  <span className="w-12 text-right text-[11.5px] tabular-nums text-muted">
                    {pctOfTotal.toFixed(1)}%
                  </span>
                  <span
                    className={cn(
                      "w-14 text-right text-[11px] tabular-nums",
                      i === 0
                        ? "text-transparent"
                        : stepPct >= 50
                          ? "text-emerald-500"
                          : stepPct >= 20
                            ? "text-amber-500"
                            : "text-rose-500",
                    )}
                    title="Conversion from the previous step"
                  >
                    {i === 0 ? "—" : `↳ ${stepPct.toFixed(0)}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Revenue */}
        <Card className="p-5">
          <h2 className="mb-4 text-[15px] font-semibold">Revenue</h2>
          <div className="space-y-3.5">
            <MoneyRow label="Open pipeline value" value={t.pipelineValue} />
            <MoneyRow label="Won lead value" value={t.wonValue} tone="emerald" />
            <MoneyRow label="Signed project value" value={pt.value} />
            <MoneyRow label="Paid / collected" value={pt.paid} tone="emerald" />
            <MoneyRow label="Outstanding" value={outstanding} tone="amber" />
            <div>
              <div className="mb-1 flex items-center justify-between text-[12px] text-muted">
                <span>Collection rate</span>
                <span>{pt.value ? Math.round((pt.paid / pt.value) * 100) : 0}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${pt.value ? (pt.paid / pt.value) * 100 : 0}%` }}
                />
              </div>
            </div>
            {outstanding > 0 ? (
              <Link
                href="/projects?filter=outstanding"
                className="block text-[12px] text-accent hover:underline"
              >
                Chase outstanding payments →
              </Link>
            ) : null}
          </div>
        </Card>

        {/* Niche performance */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-[15px] font-semibold">Niche performance</h2>
          <p className="mt-0.5 mb-4 text-[12px] text-subtle">
            Which niches actually turn into paying clients — prospect more where conversion is high.
          </p>
          {data.byCategory.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-subtle">No categories yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-line text-[11px] tracking-wide text-subtle uppercase">
                    <th className="py-2 text-left font-semibold">Niche</th>
                    <th className="py-2 text-right font-semibold">Leads</th>
                    <th className="py-2 text-right font-semibold">Contacted</th>
                    <th className="py-2 text-right font-semibold">Replied</th>
                    <th className="py-2 text-right font-semibold">Clients</th>
                    <th className="py-2 text-right font-semibold">Conv.</th>
                    <th className="py-2 pl-3 text-left font-semibold">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCategory.map((row) => {
                    const conv = row.value ? (row.won / row.value) * 100 : 0;
                    const best = Math.max(
                      ...data.byCategory.map((r) => (r.value ? (r.won / r.value) * 100 : 0)),
                      1,
                    );
                    return (
                      <tr key={row.key} className="border-b border-line/60 last:border-0">
                        <td className="max-w-[160px] truncate py-2 font-medium" title={row.key}>
                          <Link
                            href={`/leads?category=${encodeURIComponent(row.key)}`}
                            className="hover:text-accent"
                          >
                            {row.key}
                          </Link>
                        </td>
                        <td className="py-2 text-right tabular-nums">{row.value}</td>
                        <td className="py-2 text-right tabular-nums text-muted">{row.contacted}</td>
                        <td className="py-2 text-right tabular-nums text-muted">{row.replied}</td>
                        <td className="py-2 text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-300">
                          {row.won}
                        </td>
                        <td className="py-2 text-right tabular-nums">{conv.toFixed(1)}%</td>
                        <td className="w-[110px] py-2 pl-3">
                          <div className="h-1.5 overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                              style={{ width: `${(conv / best) * 100}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Tier performance */}
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Tier performance</h2>
          <p className="mt-0.5 mb-4 text-[12px] text-subtle">
            Is your manual scoring working? Tier 1 should convert best.
          </p>
          <div className="space-y-3">
            {data.byTier.map((row) => {
              const conv = row.value ? (row.won / row.value) * 100 : 0;
              const label = row.key ? `Tier ${row.key}` : "No tier";
              return (
                <div key={String(row.key)} className="rounded-xl border border-line p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{label}</span>
                    {row.key ? (
                      <span className="text-[11px] text-subtle">{TIER_LABELS[row.key]}</span>
                    ) : null}
                    <span className="ml-auto text-[12px] font-semibold tabular-nums">
                      {conv.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-accent/75 transition-all duration-700"
                      style={{ width: `${Math.min(conv, 100)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11.5px] text-subtle">
                    <span>{row.value} leads</span>
                    <span>{row.contacted} contacted</span>
                    <span>{row.meetings} meetings</span>
                    <span className="text-emerald-600 dark:text-emerald-300">
                      {row.won} clients
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Status split */}
        <Card className="p-5">
          <h2 className="mb-4 text-[15px] font-semibold">Leads by status</h2>
          <div className="space-y-2">
            {[...data.byStatus]
              .sort((a, b) => b.value - a.value)
              .map((row) => {
                const max = Math.max(...data.byStatus.map((r) => r.value), 1);
                return (
                  <div key={row.key} className="flex items-center gap-3 text-[12.5px]">
                    <Link
                      href={`/leads?status=${encodeURIComponent(row.key)}`}
                      className="w-24 shrink-0 truncate hover:text-accent"
                    >
                      {row.key}
                    </Link>
                    <div className="h-4 flex-1 overflow-hidden rounded-md bg-surface-muted">
                      <div
                        className="h-full rounded-md bg-accent/60 transition-all duration-700"
                        style={{ width: `${(row.value / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right tabular-nums">{row.value}</span>
                  </div>
                );
              })}
          </div>
        </Card>

        {/* Locations */}
        <Card className="p-5">
          <h2 className="mb-4 text-[15px] font-semibold">Top locations</h2>
          <div className="space-y-2">
            {data.byCity.map((c) => (
              <div key={c.key} className="flex items-center gap-3 text-[12.5px]">
                <Link
                  href={`/leads?city=${encodeURIComponent(c.key)}`}
                  className="min-w-0 flex-1 truncate hover:text-accent"
                >
                  {c.key}
                </Link>
                {c.won ? (
                  <span className="text-[11px] text-emerald-500">{c.won} won</span>
                ) : null}
                <span className="w-8 text-right font-medium tabular-nums">{c.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Revenue by month */}
        <Card className="p-5">
          <h2 className="mb-4 text-[15px] font-semibold">Revenue by month</h2>
          {data.revenueMonthly.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-subtle">No projects yet.</p>
          ) : (
            <>
              <div className="flex h-36 items-end gap-2">
                {data.revenueMonthly.map((m) => {
                  const max = Math.max(...data.revenueMonthly.map((x) => x.value), 1);
                  return (
                    <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="relative flex w-full flex-1 items-end">
                        <div
                          className="w-full rounded-t-lg bg-line transition-all duration-700"
                          style={{ height: `${(m.value / max) * 100}%` }}
                          title={`${formatETB(m.value)} signed`}
                        >
                          <div
                            className="w-full rounded-t-lg bg-emerald-500 transition-all duration-700"
                            style={{
                              height: `${m.value ? (m.paid / m.value) * 100 : 0}%`,
                              marginTop: `${m.value ? 100 - (m.paid / m.value) * 100 : 100}%`,
                            }}
                            title={`${formatETB(m.paid)} paid`}
                          />
                        </div>
                      </div>
                      <span className="text-[10px] whitespace-nowrap text-subtle">{m.key}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-4 text-[11px] text-subtle">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Paid
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-line" /> Signed value
                </span>
              </div>
            </>
          )}
        </Card>

        {/* Revenue by niche */}
        <Card className="p-5">
          <h2 className="mb-4 text-[15px] font-semibold">Revenue by niche</h2>
          {data.revenueByNiche.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-subtle">No projects yet.</p>
          ) : (
            <div className="space-y-2.5">
              {data.revenueByNiche.map((r) => {
                const max = Math.max(...data.revenueByNiche.map((x) => x.value), 1);
                return (
                  <div key={r.key}>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="truncate">{r.key}</span>
                      <span className="font-medium tabular-nums">{formatETB(r.value, true)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-indigo-500/70"
                        style={{ width: `${(r.value / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Project stages */}
        <Card className="p-5">
          <h2 className="mb-4 text-[15px] font-semibold">Projects by stage</h2>
          {data.projectStages.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-subtle">No projects yet.</p>
          ) : (
            <div className="space-y-2">
              {data.projectStages.map((s) => {
                const style = STAGE_STYLES[s.key as ProjectStage] ?? STAGE_STYLES.Planning;
                const max = Math.max(...data.projectStages.map((x) => x.value), 1);
                return (
                  <div key={s.key} className="flex items-center gap-3 text-[12.5px]">
                    <span className="flex w-24 shrink-0 items-center gap-1.5">
                      <span className={cn("h-2 w-2 rounded-full", style.dot)} />
                      {s.key}
                    </span>
                    <div className="h-4 flex-1 overflow-hidden rounded-md bg-surface-muted">
                      <div
                        className={cn("h-full rounded-md transition-all duration-700", style.dot)}
                        style={{ width: `${(s.value / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right tabular-nums">{s.value}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Prospecting quality */}
        <Card className="p-5">
          <h2 className="mb-4 text-[15px] font-semibold">Prospecting quality</h2>
          <div className="space-y-3">
            <Ratio
              label="No website (your market)"
              value={t.total - t.withWebsite}
              total={t.total}
              tone="emerald"
            />
            <Ratio label="Has phone" value={t.withPhone} total={t.total} />
            <Ratio label="Has social media" value={t.withSocial} total={t.total} />
            <Ratio label="Already has website" value={t.withWebsite} total={t.total} />
            <div className="flex items-center justify-between border-t border-line pt-3 text-[12.5px]">
              <span className="text-muted">Average lead score</span>
              <span className="font-semibold tabular-nums">{t.avgScore || "—"}</span>
            </div>
          </div>
        </Card>

        {/* Outreach mix */}
        <Card className="p-5">
          <h2 className="mb-4 text-[15px] font-semibold">Outreach activity</h2>
          {data.activityMix.filter((a) => !["system", "status"].includes(a.key)).length === 0 ? (
            <p className="py-8 text-center text-[13px] text-subtle">
              Log calls and messages to see your outreach mix.
            </p>
          ) : (
            <div className="space-y-2">
              {data.activityMix
                .filter((a) => !["system", "status"].includes(a.key))
                .map((a) => {
                  const max = Math.max(
                    ...data.activityMix
                      .filter((x) => !["system", "status"].includes(x.key))
                      .map((x) => x.value),
                    1,
                  );
                  return (
                    <div key={a.key} className="flex items-center gap-3 text-[12.5px]">
                      <span className="w-20 shrink-0 capitalize">{a.key}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded-md bg-surface-muted">
                        <div
                          className="h-full rounded-md bg-violet-500/60"
                          style={{ width: `${(a.value / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right tabular-nums">{a.value}</span>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>

        {/* Leads added */}
        <Card className="p-5 lg:col-span-3">
          <h2 className="mb-4 text-[15px] font-semibold">Leads added &amp; won by month</h2>
          <div className="flex h-40 items-end gap-2">
            {data.monthly.map((m) => {
              const max = Math.max(...data.monthly.map((x) => x.value), 1);
              return (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 items-end gap-0.5">
                    <div
                      className="flex-1 rounded-t-md bg-gradient-to-t from-indigo-500/60 to-violet-500/60 transition-all duration-700"
                      style={{ height: `${(m.value / max) * 100}%` }}
                      title={`${m.value} leads added`}
                    />
                    <div
                      className="flex-1 rounded-t-md bg-emerald-500/80 transition-all duration-700"
                      style={{ height: `${(m.won / max) * 100}%` }}
                      title={`${m.won} won`}
                    />
                  </div>
                  <span className="text-[10px] whitespace-nowrap text-subtle">{m.key}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-[11px] text-subtle">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-500/70" /> Leads added
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Won
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "amber";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span
        className={cn(
          "text-[14px] font-semibold tabular-nums",
          tone === "emerald" && "text-emerald-600 dark:text-emerald-300",
          tone === "amber" && "text-amber-600 dark:text-amber-300",
        )}
      >
        {formatETB(value)}
      </span>
    </div>
  );
}

function Ratio({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone?: "emerald";
}) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">
          {value} · {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            tone === "emerald" ? "bg-emerald-500" : "bg-accent/70",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
