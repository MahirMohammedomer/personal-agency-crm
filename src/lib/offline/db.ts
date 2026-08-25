"use client";

const DB_NAME = "meda-crm";
const DB_VERSION = 1;
export const CACHE_STORE = "cache";
export const OUTBOX_STORE = "outbox";

export type CacheEntry = { key: string; data: unknown; at: number };
export type OutboxItem = {
  id?: number;
  url: string;
  method: string;
  body: unknown;
  at: number;
  tries: number;
  error?: string | null;
  label: string;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return dbPromise;
}

async function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(store, mode);
      const request = run(transaction.objectStore(store));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/* ---------------------------------- cache --------------------------------- */

export async function cacheGet<T>(key: string): Promise<{ data: T; at: number } | null> {
  const row = await tx<CacheEntry>(CACHE_STORE, "readonly", (s) => s.get(key));
  return row ? { data: row.data as T, at: row.at } : null;
}

export async function cachePut(key: string, data: unknown) {
  await tx(CACHE_STORE, "readwrite", (s) => s.put({ key, data, at: Date.now() }));
}

export async function cacheKeys(): Promise<string[]> {
  const keys = await tx<IDBValidKey[]>(CACHE_STORE, "readonly", (s) => s.getAllKeys());
  return (keys ?? []).map(String);
}

export async function cacheClear() {
  await tx(CACHE_STORE, "readwrite", (s) => s.clear());
}

/* --------------------------------- outbox --------------------------------- */

export async function outboxAdd(item: Omit<OutboxItem, "id">): Promise<number | null> {
  const key = await tx<IDBValidKey>(OUTBOX_STORE, "readwrite", (s) => s.add(item));
  return key === null ? null : Number(key);
}

export async function outboxAll(): Promise<OutboxItem[]> {
  const rows = await tx<OutboxItem[]>(OUTBOX_STORE, "readonly", (s) => s.getAll());
  return (rows ?? []).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function outboxDelete(id: number) {
  await tx(OUTBOX_STORE, "readwrite", (s) => s.delete(id));
}

export async function outboxUpdate(item: OutboxItem) {
  await tx(OUTBOX_STORE, "readwrite", (s) => s.put(item));
}

export async function outboxClear() {
  await tx(OUTBOX_STORE, "readwrite", (s) => s.clear());
}
