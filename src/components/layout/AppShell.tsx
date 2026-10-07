"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  Download,
  FolderKanban,
  Handshake,
  KeyRound,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Search,
  Settings as SettingsIcon,
  Shield,
  Sun,
  Upload,
  Users,
} from "lucide-react";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { Button, Dropdown, MenuItem, MenuLabel } from "@/components/ui/ui";
import { SyncIndicator } from "@/components/common/SyncIndicator";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { onInstallPromptChange, promptInstall, registerServiceWorker } from "@/lib/pwa";
import { startSyncEngine } from "@/lib/offline/sync";
import { useToast } from "@/components/ui/toast";
import { cn, initials } from "@/lib/utils";

type Owner = { email: string | null };

/** Single source of truth for app navigation — every href is a real page. */
const NAV: Array<{ href: string; label: string; short: string; icon: React.ElementType }> = [
  { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", short: "Leads", icon: Users },
  { href: "/pipeline", label: "Pipeline", short: "Pipeline", icon: KanbanSquare },
  { href: "/follow-ups", label: "Follow-ups", short: "Follow", icon: CalendarClock },
  { href: "/projects", label: "Projects", short: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", short: "Tasks", icon: ListChecks },
  { href: "/clients", label: "Clients", short: "Clients", icon: Handshake },
  { href: "/calendar", label: "Calendar", short: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", short: "Stats", icon: BarChart3 },
  { href: "/import", label: "Import", short: "Import", icon: Upload },
];

/** The five tabs that live in the mobile bottom bar (rest sits behind “More”). */
const MOBILE_TABS = ["/", "/leads", "/pipeline", "/follow-ups"];

/** Meridian mark — abstract M / horizon mark, works light & dark */
function MeridianMark({ size = 26 }: { size?: number }) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] shadow-sm ring-1 ring-black/5 dark:ring-white/10"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" width={size} height={size} className="block">
        <defs>
          <linearGradient id="m-g" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="55%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="m-a" x1="8" y1="6" x2="26" y2="28">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="10" fill="url(#m-g)" className="dark:opacity-90" />
        <path d="M6 18h20" stroke="url(#m-a)" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
        <path
          d="M7 24V10l5.5 8.5L18 10l5.5 8.5L29 10v14"
          fill="none"
          stroke="white"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const options: Array<{ value: ThemeMode; label: string; icon: React.ElementType }> = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  const Current = mode === "dark" ? Moon : mode === "light" ? Sun : Monitor;
  return (
    <Dropdown
      trigger={({ toggle }) => (
        <Button variant="ghost" size="icon-sm" onClick={toggle} title="Appearance" aria-label="Appearance">
          <Current className="h-4 w-4" />
        </Button>
      )}
      panelClassName="w-40"
    >
      {({ close }) => (
        <>
          <MenuLabel>Appearance</MenuLabel>
          {options.map((o) => (
            <MenuItem
              key={o.value}
              icon={<o.icon className="h-4 w-4" />}
              className={mode === o.value ? "bg-surface-muted" : ""}
              onClick={() => {
                setMode(o.value);
                close();
              }}
            >
              {o.label}
            </MenuItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}

function UserMenu({ owner }: { owner: Owner }) {
  const { navigate } = useNav();
  const [installable, setInstallable] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onInstallPromptChange((p) => setInstallable(Boolean(p)));
    return () => {
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } catch {
      /* offline — cookie will still be cleared on next online load */
    }
    toast("Signed out");
    window.location.href = "/login";
  };

  return (
    <Dropdown
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-[12.5px] font-semibold text-white shadow-sm transition hover:opacity-90 sm:h-8 sm:w-8 sm:text-[12px] dark:from-white dark:to-slate-300 dark:text-slate-900"
          title={owner.email ?? "Account"}
          aria-label="Account menu"
        >
          {initials(owner.email ?? "Owner").slice(0, 1) || "O"}
        </button>
      )}
      panelClassName="w-[min(15rem,calc(100vw-1.5rem))]"
    >
      {({ close }) => (
        <>
          <div className="px-2.5 py-2">
            <div className="truncate text-[13px] font-medium text-ink">{owner.email ?? "Owner"}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
              <Shield className="h-3 w-3" /> Private owner account
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          <MenuItem
            icon={<SettingsIcon className="h-4 w-4" />}
            onClick={() => {
              navigate("/settings");
              close();
            }}
          >
            Settings
          </MenuItem>
          <MenuItem
            icon={<Download className="h-4 w-4" />}
            onClick={() => {
              window.open("/api/export?scope=all", "_blank");
              toast("Full backup download started");
              close();
            }}
          >
            Export full backup
          </MenuItem>
          {installable && (
            <MenuItem
              icon={<Download className="h-4 w-4" />}
              onClick={async () => {
                const result = await promptInstall();
                if (result === "accepted") toast("Installing Meda CRM…");
                close();
              }}
            >
              Install app
            </MenuItem>
          )}
          <MenuItem
            icon={<KeyRound className="h-4 w-4" />}
            onClick={() => {
              navigate("/settings#account");
              close();
            }}
          >
            Password / account
          </MenuItem>
          <div className="my-1 h-px bg-line" />
          <MenuItem danger icon={<LogOut className="h-4 w-4" />} onClick={() => void signOut()}>
            Sign out
          </MenuItem>
        </>
      )}
    </Dropdown>
  );
}

/** Tiny nav helper so nested components can push routes without the router hook dance. */
const NavCtx = React.createContext<{ navigate: (href: string) => void }>({ navigate: () => {} });
export function useNav() {
  return React.useContext(NavCtx);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const { toast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [owner, setOwner] = useState<Owner>({ email: null });
  const goBuffer = useRef<{ key: string; at: number } | null>(null);

  // Restore UI preferences + boot the offline engine / service worker once.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("meda:sidebar-collapsed") === "1");
    } catch {
      /* ignore */
    }
    registerServiceWorker();
    startSyncEngine();
    fetch("/api/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { email?: string | null; ownerEmail?: string | null }) =>
        setOwner({ email: d.email ?? d.ownerEmail ?? null }),
      )
      .catch(() => undefined);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const navigate = useCallback(
    (href: string) => {
      setDrawerOpen(false);
      if (href.startsWith("#")) return;
      router.push(href);
    },
    [router],
  );

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("meda:sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Global keyboard shortcuts: ⌘K / Ctrl+K or “/” for search, “g then x” to jump.
  useEffect(() => {
    const GO_MAP: Record<string, string> = {
      d: "/",
      l: "/leads",
      p: "/pipeline",
      f: "/follow-ups",
      c: "/clients",
      r: "/projects",
      t: "/tasks",
      a: "/analytics",
      i: "/import",
      s: "/settings",
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (meta && e.key.toLowerCase() === "n" && !e.shiftKey) {
        e.preventDefault();
        router.push("/leads?new=1");
        return;
      }
      if (typing || meta || e.altKey) return;

      if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.key === "g") {
        goBuffer.current = { key: "g", at: Date.now() };
        return;
      }
      if (goBuffer.current && Date.now() - goBuffer.current.at < 1200) {
        const href = GO_MAP[e.key.toLowerCase()];
        goBuffer.current = null;
        if (href) {
          e.preventDefault();
          router.push(href);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const bottomTabs = NAV.filter((n) => MOBILE_TABS.includes(n.href));

  return (
    <NavCtx.Provider value={{ navigate }}>
      <div className="flex h-full w-full overflow-hidden">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "relative hidden shrink-0 flex-col border-r border-line bg-surface/60 backdrop-blur-xl transition-[width] duration-200 ease-out md:flex",
            collapsed ? "w-[68px]" : "w-[236px]",
          )}
        >
          <div className={cn("flex items-center py-[14px]", collapsed ? "justify-center px-2" : "px-4")}>
            <Link
              href="/"
              className={cn("flex items-center gap-2.5 transition hover:opacity-90", collapsed ? "" : "w-full")}
            >
              <MeridianMark />
              {!collapsed && (
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="text-[15px] font-semibold tracking-tight text-ink">Meda CRM</div>
                  <div className="text-[10.5px] uppercase tracking-[0.1em] text-subtle">Agency OS</div>
                </div>
              )}
            </Link>
          </div>

          <nav className={cn("flex-1 space-y-0.5 overflow-y-auto py-1", collapsed ? "px-2" : "px-3")}>
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "flex items-center rounded-xl font-medium transition-all",
                    collapsed ? "h-10 justify-center" : "gap-3 px-3 py-2 text-[13.5px]",
                    active
                      ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                      : "text-muted hover:bg-surface-muted hover:text-ink",
                  )}
                >
                  <item.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={active ? 2.2 : 1.9} />
                  {!collapsed && item.label}
                </Link>
              );
            })}
          </nav>

          <div className={cn("border-t border-line", collapsed ? "p-2" : "p-3")}>
            <Link
              href="/settings"
              title="Settings"
              className={cn(
                "flex items-center rounded-xl font-medium transition-all",
                collapsed ? "h-10 justify-center" : "gap-3 px-3 py-2 text-[13.5px]",
                isActive(pathname, "/settings")
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-muted hover:bg-surface-muted hover:text-ink",
              )}
            >
              <SettingsIcon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9} />
              {!collapsed && "Settings"}
            </Link>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="mt-1 flex h-8 w-full items-center justify-center rounded-xl text-subtle transition hover:bg-surface-muted hover:text-ink"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
        </aside>

        {/* Mobile drawer */}
        <div
          className={cn(
            "fixed inset-0 z-[110] md:hidden",
            drawerOpen ? "pointer-events-auto" : "pointer-events-none",
          )}
          aria-hidden={!drawerOpen}
        >
          <div
            className={cn(
              "absolute inset-0 bg-slate-900/45 backdrop-blur-[2px] transition-opacity duration-200",
              drawerOpen ? "opacity-100" : "opacity-0",
            )}
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className={cn(
              "absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col border-r border-line bg-surface transition-transform duration-250 ease-out",
              drawerOpen ? "translate-x-0" : "-translate-x-full",
            )}
            role="dialog"
            aria-label="Navigation"
          >
            <div className="flex items-center justify-between px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
              <Link href="/" className="flex items-center gap-2.5" onClick={() => setDrawerOpen(false)}>
                <MeridianMark />
                <div className="leading-tight">
                  <div className="text-[15px] font-semibold text-ink">Meda CRM</div>
                  <div className="text-[10.5px] uppercase tracking-[0.1em] text-subtle">Agency OS</div>
                </div>
              </Link>
              <Button variant="ghost" size="icon-sm" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                <Menu className="h-4 w-4 rotate-90" />
              </Button>
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 pb-4">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium",
                      active ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-muted",
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
              <Link
                href="/settings"
                onClick={() => setDrawerOpen(false)}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium",
                  isActive(pathname, "/settings")
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-muted",
                )}
              >
                <SettingsIcon className="h-[18px] w-[18px] shrink-0" />
                Settings
              </Link>
            </nav>

            <div className="border-t border-line px-4 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
              <div className="truncate text-[12.5px] text-muted">{owner.email ?? "Owner"}</div>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  void fetch("/api/auth", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "logout" }),
                  }).then(() => {
                    toast("Signed out");
                    window.location.href = "/login";
                  });
                }}
                className="mt-2 flex min-h-10 items-center gap-2 text-[14px] font-medium text-rose-600 dark:text-rose-400"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </div>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-[56px] shrink-0 items-center gap-1.5 border-b border-line bg-surface/85 px-2.5 backdrop-blur-xl sm:gap-2 sm:px-4 md:h-[60px]">
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-left text-[13px] text-subtle transition hover:border-line-strong sm:max-w-md"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">Search</span>
              <kbd className="hidden rounded-md border border-line bg-surface-muted px-1.5 py-0.5 font-sans text-[10.5px] text-subtle sm:inline">
                ⌘K
              </kbd>
            </button>

            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
              <SyncIndicator />
              <span className="hidden sm:inline-flex">
                <ThemeToggle />
              </span>
              <Button
                variant="primary"
                size="icon-sm"
                className="md:hidden"
                onClick={() => router.push("/leads?new=1")}
                aria-label="Add lead"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="hidden md:inline-flex"
                onClick={() => router.push("/leads?new=1")}
              >
                <Plus className="h-4 w-4" /> Quick add
              </Button>
              <UserMenu owner={owner} />
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-[1400px] px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-4 sm:pt-5 md:px-6 md:pb-10">
              {children}
            </div>
          </main>

          {/* Mobile bottom tabs */}
          <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
            {bottomTabs.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[10.5px] font-medium transition",
                    active ? "text-ink" : "text-subtle",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <item.icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.8} />
                  <span className="max-w-full truncate">{item.short}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className={cn(
                "flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[10.5px] font-medium transition",
                NAV.some((n) => !MOBILE_TABS.includes(n.href) && isActive(pathname, n.href))
                  ? "text-ink"
                  : "text-subtle",
              )}
              aria-label="More navigation"
            >
              <Menu className="h-5 w-5" strokeWidth={1.8} />
              <span>More</span>
            </button>
          </nav>
        </div>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </div>
    </NavCtx.Provider>
  );
}

export { MeridianMark };
