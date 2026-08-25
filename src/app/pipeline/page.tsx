"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Input, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiGet, apiPatch } from "@/lib/api";
import { PIPELINE_COLUMNS, STATUS_STYLES, type Lead } from "@/lib/types";
import {
  buildLeadInfoText,
  cn,
  copyText,
  formatETB,
  mapsHref,
  telHref,
  whatsappHref,
} from "@/lib/utils";
import { ScoreBadge, TierBadge } from "@/components/leads/shared";

export default function PipelinePage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ leads: Lead[] }>("/api/leads?pageSize=500&sort=score_desc");
      setLeads(data.leads);
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.businessName, l.category, l.city, l.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [leads, query]);

  const columns = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const status of PIPELINE_COLUMNS) map.set(status, []);
    for (const lead of filtered) {
      if (map.has(lead.status)) map.get(lead.status)!.push(lead);
    }
    return map;
  }, [filtered]);

  const moveLead = async (leadId: number, status: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === status) return;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
    try {
      await apiPatch(`/api/leads/${leadId}`, { status });
      toast(`${lead.businessName} → ${status}`, "success");
    } catch (error) {
      toast((error as Error).message, "error");
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: lead.status } : l)));
    }
  };

  const hiddenCount = leads.length - filtered.filter((l) => PIPELINE_COLUMNS.includes(l.status as never)).length;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Pipeline"
        subtitle="Drag a business between stages — its status updates instantly."
        actions={
          <div className="w-56">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter board…"
            />
          </div>
        }
      />

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_COLUMNS.map((c) => (
            <Skeleton key={c} className="h-96 w-[290px] shrink-0" />
          ))}
        </div>
      ) : !leads.length ? (
        <EmptyState
          icon="▦"
          title="Your pipeline is empty"
          description="Import leads or create one manually to start moving businesses through your stages."
          action={
            <Link href="/import">
              <Button variant="primary" size="md">
                Import leads
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_COLUMNS.map((status) => {
            const items = columns.get(status) ?? [];
            const value = items.reduce((sum, l) => sum + (l.potentialValue ?? 0), 0);
            const style = STATUS_STYLES[status];
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(status);
                }}
                onDragLeave={() => setDragOver((prev) => (prev === status ? null : prev))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const id = Number(e.dataTransfer.getData("text/plain")) || dragId;
                  if (id) void moveLead(id, status);
                  setDragId(null);
                }}
                className={cn(
                  "flex w-[290px] shrink-0 flex-col rounded-2xl border border-line bg-surface-muted/40 transition-colors",
                  dragOver === status && "drag-over",
                )}
              >
                <div className="flex items-center gap-2 border-b border-line px-3.5 py-3">
                  <span className={cn("h-2 w-2 rounded-full", style.dot)} />
                  <span className="text-[12.5px] font-semibold tracking-wide uppercase">
                    {status}
                  </span>
                  <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted">
                    {items.length}
                  </span>
                </div>
                {value > 0 ? (
                  <div className="px-3.5 pt-2 text-[11.5px] text-subtle">
                    {formatETB(value, true)} potential
                  </div>
                ) : null}

                <div className="flex-1 space-y-2 overflow-y-auto p-2.5" style={{ maxHeight: "68vh" }}>
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line py-8 text-center text-[12px] text-subtle">
                      Drop here
                    </div>
                  ) : (
                    items.map((lead) => (
                      <KanbanCard
                        key={lead.id}
                        lead={lead}
                        dragging={dragId === lead.id}
                        onDragStart={(e) => {
                          setDragId(lead.id);
                          e.dataTransfer.setData("text/plain", String(lead.id));
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setDragId(null)}
                        onMove={(next) => moveLead(lead.id, next)}
                        onCopy={async () => {
                          const ok = await copyText(buildLeadInfoText(lead));
                          toast(ok ? "All info copied" : "Clipboard blocked", ok ? "success" : "error");
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hiddenCount > 0 ? (
        <p className="mt-3 text-[12px] text-subtle">
          {hiddenCount} lead{hiddenCount === 1 ? "" : "s"} with status “Not Interested” or
          “Follow-up” are not shown on the board.{" "}
          <Link href="/leads" className="text-accent hover:underline">
            View in leads →
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function KanbanCard({
  lead,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  onCopy,
}: {
  lead: Lead;
  dragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onMove: (status: string) => void;
  onCopy: () => void;
}) {
  const tel = telHref(lead.phone);
  const wa = whatsappHref(lead.phone);
  const maps = mapsHref(lead);
  const iconBtn =
    "inline-flex h-7 w-7 items-center justify-center rounded-lg text-[12.5px] transition-colors hover:bg-surface-muted";

  return (
    <Card
      className={cn(
        "group cursor-grab p-3 transition-shadow active:cursor-grabbing",
        dragging && "dragging",
      )}
    >
      <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <Link
          href={`/leads/${lead.id}`}
          className="block truncate text-[13.5px] font-semibold hover:text-accent"
        >
          {lead.businessName}
        </Link>
        <div className="mt-0.5 truncate text-[11.5px] text-subtle">
          {[lead.category, lead.city].filter(Boolean).join(" · ") || "—"}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <TierBadge tier={lead.tier} />
          <ScoreBadge score={lead.leadScore} />
          {lead.potentialValue ? (
            <span className="text-[11px] text-emerald-500">
              {formatETB(lead.potentialValue, true)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-0.5 border-t border-line pt-2">
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
        {maps ? (
          <a href={maps} target="_blank" rel="noreferrer" className={iconBtn} title="Maps">
            📍
          </a>
        ) : null}
        <select
          value={lead.status}
          onChange={(e) => onMove(e.target.value)}
          className="field ml-auto h-7 w-[104px] py-0 text-[11.5px]"
          title="Move to stage"
        >
          {PIPELINE_COLUMNS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </Card>
  );
}
