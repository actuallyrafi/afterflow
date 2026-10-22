// Carries "the person I just scanned" through card creation.
// Order of trust: the ?meet= URL param, then sessionStorage (same tab), then a
// localStorage copy that expires after an hour so an old scan never resurfaces.

export const MEET_KEY = "afterflow.meet";
export const MEET_TTL_MS = 60 * 60 * 1000;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

export function cleanMeetId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return ID_PATTERN.test(id) ? id : null;
}

export function encodeStoredMeet(id: string, now = Date.now()): string {
  return JSON.stringify({ id, at: now });
}

/** Reads the localStorage value. Legacy bare ids (no timestamp) count as expired. */
export function decodeStoredMeet(raw: string | null, now = Date.now()): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: unknown; at?: unknown };
    const id = cleanMeetId(parsed?.id);
    if (!id || typeof parsed.at !== "number") return null;
    if (now - parsed.at > MEET_TTL_MS || parsed.at - now > 60_000) return null;
    return id;
  } catch {
    return null;
  }
}

export function rememberMeet(id: string): void {
  try {
    sessionStorage.setItem(MEET_KEY, id);
    localStorage.setItem(MEET_KEY, encodeStoredMeet(id));
  } catch {
    // Private mode can refuse storage; the URL param still carries the id.
  }
}

export function readPendingMeet(fromUrl: string | null): string | null {
  const direct = cleanMeetId(fromUrl);
  if (direct) return direct;
  try {
    const session = cleanMeetId(sessionStorage.getItem(MEET_KEY));
    if (session) return session;
    const stored = localStorage.getItem(MEET_KEY);
    const local = decodeStoredMeet(stored);
    if (!local && stored) localStorage.removeItem(MEET_KEY);
    return local;
  } catch {
    return null;
  }
}

export function clearPendingMeet(): void {
  try {
    sessionStorage.removeItem(MEET_KEY);
    localStorage.removeItem(MEET_KEY);
  } catch {
    // Nothing to clear.
  }
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}
