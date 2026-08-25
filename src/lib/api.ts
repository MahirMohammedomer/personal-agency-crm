"use client";

import { offlineGet, offlineSend } from "./offline/sync";

/**
 * All app data access flows through here, so every page automatically gets
 * offline caching (GET) and outbox queueing (mutations) with no page changes.
 */
export async function apiGet<T>(url: string): Promise<T> {
  return offlineGet<T>(url);
}

export const apiPost = <T,>(url: string, body?: unknown) => offlineSend<T>(url, "POST", body);
export const apiPatch = <T,>(url: string, body?: unknown) => offlineSend<T>(url, "PATCH", body);
export const apiPut = <T,>(url: string, body?: unknown) => offlineSend<T>(url, "PUT", body);
export const apiDelete = <T,>(url: string) => offlineSend<T>(url, "DELETE");
