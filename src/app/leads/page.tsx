"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LeadCard } from "@/components/leads/LeadCard";
import { LeadTable } from "@/components/leads/LeadTable";
import { FollowUpModal, LeadFormModal } from "@/components/leads/modals";
import { ConfirmDialog } from "@/components/ui/modal";
import { Button, Card, EmptyState, Input, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { downloadCSV, downloadXLSX, leadsToRows, stamp } from "@/lib/export-client";
import { LEAD_STATUSES, type Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

type Facets = { categories: string[]; cities: string[]; tags: string[] };

type Filters = {
  status: string[];
  tier: string[];
  category: string[];
  city: string[];
  tags: string[];
  scoreMin: string;
  scoreMax: string;
  ratingMin: string;
  reviewsMin: string;
  hasWebsite: string;
  hasPhone: string;
  hasSocial: string;
  archived: boolean;
};

const EMPTY_FILTERS: Filters = {
  status: [],
  tier: [],
  category: [],
  city: [],
  tags: [],
  scoreMin: "",
  scoreMax: "",
  ratingMin: "",
  reviewsMin: "",
  hasWebsite: "",
  hasPhone: "",
  hasSocial: "",
  archived: false,
};

export default function LeadsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <LeadsInner />
    </Suspense>
  );
}

function LeadsInner() {
  const params = useSearchParams();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState(params.get("sort") ?? "score_desc");
  const [filters, setFilters] = useState<Filters>(() => ({
    ...EMPTY_FILTERS,
    status: params.get("status") ? [params.get("status") as string] : [],
    tier: params.get("tier") ? [params.get("tier") as string] : [],
    hasWebsite: params.get("hasWebsite") ?? "",
  }));
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<"table" | "cards">("table");
  const isMobile = useIsMobile();
  const effectiveView = isMobile ? "cards" : view;
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Facets>({ categories: [], cities: [], tags: [] });
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [formOpen, setFormOpen] = useState(params.get("new") === "1");
  const [editing, setEditing] = useState<Lead | null>(null);
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagPresets, setTagPresets] = useState<string[]>([]);
  const [customFieldKeys, setCustomFieldKeys] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    apiGet<{ settings: { tagPresets?: string[]; customFields?: string[] } }>("/api/settings")
      .then((data) => {
        setTagPresets(data.settings.tagPresets ?? []);
        setCustomFieldKeys(data.settings.customFields ?? []);
      })
      .catch(() => undefined);
  }, []);

  // Facets (niches/cities/tags) rarely change — load them once, never per keystroke.
  const loadFacets = useCallback(() => {
    apiGet<{ facets?: Facets }>("/api/leads?pageSize=1&facets=true")
      .then((data) => {
        if (data.facets) setFacets(data.facets);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadFacets();
  }, [loadFacets]);

  const queryKey = useMemo(() => {
    const sp = new URLSearchParams();
    if (debounced) sp.set("q", debounced);
    if (sort) sp.set("sort", sort);
    for (const key of ["status", "tier", "category", "city", "tags"] as const) {
      for (const value of filters[key]) sp.append(key, value);
    }
    for (const key of ["scoreMin", "scoreMax", "ratingMin", "reviewsMin"] as const) {
      if (filters[key]) sp.set(key, filters[key]);
    }
    for (const key of ["hasWebsite", "hasPhone", "hasSocial"] as const) {
      if (filters[key]) sp.set(key, filters[key]);
    }
    if (filters.archived) sp.set("archived", "true");
    sp.sort();
    return sp.toString();
  }, [debounced, sort, filters]);

  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setRefreshing(true);
    try {
      const sp = new URLSearchParams(queryKey);
      sp.set("page", String(page));
      sp.set("pageSize", String(pageSize));
      const data = await apiGet<{ leads: Lead[]; total: number }>(`/api/leads?${sp.toString()}`);
      if (id !== requestId.current) return; // a newer request already won
      setLeads(data.leads);
      setTotal(data.total);
    } catch (error) {
      if (id === requestId.current) toast((error as Error).message, "error");
    } finally {
      if (id === requestId.current) {
        setRefreshing(false);
        setInitialLoad(false);
      }
    }
  }, [queryKey, page, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset to page 1 only when the query genuinely changes (never on mount).
  const lastQueryKey = useRef(queryKey);
  useEffect(() => {
    if (lastQueryKey.current === queryKey) return;
    lastQueryKey.current = queryKey;
    setPage((p) => (p === 1 ? p : 1));
  }, [queryKey]);

  const activeFilterCount =
    filters.status.length +
    filters.tier.length +
    filters.category.length +
    filters.city.length +
    filters.tags.length +
    (filters.scoreMin ? 1 : 0) +
    (filters.scoreMax ? 1 : 0) +
    (filters.ratingMin ? 1 : 0) +
    (filters.reviewsMin ? 1 : 0) +
    (filters.hasWebsite ? 1 : 0) +
    (filters.hasPhone ? 1 : 0) +
    (filters.hasSocial ? 1 : 0) +
    (filters.archived ? 1 : 0);

  const toggleMulti = (key: "status" | "tier" | "category" | "city" | "tags", value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  };

  const quickEdit = async (lead: Lead, patch: Partial<Lead>) => {
    try {
      const result = await apiPatch<{ lead: Lead }>(`/api/leads/${lead.id}`, patch);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? result.lead : l)));
      toast("Saved", "success");
    } catch (error) {
      toast((error as Error).message, "error");
    }
  };

  const bulk = async (action: string, value?: unknown) => {
    const ids = [...selected];
    if (!ids.length) return;
    try {
      await apiPost("/api/leads/bulk", { ids, action, value });
      toast(`${ids.length} lead${ids.length > 1 ? "s" : ""} updated`, "success");
      setSelected(new Set());
      void load();
      loadFacets();
    } catch (error) {
      toast((error as Error).message, "error");
    }
  };

  const fetchAllForExport = async (): Promise<Lead[]> => {
    if (selected.size) return leads.filter((l) => selected.has(l.id));
    const sp = new URLSearchParams(queryKey);
    sp.set("page", "1");
    sp.set("pageSize", "5000");
    const data = await apiGet<{ leads: Lead[] }>(`/api/leads?${sp.toString()}`);
    return data.leads;
  };

  const exportCSV = async () => {
    const rows = leadsToRows(await fetchAllForExport());
    if (!rows.length) return toast("Nothing to export", "error");
    downloadCSV(rows, `leads-${stamp()}.csv`);
    toast(`Exported ${rows.length} leads`, "success");
  };

  const exportXLSX = async () => {
    const rows = leadsToRows(await fetchAllForExport());
    if (!rows.length) return toast("Nothing to export", "error");
    await downloadXLSX([{ name: "Leads", rows }], `leads-${stamp()}.xlsx`);
    toast(`Exported ${rows.length} leads`, "success");
  };

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Leads"
        subtitle={
          refreshing && !initialLoad
            ? "Updating…"
            : `${total.toLocaleString()} business${total === 1 ? "" : "es"} in your database`
        }
        actions={
          <>
            <Button size="md" onClick={exportCSV} title="Export current view to CSV">
              ⬇ CSV
            </Button>
            <Button size="md" onClick={exportXLSX} title="Export current view to Excel">
              ⬇ Excel
            </Button>
            <Link href="/import">
              <Button size="md" variant="secondary">
                ⬆ Import
              </Button>
            </Link>
            <Button
              size="md"
              variant="primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              + New lead
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <span className="absolute top-1/2 left-3 -translate-y-1/2 text-subtle">⌕</span>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, phone, niche, city, notes…"
              className="pl-9"
            />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="field w-auto">
            <option value="score_desc">Score: high → low</option>
            <option value="score_asc">Score: low → high</option>
            <option value="tier_asc">Tier: 1 → 5</option>
            <option value="rating_desc">Rating: high → low</option>
            <option value="reviews_desc">Reviews: most</option>
            <option value="name_asc">Name: A → Z</option>
            <option value="created_desc">Newest first</option>
            <option value="updated_desc">Recently updated</option>
          </select>
          <Button
            size="md"
            variant={showFilters || activeFilterCount ? "primary" : "secondary"}
            onClick={() => setShowFilters((v) => !v)}
          >
            ⚑ Filters{activeFilterCount ? ` · ${activeFilterCount}` : ""}
          </Button>
          <div className="hidden items-center rounded-xl border border-line p-0.5 md:flex">
            {(["table", "cards"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-medium capitalize transition-colors",
                  view === v ? "bg-surface-muted text-ink" : "text-subtle hover:text-ink",
                )}
              >
                {v === "table" ? "☰" : "▦"} {v}
              </button>
            ))}
          </div>
        </div>

        {showFilters ? (
          <div className="mt-3 space-y-4 border-t border-line pt-4">
            <FilterChips
              label="Status"
              options={LEAD_STATUSES.map((s) => ({ value: s, label: s }))}
              selected={filters.status}
              onToggle={(v) => toggleMulti("status", v)}
            />
            <FilterChips
              label="Tier"
              options={[1, 2, 3, 4, 5]
                .map((t) => ({ value: String(t), label: `Tier ${t}` }))
                .concat([{ value: "none", label: "No tier" }])}
              selected={filters.tier}
              onToggle={(v) => toggleMulti("tier", v)}
            />
            {facets.categories.length ? (
              <FilterChips
                label="Niche"
                options={facets.categories.map((c) => ({ value: c, label: c }))}
                selected={filters.category}
                onToggle={(v) => toggleMulti("category", v)}
              />
            ) : null}
            {facets.cities.length ? (
              <FilterChips
                label="Location"
                options={facets.cities.map((c) => ({ value: c, label: c }))}
                selected={filters.city}
                onToggle={(v) => toggleMulti("city", v)}
              />
            ) : null}
            {facets.tags.length ? (
              <FilterChips
                label="Tags"
                options={facets.tags.map((t) => ({ value: t, label: t }))}
                selected={filters.tags}
                onToggle={(v) => toggleMulti("tags", v)}
              />
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
              <NumField
                label="Score min"
                value={filters.scoreMin}
                onChange={(v) => setFilters((p) => ({ ...p, scoreMin: v }))}
              />
              <NumField
                label="Score max"
                value={filters.scoreMax}
                onChange={(v) => setFilters((p) => ({ ...p, scoreMax: v }))}
              />
              <NumField
                label="Rating ≥"
                value={filters.ratingMin}
                onChange={(v) => setFilters((p) => ({ ...p, ratingMin: v }))}
              />
              <NumField
                label="Reviews ≥"
                value={filters.reviewsMin}
                onChange={(v) => setFilters((p) => ({ ...p, reviewsMin: v }))}
              />
              <TriField
                label="Website"
                value={filters.hasWebsite}
                onChange={(v) => setFilters((p) => ({ ...p, hasWebsite: v }))}
              />
              <TriField
                label="Phone"
                value={filters.hasPhone}
                onChange={(v) => setFilters((p) => ({ ...p, hasPhone: v }))}
              />
              <TriField
                label="Social"
                value={filters.hasSocial}
                onChange={(v) => setFilters((p) => ({ ...p, hasSocial: v }))}
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-[12.5px] text-muted">
                <input
                  type="checkbox"
                  checked={filters.archived}
                  onChange={(e) => setFilters((p) => ({ ...p, archived: e.target.checked }))}
                  className="h-4 w-4 accent-[rgb(var(--accent))]"
                />
                Show archived only
              </label>
              <Button size="sm" variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear all filters
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {selected.size ? (
        <div className="glass sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line p-3 shadow-lg">
          <span className="text-[13px] font-medium">{selected.size} selected</span>
          <select
            className="field h-8 w-auto py-0 text-[12.5px]"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) void bulk("status", e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">Set status…</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="field h-8 w-auto py-0 text-[12.5px]"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) void bulk("tier", e.target.value === "none" ? null : e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">Set tier…</option>
            {[1, 2, 3, 4, 5].map((t) => (
              <option key={t} value={t}>
                Tier {t}
              </option>
            ))}
            <option value="none">No tier</option>
          </select>
          <BulkTagInput onAdd={(tag) => bulk("addTags", [tag])} presets={tagPresets} />
          <Button size="sm" onClick={() => bulk(filters.archived ? "unarchive" : "archive")}>
            {filters.archived ? "Unarchive" : "Archive"}
          </Button>
          <Button size="sm" onClick={exportCSV}>
            Export selected
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      {initialLoad ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : !leads.length ? (
        <EmptyState
          icon={debounced || activeFilterCount ? "🔍" : "📥"}
          title={debounced || activeFilterCount ? "No leads match your filters" : "No leads yet"}
          description={
            debounced || activeFilterCount
              ? "Try clearing a filter or searching for something else."
              : "Import your Excel/CSV database — your lead scores and tiers are imported exactly as they are."
          }
          action={
            debounced || activeFilterCount ? (
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setQuery("");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Link href="/import">
                <Button variant="primary" size="md">
                  Import leads
                </Button>
              </Link>
            )
          }
        />
      ) : effectiveView === "table" ? (
        <LeadTable
          leads={leads}
          selected={selected}
          sort={sort}
          onSortChange={setSort}
          onToggle={(id) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onToggleAll={() =>
            setSelected((prev) =>
              leads.every((l) => prev.has(l.id)) ? new Set() : new Set(leads.map((l) => l.id)),
            )
          }
          onQuickEdit={quickEdit}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              selected={selected.has(lead.id)}
              onToggleSelect={(id) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onQuickEdit={quickEdit}
              onFollowUp={setFollowUpLead}
              onLogActivity={(leadId, type, summary) => {
                void apiPost("/api/activities", { leadId, type, summary });
              }}
            />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Previous
          </Button>
          <span className="text-[12.5px] text-muted">
            Page {page} of {totalPages}
          </span>
          <Button size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next →
          </Button>
        </div>
      ) : null}

      <LeadFormModal
        open={formOpen}
        lead={editing}
        tagPresets={tagPresets}
        customFieldKeys={customFieldKeys}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />
      <FollowUpModal
        open={Boolean(followUpLead)}
        leadId={followUpLead?.id ?? null}
        leadName={followUpLead?.businessName}
        onClose={() => setFollowUpLead(null)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${selected.size} lead${selected.size > 1 ? "s" : ""}?`}
        message="This permanently removes the leads and all their notes, activities and follow-ups. Consider archiving instead — it keeps everything."
        confirmLabel="Delete permanently"
        destructive
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => bulk("delete")}
      />
    </div>
  );
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mobile;
}

function FilterChips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? options : options.slice(0, 12);
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-[12px] transition-colors",
              selected.includes(opt.value)
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-line text-muted hover:border-line-strong hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        ))}
        {options.length > 12 ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg px-2 py-1 text-[12px] text-accent hover:underline"
          >
            {expanded ? "Show less" : `+${options.length - 12} more`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-subtle">{label}</div>
      <Input
        value={value}
        inputMode="numeric"
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        className="h-8 py-0 text-[13px]"
      />
    </div>
  );
}

function TriField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-subtle">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field h-8 py-0 text-[13px]"
      >
        <option value="">Any</option>
        <option value="yes">Has</option>
        <option value="no">None</option>
      </select>
    </div>
  );
}

function BulkTagInput({
  onAdd,
  presets,
}: {
  onAdd: (tag: string) => void;
  presets: string[];
}) {
  const [value, setValue] = useState("");
  return (
    <div className="flex items-center gap-1.5">
      <input
        list="tag-presets"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            onAdd(value.trim());
            setValue("");
          }
        }}
        placeholder="Add tag…"
        className="field h-8 w-32 py-0 text-[12.5px]"
      />
      <datalist id="tag-presets">
        {presets.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <Button
        size="sm"
        onClick={() => {
          if (value.trim()) {
            onAdd(value.trim());
            setValue("");
          }
        }}
      >
        Tag
      </Button>
    </div>
  );
}
