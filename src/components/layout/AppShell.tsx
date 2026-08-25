"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { OfflineBanner, SyncStatus } from "./SyncStatus";
import { QuickAdd } from "./QuickAdd";
import { cn, daysBetween, todayISO } from "@/lib/utils";
import type { FollowUpWithLead } from "@/lib/types";

const NAV = [
  { href: "/", label: "Dashboard", icon: "◧", key: "d" },
  { href: "/leads", label: "Leads", icon: "☰", key: "l" },
  { href: "/pipeline", label: "Pipeline", icon: "▦", key: "p" },
  { href: "/follow-ups", label: "Follow-ups", icon: "◷", key: "f" },
  { href: "/calendar", label: "Calendar", icon: "▤", key: "k" },
  { href: "/clients", label: "Clients", icon: "★", key: "c" },
  { href: "/projects", label: "Projects", icon: "◈", key: "r" },
  { href: "/analytics", label: "Analytics", icon: "◭", key: "a" },
  { href: "/settings", label: "Settings", icon: "⚙", key: "s" },
];

const HIT_META: Record<string, { icon: string; label: string }> = {
  lead: { icon: "☰", label: "Lead" },
  client: { icon: "★", label: "Client" },
  project: { icon: "◈", label: "Project" },
  task: { icon: "✓", label: "Task" },
  contact: { icon: "👤", label: "Contact" },
  note: { icon: "📝", label: "Note" },
};

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const stored = localStorage.getItem("meda-theme");
    const initial =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);
  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("meda-theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);
  return { theme, toggle };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === "/login";
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dueCount, setDueCount] = useState(0);

  const refreshBadge = useCallback(async () => {
    try {
      const data = await apiGet<{ followUps: FollowUpWithLead[] }>("/api/followups");
      const today = todayISO();
      setDueCount(
        data.followUps.filter(
          (f) => f.status === "pending" && daysBetween(today, f.dueDate) <= 0,
        ).length,
      );
    } catch {
      /* badge is non-critical */
    }
  }, []);

  useEffect(() => {
    void refreshBadge();
  }, [refreshBadge, pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (bare || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, [bare]);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as unknown as { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key.toLowerCase() === "g") {
        const handler = (e2: KeyboardEvent) => {
          const item = NAV.find((n) => n.key === e2.key.toLowerCase());
          if (item) router.push(item.href);
          window.removeEventListener("keydown", handler);
        };
        window.addEventListener("keydown", handler, { once: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (bare) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-line bg-bg-elevated/85 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-[15px] font-bold text-white shadow-sm">
            M
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-[-0.01em]">Meda CRM</div>
            <div className="text-[11px] text-subtle">Web agency pipeline</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150",
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:bg-surface-muted hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "w-4 text-center text-[13px]",
                    active ? "text-accent" : "text-subtle group-hover:text-muted",
                  )}
                >
                  {item.icon}
                </span>
                {item.label}
                {item.href === "/follow-ups" && dueCount > 0 ? (
                  <span className="ml-auto rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-500">
                    {dueCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-line px-3 py-4">
          <Link
            href="/import"
            className="flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:brightness-110"
          >
            ⬆ Import leads
          </Link>
          <button
            onClick={toggle}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <span className="w-4 text-center">{theme === "dark" ? "☾" : "☀"}</span>
            {theme === "dark" ? "Dark mode" : "Light mode"}
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <span className="w-4 text-center">⌕</span>
            Search
            <kbd className="ml-auto rounded-md border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] text-subtle">
              ⌘K
            </kbd>
          </button>
          {installPrompt ? (
            <button
              onClick={async () => {
                await installPrompt.prompt();
                setInstallPrompt(null);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-accent transition-colors hover:bg-accent/10"
            >
              <span className="w-4 text-center">⤓</span>
              Install app
            </button>
          ) : null}
          <div className="flex items-center justify-between">
            <SyncStatus />
            <button
              onClick={async () => {
                await apiPost("/api/auth", { action: "logout" });
                window.location.href = "/login";
              }}
              title="Sign out"
              className="rounded-xl px-2.5 py-2 text-[12.5px] text-subtle transition-colors hover:bg-surface-muted hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <div
          className="animate-fade-in fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[248px]">
        <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg px-2 py-1.5 text-lg text-muted hover:bg-surface-muted"
            aria-label="Open navigation"
          >
            ☰
          </button>
          <span className="text-[15px] font-semibold">Meda CRM</span>
          <div className="ml-auto">
            <SyncStatus compact />
          </div>
          <button
            onClick={() => setPaletteOpen(true)}
            className="rounded-lg px-2 py-1.5 text-muted hover:bg-surface-muted"
            aria-label="Search"
          >
            ⌕
          </button>
          <button
            onClick={toggle}
            className="rounded-lg px-2 py-1.5 text-muted hover:bg-surface-muted"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☾" : "☀"}
          </button>
        </header>
        <OfflineBanner />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-6 pb-28 sm:px-7 sm:py-9 lg:pb-9">
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <nav className="glass fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden">
          {NAV.filter((n) => ["/", "/leads", "/pipeline", "/follow-ups", "/projects"].includes(n.href)).map(
            (item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                    active ? "text-accent" : "text-subtle",
                  )}
                >
                  <span className="text-[15px]">{item.icon}</span>
                  {item.label}
                  {item.href === "/follow-ups" && dueCount > 0 ? (
                    <span className="absolute top-1.5 right-[22%] h-1.5 w-1.5 rounded-full bg-rose-500" />
                  ) : null}
                </Link>
              );
            },
          )}
        </nav>
      </div>

      <QuickAdd />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

type SearchHit = {
  kind: string;
  id: number;
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
};

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiGet<{ results: SearchHit[] }>(
          `/api/search?q=${encodeURIComponent(query.trim())}`,
        );
        setResults(data.results);
        setCursor(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 170);
    return () => clearTimeout(handle);
  }, [query, open]);

  const pages = useMemo(
    () =>
      NAV.filter((n) => n.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5),
    [query],
  );

  const go = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose],
  );

  const flat = useMemo(
    () => [...pages.map((p) => p.href), ...results.map((r) => r.href)],
    [pages, results],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, Math.max(flat.length - 1, 0)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      }
      if (e.key === "Enter" && flat[cursor]) {
        e.preventDefault();
        go(flat[cursor]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, flat, cursor, go]);

  if (!open) return null;

  const grouped = results.reduce<Record<string, SearchHit[]>>((acc, hit) => {
    (acc[hit.kind] ??= []).push(hit);
    return acc;
  }, {});
  let flatIndex = pages.length - 1;

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center px-4 pt-[12vh]">
      <div className="animate-fade-in absolute inset-0 bg-black/35 backdrop-blur-[3px]" onClick={onClose} />
      <div className="animate-pop-in relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="text-subtle">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search businesses, phones, contacts, projects, tasks, notes…"
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-subtle"
          />
          <kbd className="rounded-md border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] text-subtle">
            ESC
          </kbd>
        </div>
        <div className="max-h-[56vh] overflow-y-auto p-2">
          {pages.length ? (
            <div className="mb-1">
              <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
                Pages
              </div>
              {pages.map((p, i) => (
                <button
                  key={p.href}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(p.href)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm",
                    cursor === i ? "bg-surface-muted" : "hover:bg-surface-muted",
                  )}
                >
                  <span className="w-4 text-center text-subtle">{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}

          {loading ? <div className="px-3 py-3 text-sm text-subtle">Searching…</div> : null}

          {Object.entries(grouped).map(([kind, hits]) => (
            <div key={kind} className="mb-1">
              <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
                {HIT_META[kind]?.label ?? kind}s
              </div>
              {hits.map((hit) => {
                flatIndex += 1;
                const idx = flatIndex;
                return (
                  <button
                    key={`${hit.kind}-${hit.id}`}
                    onMouseEnter={() => setCursor(idx)}
                    onClick={() => go(hit.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left",
                      cursor === idx ? "bg-surface-muted" : "hover:bg-surface-muted",
                    )}
                  >
                    <span className="w-4 shrink-0 text-center text-[12px] text-subtle">
                      {HIT_META[hit.kind]?.icon ?? "•"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{hit.title}</span>
                      <span className="block truncate text-[11.5px] text-subtle">
                        {hit.subtitle}
                      </span>
                    </span>
                    {hit.meta ? (
                      <span className="shrink-0 text-[11px] text-subtle capitalize">{hit.meta}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}

          {!loading && !results.length && query.trim().length >= 2 ? (
            <div className="px-3 py-6 text-center text-sm text-subtle">No matches found</div>
          ) : null}
          {!query ? (
            <div className="px-3 py-3 text-[12px] text-subtle">
              Search everything: business names, phone numbers, contacts, projects, tasks and notes.
              Tip: <kbd className="rounded border border-line px-1">g</kbd> then{" "}
              <kbd className="rounded border border-line px-1">l</kbd> jumps to Leads.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
