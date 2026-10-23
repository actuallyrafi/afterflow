// Events: a private way to group the people you met. Each person keeps their own book of
// events; filing someone never touches the other person's book, and nothing here is ranked.

export type EventItem = {
  id: string;
  name: string;
  /** YYYY-MM-DD, the day it happened. */
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
  /** "I'm at an event now": new connections go here until `until` (24h) or until ended. */
  current: CurrentEvent | null;
};

export const EVENT_NAME_MAX = 60;
export const EVENTS_MAX = 60;
export const CURRENT_EVENT_MS = 24 * 60 * 60 * 1000;

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
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function cleanEventName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, EVENT_NAME_MAX);
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
    const name = cleanEventName(e.name);
    if (!id || !name || !isDay(e.date) || events.some((other) => other.id === id)) continue;
    events.push({
      id,
      name,
      date: e.date as string,
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
  return { events, filed, current };
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

/** "Grok Bot London · 22 Oct" */
export function eventLabel(event: Pick<EventItem, "name" | "date">): string {
  return `${event.name} · ${new Date(`${event.date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  })}`;
}

export function sortEvents(events: EventItem[]): EventItem[] {
  return [...events].sort((left, right) => right.date.localeCompare(left.date) || left.name.localeCompare(right.name));
}

export type EventEdit =
  | { action: "create"; name: unknown; date: unknown; startNow?: unknown }
  | { action: "rename"; eventId: unknown; name: unknown; date?: unknown }
  | { action: "delete"; eventId: unknown }
  | { action: "start"; eventId: unknown }
  | { action: "end" }
  | { action: "file"; connectionId: unknown; eventId: unknown };

export type EditResult = { ok: true; book: EventBook; eventId?: string } | { ok: false; status: number; error: string };

/** Pure edits on one person's book. `knownConnection` says whether the id is one of theirs. */
export function applyEventEdit(
  book: EventBook,
  edit: EventEdit,
  options: { now?: number; knownConnection?: (id: string) => boolean; newId?: () => string } = {},
): EditResult {
  const now = options.now ?? Date.now();
  const next: EventBook = { events: [...book.events], filed: { ...book.filed }, current: book.current };
  const find = (id: unknown) => (typeof id === "string" ? next.events.find((event) => event.id === id) : undefined);
  switch (edit.action) {
    case "create": {
      const name = cleanEventName(edit.name);
      if (!name) return { ok: false, status: 400, error: "Give the event a name." };
      if (!isDay(edit.date)) return { ok: false, status: 400, error: "Pick the day it happened." };
      if (next.events.length >= EVENTS_MAX) return { ok: false, status: 400, error: "That's a lot of events. Delete an old one first." };
      const event: EventItem = { id: options.newId?.() ?? globalThis.crypto.randomUUID(), name, date: edit.date as string, createdAt: new Date(now).toISOString() };
      next.events.push(event);
      if (edit.startNow === true) next.current = { eventId: event.id, until: new Date(now + CURRENT_EVENT_MS).toISOString() };
      return { ok: true, book: next, eventId: event.id };
    }
    case "rename": {
      const event = find(edit.eventId);
      if (!event) return { ok: false, status: 404, error: "That event isn't here anymore." };
      const name = cleanEventName(edit.name);
      if (!name) return { ok: false, status: 400, error: "Give the event a name." };
      if (edit.date !== undefined && !isDay(edit.date)) return { ok: false, status: 400, error: "Pick the day it happened." };
      next.events = next.events.map((item) =>
        item.id === event.id ? { ...item, name, ...(edit.date !== undefined ? { date: edit.date as string } : {}) } : item,
      );
      return { ok: true, book: next, eventId: event.id };
    }
    case "delete": {
      const event = find(edit.eventId);
      if (!event) return { ok: false, status: 404, error: "That event isn't here anymore." };
      // Only the grouping goes. Everyone filed here moves back to "not in an event".
      next.events = next.events.filter((item) => item.id !== event.id);
      for (const [connectionId, eventId] of Object.entries(next.filed)) if (eventId === event.id) delete next.filed[connectionId];
      if (next.current?.eventId === event.id) next.current = null;
      return { ok: true, book: next };
    }
    case "start": {
      const event = find(edit.eventId);
      if (!event) return { ok: false, status: 404, error: "That event isn't here anymore." };
      next.current = { eventId: event.id, until: new Date(now + CURRENT_EVENT_MS).toISOString() };
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
