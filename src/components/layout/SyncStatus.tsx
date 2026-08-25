"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/primitives";
import {
  discardFailed,
  dismissConflicts,
  flushOutbox,
  retryFailed,
  startSyncEngine,
  subscribeSync,
  type SyncState,
} from "@/lib/offline/sync";
import { cn } from "@/lib/utils";

export function SyncStatus({ compact }: { compact?: boolean }) {
  const [state, setState] = useState<SyncState>({
    online: true,
    syncing: false,
    pending: 0,
    failed: 0,
    lastSyncedAt: null,
    conflicts: [],
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    startSyncEngine();
    return subscribeSync(setState);
  }, []);

  const tone = !state.online
    ? { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-300" }
    : state.failed
      ? { dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-300" }
      : state.syncing
        ? { dot: "bg-sky-500 animate-pulse", text: "text-sky-600 dark:text-sky-300" }
        : { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-300" };

  const label = !state.online
    ? state.pending
      ? `Offline — ${state.pending} waiting`
      : "Offline"
    : state.syncing
      ? "Syncing…"
      : state.failed
        ? `${state.failed} failed`
        : state.pending
          ? `${state.pending} waiting`
          : "Synced";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Sync status"
        className={cn(
          "flex items-center gap-2 rounded-xl px-2.5 py-2 text-[12.5px] font-medium transition-colors hover:bg-surface-muted",
          tone.text,
        )}
      >
        <span className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)} />
        {!compact ? <span className="truncate">{label}</span> : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="animate-pop-in absolute bottom-full left-0 z-50 mb-2 w-[248px] rounded-2xl border border-line bg-surface p-4 shadow-2xl">
            <div className="mb-3 flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
              <span className="text-[13px] font-semibold">{label}</span>
            </div>
            <dl className="space-y-1.5 text-[12px]">
              <div className="flex justify-between">
                <dt className="text-subtle">Last synced</dt>
                <dd>
                  {state.lastSyncedAt
                    ? new Date(state.lastSyncedAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-subtle">Pending</dt>
                <dd>{state.pending} change{state.pending === 1 ? "" : "s"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-subtle">Failed</dt>
                <dd className={state.failed ? "text-rose-500" : ""}>{state.failed}</dd>
              </div>
            </dl>

            {state.conflicts.length ? (
              <div className="mt-3 rounded-xl bg-amber-500/10 p-2.5 text-[11.5px] text-amber-700 dark:text-amber-300">
                <div className="mb-1 font-semibold">Sync conflict detected</div>
                {state.conflicts.map((c, i) => (
                  <div key={i}>{c}</div>
                ))}
                <button onClick={dismissConflicts} className="mt-1.5 underline">
                  Dismiss
                </button>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button size="xs" onClick={() => void flushOutbox()}>
                Sync now
              </Button>
              {state.failed ? (
                <>
                  <Button size="xs" onClick={() => void retryFailed()}>
                    Retry failed
                  </Button>
                  <Button size="xs" variant="danger" onClick={() => void discardFailed()}>
                    Discard
                  </Button>
                </>
              ) : null}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-subtle">
              Changes made offline are stored on this device and sent automatically when you are
              back online.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Slim, non-intrusive connectivity banner. */
export function OfflineBanner() {
  const [state, setState] = useState<SyncState | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => subscribeSync(setState), []);

  useEffect(() => {
    if (!state) return;
    if (!state.online) {
      setWasOffline(true);
      return;
    }
    if (wasOffline) {
      setFlash(state.pending ? "Back online — syncing…" : "Back online");
      setWasOffline(false);
      const t = setTimeout(() => setFlash(null), 2600);
      return () => clearTimeout(t);
    }
  }, [state, wasOffline]);

  useEffect(() => {
    const onSynced = () => {
      setFlash("All changes synced");
      setTimeout(() => setFlash(null), 2200);
    };
    window.addEventListener("meda:synced", onSynced);
    return () => window.removeEventListener("meda:synced", onSynced);
  }, []);

  if (!state) return null;
  if (state.online && !flash) return null;

  return (
    <div className="sticky top-0 z-40 w-full">
      <div
        className={cn(
          "flex items-center justify-center gap-2 px-4 py-1.5 text-[12px] font-medium",
          state.online
            ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
            : "bg-amber-500/14 text-amber-800 dark:text-amber-200",
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", state.online ? "bg-emerald-500" : "bg-amber-500")} />
        {state.online
          ? flash
          : `You're offline — everything still works${
              state.pending ? `, ${state.pending} change${state.pending === 1 ? "" : "s"} waiting` : ""
            }`}
      </div>
    </div>
  );
}
