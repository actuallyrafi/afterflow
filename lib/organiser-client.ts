// Browser helpers for the organiser pages (v4.1h). Keys live in sessionStorage for this tab only.
import type { EventSummary, OrganiserStats } from "./organiser";

export const MASTER_KEY = "afterflow.organiser";
export const eventKeyName = (id: string) => `afterflow.organiser.key.${id}`;
/** Set by /join/{id} for someone with no card yet; the survey sends it with the new card. */
export const JOIN_EVENT_KEY = "afterflow.join.event";

export function readSession(name: string): string {
  try {
    return sessionStorage.getItem(name) ?? "";
  } catch {
    return "";
  }
}
export function writeSession(name: string, value: string) {
  try {
    if (value) sessionStorage.setItem(name, value);
    else sessionStorage.removeItem(name);
  } catch {
    // Private mode: the link still works, it just isn't remembered for this tab.
  }
}

export type OrgReply<T> = { ok: boolean; status: number; data: T & { error?: string } };

export async function orgFetch<T>(url: string, auth: { master?: string; key?: string }, body?: unknown): Promise<OrgReply<T>> {
  const headers: Record<string, string> = {};
  if (auth.master) headers["x-organiser-passcode"] = auth.master;
  if (auth.key) headers["x-organiser-key"] = auth.key;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  try {
    const response = await fetch(url, { method: body === undefined ? "GET" : "POST", cache: "no-store", headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Couldn't reach Afterflow. Check your connection and try again." } as T & { error?: string } };
  }
}

export const joinUrl = (origin: string, id: string) => `${origin}/join/${id}`;
/** The key rides in the fragment, which browsers never send to the server. */
export const organiserUrl = (origin: string, id: string, key: string) => `${origin}/organiser/${id}#k=${key}`;

export function keyFromHash(hash: string): string {
  const match = /(?:^#|&)k=([A-Za-z0-9_-]{20,})/.exec(hash);
  return match ? match[1] : "";
}

export type EventReply = { event: EventSummary; stats: OrganiserStats; master: boolean };
