// Events: a private way to group the people you met. Each person keeps their own book of
// events; filing someone never touches the other person's book, and nothing here is ranked.

export type EventItem = {
  id: string;
  name: string;
  /** YYYY-MM-DD, the day it happened, or "" for no date (it's optional). */
  date: string;
  createdAt: string;
  /** The Grok Bot London night, filed for people who joined before events existed. */
  seeded?: boolean;
};

export type CurrentEvent = { eventId: string; until: string };

export type EventBook = {
  events: EventItem[];
  /** connection id -> event id. Only this person's filing. */
  filed: Record<string, string>;
  /** "I'm at an event now": new connections go here until `until` (4am or 12 hours) or until turned off. */
  current: CurrentEvent | null;
  /** v4.1d: events whose recap card you hid. The recap screen itself stays reachable. */
  recapHidden?: string[];
};

export const EVENT_NAME_MAX = 60;
export const EVENTS_MAX = 60;
/** "I'm at an event now" turns itself off after 12 hours, or at 04:00 London time, whichever is first. */
export const CURRENT_EVENT_MS = 12 * 60 * 60 * 1000;
export const AUTO_OFF_HOUR = 4;

/** The next 04:00 in Europe/London after `now`, as epoch ms (DST-safe). */
export function nextFourAm(now: number): number {
  const parts = (ms: number) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ms))
      .reduce<Record<string, number>>((acc, part) => (part.type === "literal" ? acc : { ...acc, [part.type]: Number(part.value) }), {});
  const p = parts(now);
  for (const dayOffset of [0, 1, 2]) {
    // Guess the UTC instant of 04:00 London on that day, then correct for the zone's offset.
    const guess = Date.UTC(p.year, p.month - 1, p.day + dayOffset, AUTO_OFF_HOUR, 0);
    const q = parts(guess);
    const shown = Date.UTC(q.year, q.month - 1, q.day, q.hour, q.minute);
    const at = guess - (shown - guess);
    if (at > now) return at;
  }
  return now + CURRENT_EVENT_MS;
}

export function currentUntil(now: number): string {
  return new Date(Math.min(now + CURRENT_EVENT_MS, nextFourAm(now))).toISOString();
}

/** The hackathon night. Cards and connections made before this were made around it. */
export const SEED_EVENT: Omit<EventItem, "createdAt"> = {
  id: "grokbot-london-2026",
  name: "Grok Bot London",
  date: "2026-10-22",
  seeded: true,
};
/**
 * 23 Oct 2026, 06:00 BST: the morning after the event, when events shipped. Cards and
 * connections older than this were made at or right after Grok Bot London, so they're seeded.
 */
export const SEED_CUTOFF = Date.parse("2026-10-23T05:00:00Z");

export function emptyBook(): EventBook {
  return { events: [], filed: {}, current: null };
}

function isDay(value: unknown): value is string {
  if (value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function cleanEventName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameError(name: string, events: EventItem[], date: string, exceptId?: string): string | null {
  if (!name) return "Give the event a name.";
  if (name.length > EVENT_NAME_MAX) return `Keep it under ${EVENT_NAME_MAX} characters.`;
  const clash = events.some(
    (event) => event.id !== exceptId && event.name.toLowerCase() === name.toLowerCase() && event.date === date,
  );
  return clash ? "You already have an event called that on this day." : null;
}

/** Tolerant read of a stored book (blob JSON, SQL text, or nothing). */
export function normalizeEventBook(raw: unknown): EventBook | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const events: EventItem[] = [];
  for (const item of Array.isArray(row.events) ? row.events : []) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const id = typeof e.id === "string" ? e.id : "";
    const name = cleanEventName(e.name).slice(0, EVENT_NAME_MAX);
    const date = e.date == null ? "" : e.date;
    if (!id || !name || !isDay(date) || events.some((other) => other.id === id)) continue;
    events.push({
      id,
      name,
      date: date as string,
      createdAt: typeof e.createdAt === "string" ? e.createdAt : "",
      ...(e.seeded === true ? { seeded: true } : {}),
    });
  }
  const ids = new Set(events.map((event) => event.id));
  const filed: Record<string, string> = {};
  if (row.filed && typeof row.filed === "object") {
    for (const [connectionId, eventId] of Object.entries(row.filed as Record<string, unknown>)) {
      if (typeof eventId === "string" && ids.has(eventId)) filed[connectionId] = eventId;
    }
  }
  let current: CurrentEvent | null = null;
  if (row.current && typeof row.current === "object") {
    const c = row.current as Record<string, unknown>;
    if (typeof c.eventId === "string" && ids.has(c.eventId) && typeof c.until === "string" && !Number.isNaN(Date.parse(c.until))) {
      current = { eventId: c.eventId, until: c.until };
    }
  }
  const recapHidden = Array.isArray(row.recapHidden)
    ? [...new Set(row.recapHidden.filter((id): id is string => typeof id === "string" && ids.has(id)))]
    : [];
  return { events, filed, current, ...(recapHidden.length ? { recapHidden } : {}) };
}

/**
 * Lazy migration. Nobody's book is written until they change something: until then a person who
 * had a card before events shipped sees the Grok Bot London event with their older connections
 * in it. Newer cards start with an empty book.
 */
export function seededBook(
  profile: { createdAt: string },
  connections: { id: string; createdAt: string }[],
): EventBook {
  const created = Date.parse(profile.createdAt);
  if (!Number.isFinite(created) || created >= SEED_CUTOFF) return emptyBook();
  const filed: Record<string, string> = {};
  for (const connection of connections) {
    const at = Date.parse(connection.createdAt);
    if (Number.isFinite(at) && at < SEED_CUTOFF) filed[connection.id] = SEED_EVENT.id;
  }
  return { events: [{ ...SEED_EVENT, createdAt: profile.createdAt }], filed, current: null };
}

export function activeCurrent(book: EventBook, now = Date.now()): CurrentEvent | null {
  if (!book.current) return null;
  return Date.parse(book.current.until) > now ? book.current : null;
}

/** "Grok Bot London · 22 Oct", or just the name when it has no date. */
export function eventLabel(event: Pick<EventItem, "name" | "date">): string {
  if (!event.date) return event.name;
  return `${event.name} · ${new Date(`${event.date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  })}`;
}

/** Newest first; undated events after dated ones, newest made first. */
export function sortEvents(events: EventItem[]): EventItem[] {
  return [...events].sort(
    (left, right) =>
      (right.date || "0").localeCompare(left.date || "0") || right.createdAt.localeCompare(left.createdAt) || left.name.localeCompare(right.name),
  );
}

export type EventEdit =
  | { action: "create"; name: unknown; date: unknown; startNow?: unknown }
  | { action: "rename"; eventId: unknown; name: unknown; date?: unknown }
  | { action: "delete"; eventId: unknown }
  | { action: "start"; eventId: unknown }
  | { action: "end" }
  | { action: "file"; connectionId: unknown; eventId: unknown }
  | { action: "restore"; event: unknown; connectionIds: unknown }
  | { action: "recap_hide"; eventId: unknown }
  | { action: "recap_show"; eventId: unknown };

export type EditResult = { ok: true; book: EventBook; eventId?: string } | { ok: false; status: number; error: string };

/** Pure edits on one person's book. `knownConnection` says whether the id is one of theirs. */
export function applyEventEdit(
  book: EventBook,
  edit: EventEdit,
  options: { now?: number; knownConnection?: (id: string) => boolean; newId?: () => string } = {},
): EditResult {
  const now = options.now ?? Date.now();
  const next: EventBook = { events: [...book.events], filed: { ...book.filed }, current: book.current, ...(book.recapHidden ? { recapHidden: [...book.recapHidden] } : {}) };
  const find = (id: unknown) => (typeof id === "string" ? next.events.find((event) => event.id === id) : undefined);
  switch (edit.action) {
    case "create": {
      const name = cleanEventName(edit.name);
      const date = edit.date == null ? "" : edit.date;
      if (!isDay(date)) return { ok: false, status: 400, error: "Pick the day it happened." };
      const problem = nameError(name, next.events, date as string);
      if (problem) return { ok: false, status: 400, error: problem };
      if (next.events.length >= EVENTS_MAX) return { ok: false, status: 400, error: "That's a lot of events. Delete an old one first." };
      const event: EventItem = { id: options.newId?.() ?? globalThis.crypto.randomUUID(), name, date: date as string, createdAt: new Date(now).toISOString() };
      next.events.push(event);
      if (edit.startNow === true) next.current = { eventId: event.id, until: currentUntil(now) };
      return { ok: true, book: next, eventId: event.id };
    }
    case "rename": {
      const event = find(edit.eventId);
      if (!event) return { ok: false, status: 404, error: "That event isn't here anymore." };
      const name = cleanEventName(edit.name);
      const date = edit.date === undefined ? event.date : edit.date == null ? "" : edit.date;
      if (!isDay(date)) return { ok: false, status: 400, error: "Pick the day it happened." };
      const problem = nameError(name, next.events, date as string, event.id);
      if (problem) return { ok: false, status: 400, error: problem };
      next.events = next.events.map((item) => (item.id === event.id ? { ...item, name, date: date as string } : item));
      return { ok: true, book: next, eventId: event.id };
    }
    case "delete": {
      const event = find(edit.eventId);
      if (!event) return { ok: false, status: 404, error: "That event isn't here anymore." };
      // Only the grouping goes. Everyone filed here moves back to "not in an event".
      next.events = next.events.filter((item) => item.id !== event.id);
      for (const [connectionId, eventId] of Object.entries(next.filed)) if (eventId === event.id) delete next.filed[connectionId];
      if (next.current?.eventId === event.id) next.current = null;
      if (next.recapHidden) next.recapHidden = next.recapHidden.filter((id) => id !== event.id);
      return { ok: true, book: next };
    }
    case "start": {
      const event = find(edit.eventId);
      if (!event) return { ok: false, status: 404, error: "That event isn't here anymore." };
      next.current = { eventId: event.id, until: currentUntil(now) };
      return { ok: true, book: next, eventId: event.id };
    }
    case "end":
      next.current = null;
      return { ok: true, book: next };
    case "file": {
      const connectionId = typeof edit.connectionId === "string" ? edit.connectionId : "";
      if (!connectionId || !(options.knownConnection?.(connectionId) ?? false)) {
        return { ok: false, status: 404, error: "This connection isn't here anymore." };
      }
      if (edit.eventId === null || edit.eventId === "") {
        delete next.filed[connectionId];
        return { ok: true, book: next };
      }
      const event = find(edit.eventId);
      if (!event) return { ok: false, status: 404, error: "That event isn't here anymore." };
      next.filed[connectionId] = event.id;
      return { ok: true, book: next, eventId: event.id };
    }
    case "restore": {
      // Undo for delete: put the event back with its id, and refile the people who were in it
      // (only connections that are still yours and not filed elsewhere since).
      const raw = edit.event && typeof edit.event === "object" ? (edit.event as Record<string, unknown>) : null;
      const restored = raw ? normalizeEventBook({ events: [raw] })?.events[0] : undefined;
      if (!restored) return { ok: false, status: 400, error: "That event can't come back." };
      if (!find(restored.id)) next.events.push(restored);
      for (const connectionId of Array.isArray(edit.connectionIds) ? edit.connectionIds : []) {
        if (typeof connectionId === "string" && (options.knownConnection?.(connectionId) ?? false) && !next.filed[connectionId]) {
          next.filed[connectionId] = restored.id;
        }
      }
      return { ok: true, book: next, eventId: restored.id };
    }
    case "recap_hide":
    case "recap_show": {
      // v4.1d: hiding the recap card is for good (a later connection never re-shows it); Undo shows it again.
      const event = find(edit.eventId);
      if (!event) return { ok: false, status: 404, error: "That event isn't here anymore." };
      const hidden = new Set(next.recapHidden ?? []);
      if (edit.action === "recap_hide") hidden.add(event.id);
      else hidden.delete(event.id);
      next.recapHidden = [...hidden];
      return { ok: true, book: next, eventId: event.id };
    }
    default:
      return { ok: false, status: 400, error: "Unknown action." };
  }
}

/** File a new connection under the person's current event, if they set one and it hasn't ended. */
export function autoFile(book: EventBook, connectionId: string, now = Date.now()): EventBook | null {
  const current = activeCurrent(book, now);
  if (!current || book.filed[connectionId]) return null;
  return { ...book, filed: { ...book.filed, [connectionId]: current.eventId } };
}
