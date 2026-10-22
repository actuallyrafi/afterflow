// Small browser helpers for the JSON API.

export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const response = await fetch(url, {
      method: init?.method ?? "GET",
      cache: "no-store",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Couldn't reach Afterflow. Check your connection and try again." } as T & { error?: string } };
  }
}

export const TOKEN_KEY = "afterflow.token";

export function rememberToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Private mode: the link itself still works.
  }
}

export function forgetToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing stored.
  }
}

export function savedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
}
