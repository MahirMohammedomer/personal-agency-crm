"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  RefreshCw,
  RotateCw,
  Trash2,
  WifiOff,
} from "lucide-react";
import {
  discardFailed,
  dismissConflicts,
  flushOutbox,
  getSyncState,
  retryFailed,
  subscribeSync,
  type SyncState,
} from "@/lib/offline/sync";
import { outboxAll, type OutboxItem } from "@/lib/offline/db";
import { Button, Dropdown, MenuLabel } from "@/components/ui/ui";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";

const NEUTRAL_SYNC_STATE: SyncState = {
  online: true,
  syncing: false,
  pending: 0,
  failed: 0,
  lastSyncedAt: null,
  conflicts: [],
};

/** "Synced 5 min ago" style label — re-evaluated on a timer so it never goes stale. */
function useSyncedLabel(state: SyncState) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const syncing = state.syncing;
  const pending = state.pending;
  if (!state.online) return pending ? `Offline · ${pending}` : "Offline";
  if (syncing) return "Syncing…";
  if (pending) return `${pending} waiting`;
  if (!state.lastSyncedAt) return "Synced";
  return `Synced ${timeAgo(new Date(state.lastSyncedAt).toISOString())}`;
}

/** Offline-outbox indicator: shows whether edits reached the server, and lets you retry. */
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const { toast } = useToast();
  // `null` until mounted: the persisted sync state lives in localStorage, so rendering it during
  // hydration would differ from the server HTML (and do so on every page).
  const [live, setLive] = useState<SyncState | null>(null);
  const [items, setItems] = useState<OutboxItem[]>([]);

  useEffect(() => {
    setLive(getSyncState());
    return subscribeSync(setLive);
  }, []);

  const state = live ?? NEUTRAL_SYNC_STATE;

  useEffect(() => {
    const load = () => void outboxAll().then(setItems);
    load();
    window.addEventListener("meda:synced", load);
    return () => window.removeEventListener("meda:synced", load);
  }, [state.pending, state.failed]);

  const failed = useMemo(() => items.filter((i) => (i.tries ?? 0) >= 5), [items]);
  const pending = useMemo(() => items.filter((i) => (i.tries ?? 0) < 5), [items]);

  const tone = !state.online
    ? { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", Icon: WifiOff }
    : state.failed
      ? { dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", Icon: AlertTriangle }
      : state.syncing || state.pending
        ? { dot: "bg-sky-500", text: "text-sky-600 dark:text-sky-400", Icon: RefreshCw }
        : { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", Icon: CheckCircle2 };

  const syncedLabel = useSyncedLabel(state);
  const label = live ? syncedLabel : "Sync";
  const { Icon } = tone;

  return (
    <Dropdown
      align="right"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Sync status: ${label}`}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-[11.5px] font-medium text-muted transition hover:bg-surface-muted sm:h-8 sm:px-2.5"
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot} ${state.syncing ? "animate-pulse" : ""}`} />
          {!compact && <span className={`hidden max-w-[9rem] truncate sm:inline ${tone.text}`}>{label}</span>}
        </button>
      )}
      panelClassName="w-[min(22rem,calc(100vw-1.5rem))] p-0"
    >
      {({ close }) => (
        <div>
          <div className="flex items-start gap-2.5 border-b border-line px-3.5 py-3">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.text}`} />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink">
                {!state.online ? "Offline — changes are saved on this device" : label}
              </div>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {state.online
                  ? state.pending || state.syncing
                    ? "Sending your edits to the server…"
                    : "Everything you changed is saved on the server."
                  : "We'll send everything automatically when you're back online."}
              </p>
            </div>
          </div>

          {state.conflicts.length > 0 && (
            <div className="border-b border-line bg-amber-500/10 px-3.5 py-2.5 text-[11.5px] text-amber-700 dark:text-amber-300">
              <div className="font-medium">{state.conflicts.length} change(s) could not be applied</div>
              <p className="mt-0.5 leading-relaxed opacity-90">{state.conflicts[state.conflicts.length - 1]}</p>
              <button
                type="button"
                className="mt-1.5 underline decoration-dotted"
                onClick={() => {
                  dismissConflicts();
                  close();
                }}
              >
                Dismiss
              </button>
            </div>
          )}

          {items.length > 0 && (
            <div className="max-h-52 overflow-y-auto overscroll-contain px-3 py-2">
              {failed.length > 0 && <MenuLabel className="px-0.5 text-rose-500">Needs attention</MenuLabel>}
              {failed.map((i) => (
                <div key={i.id} className="rounded-lg px-1 py-1.5 text-[11.5px] text-ink">
                  <div className="truncate font-medium">{i.label}</div>
                  <div className="truncate text-[10.5px] text-rose-500">{i.error ?? "Failed to send"}</div>
                </div>
              ))}
              {pending.length > 0 && (
                <MenuLabel className="px-0.5 pt-2">Waiting to send ({pending.length})</MenuLabel>
              )}
              {pending.slice(0, 10).map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 px-1 py-1.5 text-[11.5px]">
                  <span className="truncate text-ink">{i.label}</span>
                  <span className="shrink-0 text-[10.5px] text-subtle">{timeAgo(new Date(i.at).toISOString())}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5">
            <Button
              size="xs"
              variant="secondary"
              onClick={() => {
                void flushOutbox();
                toast("Checking for changes to send…");
                close();
              }}
            >
              <RotateCw className="h-3 w-3" /> Sync now
            </Button>
            {failed.length > 0 && (
              <>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    void retryFailed().then(() => toast("Retrying failed changes…"));
                  }}
                >
                  Retry
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    void discardFailed().then(() => toast("Failed changes discarded"));
                  }}
                >
                  <Trash2 className="h-3 w-3" /> Discard
                </Button>
              </>
            )}
            {items.length === 0 && (
              <span className="flex items-center gap-1.5 text-[11.5px] text-subtle">
                <CloudOff className="h-3.5 w-3.5" /> Nothing pending
              </span>
            )}
          </div>
        </div>
      )}
    </Dropdown>
  );
}
