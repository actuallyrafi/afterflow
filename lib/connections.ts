import { REMINDER_DELAY_MS } from "./event";
import {
  activeCurrent,
  applyEventEdit,
  autoFile,
  eventLabel,
  seededBook,
  sortEvents,
  type EventBook,
  type EventEdit,
  type EventItem,
} from "./events";
import { firstOf } from "./handoff";
import { nameMatches } from "./name-match";
import { parseContact, validateSubmission, type Channel } from "./survey";
import type { BlockRecord, MatchPatch, MatchRow, Profile, Store } from "./store";

/** Undo stays possible this long after Remove or Block; then the connection record is deleted. */
export const PURGE_AFTER_MS = 60_000;
const NOTE_MAX = 180;
const SHARED_NOTE_MAX = 280;

export type ConnectionStatus = "waiting_for_them" | "waiting_for_you" | "connected";

export type PersonCard = { publicId: string; name: string; answer: string; isDemo: boolean };

export type ConnectionCard = {
  id: string;
  status: ConnectionStatus;
  mutual: boolean;
  /** Only you see this. */
  muted: boolean;
  /** Private "Talked again?" mark. Only you see this. */
  talkedAgain: boolean;
  talkedAgainAt: string | null;
  /** Your private note. */
  myNote: string;
  /** Both people see this, once you've both said yes. */
  sharedNote: string;
  myAnswer: string;
  metAt: string;
  /** The event you filed them under. Yours only; their filing of you is theirs. */
  eventId: string | null;
  other: {
    name: string;
    publicId: string;
    isDemo: boolean;
    answer: string;
    /** Only after both say yes. Their preferred contact. */
    contact?: string;
    /** Only after both say yes. Every way to reach them, preferred first. */
    contacts?: string[];
  };
};

/** At most three, the most recent people. Never a number: nothing here can rank or reveal size. */
export type EventMark = { name: string; seed: string };
export const MARKS_MAX = 3;

export type EventSummary = {
  id: string;
  name: string;
  /** YYYY-MM-DD or "" (no date). */
  date: string;
  /** "Grok Bot London · 22 Oct" */
  label: string;
  marks: EventMark[];
  /** Nobody filed here yet. */
  empty: boolean;
  seeded: boolean;
};

export type EventsView = {
  events: EventSummary[];
  /** People not in any event ("No event"). */
  unfiled: { marks: EventMark[]; empty: boolean };
  current: { eventId: string; until: string; label: string; name: string } | null;
};

export type HomeResult = {
  profile: {
    name: string;
    publicId: string;
    isDemo: boolean;
    answer: string;
    contact: string;
    contacts: string[];
    channel: Channel;
    reminders: boolean;
  };
  connections: ConnectionCard[];
  events: EventsView;
  /** At most one gentle reminder, only if you turned it on. */
  reminder: { connectionId: string; name: string } | null;
};

type Result<T> = { status: number; body: T | { error: string } };

const GONE = "This connection isn't here anymore.";

function cleanLine(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function sideOf(match: MatchRow, myId: string): "a" | "b" {
  return match.aId === myId ? "a" : "b";
}

function otherIdOf(match: MatchRow, myId: string): string {
  return match.aId === myId ? match.bId : match.aId;
}

function blockedBetween(blocks: BlockRecord[], blockerId: string, blockedId: string): boolean {
  return blocks.some((block) => block.blockerId === blockerId && block.blockedId === blockedId);
}

function stale(at: string | null, now: number): boolean {
  return Boolean(at) && now - Date.parse(at as string) > PURGE_AFTER_MS;
}

/** Remove/Block keep the record only for Undo; a declined or orphaned shadow is also cleared. */
function shouldPurge(match: MatchRow, blocks: BlockRecord[], now: number): boolean {
  if (match.removedAt && stale(match.removedAt, now)) return true;
  if (match.blockedAt && stale(match.blockedAt, now)) return true;
  if (match.shadow) {
    const requester = match.aStatus === "accepted" ? match.aId : match.bId;
    const target = requester === match.aId ? match.bId : match.aId;
    if (!blockedBetween(blocks, target, requester)) return true;
  }
  return false;
}

/**
 * Who sees what. A blocker never sees the pair again. The blocked person sees nothing that
 * reveals the block: their old row is simply gone, and a new request just stays "waiting".
 */
function visibleTo(match: MatchRow, meId: string, blocks: BlockRecord[]): boolean {
  if (!match.met) return false;
  if (match.removedAt || match.blockedBy) return false;
  if (match.aStatus === "declined" || match.bStatus === "declined") return false;
  const otherId = otherIdOf(match, meId);
  if (blockedBetween(blocks, meId, otherId)) return false;
  if (blockedBetween(blocks, otherId, meId)) return match.shadow;
  return !match.shadow;
}

function toCard(match: MatchRow, me: Profile, other: Profile, book?: EventBook): ConnectionCard {
  const side = sideOf(match, me.id);
  const mine = side === "a" ? match.aStatus : match.bStatus;
  const theirs = side === "a" ? match.bStatus : match.aStatus;
  const mutual = !match.shadow && mine === "accepted" && theirs === "accepted";
  const status: ConnectionStatus = mutual
    ? "connected"
    : match.shadow || mine === "accepted"
      ? "waiting_for_them"
      : "waiting_for_you";
  const follow = side === "a" ? match.aFollowUp : match.bFollowUp;
  return {
    id: match.id,
    status,
    mutual,
    muted: side === "a" ? match.aMuted : match.bMuted,
    talkedAgain: follow === "yes",
    talkedAgainAt: follow === "yes" ? (side === "a" ? match.aFollowUpAt : match.bFollowUpAt) : null,
    myNote: side === "a" ? match.aNote : match.bNote,
    sharedNote: mutual ? match.sharedNote : "",
    myAnswer: me.answer,
    metAt: match.createdAt,
    eventId: book?.filed[match.id] ?? null,
    other: {
      name: other.name,
      publicId: other.publicId,
      isDemo: other.isDemo,
      answer: other.answer,
      ...(mutual ? { contact: other.contact, contacts: other.contacts } : {}),
    },
  };
}

function ownProfile(me: Profile): HomeResult["profile"] {
  return {
    name: me.name,
    publicId: me.publicId,
    isDemo: me.isDemo,
    answer: me.answer,
    contact: me.contact,
    contacts: me.contacts,
    channel: parseContact(me.contact).channel,
    reminders: me.reminders,
  };
}

/** This person's book, or (lazily, without writing anything) the seeded one for older cards. */
async function loadBook(store: Store, me: Profile, matches?: MatchRow[]): Promise<EventBook> {
  const stored = await store.readEventBook(me.id);
  if (stored) return stored;
  return seededBook(me, matches ?? (await store.listMatchesFor(me.id)));
}

/** Read-modify-write on my own book; the first write materialises the seeded book. */
async function editBook(store: Store, me: Profile, mutate: (book: EventBook) => EventBook | null): Promise<EventBook> {
  const matches = await store.listMatchesFor(me.id);
  const saved = await store.updateEventBook(me.id, (current) => mutate(current ?? seededBook(me, matches)));
  return saved ?? seededBook(me, matches);
}

/** Filed automatically only while that person said "I'm at an event now". */
async function fileUnderCurrent(store: Store, profile: Profile, connectionId: string, now = Date.now()) {
  const book = await store.readEventBook(profile.id);
  if (!book || !activeCurrent(book, now)) return;
  await store.updateEventBook(profile.id, (current) => (current ? autoFile(current, connectionId, now) : null));
}

async function fileChoice(store: Store, me: Profile, connectionId: string, eventId: string) {
  await editBook(store, me, (book) => {
    if (eventId && !book.events.some((event) => event.id === eventId)) return null;
    const filed = { ...book.filed };
    if (eventId) filed[connectionId] = eventId;
    else delete filed[connectionId];
    return { ...book, filed };
  });
}

function eventsView(book: EventBook, cards: ConnectionCard[], now: number): EventsView {
  const recent = [...cards].sort((left, right) => right.metAt.localeCompare(left.metAt));
  const marksFor = (eventId: string | null) => {
    const inIt = recent.filter((card) => (book.filed[card.id] ?? null) === eventId);
    return {
      marks: inIt.slice(0, MARKS_MAX).map((card) => ({ name: card.other.name, seed: card.other.publicId })),
      empty: inIt.length === 0,
    };
  };
  const current = activeCurrent(book, now);
  const currentEvent = current ? book.events.find((event) => event.id === current.eventId) : undefined;
  return {
    events: sortEvents(book.events).map((event) => ({
      id: event.id,
      name: event.name,
      date: event.date,
      label: eventLabel(event),
      ...marksFor(event.id),
      seeded: Boolean(event.seeded),
    })),
    unfiled: marksFor(null),
    current: current && currentEvent ? { ...current, label: eventLabel(currentEvent), name: currentEvent.name } : null,
  };
}

async function visibleCards(store: Store, me: Profile, now: number, book?: EventBook) {
  const blocks = await store.listBlocksFor(me.id);
  const rows: { match: MatchRow; card: ConnectionCard }[] = [];
  const matches = await store.listMatchesFor(me.id);
  const filing = book ?? (await loadBook(store, me, matches));
  for (const match of matches) {
    if (shouldPurge(match, blocks, now)) {
      await store.deleteMatch(match.id);
      continue;
    }
    if (!visibleTo(match, me.id, blocks)) continue;
    const other = await store.getProfileById(otherIdOf(match, me.id));
    if (!other) continue;
    rows.push({ match, card: toCard(match, me, other, filing) });
  }
  rows.sort((left, right) => left.card.other.name.localeCompare(right.card.other.name));
  return { rows, book: filing };
}

export async function listHome(store: Store, token: string, options: { now?: number } = {}): Promise<HomeResult | null> {
  const now = options.now ?? Date.now();
  const me = await store.getProfileByToken(token);
  if (!me) return null;
  const { rows, book } = await visibleCards(store, me, now);
  let reminder: HomeResult["reminder"] = null;
  if (me.reminders) {
    const due = rows.find(({ match, card }) => {
      const done = sideOf(match, me.id) === "a" ? match.aReminderDone : match.bReminderDone;
      return card.mutual && !card.muted && !done && now - Date.parse(match.createdAt) >= REMINDER_DELAY_MS;
    });
    if (due) {
      // Served once, then never again for this person: no nagging, no streaks.
      const field = sideOf(due.match, me.id) === "a" ? "aReminderDone" : "bReminderDone";
      await store.patchMatch(due.match.id, { [field]: true });
      reminder = { connectionId: due.card.id, name: firstOf(due.card.other.name) };
    }
  }
  const connections = rows.map((row) => row.card);
  return { profile: ownProfile(me), connections, events: eventsView(book, connections, now), reminder };
}

export async function listEvents(store: Store, token: string, options: { now?: number } = {}): Promise<EventsView | null> {
  const now = options.now ?? Date.now();
  const me = await store.getProfileByToken(token);
  if (!me) return null;
  const { rows, book } = await visibleCards(store, me, now);
  return eventsView(book, rows.map((row) => row.card), now);
}

/** Create, rename, delete, start/end "I'm at an event now", and file a connection. Only ever my own book. */
export async function editEvents(
  store: Store,
  token: string,
  body: unknown,
  options: { now?: number } = {},
): Promise<Result<EventsView & EventEditExtras>> {
  const now = options.now ?? Date.now();
  const me = await store.getProfileByToken(token);
  if (!me) return { status: 404, body: { error: "This card isn't available." } };
  const edit = (body && typeof body === "object" ? body : {}) as EventEdit;
  const extras: EventEditExtras = {};
  let known = new Set<string>();
  if (edit.action === "file" || edit.action === "restore") {
    const { rows } = await visibleCards(store, me, now);
    known = new Set(rows.map((row) => row.card.id));
  }
  let failure: { status: number; error: string } | null = null;
  let eventId: string | undefined;
  await editBook(store, me, (book) => {
    // What Undo needs, from the book as it was. Only ever this person's own data.
    if (edit.action === "delete") {
      const gone = book.events.find((event) => event.id === edit.eventId);
      extras.deleted = gone
        ? { event: gone, connectionIds: Object.keys(book.filed).filter((id) => book.filed[id] === gone.id) }
        : undefined;
    }
    if (edit.action === "file" && typeof edit.connectionId === "string") extras.previous = book.filed[edit.connectionId] ?? "";
    const result = applyEventEdit(book, edit, { now, knownConnection: (id) => known.has(id) });
    if (!result.ok) {
      failure = { status: result.status, error: result.error };
      return null;
    }
    eventId = result.eventId;
    return result.book;
  });
  if (failure) {
    const { status, error } = failure as { status: number; error: string };
    return { status, body: { error } };
  }
  const view = await listEvents(store, token, { now });
  if (!view) return { status: 404, body: { error: "This card isn't available." } };
  return { status: 200, body: { ...view, ...(eventId ? { eventId } : {}), ...extras } };
}

export type EventEditExtras = {
  eventId?: string;
  /** After delete: the event and who was in it, so Undo can put it back. */
  deleted?: { event: EventItem; connectionIds: string[] };
  /** After file: where the person was before ("" = No event), for Undo. */
  previous?: string;
};

export async function publicCard(store: Store, publicId: string): Promise<PersonCard | null> {
  const profile = await store.getProfileByPublicId(publicId);
  if (!profile) return null;
  return { publicId: profile.publicId, name: profile.name, answer: profile.answer, isDemo: profile.isDemo };
}

export async function searchPeople(store: Store, token: string, query: unknown): Promise<PersonCard[] | null> {
  const me = await store.getProfileByToken(token);
  if (!me) return null;
  const q = cleanLine(query, 80).toLowerCase();
  if (q.length < 2) return [];
  const blocks = await store.listBlocksFor(me.id);
  const hidden = new Set(blocks.flatMap((block) => [block.blockerId, block.blockedId]));
  const profiles = await store.listProfiles();
  return profiles
    .filter((profile) => profile.id !== me.id && !hidden.has(profile.id) && profile.name.toLowerCase().includes(q))
    .slice(0, 8)
    .map((profile) => ({ publicId: profile.publicId, name: profile.name, answer: profile.answer, isDemo: profile.isDemo }));
}

async function pairMatch(store: Store, me: Profile, otherId: string): Promise<MatchRow | null> {
  return (await store.listMatchesFor(me.id)).find((match) => otherIdOf(match, me.id) === otherId) ?? null;
}

export async function addMet(
  store: Store,
  token: string,
  publicId: unknown,
  noteInput: unknown,
  /** From meet confirm's [Change]: file under this event (or "" for No event) instead of the current one. */
  eventChoice?: unknown,
): Promise<Result<{ connection: ConnectionCard }>> {
  const me = await store.getProfileByToken(token);
  if (!me) return { status: 404, body: { error: "This card isn't available." } };
  const id = cleanLine(publicId, 80);
  const other = id ? await store.getProfileByPublicId(id) : null;
  if (!other) return { status: 404, body: { error: "This card isn't available." } };
  if (other.id === me.id) return { status: 400, body: { error: "That's your own card." } };
  const note = cleanLine(noteInput, NOTE_MAX);
  const blocks = await store.listBlocksFor(me.id);
  const meIsA = me.id < other.id;

  if (blockedBetween(blocks, me.id, other.id)) {
    return {
      status: 409,
      body: { error: `You blocked ${firstOf(other.name)}. You can unblock them in Your people › Blocked.` },
    };
  }

  let existing = await pairMatch(store, me, other.id);
  const theyBlockedMe = blockedBetween(blocks, other.id, me.id);

  if (theyBlockedMe) {
    // Dropped server-side, but it looks like any request that hasn't been answered yet.
    if (existing && !existing.shadow) {
      await store.deleteMatch(existing.id);
      existing = null;
    }
    const shadow =
      existing ??
      (await store.createMatch({
        aId: me.id,
        bId: other.id,
        met: true,
        shadow: true,
        aStatus: meIsA ? "accepted" : "pending",
        bStatus: meIsA ? "pending" : "accepted",
        aNote: meIsA ? note : "",
        bNote: meIsA ? "" : note,
      }));
    // Filed for the requester like any request, so nothing about it looks different.
    await fileUnderCurrent(store, me, shadow.id);
    return { status: 200, body: { connection: toCard(shadow, me, other, await loadBook(store, me)) } };
  }

  // A removed, declined or leftover connection starts again as a fresh request.
  if (
    existing &&
    (existing.removedAt || existing.blockedBy || existing.shadow || existing.aStatus === "declined" || existing.bStatus === "declined")
  ) {
    await store.deleteMatch(existing.id);
    existing = null;
  }

  const created = !existing;
  let match =
    existing ??
    (await store.createMatch({
      aId: me.id,
      bId: other.id,
      met: true,
      aStatus: meIsA ? "accepted" : "pending",
      bStatus: meIsA ? "pending" : "accepted",
      aNote: meIsA ? note : "",
      bNote: meIsA ? "" : note,
    }));
  const side = sideOf(match, me.id);
  const patch: MatchPatch = { met: true };
  if ((side === "a" ? match.aStatus : match.bStatus) !== "accepted") patch[side === "a" ? "aStatus" : "bStatus"] = "accepted";
  if (note) patch[side === "a" ? "aNote" : "bNote"] = note;
  match = (await store.patchMatch(match.id, patch)) ?? match;
  // "I'm at an event now": each side's own current event files this new connection for them.
  if (typeof eventChoice === "string") await fileChoice(store, me, match.id, eventChoice);
  else await fileUnderCurrent(store, me, match.id);
  if (created) await fileUnderCurrent(store, other, match.id);
  return { status: 200, body: { connection: toCard(match, me, other, await loadBook(store, me)) } };
}

export type ActionBody = { action?: unknown; text?: unknown };

export async function getConnection(
  store: Store,
  token: string,
  matchId: string,
): Promise<
  Result<{
    connection: ConnectionCard;
    me: { name: string; isDemo: boolean; contacts: string[]; reminders: boolean };
    events: EventsView;
  }>
> {
  const me = await store.getProfileByToken(token);
  if (!me) return { status: 404, body: { error: "This card isn't available." } };
  const match = await store.getMatchById(matchId);
  if (!match || (match.aId !== me.id && match.bId !== me.id)) return { status: 404, body: { error: GONE } };
  const blocks = await store.listBlocksFor(me.id);
  if (!visibleTo(match, me.id, blocks)) return { status: 404, body: { error: GONE } };
  const other = await store.getProfileById(otherIdOf(match, me.id));
  if (!other) return { status: 404, body: { error: GONE } };
  const { rows, book } = await visibleCards(store, me, Date.now());
  return {
    status: 200,
    body: {
      connection: toCard(match, me, other, book),
      me: { name: me.name, isDemo: me.isDemo, contacts: me.contacts, reminders: me.reminders },
      events: eventsView(book, rows.map((row) => row.card), Date.now()),
    },
  };
}

export async function actOnConnection(
  store: Store,
  token: string,
  matchId: string,
  body: ActionBody,
): Promise<
  Result<{ connection: ConnectionCard } | { declined: true } | { removed: true } | { blocked: true }>
> {
  const me = await store.getProfileByToken(token);
  if (!me) return { status: 404, body: { error: "This card isn't available." } };
  const match = await store.getMatchById(matchId);
  if (!match || (match.aId !== me.id && match.bId !== me.id)) return { status: 404, body: { error: GONE } };
  const other = await store.getProfileById(otherIdOf(match, me.id));
  if (!other) return { status: 404, body: { error: GONE } };
  const action = typeof body.action === "string" ? body.action : "";
  const side = sideOf(match, me.id);
  const blocks = await store.listBlocksFor(me.id);
  const book = await loadBook(store, me);
  const card = (row: MatchRow | null) =>
    row ? { status: 200, body: { connection: toCard(row, me, other, book) } } : { status: 404, body: { error: GONE } };

  // Undo is only for the person who removed or blocked, and only while the record still exists.
  if (action === "undo_remove") {
    if (match.removedBy !== me.id) return { status: 404, body: { error: GONE } };
    return card(await store.patchMatch(match.id, { removedBy: null, removedAt: null }));
  }
  if (action === "undo_block") {
    if (match.blockedBy !== me.id) return { status: 404, body: { error: GONE } };
    await store.removeBlock(me.id, other.id);
    return card(await store.patchMatch(match.id, { blockedBy: null, blockedAt: null }));
  }

  if (!visibleTo(match, me.id, blocks)) return { status: 404, body: { error: GONE } };
  const mutual = !match.shadow && match.aStatus === "accepted" && match.bStatus === "accepted";
  const mine = <K extends "Status" | "Muted" | "Note" | "FollowUp" | "FollowUpAt" | "ReminderDone">(key: K) =>
    `${side}${key}` as `a${K}` | `b${K}`;

  switch (action) {
    case "confirm": {
      if (match.shadow) return card(match);
      const confirmed = await store.patchMatch(match.id, { [mine("Status")]: "accepted", met: true });
      if (confirmed) {
        await fileUnderCurrent(store, me, match.id);
        const filed = await store.readEventBook(me.id);
        if (filed) book.filed = filed.filed;
      }
      return card(confirmed);
    }
    case "decline": {
      const updated = await store.patchMatch(match.id, { [mine("Status")]: "declined" });
      if (!updated) return { status: 404, body: { error: GONE } };
      return { status: 200, body: { declined: true } };
    }
    case "simulate_demo_confirm": {
      if (!other.isDemo) return { status: 400, body: { error: "That person has to say yes themselves." } };
      const theirs = side === "a" ? "bStatus" : "aStatus";
      return card(await store.patchMatch(match.id, { [theirs]: "accepted", met: true }));
    }
    case "mute":
    case "unmute":
      return card(await store.patchMatch(match.id, { [mine("Muted")]: action === "mute" }));
    case "remove": {
      const updated = await store.patchMatch(match.id, { removedBy: me.id, removedAt: new Date().toISOString() });
      if (!updated) return { status: 404, body: { error: GONE } };
      return { status: 200, body: { removed: true } };
    }
    case "block": {
      await store.addBlock(me.id, other.id);
      const updated = await store.patchMatch(match.id, { blockedBy: me.id, blockedAt: new Date().toISOString() });
      if (!updated) return { status: 404, body: { error: GONE } };
      return { status: 200, body: { blocked: true } };
    }
    case "talked_again":
    case "talked_again_undo": {
      if (!mutual) return { status: 400, body: { error: "That opens once you've both said yes." } };
      const on = action === "talked_again";
      return card(
        await store.patchMatch(match.id, {
          [mine("FollowUp")]: on ? "yes" : null,
          [mine("FollowUpAt")]: on ? new Date().toISOString() : null,
        }),
      );
    }
    case "my_note":
      return card(await store.patchMatch(match.id, { [mine("Note")]: cleanLine(body.text, NOTE_MAX) }));
    case "shared_note": {
      if (!mutual) return { status: 400, body: { error: "The shared note opens once you've both said yes." } };
      return card(
        await store.patchMatch(match.id, {
          sharedNote: cleanLine(body.text, SHARED_NOTE_MAX),
          sharedNoteAt: new Date().toISOString(),
        }),
      );
    }
    case "reminder_done":
      return card(await store.patchMatch(match.id, { [mine("ReminderDone")]: true }));
    default:
      return { status: 400, body: { error: "Unknown action." } };
  }
}

export type BlockedPerson = { publicId: string; name: string; isDemo: boolean; blockedAt: string };

export async function listBlocked(store: Store, token: string): Promise<BlockedPerson[] | null> {
  const me = await store.getProfileByToken(token);
  if (!me) return null;
  const mine = (await store.listBlocksFor(me.id)).filter((block) => block.blockerId === me.id);
  const people: BlockedPerson[] = [];
  for (const block of mine) {
    const other = await store.getProfileById(block.blockedId);
    if (other) people.push({ publicId: other.publicId, name: other.name, isDemo: other.isDemo, blockedAt: block.createdAt });
  }
  return people.sort((left, right) => left.name.localeCompare(right.name));
}

/** Unblocking doesn't reconnect: anything left between the pair is cleared. */
export async function unblock(store: Store, token: string, publicId: unknown): Promise<Result<{ unblocked: true }>> {
  const me = await store.getProfileByToken(token);
  if (!me) return { status: 404, body: { error: "This card isn't available." } };
  const other = await store.getProfileByPublicId(cleanLine(publicId, 80));
  if (!other) return { status: 404, body: { error: "No one with that link." } };
  await store.removeBlock(me.id, other.id);
  for (const match of await store.listMatchesFor(me.id)) {
    if (otherIdOf(match, me.id) === other.id) await store.deleteMatch(match.id);
  }
  return { status: 200, body: { unblocked: true } };
}

export async function updateCard(
  store: Store,
  token: string,
  body: unknown,
): Promise<Result<{ profile: HomeResult["profile"] }>> {
  const me = await store.getProfileByToken(token);
  if (!me) return { status: 404, body: { error: "This card isn't available." } };
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (Object.keys(raw).length === 1 && typeof raw.reminders === "boolean") {
    const updated = await store.updateProfile(me.id, { reminders: raw.reminders });
    return updated ? { status: 200, body: { profile: ownProfile(updated) } } : { status: 404, body: { error: "This card isn't available." } };
  }
  // My card › Ways to reach me: star, remove, reorder or add without touching name or answer.
  if (Array.isArray(raw.contacts) && Object.keys(raw).every((key) => key === "contacts" || key === "preferred")) {
    const parsed = validateSubmission({ ...raw, name: me.name, answer: me.answer || "..." }, { requireConsent: false });
    if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
    const updated = await store.updateProfile(me.id, { contacts: parsed.value.contacts });
    return updated ? { status: 200, body: { profile: ownProfile(updated) } } : { status: 404, body: { error: "This card isn't available." } };
  }
  const parsed = validateSubmission(raw, { requireConsent: false });
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
  const updated = await store.updateProfile(me.id, parsed.value);
  return updated ? { status: 200, body: { profile: ownProfile(updated) } } : { status: 404, body: { error: "This card isn't available." } };
}

/** Delete my card: profile, token, public id, connections and blocks. Nobody is told. */
export async function deleteCard(store: Store, token: string, confirmName: unknown): Promise<Result<{ deleted: true }>> {
  const me = await store.getProfileByToken(token);
  if (!me) return { status: 404, body: { error: "This card isn't available." } };
  if (!nameMatches(confirmName, me.name)) return { status: 400, body: { error: "That doesn't match your name yet." } };
  await store.deleteProfile(me.id);
  return { status: 200, body: { deleted: true } };
}

