"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CalendarClock,
  CalendarDays,
  CornerDownLeft,
  FolderKanban,
  Handshake,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Phone,
  Plus,
  Search,
  Settings as SettingsIcon,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";

type SearchHit = {
  kind: "lead" | "client" | "project" | "task" | "contact" | "note";
  id: number;
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
};

type PaletteItem = {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  run: () => void;
};

const NAV_ITEMS: Array<{ label: string; href: string; icon: React.ReactNode }> = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Leads", href: "/leads", icon: <Users className="h-4 w-4" /> },
  { label: "Pipeline", href: "/pipeline", icon: <KanbanSquare className="h-4 w-4" /> },
  { label: "Follow-ups", href: "/follow-ups", icon: <CalendarClock className="h-4 w-4" /> },
  { label: "Clients", href: "/clients", icon: <Handshake className="h-4 w-4" /> },
  { label: "Projects", href: "/projects", icon: <FolderKanban className="h-4 w-4" /> },
  { label: "Tasks", href: "/tasks", icon: <ListChecks className="h-4 w-4" /> },
  { label: "Calendar", href: "/calendar", icon: <CalendarDays className="h-4 w-4" /> },
  { label: "Analytics", href: "/analytics", icon: <BarChart3 className="h-4 w-4" /> },
  { label: "Import", href: "/import", icon: <Upload className="h-4 w-4" /> },
  { label: "Settings", href: "/settings", icon: <SettingsIcon className="h-4 w-4" /> },
];

const KIND_ICON: Record<SearchHit["kind"], React.ReactNode> = {
  lead: <Users className="h-4 w-4" />,
  client: <Handshake className="h-4 w-4" />,
  project: <Briefcase className="h-4 w-4" />,
  task: <ListChecks className="h-4 w-4" />,
  contact: <User className="h-4 w-4" />,
  note: <FolderKanban className="h-4 w-4" />,
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHits([]);
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(() => {
      apiGet<{ results: SearchHit[] }>(`/api/search?q=${encodeURIComponent(q)}`)
        .then((data) => {
          if (!cancelled) setHits(data.results ?? []);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, query]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [];
    if (query.trim().length >= 2) {
      for (const hit of hits) {
        list.push({
          id: `${hit.kind}-${hit.id}`,
          group: hit.kind === "lead" || hit.kind === "client" ? "Leads" : "Records",
          label: hit.title,
          sub: [hit.subtitle, hit.meta].filter(Boolean).join(" · "),
          icon: KIND_ICON[hit.kind] ?? <Search className="h-4 w-4" />,
          run: () => go(hit.href),
        });
      }
      list.push({
        id: "search-all",
        group: "Actions",
        label: `Search all leads for “${query.trim()}”`,
        icon: <Search className="h-4 w-4" />,
        run: () => go(`/leads?q=${encodeURIComponent(query.trim())}`),
      });
      return list;
    }
    list.push(
      {
        id: "new-lead",
        group: "Actions",
        label: "Add a new lead",
        sub: "⌘N",
        icon: <Plus className="h-4 w-4" />,
        run: () => go("/leads?new=1"),
      },
      {
        id: "call-queue",
        group: "Actions",
        label: "Open call queue",
        sub: "Contacted + New leads",
        icon: <Phone className="h-4 w-4" />,
        run: () => go("/leads?status=New"),
      },
    );
    for (const nav of NAV_ITEMS) {
      list.push({
        id: `nav-${nav.href}`,
        group: "Go to",
        label: nav.label,
        icon: nav.icon,
        run: () => go(nav.href),
      });
    }
    return list;
  }, [hits, query]);

  useEffect(() => {
    setActive((n) => Math.min(n, Math.max(items.length - 1, 0)));
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((n) => (items.length ? (n + 1) % items.length : 0));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((n) => (items.length ? (n - 1 + items.length) % items.length : 0));
      }
      if (e.key === "Enter") {
        const item = items[active];
        if (item) {
          e.preventDefault();
          item.run();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, active, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  let lastGroup = "";

  return createPortal(
    <div className="fixed inset-0 z-[130]">
      <div
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-x-0 top-0 flex max-h-full flex-col sm:inset-x-auto sm:left-1/2 sm:top-[12vh] sm:w-full sm:max-w-[620px] sm:-translate-x-1/2">
        <div className="animate-pop-in flex max-h-[100dvh] flex-col overflow-hidden border-line bg-surface shadow-2xl sm:max-h-[70vh] sm:rounded-2xl sm:border">
          <div className="flex shrink-0 items-center gap-2.5 border-b border-line px-4 pt-[max(0.85rem,env(safe-area-inset-top))] pb-3.5 sm:pt-3.5">
            <Search className="h-4 w-4 shrink-0 text-subtle" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search leads, projects, tasks…"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-subtle"
              autoComplete="off"
              enterKeyHint="search"
            />
            {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-subtle" />}
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-subtle transition hover:bg-surface-muted sm:hidden"
              aria-label="Close search"
            >
              <X className="h-5 w-5" />
            </button>
            <kbd className="hidden shrink-0 rounded-md border border-line bg-surface-muted px-1.5 py-0.5 text-[10.5px] text-subtle sm:block">
              esc
            </kbd>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
            {items.length === 0 && !loading ? (
              <div className="px-3 py-10 text-center text-[13px] text-muted">
                {query.trim().length >= 2 ? "No matches found." : "Type at least 2 characters to search."}
              </div>
            ) : (
              items.map((item, index) => {
                const showGroup = item.group !== lastGroup;
                lastGroup = item.group;
                return (
                  <div key={item.id}>
                    {showGroup && (
                      <div className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                        {item.group}
                      </div>
                    )}
                    <button
                      type="button"
                      data-index={index}
                      onMouseEnter={() => setActive(index)}
                      onClick={item.run}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                        active === index ? "bg-surface-muted" : "hover:bg-surface-muted/60",
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted">
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-ink">{item.label}</span>
                        {item.sub && <span className="block truncate text-[11.5px] text-muted">{item.sub}</span>}
                      </span>
                      {active === index && (
                        <CornerDownLeft className="hidden h-3.5 w-3.5 shrink-0 text-subtle sm:block" />
                      )}
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-subtle sm:hidden" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden shrink-0 items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-subtle sm:flex">
            <span>
              <kbd className="rounded border border-line px-1">↑</kbd>{" "}
              <kbd className="rounded border border-line px-1">↓</kbd> navigate
            </span>
            <span>
              <kbd className="rounded border border-line px-1">↵</kbd> open
            </span>
            <span className="ml-auto">Press ⌘K anywhere</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
