import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cleanEventName, EVENT_NAME_MAX, SEED_CUTOFF, SEED_EVENT } from "./events";
import type { MatchRow, Profile, Store } from "./store";

/*
 * v4.1h (D33, D34): organiser access is per event.
 *
 * - The master code (env ORGANISER_PASSCODE, header x-organiser-passcode) lists events, creates
 *   them and opens any one. There is no default: unset or empty refuses everyone.
 * - Each event has its own organiser key (header x-organiser-key). Only its sha-256 is stored; the
 *   plain key is shown once, in a link fragment (/organiser/{id}#k=…) so it never reaches server logs.
 * - Stats and the delete are always for one event. Nothing can wipe the whole store.
 *
 * Organiser events live in their own records (orgevents/{id} in Blobs), which the live main build
 * never reads or writes, so prod writes to cards and connections can't drop the event links.
 */

const sameLength = (given: Buffer, want: Buffer) => {
  if (given.length !== want.length) {
    timingSafeEqual(want, want);
    return false;
  }
  return timingSafeEqual(given, want);
};

/** The master code. */
export function organiserAuthorised(header: string | null): boolean {
  const expected = process.env.ORGANISER_PASSCODE ?? "";
  if (!expected) return false;
  return sameLength(Buffer.from(header ?? ""), Buffer.from(expected));
}

export type OrganiserEvent = {
  id: string;
  name: string;
  /** YYYY-MM-DD or "". */
  date: string;
  createdAt: string;
  /** sha-256 (hex) of the organiser key; null until a link is made. Never the key itself. */
  keyHash: string | null;
  keyIssuedAt: string | null;
  /** profile id -> when they joined through the event's join link. */
  members: Record<string, string>;
  /** connection id -> when it was made between two members. */
  connections: Record<string, string>;
  /** The Grok Bot London night, which predates organiser events (see eventMembers). */
  legacy?: boolean;
  /** Set once the legacy event's data has been deleted: the before-events rule stops applying. */
  legacyCleared?: boolean;
  dataDeletedAt?: string | null;
};

export type OrganiserStats = {
  /** Headline: private "Talked again" marks across the event, as one total. */
  talkedAgainMarks: number;
  /** Connections where at least one person marked "Talked again". */
  pairsTalkedAgain: number;
  /** Headline: connections both people confirmed. */
  mutualConfirms: number;
  /** Context only. */
  connectionsRequested: number;
  signups: number;
};

export type EventSummary = Pick<OrganiserEvent, "id" | "name" | "date" | "createdAt"> & {
  hasLink: boolean;
  keyIssuedAt: string | null;
  legacy: boolean;
  dataDeletedAt: string | null;
};

/** Built in: the hackathon night. Its id matches the private-books seed event (lib/events.ts). */
export const LEGACY_EVENT_ID = SEED_EVENT.id;

export function legacyEvent(): OrganiserEvent {
  return {
    id: LEGACY_EVENT_ID,
    name: SEED_EVENT.name,
    date: SEED_EVENT.date,
    createdAt: "2026-10-22T17:00:00.000Z",
    keyHash: null,
    keyIssuedAt: null,
    members: {},
    connections: {},
    legacy: true,
  };
}

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
export const isEventId = (value: unknown): value is string => typeof value === "string" && ID_RE.test(value);

export function newEventId(): string {
  return `ev-${randomBytes(9).toString("base64url")}`;
}

/** 32 bytes of randomness, 43 URL-safe characters. */
export function newOrganiserKey(): string {
  return randomBytes(32).toString("base64url");
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

const DUMMY_HASH = hashKey("no-key-has-been-issued");

/** Constant time on the hashes, whatever was given (or whether a key exists at all). */
export function keyMatches(event: Pick<OrganiserEvent, "keyHash"> | null, given: string | null): boolean {
  const want = Buffer.from(event?.keyHash ?? DUMMY_HASH, "hex");
  const got = Buffer.from(hashKey(given ?? ""), "hex");
  const same = sameLength(got, want);
  return Boolean(event?.keyHash) && Boolean(given) && same;
}

function stringMap(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (value && typeof value === "object") {
    for (const [key, at] of Object.entries(value as Record<string, unknown>)) if (typeof at === "string") out[key] = at;
  }
  return out;
}

export function normalizeOrganiserEvent(raw: unknown): OrganiserEvent | null {
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
  if (!isEventId(row.id)) return null;
  const name = cleanEventName(row.name).slice(0, EVENT_NAME_MAX);
  if (!name) return null;
  const date = typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : "";
  return {
    id: row.id,
    name,
    date,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
    keyHash: typeof row.keyHash === "string" && /^[0-9a-f]{64}$/.test(row.keyHash) ? row.keyHash : null,
    keyIssuedAt: typeof row.keyIssuedAt === "string" ? row.keyIssuedAt : null,
    members: stringMap(row.members),
    connections: stringMap(row.connections),
    ...(row.legacy === true || row.id === LEGACY_EVENT_ID ? { legacy: true } : {}),
    ...(row.legacyCleared === true ? { legacyCleared: true } : {}),
    dataDeletedAt: typeof row.dataDeletedAt === "string" ? row.dataDeletedAt : null,
  };
}

export function summary(event: OrganiserEvent): EventSummary {
  return {
    id: event.id,
    name: event.name,
    date: event.date,
    createdAt: event.createdAt,
    hasLink: Boolean(event.keyHash),
    keyIssuedAt: event.keyIssuedAt,
    legacy: Boolean(event.legacy),
    dataDeletedAt: event.dataDeletedAt ?? null,
  };
}

export async function readEvent(store: Store, id: string): Promise<OrganiserEvent | null> {
  if (!isEventId(id)) return null;
  const stored = await store.readOrganiserEvent(id);
  if (stored) return stored;
  return id === LEGACY_EVENT_ID ? legacyEvent() : null;
}

/** Newest first; the built-in Grok Bot London event is always there. */
export async function listEvents(store: Store): Promise<OrganiserEvent[]> {
  const stored = await store.listOrganiserEvents();
  const all = stored.some((event) => event.id === LEGACY_EVENT_ID) ? stored : [...stored, legacyEvent()];
  return all.sort((a, b) => (b.date || "0").localeCompare(a.date || "0") || b.createdAt.localeCompare(a.createdAt));
}

/** Writes through the store's update, starting from the built-in default for the legacy event. */
async function update(store: Store, id: string, mutate: (event: OrganiserEvent) => OrganiserEvent | null) {
  return store.updateOrganiserEvent(id, (current) => {
    const base = current ?? (id === LEGACY_EVENT_ID ? legacyEvent() : null);
    return base ? mutate(base) : null;
  });
}

export type CreateResult = { ok: true; event: OrganiserEvent; key: string } | { ok: false; status: number; error: string };

export async function createEvent(store: Store, input: { name: unknown; date: unknown }, now = Date.now()): Promise<CreateResult> {
  const name = cleanEventName(input.name);
  if (!name) return { ok: false, status: 400, error: "Give the event a name." };
  if (name.length > EVENT_NAME_MAX) return { ok: false, status: 400, error: `Keep it under ${EVENT_NAME_MAX} characters.` };
  const date = input.date == null ? "" : input.date;
  if (typeof date !== "string" || (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))))) {
    return { ok: false, status: 400, error: "Pick the day it happens." };
  }
  const key = newOrganiserKey();
  const at = new Date(now).toISOString();
  const event: OrganiserEvent = {
    id: newEventId(),
    name,
    date,
    createdAt: at,
    keyHash: hashKey(key),
    keyIssuedAt: at,
    members: {},
    connections: {},
    dataDeletedAt: null,
  };
  const saved = await store.updateOrganiserEvent(event.id, (current) => (current ? null : event));
  if (!saved || saved.keyHash !== event.keyHash) return { ok: false, status: 500, error: "Couldn't make the event. Try again." };
  return { ok: true, event: saved, key };
}

/** A new organiser link; the old one stops working at once. */
export async function rotateKey(store: Store, id: string, now = Date.now()): Promise<string | null> {
  const key = newOrganiserKey();
  const saved = await update(store, id, (event) => ({ ...event, keyHash: hashKey(key), keyIssuedAt: new Date(now).toISOString() }));
  return saved ? key : null;
}

export async function joinEvent(store: Store, eventId: string, profileId: string, now = Date.now()): Promise<OrganiserEvent | null> {
  if (!(await readEvent(store, eventId))) return null;
  return update(store, eventId, (event) =>
    event.members[profileId] ? null : { ...event, members: { ...event.members, [profileId]: new Date(now).toISOString() } },
  ).then(async (saved) => saved ?? readEvent(store, eventId));
}

/**
 * A new connection between two people who both joined an event counts for that event. If they
 * share more than one, the one they most recently joined wins (one event per connection).
 */
export async function attributeConnection(store: Store, match: Pick<MatchRow, "id" | "aId" | "bId">, now = Date.now()): Promise<string | null> {
  const events = await store.listOrganiserEvents();
  let best: { id: string; at: string } | null = null;
  for (const event of events) {
    const a = event.members[match.aId];
    const b = event.members[match.bId];
    if (!a || !b) continue;
    if (event.connections[match.id]) return event.id;
    const at = a > b ? a : b;
    if (!best || at > best.at) best = { id: event.id, at };
  }
  if (!best) return null;
  await update(store, best.id, (event) => ({ ...event, connections: { ...event.connections, [match.id]: new Date(now).toISOString() } }));
  return best.id;
}

const before = (iso: string, cutoff: number) => {
  const at = Date.parse(iso);
  return Number.isFinite(at) && at < cutoff;
};

/** Legacy rule: cards and connections made before events shipped (SEED_CUTOFF) were made at Grok Bot London. */
const legacyApplies = (event: OrganiserEvent) => Boolean(event.legacy) && !event.legacyCleared;

export function isMember(event: OrganiserEvent, profile: Pick<Profile, "id" | "createdAt">): boolean {
  return Boolean(event.members[profile.id]) || (legacyApplies(event) && before(profile.createdAt, SEED_CUTOFF));
}

export function eventMembers(event: OrganiserEvent, profiles: Profile[]): Profile[] {
  return profiles.filter((profile) => isMember(event, profile));
}

export function inEvent(event: OrganiserEvent, match: Pick<MatchRow, "id" | "createdAt">, claimed: Set<string>): boolean {
  if (event.connections[match.id]) return true;
  return legacyApplies(event) && !claimed.has(match.id) && before(match.createdAt, SEED_CUTOFF);
}

/** Connection ids claimed by other events, so the legacy rule never double-counts them. */
async function claimedElsewhere(store: Store, eventId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const other of await store.listOrganiserEvents()) if (other.id !== eventId) for (const id of Object.keys(other.connections)) ids.add(id);
  return ids;
}

export function statsFor(event: OrganiserEvent, profiles: Profile[], matches: MatchRow[], claimed = new Set<string>()): OrganiserStats {
  const live = matches.filter((match) => inEvent(event, match, claimed) && match.met && !match.shadow && !match.removedAt && !match.blockedBy);
  let mutualConfirms = 0;
  let talkedAgainMarks = 0;
  let pairsTalkedAgain = 0;
  for (const match of live) {
    if (match.aStatus === "accepted" && match.bStatus === "accepted") mutualConfirms += 1;
    const marks = (match.aFollowUp === "yes" ? 1 : 0) + (match.bFollowUp === "yes" ? 1 : 0);
    talkedAgainMarks += marks;
    if (marks > 0) pairsTalkedAgain += 1;
  }
  return { talkedAgainMarks, pairsTalkedAgain, mutualConfirms, connectionsRequested: live.length, signups: eventMembers(event, profiles).length };
}

/**
 * Aggregate totals for one event's organiser. Never shown to attendees, never per person, never
 * ranked. Removed, blocked and one-sided "shadow" rows don't count.
 */
export async function eventStats(store: Store, eventId: string): Promise<OrganiserStats | null> {
  const event = await readEvent(store, eventId);
  if (!event) return null;
  const [profiles, matches, claimed] = await Promise.all([store.listProfiles(), store.listMatches(), claimedElsewhere(store, eventId)]);
  return statsFor(event, profiles, matches, claimed);
}

export type DeleteResult = { connectionsDeleted: number; cardsDeleted: number; membersRemoved: number };

/**
 * D34 scoped delete. Removes this event's connections (with their private and shared notes,
 * "Talked again" marks and hello records, which all live on the connection) and the event's
 * membership list. A card is deleted only if it belongs to this event alone: the person is in no
 * other organiser event and has no connections left once this event's are gone. Everyone else
 * just leaves the event. The event itself stays (with zero totals) so its links keep working.
 */
export async function deleteEventData(store: Store, eventId: string, now = Date.now()): Promise<DeleteResult | null> {
  const event = await readEvent(store, eventId);
  if (!event) return null;
  const [profiles, matches, others, claimed] = await Promise.all([
    store.listProfiles(),
    store.listMatches(),
    store.listOrganiserEvents().then((all) => all.filter((other) => other.id !== eventId)),
    claimedElsewhere(store, eventId),
  ]);
  const doomed = matches.filter((match) => inEvent(event, match, claimed));
  for (const match of doomed) await store.deleteMatch(match.id);
  const members = eventMembers(event, profiles);
  const legacyOther = others.find((other) => other.id === LEGACY_EVENT_ID) ?? (eventId === LEGACY_EVENT_ID ? null : legacyEvent());
  let cardsDeleted = 0;
  for (const profile of members) {
    const elsewhere = others.some((other) => other.members[profile.id]) || (legacyOther ? isMember(legacyOther, profile) : false);
    if (elsewhere) continue;
    if ((await store.listMatchesFor(profile.id)).length > 0) continue;
    await store.deleteProfile(profile.id);
    cardsDeleted += 1;
  }
  await update(store, eventId, (current) => ({
    ...current,
    members: {},
    connections: {},
    ...(current.legacy ? { legacyCleared: true } : {}),
    dataDeletedAt: new Date(now).toISOString(),
  }));
  return { connectionsDeleted: doomed.length, cardsDeleted, membersRemoved: members.length };
}

/**
 * Best-effort brake on guessing: after 10 refused tries from one address in 10 minutes, answer 429
 * for the rest of the window. Per function instance (serverless), so it slows guessing rather than
 * stopping it; the keys themselves (256 bits) are what make guessing pointless.
 */
const FAIL_WINDOW_MS = 10 * 60 * 1000;
const FAIL_LIMIT = 10;
const failures = new Map<string, { count: number; until: number }>();

export function clientAddress(request: Request): string {
  return (
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

export function throttled(address: string, now = Date.now()): boolean {
  const entry = failures.get(address);
  if (!entry || entry.until <= now) return false;
  return entry.count >= FAIL_LIMIT;
}

export function noteFailure(address: string, now = Date.now()) {
  const entry = failures.get(address);
  if (!entry || entry.until <= now) failures.set(address, { count: 1, until: now + FAIL_WINDOW_MS });
  else entry.count += 1;
  if (failures.size > 5000) failures.clear();
}

export function resetThrottle() {
  failures.clear();
}

/** Response headers for everything organiser: never cached, never indexed. */
export const ORGANISER_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
} as const;

export const NOT_ALLOWED = "That link or code doesn't work.";
