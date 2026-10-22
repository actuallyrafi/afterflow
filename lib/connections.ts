import eventContextJson from "../event-context.json";
import { mutualReason } from "./evidence";
import { scoreMatch } from "./matching";
import { pickNextStep, type EventContext } from "./next-step";
import type { FollowUp, MatchRow, MatchTextField, Profile, Store } from "./store";

const eventContext = eventContextJson as EventContext;

export type ConnectionStatus = "waiting_for_them" | "waiting_for_you" | "connected" | "followed_up";

export type PersonCard = {
  publicId: string;
  name: string;
  role: string;
  isDemo: boolean;
};

export type Journey = {
  recap: string[];
  why: string;
  communityStep: string;
  opener: string;
  myLink: string;
  theirLink: string;
  myTime: string;
  theirTime: string;
};

export type ConnectionCard = {
  id: string;
  status: ConnectionStatus;
  statusLabel: string;
  mutual: boolean;
  myFollowUp: FollowUp;
  myFollowUpAt: string | null;
  myNote: string;
  theirNote: string;
  other: {
    name: string;
    role: string;
    publicId: string;
    isDemo: boolean;
    contact?: string;
    linkedin?: string;
  };
  journey: Journey | null;
};

export type HomeResult = {
  profile: { name: string; role: string; publicId: string; isDemo: boolean };
  connections: ConnectionCard[];
};

function cleanLine(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function cleanLink(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const text = cleanLine(value, 300);
  if (!text) return { ok: true, value: "" };
  if (text.includes(" ")) return { ok: false, error: "That link has a space in it." };
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, error: "Use an http or https link." };
    }
    if (!url.hostname.includes(".")) return { ok: false, error: "That link needs a host." };
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false, error: "That does not look like a link." };
  }
}

function sideOf(match: MatchRow, myId: string): "a" | "b" {
  return match.aId === myId ? "a" : "b";
}

function statusFor(mine: string, theirs: string, follow: FollowUp): { status: ConnectionStatus; statusLabel: string } {
  if (mine === "accepted" && theirs === "accepted") {
    if (follow === "yes") return { status: "followed_up", statusLabel: "Followed up" };
    return { status: "connected", statusLabel: "Connected" };
  }
  if (mine === "accepted") return { status: "waiting_for_them", statusLabel: "Waiting for them" };
  return { status: "waiting_for_you", statusLabel: "Needs my confirm" };
}

function first(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

/** First names, unless both people share one; then full names keep the quotes unambiguous. */
function namesFor(me: Profile, them: Profile): { mine: string; theirs: string } {
  const mine = first(me.name);
  const theirs = first(them.name);
  if (mine.toLowerCase() === theirs.toLowerCase()) return { mine: me.name, theirs: them.name };
  return { mine, theirs };
}

function roleLine(name: string, role: string): string {
  const text = role.trim().replace(/[.\s]+$/, "");
  if (!text) return "";
  // Lower-case only an ordinary capitalised word ("Product designer"), never an acronym ("ML engineer").
  const softened = /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
  const article = /^[aeiou]/i.test(softened) ? "an" : "a";
  return `${name} is ${article} ${softened}.`;
}

function looksLikeEmail(contact: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim());
}

/** The note as the writer typed it, without trailing punctuation so it reads inside a sentence. */
function noteForSentence(note: string): string {
  return note.trim().replace(/[\s.!?,;:]+$/, "");
}

function opener(me: Profile, them: Profile, myNote: string, theirNote: string): string {
  const names = namesFor(me, them);
  const greeting = `Hi ${first(them.name)}, it's ${names.mine} from the Grok hackathon.`;
  const note = noteForSentence(myNote) || noteForSentence(theirNote);
  const middle = note ? ` Still thinking about ${note}.` : " Really glad we met.";
  const where = looksLikeEmail(them.contact) ? "over email" : "on Discord";
  return `${greeting}${middle} Want to keep going ${where}?`;
}

/**
 * The recap only quotes what people wrote: one quote per person, then the notes.
 * Each line is a separate sentence so nothing is repeated.
 */
function quoted(text: string): string {
  const value = text.trim();
  return /[.!?]$/.test(value) ? `"${value}"` : `"${value}".`;
}

function recapLines(me: Profile, other: Profile, myNote: string, theirNote: string): string[] {
  const names = namesFor(me, other);
  const lines: string[] = [];
  const role = roleLine(names.theirs, other.role);
  if (role) lines.push(role);
  if (me.isDemo) lines.push(`${me.name} is a demo profile.`);
  if (other.isDemo) lines.push(`${other.name} is a demo profile.`);
  lines.push(`${names.theirs} wrote ${quoted(other.tryingTo)}`);
  lines.push(`You wrote ${quoted(me.tryingTo)}`);
  const mine = myNote.trim();
  const theirs = theirNote.trim();
  if (mine && theirs && mine.toLowerCase() === theirs.toLowerCase()) {
    lines.push(`You both noted ${quoted(mine)}`);
  } else {
    if (mine) lines.push(`You noted ${quoted(mine)}`);
    if (theirs) lines.push(`${names.theirs} noted ${quoted(theirs)}`);
  }
  return lines;
}

function toCard(match: MatchRow, me: Profile, other: Profile): ConnectionCard {
  const side = sideOf(match, me.id);
  const mine = side === "a" ? match.aStatus : match.bStatus;
  const theirs = side === "a" ? match.bStatus : match.aStatus;
  const myNote = side === "a" ? match.aNote : match.bNote;
  const theirNote = side === "a" ? match.bNote : match.aNote;
  const follow = side === "a" ? match.aFollowUp : match.bFollowUp;
  const followAt = side === "a" ? match.aFollowUpAt : match.bFollowUpAt;
  const mutual = mine === "accepted" && theirs === "accepted";
  const { status, statusLabel } = statusFor(mine, theirs, follow);
  const myLink = side === "a" ? match.aLink : match.bLink;
  const theirLink = side === "a" ? match.bLink : match.aLink;
  const myTime = side === "a" ? match.aTime : match.bTime;
  const theirTime = side === "a" ? match.bTime : match.aTime;
  const journey: Journey | null = mutual
    ? {
        recap: recapLines(me, other, myNote, theirNote),
        why: mutualReason(me, other),
        communityStep: match.firstAction,
        opener: opener(me, other, myNote, theirNote),
        myLink,
        theirLink,
        myTime,
        theirTime,
      }
    : null;
  return {
    id: match.id,
    status,
    statusLabel,
    mutual,
    myFollowUp: follow,
    myFollowUpAt: followAt,
    myNote,
    theirNote,
    other: {
      name: other.name,
      role: other.role,
      publicId: other.publicId,
      isDemo: other.isDemo,
      ...(mutual
        ? { contact: other.contact, ...(other.linkedin ? { linkedin: other.linkedin } : {}) }
        : {}),
    },
    journey,
  };
}

async function cardFor(store: Store, match: MatchRow, me: Profile): Promise<ConnectionCard | null> {
  const otherId = match.aId === me.id ? match.bId : match.aId;
  const other = await store.getProfileById(otherId);
  if (!other) return null;
  return toCard(match, me, other);
}

export async function listHome(store: Store, token: string): Promise<HomeResult | null> {
  const me = await store.getProfileByToken(token);
  if (!me) return null;
  const matches = (await store.listMatchesFor(me.id)).filter(
    (match) => match.met && match.aStatus !== "declined" && match.bStatus !== "declined",
  );
  const connections: ConnectionCard[] = [];
  for (const match of matches) {
    const card = await cardFor(store, match, me);
    if (card) connections.push(card);
  }
  connections.sort((left, right) => left.other.name.localeCompare(right.other.name));
  return {
    profile: { name: me.name, role: me.role, publicId: me.publicId, isDemo: me.isDemo },
    connections,
  };
}

export async function publicCard(store: Store, publicId: string): Promise<PersonCard | null> {
  const profile = await store.getProfileByPublicId(publicId);
  if (!profile) return null;
  return { publicId: profile.publicId, name: profile.name, role: profile.role, isDemo: profile.isDemo };
}

export async function searchPeople(store: Store, token: string, query: unknown): Promise<PersonCard[] | null> {
  const me = await store.getProfileByToken(token);
  if (!me) return null;
  const q = cleanLine(query, 80).toLowerCase();
  if (q.length < 2) return [];
  const profiles = await store.listProfiles();
  return profiles
    .filter((profile) => profile.id !== me.id && profile.name.toLowerCase().includes(q))
    .slice(0, 8)
    .map((profile) => ({
      publicId: profile.publicId,
      name: profile.name,
      role: profile.role,
      isDemo: profile.isDemo,
    }));
}

export async function addMet(
  store: Store,
  token: string,
  publicId: unknown,
  noteInput: unknown,
): Promise<{ status: number; body: { error: string } | { connection: ConnectionCard } }> {
  const me = await store.getProfileByToken(token);
  if (!me) return { status: 404, body: { error: "This link does not match a card." } };
  const id = cleanLine(publicId, 40);
  const other = id ? await store.getProfileByPublicId(id) : null;
  if (!other) return { status: 404, body: { error: "No one with that link." } };
  if (other.id === me.id) return { status: 400, body: { error: "That is your own card." } };
  const note = cleanLine(noteInput, 180);
  const [first, second] = me.id < other.id ? [me, other] : [other, me];
  const scored = scoreMatch(
    {
      offers: first.offers,
      topOffer: first.topOffer,
      needs: first.needs,
      topNeed: first.topNeed,
      availability: first.availability,
      tryingTo: first.tryingTo,
      role: first.role,
    },
    {
      offers: second.offers,
      topOffer: second.topOffer,
      needs: second.needs,
      topNeed: second.topNeed,
      availability: second.availability,
      tryingTo: second.tryingTo,
      role: second.role,
    },
  );
  const copy = { explanation: mutualReason(first, second), firstAction: pickNextStep(first, second, eventContext) };
  const mineIsA = me.id < other.id;
  const created = await store.createMatch({
    aId: me.id,
    bId: other.id,
    score: scored.score,
    explanation: copy.explanation,
    firstAction: copy.firstAction,
    met: true,
    aStatus: mineIsA ? "accepted" : "pending",
    bStatus: mineIsA ? "pending" : "accepted",
    aNote: mineIsA ? note : "",
    bNote: mineIsA ? "" : note,
  });
  const side = created.aId === me.id ? "a" : "b";
  let match = (await store.setStatus(created.id, side, "accepted")) ?? created;
  if (note) {
    const field: MatchTextField = side === "a" ? "a_note" : "b_note";
    match = (await store.setText(match.id, field, note)) ?? match;
  }
  match = (await store.setMet(match.id)) ?? match;
  const card = toCard(match, me, other);
  return { status: 200, body: { connection: card } };
}

export async function actOnConnection(
  store: Store,
  token: string,
  matchId: string,
  body: { action?: unknown; link?: unknown; time?: unknown },
): Promise<{ status: number; body: { error: string } | { connection: ConnectionCard } | { declined: true } }> {
  const me = await store.getProfileByToken(token);
  const match = await store.getMatchById(matchId);
  if (!me || !match || (match.aId !== me.id && match.bId !== me.id)) {
    return { status: 404, body: { error: "Connection not found." } };
  }
  const otherId = match.aId === me.id ? match.bId : match.aId;
  const other = await store.getProfileById(otherId);
  if (!other) return { status: 404, body: { error: "Connection not found." } };
  const action = typeof body.action === "string" ? body.action : "";
  const side = match.aId === me.id ? "a" : "b";

  if (action === "decline") {
    const updated = await store.setStatus(match.id, side, "declined");
    if (!updated) return { status: 404, body: { error: "Connection not found." } };
    return { status: 200, body: { declined: true } };
  }

  if (action === "simulate_demo_confirm") {
    if (!other.isDemo) return { status: 400, body: { error: "That person has to confirm themselves." } };
    const theirSide = side === "a" ? "b" : "a";
    let updated = await store.setStatus(match.id, theirSide, "accepted");
    updated = updated ? await store.setMet(updated.id) : null;
    if (!updated) return { status: 404, body: { error: "Connection not found." } };
    return { status: 200, body: { connection: toCard(updated, me, other) } };
  }

  if (action === "confirm") {
    let updated = await store.setStatus(match.id, side, "accepted");
    updated = updated ? await store.setMet(updated.id) : null;
    if (!updated) return { status: 404, body: { error: "Connection not found." } };
    return { status: 200, body: { connection: toCard(updated, me, other) } };
  }

  const mutual = match.aStatus === "accepted" && match.bStatus === "accepted";
  if (action === "follow_up_yes" || action === "follow_up_not_yet") {
    if (!mutual) return { status: 400, body: { error: "Follow-up starts after you both confirm." } };
    const updated = await store.setFollowUp(match.id, side, action === "follow_up_yes" ? "yes" : "not_yet");
    if (!updated) return { status: 404, body: { error: "Connection not found." } };
    return { status: 200, body: { connection: toCard(updated, me, other) } };
  }

  if (action === "share_link" || action === "suggest_time") {
    if (!mutual) return { status: 400, body: { error: "That opens after you both confirm." } };
    if (action === "share_link") {
      const link = cleanLink(body.link);
      if (!link.ok) return { status: 400, body: { error: link.error } };
      const field: MatchTextField = side === "a" ? "a_link" : "b_link";
      const updated = await store.setText(match.id, field, link.value);
      if (!updated) return { status: 404, body: { error: "Connection not found." } };
      return { status: 200, body: { connection: toCard(updated, me, other) } };
    }
    const time = cleanLine(body.time, 120);
    const field: MatchTextField = side === "a" ? "a_time" : "b_time";
    const updated = await store.setText(match.id, field, time);
    if (!updated) return { status: 404, body: { error: "Connection not found." } };
    return { status: 200, body: { connection: toCard(updated, me, other) } };
  }

  return { status: 400, body: { error: "Unknown action." } };
}
