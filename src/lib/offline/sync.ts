"use client";

import {
  cacheGet,
  cachePut,
  outboxAdd,
  outboxAll,
  outboxDelete,
  outboxUpdate,
  type OutboxItem,
} from "./db";

export type SyncState = {
  online: boolean;
  syncing: boolean;
  pending: number;
  failed: number;
  lastSyncedAt: number | null;
  conflicts: string[];
};

const listeners = new Set<(state: SyncState) => void>();

let state: SyncState = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  syncing: false,
  pending: 0,
  failed: 0,
  lastSyncedAt: null,
  conflicts: [],
};

export function getSyncState() {
  return state;
}

export function subscribeSync(fn: (s: SyncState) => void) {
  listeners.add(fn);
  fn(state);
  return () => {
    listeners.delete(fn);
  };
}

function emit(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

async function refreshCounts() {
  const items = await outboxAll();
  emit({
    pending: items.filter((i) => (i.tries ?? 0) < 5).length,
    failed: items.filter((i) => (i.tries ?? 0) >= 5).length,
  });
}

/* ------------------------------ pending overlay ---------------------------- */
/**
 * Queued mutations are replayed against cached GET payloads so offline edits
 * are visible immediately instead of silently disappearing until sync.
 */
type Overlay = {
  leads: Map<number, Record<string, unknown>>;
  tasks: Map<number, Record<string, unknown>>;
  projects: Map<number, Record<string, unknown>>;
  followUps: Map<number, Record<string, unknown>>;
  newNotes: Array<{ leadId: number; body: string; at: number }>;
  newProjectNotes: Array<{ projectId: number; body: string; at: number }>;
  newActivities: Array<{ leadId: number; type: string; summary: string; at: number }>;
};

function emptyOverlay(): Overlay {
  return {
    leads: new Map(),
    tasks: new Map(),
    projects: new Map(),
    followUps: new Map(),
    newNotes: [],
    newProjectNotes: [],
    newActivities: [],
  };
}

function idFromQuery(url: string, key = "id"): number | null {
  const value = new URL(url, "http://x").searchParams.get(key);
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function buildOverlay(): Promise<Overlay> {
  const overlay = emptyOverlay();
  const items = await outboxAll();
  for (const item of items) {
    const body = (item.body ?? {}) as Record<string, unknown>;
    const path = item.url.split("?")[0];

    if (path.startsWith("/api/leads/") && item.method === "PATCH") {
      const id = Number(path.split("/")[3]);
      if (Number.isFinite(id)) {
        overlay.leads.set(id, { ...(overlay.leads.get(id) ?? {}), ...body });
      }
    } else if (path === "/api/tasks" && item.method === "PATCH") {
      const id = idFromQuery(item.url);
      if (id !== null) overlay.tasks.set(id, { ...(overlay.tasks.get(id) ?? {}), ...body });
    } else if (path === "/api/projects" && item.method === "PATCH") {
      const id = idFromQuery(item.url);
      if (id !== null) overlay.projects.set(id, { ...(overlay.projects.get(id) ?? {}), ...body });
    } else if (path === "/api/followups" && item.method === "PATCH") {
      const id = idFromQuery(item.url);
      if (id !== null) overlay.followUps.set(id, { ...(overlay.followUps.get(id) ?? {}), ...body });
    } else if (path === "/api/notes" && item.method === "POST") {
      overlay.newNotes.push({
        leadId: Number(body.leadId),
        body: String(body.body ?? ""),
        at: item.at,
      });
    } else if (path === "/api/project-notes" && item.method === "POST") {
      overlay.newProjectNotes.push({
        projectId: Number(body.projectId),
        body: String(body.body ?? ""),
        at: item.at,
      });
    } else if (path === "/api/activities" && item.method === "POST") {
      overlay.newActivities.push({
        leadId: Number(body.leadId),
        type: String(body.type ?? "other"),
        summary: String(body.summary ?? ""),
        at: item.at,
      });
    }
  }
  return overlay;
}

function coerce(patch: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...patch };
  for (const key of ["leadScore", "tier", "potentialValue", "progress", "paid", "value"]) {
    if (key in out) {
      const raw = out[key];
      if (raw === null || raw === "") out[key] = null;
      else {
        const n = Number(String(raw).replace(/[^\d.-]/g, ""));
        if (Number.isFinite(n)) out[key] = Math.round(n);
      }
    }
  }
  return out;
}

type AnyRecord = Record<string, unknown>;

function applyOverlay(url: string, payload: unknown, overlay: Overlay): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const path = url.split("?")[0];
  const data = payload as AnyRecord;

  const patchList = (list: unknown, map: Map<number, AnyRecord>) =>
    Array.isArray(list)
      ? list.map((row) => {
          const item = row as AnyRecord;
          const patch = map.get(Number(item.id));
          return patch ? { ...item, ...coerce(patch) } : item;
        })
      : list;

  if (path === "/api/leads") {
    return { ...data, leads: patchList(data.leads, overlay.leads) };
  }

  if (/^\/api\/leads\/\d+$/.test(path)) {
    const lead = data.lead as AnyRecord | undefined;
    if (!lead) return data;
    const leadId = Number(lead.id);
    const patch = overlay.leads.get(leadId);
    const extraNotes = overlay.newNotes
      .filter((n) => n.leadId === leadId)
      .map((n, i) => ({
        id: -1 - i,
        leadId,
        body: n.body,
        createdAt: new Date(n.at).toISOString(),
        __pending: true,
      }));
    const extraActivities = overlay.newActivities
      .filter((a) => a.leadId === leadId)
      .map((a, i) => ({
        id: -1 - i,
        leadId,
        type: a.type,
        summary: a.summary,
        detail: null,
        occurredAt: new Date(a.at).toISOString(),
        createdAt: new Date(a.at).toISOString(),
        __pending: true,
      }));
    return {
      ...data,
      lead: patch ? { ...lead, ...coerce(patch) } : lead,
      notes: [...extraNotes, ...((data.notes as unknown[]) ?? [])],
      activities: [...extraActivities, ...((data.activities as unknown[]) ?? [])],
      followUps: patchList(data.followUps, overlay.followUps),
      projects: patchList(data.projects, overlay.projects),
    };
  }

  if (path === "/api/tasks") return { ...data, tasks: patchList(data.tasks, overlay.tasks) };
  if (path === "/api/projects") {
    return { ...data, projects: patchList(data.projects, overlay.projects) };
  }
  if (/^\/api\/projects\/\d+$/.test(path)) {
    const project = data.project as AnyRecord | undefined;
    if (!project) return data;
    const projectId = Number(project.id);
    const patch = overlay.projects.get(projectId);
    const extraNotes = overlay.newProjectNotes
      .filter((n) => n.projectId === projectId)
      .map((n, i) => ({
        id: -1 - i,
        projectId,
        body: n.body,
        createdAt: new Date(n.at).toISOString(),
        __pending: true,
      }));
    return {
      ...data,
      project: patch ? { ...project, ...coerce(patch) } : project,
      tasks: patchList(data.tasks, overlay.tasks),
      notes: [...extraNotes, ...((data.notes as unknown[]) ?? [])],
    };
  }
  if (path === "/api/followups") {
    return { ...data, followUps: patchList(data.followUps, overlay.followUps) };
  }
  return data;
}

/* -------------------------------- fetching -------------------------------- */

const CACHEABLE =
  /^\/api\/(leads|projects|tasks|followups|notes|activities|dashboard|analytics|calendar|settings|contacts|project-notes|search)/;

/** How long memory/IDB data is treated as fresh enough to skip waiting on network. */
const FRESH_MS = 45_000;

type MemoryEntry = { data: unknown; at: number };
const memoryCache = new Map<string, MemoryEntry>();
const inflight = new Map<string, Promise<unknown>>();

export class OfflineQueuedError extends Error {
  constructor() {
    super("queued");
    this.name = "OfflineQueuedError";
  }
}

async function networkGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

async function storeCache(url: string, data: unknown) {
  memoryCache.set(url, { data, at: Date.now() });
  await cachePut(url, data).catch(() => undefined);
}

async function readIdb<T>(url: string): Promise<{ data: T; at: number } | null> {
  const cached = await cacheGet<T>(url);
  if (!cached) return null;
  memoryCache.set(url, { data: cached.data, at: cached.at });
  return { data: cached.data, at: cached.at };
}

/**
 * Stale-while-revalidate GET:
 * 1. Memory hit (fresh) → return instantly, optional background refresh
 * 2. Memory/IDB hit (stale) → return instantly, revalidate in background
 * 3. Cold → wait for network (or IDB if offline)
 *
 * Mutations should call `invalidateApiCache` so the next read is fresh.
 */
export async function offlineGet<T>(url: string): Promise<T> {
  const cacheable = CACHEABLE.test(url);
  const overlay = await buildOverlay();

  if (cacheable) {
    const mem = memoryCache.get(url);
    if (mem) {
      const age = Date.now() - mem.at;
      // Always schedule a quiet background refresh; never block the UI on it.
      void revalidateInBackground(url);
      return applyOverlay(url, mem.data, overlay) as T;
    }

    const idb = await readIdb<T>(url);
    if (idb) {
      void revalidateInBackground(url);
      return applyOverlay(url, idb.data, overlay) as T;
    }
  }

  // Cold path — wait for network (deduped)
  try {
    const data = await fetchDeduped<T>(url);
    if (cacheable) await storeCache(url, data);
    emit({ online: true, lastSyncedAt: Date.now() });
    return applyOverlay(url, data, overlay) as T;
  } catch (error) {
    if (!cacheable) throw error;
    const cached = await readIdb<T>(url);
    if (!cached) throw error;
    emit({ online: typeof navigator !== "undefined" ? navigator.onLine : true });
    return applyOverlay(url, cached.data, overlay) as T;
  }
}

function fetchDeduped<T>(url: string): Promise<T> {
  const existing = inflight.get(url);
  if (existing) return existing as Promise<T>;
  const promise = networkGet<T>(url).finally(() => {
    inflight.delete(url);
  });
  inflight.set(url, promise);
  return promise;
}

async function revalidateInBackground(url: string) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (inflight.has(url)) return;
  try {
    const data = await fetchDeduped(url);
    await storeCache(url, data);
    emit({ online: true, lastSyncedAt: Date.now() });
    // Notify open pages that fresher data is available
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("meda:cache-updated", { detail: { url } }));
    }
  } catch {
    /* keep serving stale data */
  }
}

/** Drop cached GETs so the next read hits the network. Call after mutations. */
export function invalidateApiCache(match?: string | RegExp) {
  if (!match) {
    memoryCache.clear();
    return;
  }
  for (const key of [...memoryCache.keys()]) {
    const hit = typeof match === "string" ? key.includes(match) : match.test(key);
    if (hit) memoryCache.delete(key);
  }
}

function labelFor(url: string, method: string) {
  const path = url.split("?")[0];
  const name = path.replace("/api/", "").replace(/\/\d+$/, "");
  const verb = method === "POST" ? "Create" : method === "DELETE" ? "Delete" : "Update";
  return `${verb} ${name.replace(/-/g, " ")}`;
}

export async function offlineSend<T>(url: string, method: string, body?: unknown): Promise<T> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401) throw new Error("Not authenticated");
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error((payload as { error?: string }).error ?? `Request failed (${res.status})`);
    }
    // Any successful write invalidates related list/detail caches
    invalidateApiCache("/api/");
    emit({ online: true, lastSyncedAt: Date.now() });
    return (await res.json()) as T;
  } catch (error) {
    const networkDown =
      error instanceof TypeError ||
      !navigator.onLine ||
      (error as Error).message === "Failed to fetch";
    if (!networkDown) throw error;

    await outboxAdd({
      url,
      method,
      body,
      at: Date.now(),
      tries: 0,
      label: labelFor(url, method),
    });
    await refreshCounts();
    emit({ online: false });
    // Optimistic response — the overlay makes the change visible right away.
    return { ok: true, queued: true } as T;
  }
}

/* --------------------------------- flushing -------------------------------- */

let flushing = false;

export async function flushOutbox(): Promise<void> {
  if (flushing || typeof navigator === "undefined" || !navigator.onLine) return;
  const items = await outboxAll();
  if (!items.length) {
    emit({ pending: 0, failed: 0 });
    return;
  }

  flushing = true;
  emit({ syncing: true });
  const conflicts: string[] = [];

  for (const item of items) {
    if ((item.tries ?? 0) >= 5) continue;
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: { "Content-Type": "application/json" },
        body: item.body === undefined ? undefined : JSON.stringify(item.body),
      });
      if (res.ok) {
        if (item.id !== undefined) await outboxDelete(item.id);
        continue;
      }
      if (res.status === 404 || res.status === 409) {
        // The record changed or vanished on another device.
        conflicts.push(`${item.label} could not be applied (${res.status})`);
        if (item.id !== undefined) await outboxDelete(item.id);
        continue;
      }
      if (res.status === 401) break; // signed out — stop and retry later
      const next: OutboxItem = {
        ...item,
        tries: (item.tries ?? 0) + 1,
        error: `HTTP ${res.status}`,
      };
      await outboxUpdate(next);
    } catch {
      break; // network dropped again; keep the rest queued
    }
  }

  flushing = false;
  await refreshCounts();
  invalidateApiCache("/api/");
  emit({
    syncing: false,
    lastSyncedAt: Date.now(),
    conflicts: conflicts.length ? [...state.conflicts, ...conflicts].slice(-5) : state.conflicts,
  });
  window.dispatchEvent(new CustomEvent("meda:synced"));
}

export function dismissConflicts() {
  emit({ conflicts: [] });
}

export async function retryFailed() {
  const items = await outboxAll();
  for (const item of items) {
    if ((item.tries ?? 0) >= 5 && item.id !== undefined) {
      await outboxUpdate({ ...item, tries: 0, error: null });
    }
  }
  await flushOutbox();
}

export async function discardFailed() {
  const items = await outboxAll();
  for (const item of items) {
    if ((item.tries ?? 0) >= 5 && item.id !== undefined) await outboxDelete(item.id);
  }
  await refreshCounts();
}

let started = false;

export function startSyncEngine() {
  if (started || typeof window === "undefined") return;
  started = true;

  void refreshCounts();
  void flushOutbox();

  window.addEventListener("online", () => {
    emit({ online: true });
    void flushOutbox();
  });
  window.addEventListener("offline", () => emit({ online: false }));
  window.addEventListener("focus", () => void flushOutbox());
  setInterval(() => void flushOutbox(), 20000);
}
