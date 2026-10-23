import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { normalizeEventBook, type EventBook } from "./events";
import { readContacts, type Submission } from "./survey";

export type Profile = {
  id: string;
  publicId: string;
  name: string;
  /** The preferred contact, `channel:value`; older cards hold a bare email or Discord name. */
  contact: string;
  /** Every contact, preferred first (so `contacts[0] === contact`). Older cards read as `[contact]`. */
  contacts: string[];
  /** "What's something you're into right now?" */
  answer: string;
  /**
   * The one gentle reminder. On by default since v4.1c (owner-approved, 23 Oct 2026); the person can
   * turn it off. Stored cards that never had the field read as on; an explicit false stays off.
   */
  reminders: boolean;
  consentAt: string;
  createdAt: string;
  secretToken: string;
  isDemo: boolean;
};

export type ProfilePatch = Partial<Pick<Profile, "name" | "contact" | "contacts" | "answer" | "reminders">>;

export type MatchStatus = "pending" | "accepted" | "declined";
export type FollowUp = "yes" | "not_yet" | null;

export type MatchRow = {
  id: string;
  aId: string;
  bId: string;
  aStatus: MatchStatus;
  bStatus: MatchStatus;
  createdAt: string;
  /** Private "Talked again?" marks. Only the side that set it ever sees it. */
  aFollowUp: FollowUp;
  aFollowUpAt: string | null;
  bFollowUp: FollowUp;
  bFollowUpAt: string | null;
  met: boolean;
  /** Private notes, one per side. */
  aNote: string;
  bNote: string;
  /** One note both people see and either can edit. */
  sharedNote: string;
  sharedNoteAt: string | null;
  aMuted: boolean;
  bMuted: boolean;
  /** The one reminder was shown or dismissed for that side; it never comes back. */
  aReminderDone: boolean;
  bReminderDone: boolean;
  /** Soft remove / block, kept only for the few seconds Undo is offered, then purged. */
  removedBy: string | null;
  removedAt: string | null;
  blockedBy: string | null;
  blockedAt: string | null;
  /** A request made after a block: shown to the requester as "waiting", never to the blocker. */
  shadow: boolean;
};

export type MatchPatch = Partial<Omit<MatchRow, "id" | "aId" | "bId" | "createdAt">>;

export type NewMatch = {
  aId: string;
  bId: string;
  met?: boolean;
  aNote?: string;
  bNote?: string;
  aStatus?: MatchStatus;
  bStatus?: MatchStatus;
  shadow?: boolean;
  id?: string;
};

export type BlockRecord = { blockerId: string; blockedId: string; createdAt: string };

export type NewProfile = Submission & { isDemo?: boolean; id?: string; publicId?: string; secretToken?: string };

export const STORE_VERSION = 8;

/** Return the new book, or null to leave it untouched. */
export type EventBookMutation = (current: EventBook | null) => EventBook | null;

export type Store = {
  version: number;
  kind: "sqlite" | "json" | "supabase" | "netlify-blobs";
  createProfile(input: NewProfile): Promise<Profile>;
  getProfileByToken(token: string): Promise<Profile | null>;
  getProfileById(id: string): Promise<Profile | null>;
  getProfileByPublicId(publicId: string): Promise<Profile | null>;
  listProfiles(): Promise<Profile[]>;
  updateProfile(id: string, patch: ProfilePatch): Promise<Profile | null>;
  /** Hard delete: the profile, its token and public id, its connections and any blocks involving it. */
  deleteProfile(id: string): Promise<void>;
  createMatch(input: NewMatch): Promise<MatchRow>;
  getMatchById(id: string): Promise<MatchRow | null>;
  listMatches(): Promise<MatchRow[]>;
  listMatchesFor(profileId: string): Promise<MatchRow[]>;
  patchMatch(id: string, patch: MatchPatch): Promise<MatchRow | null>;
  deleteMatch(id: string): Promise<void>;
  addBlock(blockerId: string, blockedId: string): Promise<BlockRecord>;
  removeBlock(blockerId: string, blockedId: string): Promise<void>;
  /** Blocks where this profile is the blocker or the blocked. */
  listBlocksFor(profileId: string): Promise<BlockRecord[]>;
  /** This person's private events and filing. Null until they first change something. */
  readEventBook(profileId: string): Promise<EventBook | null>;
  updateEventBook(profileId: string, mutate: EventBookMutation): Promise<EventBook | null>;
  deleteDemos(): Promise<void>;
  deleteAll(): Promise<void>;
};

export function canonicalPair(left: string, right: string): [string, string] {
  return left < right ? [left, right] : [right, left];
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

/**
 * Reminder setting at read time. Unset (undefined/null, e.g. hackathon cards made before the field
 * existed) means on. Anything stored is respected, so an explicit false stays off. Nothing is rewritten.
 * Caveat: cards made between v4 and v4.1b were always written with false, so a stored false can't tell
 * "never touched" from "turned off"; it's treated as off.
 */
export function readReminders(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  return bool(value);
}

function followUp(value: unknown): FollowUp {
  return value === "yes" || value === "not_yet" ? value : null;
}

function status(value: unknown): MatchStatus {
  return value === "accepted" || value === "declined" ? value : "pending";
}

function nullable(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/**
 * Cards saved before v4 carry role, offers, needs, availability, LinkedIn and "tryingTo".
 * Reads keep what still matters (their words become the answer) and ignore the rest.
 */
export function normalizeProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = str(row.id);
  if (!id) return null;
  // `contact` stays the source of truth for the preferred method, so a build that only knows
  // `contact` can keep reading and writing these cards. `contacts` adds the rest.
  const contacts = readContacts(str(row.contact), row.contacts);
  return {
    id,
    publicId: str(row.publicId ?? row.public_id),
    name: str(row.name).trim() || "Someone",
    contact: contacts[0] ?? str(row.contact),
    contacts,
    answer: str(row.answer ?? row.tryingTo ?? row.trying_to).trim(),
    reminders: readReminders(row.reminders),
    consentAt: str(row.consentAt ?? row.consent_at),
    createdAt: str(row.createdAt ?? row.created_at),
    secretToken: str(row.secretToken ?? row.secret_token),
    isDemo: bool(row.isDemo ?? row.is_demo),
  };
}

/** Old rows carry score, explanation, links and times; those are ignored. */
export function normalizeMatch(raw: unknown): MatchRow | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = str(row.id);
  if (!id) return null;
  return {
    id,
    aId: str(row.aId ?? row.a_id),
    bId: str(row.bId ?? row.b_id),
    aStatus: status(row.aStatus ?? row.a_status),
    bStatus: status(row.bStatus ?? row.b_status),
    createdAt: str(row.createdAt ?? row.created_at),
    aFollowUp: followUp(row.aFollowUp ?? row.a_follow_up),
    aFollowUpAt: nullable(row.aFollowUpAt ?? row.a_follow_up_at),
    bFollowUp: followUp(row.bFollowUp ?? row.b_follow_up),
    bFollowUpAt: nullable(row.bFollowUpAt ?? row.b_follow_up_at),
    met: bool(row.met),
    aNote: str(row.aNote ?? row.a_note),
    bNote: str(row.bNote ?? row.b_note),
    sharedNote: str(row.sharedNote),
    sharedNoteAt: nullable(row.sharedNoteAt),
    aMuted: bool(row.aMuted),
    bMuted: bool(row.bMuted),
    aReminderDone: bool(row.aReminderDone),
    bReminderDone: bool(row.bReminderDone),
    removedBy: nullable(row.removedBy),
    removedAt: nullable(row.removedAt),
    blockedBy: nullable(row.blockedBy),
    blockedAt: nullable(row.blockedAt),
    shadow: bool(row.shadow),
  };
}

export function initMatch(input: NewMatch): MatchRow {
  const swapped = input.aId > input.bId;
  const [aId, bId] = canonicalPair(input.aId, input.bId);
  return {
    id: input.id || crypto.randomUUID(),
    aId,
    bId,
    aStatus: (swapped ? input.bStatus : input.aStatus) ?? "pending",
    bStatus: (swapped ? input.aStatus : input.bStatus) ?? "pending",
    createdAt: new Date().toISOString(),
    aFollowUp: null,
    aFollowUpAt: null,
    bFollowUp: null,
    bFollowUpAt: null,
    met: Boolean(input.met),
    aNote: (swapped ? input.bNote : input.aNote) ?? "",
    bNote: (swapped ? input.aNote : input.bNote) ?? "",
    sharedNote: "",
    sharedNoteAt: null,
    aMuted: false,
    bMuted: false,
    aReminderDone: false,
    bReminderDone: false,
    removedBy: null,
    removedAt: null,
    blockedBy: null,
    blockedAt: null,
    shadow: Boolean(input.shadow),
  };
}

export function buildProfile(input: NewProfile): Profile {
  const now = new Date().toISOString();
  return {
    id: input.id || crypto.randomUUID(),
    publicId: input.publicId || crypto.randomBytes(9).toString("base64url"),
    name: input.name,
    contact: input.contacts?.[0] ?? input.contact,
    contacts: readContacts(input.contacts?.[0] ?? input.contact, input.contacts ?? []),
    answer: input.answer,
    // v4.1c: one gentle reminder is on for new cards (and so for every new connection they make).
    reminders: true,
    consentAt: now,
    createdAt: now,
    secretToken: input.secretToken || crypto.randomBytes(24).toString("base64url"),
    isDemo: Boolean(input.isDemo),
  };
}

export function applyMatchPatch(row: MatchRow, patch: MatchPatch): MatchRow {
  const next = { ...row };
  for (const [key, value] of Object.entries(patch) as [keyof MatchPatch, unknown][]) {
    if (value === undefined) continue;
    (next as Record<string, unknown>)[key] = value;
  }
  return next;
}

export function applyProfilePatch(profile: Profile, patch: ProfilePatch): Profile {
  const contacts =
    patch.contacts !== undefined
      ? readContacts(patch.contacts[0] ?? patch.contact ?? profile.contact, patch.contacts)
      : patch.contact !== undefined
        ? readContacts(patch.contact, [])
        : null;
  return {
    ...profile,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(contacts && contacts.length ? { contact: contacts[0], contacts } : {}),
    ...(patch.answer !== undefined ? { answer: patch.answer } : {}),
    ...(patch.reminders !== undefined ? { reminders: patch.reminders } : {}),
  };
}

/** Fields that live in the `state` JSON column of the SQL stores. */
export const MATCH_STATE_KEYS = [
  "sharedNote",
  "sharedNoteAt",
  "aMuted",
  "bMuted",
  "aReminderDone",
  "bReminderDone",
  "removedBy",
  "removedAt",
  "blockedBy",
  "blockedAt",
  "shadow",
] as const;

export function matchState(row: MatchRow): string {
  const state: Record<string, unknown> = {};
  for (const key of MATCH_STATE_KEYS) state[key] = row[key];
  return JSON.stringify(state);
}

function parseState(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string" || !value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** For SQL rows: snake_case columns plus the JSON `state` column. */
export function sqlRowToMatch(row: Record<string, unknown>): MatchRow | null {
  return normalizeMatch({ ...row, ...parseState(row.state) });
}

type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: (string | number | null)[]): unknown;
    get(...params: (string | number | null)[]): Record<string, unknown> | undefined;
    all(...params: (string | number | null)[]): Record<string, unknown>[];
  };
};

// Legacy columns (role, offers, …, score, explanation) stay in the schema and are written empty.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  linkedin TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  offers TEXT NOT NULL DEFAULT '[]',
  top_offer TEXT NOT NULL DEFAULT '',
  needs TEXT NOT NULL DEFAULT '[]',
  top_need TEXT NOT NULL DEFAULT '',
  availability TEXT NOT NULL DEFAULT '',
  trying_to TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  secret_token TEXT NOT NULL UNIQUE,
  is_demo INTEGER NOT NULL DEFAULT 0,
  reminders INTEGER NOT NULL DEFAULT 1,
  contacts TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  a_id TEXT NOT NULL,
  b_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  explanation TEXT NOT NULL DEFAULT '',
  first_action TEXT NOT NULL DEFAULT '',
  a_status TEXT NOT NULL DEFAULT 'pending',
  b_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  a_follow_up TEXT,
  a_follow_up_at TEXT,
  b_follow_up TEXT,
  b_follow_up_at TEXT,
  met INTEGER NOT NULL DEFAULT 0,
  a_note TEXT NOT NULL DEFAULT '',
  b_note TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '{}',
  UNIQUE (a_id, b_id)
);
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE TABLE IF NOT EXISTS event_books (
  profile_id TEXT PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);
`;

function openSqlite(filename: string): SqliteDb {
  const specifier = "node:" + "sqlite";
  const getBuiltin = (
    process as unknown as {
      getBuiltinModule?: (id: string) => { DatabaseSync?: new (file: string) => SqliteDb };
    }
  ).getBuiltinModule;
  const builtin = getBuiltin?.(specifier);
  if (!builtin?.DatabaseSync) throw new Error("node:sqlite unavailable");
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new builtin.DatabaseSync(filename);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  const matchColumns = new Set(db.prepare("PRAGMA table_info(matches)").all().map((row) => String(row.name)));
  for (const [column, ddl] of [
    ["a_follow_up", "a_follow_up TEXT"],
    ["a_follow_up_at", "a_follow_up_at TEXT"],
    ["b_follow_up", "b_follow_up TEXT"],
    ["b_follow_up_at", "b_follow_up_at TEXT"],
    ["met", "met INTEGER NOT NULL DEFAULT 0"],
    ["a_note", "a_note TEXT NOT NULL DEFAULT ''"],
    ["b_note", "b_note TEXT NOT NULL DEFAULT ''"],
    ["state", "state TEXT NOT NULL DEFAULT '{}'"],
  ] as const) {
    if (!matchColumns.has(column)) db.exec(`ALTER TABLE matches ADD COLUMN ${ddl}`);
  }
  const profileColumns = new Set(db.prepare("PRAGMA table_info(profiles)").all().map((row) => String(row.name)));
  if (!profileColumns.has("public_id")) db.exec("ALTER TABLE profiles ADD COLUMN public_id TEXT");
  const missing = db.prepare("SELECT id FROM profiles WHERE public_id IS NULL OR public_id = ''").all();
  for (const row of missing) {
    db.prepare("UPDATE profiles SET public_id = ? WHERE id = ?").run(crypto.randomBytes(9).toString("base64url"), String(row.id));
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_idx ON profiles (public_id)");
  if (!profileColumns.has("linkedin")) db.exec("ALTER TABLE profiles ADD COLUMN linkedin TEXT NOT NULL DEFAULT ''");
  if (!profileColumns.has("reminders")) db.exec("ALTER TABLE profiles ADD COLUMN reminders INTEGER NOT NULL DEFAULT 1");
  // v4.1: extra contact methods. Old rows keep '' and read as their single `contact`.
  if (!profileColumns.has("contacts")) db.exec("ALTER TABLE profiles ADD COLUMN contacts TEXT NOT NULL DEFAULT ''");
  return db;
}

function createSqliteStore(filename: string): Store {
  const db = openSqlite(filename);
  const profileOf = (row: Record<string, unknown> | undefined) => (row ? normalizeProfile(row) : null);
  const matchOf = (row: Record<string, unknown> | undefined) => (row ? sqlRowToMatch(row) : null);
  const writeMatch = (match: MatchRow) => {
    db.prepare(
      `UPDATE matches SET a_status = ?, b_status = ?, a_follow_up = ?, a_follow_up_at = ?, b_follow_up = ?,
        b_follow_up_at = ?, met = ?, a_note = ?, b_note = ?, state = ? WHERE id = ?`,
    ).run(
      match.aStatus,
      match.bStatus,
      match.aFollowUp,
      match.aFollowUpAt,
      match.bFollowUp,
      match.bFollowUpAt,
      match.met ? 1 : 0,
      match.aNote,
      match.bNote,
      matchState(match),
      match.id,
    );
  };
  const store: Store = {
    version: STORE_VERSION,
    kind: "sqlite",
    async createProfile(input) {
      const profile = buildProfile(input);
      db.prepare(
        `INSERT INTO profiles (id, public_id, name, contact, contacts, trying_to, consent_at, created_at, secret_token, is_demo, reminders,
           linkedin, role, offers, top_offer, needs, top_need, availability)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', '[]', '', '[]', '', '')`,
      ).run(
        profile.id,
        profile.publicId,
        profile.name,
        profile.contact,
        JSON.stringify(profile.contacts),
        profile.answer,
        profile.consentAt,
        profile.createdAt,
        profile.secretToken,
        profile.isDemo ? 1 : 0,
        profile.reminders ? 1 : 0,
      );
      return profile;
    },
    async getProfileByToken(token) {
      return profileOf(db.prepare("SELECT * FROM profiles WHERE secret_token = ?").get(token));
    },
    async getProfileById(id) {
      return profileOf(db.prepare("SELECT * FROM profiles WHERE id = ?").get(id));
    },
    async getProfileByPublicId(publicId) {
      return profileOf(db.prepare("SELECT * FROM profiles WHERE public_id = ?").get(publicId));
    },
    async listProfiles() {
      return db
        .prepare("SELECT * FROM profiles ORDER BY created_at ASC")
        .all()
        .map((row) => normalizeProfile(row))
        .filter((row): row is Profile => Boolean(row));
    },
    async updateProfile(id, patch) {
      const current = await store.getProfileById(id);
      if (!current) return null;
      const next = applyProfilePatch(current, patch);
      db.prepare("UPDATE profiles SET name = ?, contact = ?, contacts = ?, trying_to = ?, reminders = ? WHERE id = ?").run(
        next.name,
        next.contact,
        JSON.stringify(next.contacts),
        next.answer,
        next.reminders ? 1 : 0,
        id,
      );
      return next;
    },
    async deleteProfile(id) {
      db.prepare("DELETE FROM matches WHERE a_id = ? OR b_id = ?").run(id, id);
      db.prepare("DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?").run(id, id);
      db.prepare("DELETE FROM event_books WHERE profile_id = ?").run(id);
      db.prepare("DELETE FROM profiles WHERE id = ?").run(id);
    },
    async createMatch(input) {
      const [aId, bId] = canonicalPair(input.aId, input.bId);
      const existing = matchOf(db.prepare("SELECT * FROM matches WHERE a_id = ? AND b_id = ?").get(aId, bId));
      if (existing) return existing;
      const match = initMatch({ ...input, aId, bId });
      try {
        db.prepare(
          `INSERT INTO matches (id, a_id, b_id, a_status, b_status, created_at, met, a_note, b_note, state,
             score, explanation, first_action)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', '')`,
        ).run(
          match.id,
          match.aId,
          match.bId,
          match.aStatus,
          match.bStatus,
          match.createdAt,
          match.met ? 1 : 0,
          match.aNote,
          match.bNote,
          matchState(match),
        );
        return match;
      } catch (error) {
        const raced = matchOf(db.prepare("SELECT * FROM matches WHERE a_id = ? AND b_id = ?").get(aId, bId));
        if (raced) return raced;
        throw error;
      }
    },
    async getMatchById(id) {
      return matchOf(db.prepare("SELECT * FROM matches WHERE id = ?").get(id));
    },
    async listMatches() {
      return db
        .prepare("SELECT * FROM matches ORDER BY created_at ASC")
        .all()
        .map((row) => sqlRowToMatch(row))
        .filter((row): row is MatchRow => Boolean(row));
    },
    async listMatchesFor(profileId) {
      return db
        .prepare("SELECT * FROM matches WHERE a_id = ? OR b_id = ?")
        .all(profileId, profileId)
        .map((row) => sqlRowToMatch(row))
        .filter((row): row is MatchRow => Boolean(row));
    },
    async patchMatch(id, patch) {
      const current = await store.getMatchById(id);
      if (!current) return null;
      const next = applyMatchPatch(current, patch);
      writeMatch(next);
      return next;
    },
    async deleteMatch(id) {
      db.prepare("DELETE FROM matches WHERE id = ?").run(id);
    },
    async addBlock(blockerId, blockedId) {
      const record = { blockerId, blockedId, createdAt: new Date().toISOString() };
      db.prepare("INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)").run(
        blockerId,
        blockedId,
        record.createdAt,
      );
      const row = db.prepare("SELECT * FROM blocks WHERE blocker_id = ? AND blocked_id = ?").get(blockerId, blockedId);
      return row ? { blockerId, blockedId, createdAt: String(row.created_at) } : record;
    },
    async removeBlock(blockerId, blockedId) {
      db.prepare("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?").run(blockerId, blockedId);
    },
    async listBlocksFor(profileId) {
      return db
        .prepare("SELECT * FROM blocks WHERE blocker_id = ? OR blocked_id = ?")
        .all(profileId, profileId)
        .map((row) => ({
          blockerId: String(row.blocker_id),
          blockedId: String(row.blocked_id),
          createdAt: String(row.created_at),
        }));
    },
    async readEventBook(profileId) {
      const row = db.prepare("SELECT data FROM event_books WHERE profile_id = ?").get(profileId);
      return row ? normalizeEventBook(row.data) : null;
    },
    async updateEventBook(profileId, mutate) {
      const current = await store.readEventBook(profileId);
      const next = mutate(current);
      if (!next) return current;
      db.prepare(
        `INSERT INTO event_books (profile_id, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(profile_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      ).run(profileId, JSON.stringify(next), new Date().toISOString());
      return next;
    },
    async deleteDemos() {
      db.exec(`
        DELETE FROM matches WHERE a_id IN (SELECT id FROM profiles WHERE is_demo = 1)
          OR b_id IN (SELECT id FROM profiles WHERE is_demo = 1);
        DELETE FROM blocks WHERE blocker_id IN (SELECT id FROM profiles WHERE is_demo = 1)
          OR blocked_id IN (SELECT id FROM profiles WHERE is_demo = 1);
        DELETE FROM event_books WHERE profile_id IN (SELECT id FROM profiles WHERE is_demo = 1);
        DELETE FROM profiles WHERE is_demo = 1;
      `);
    },
    async deleteAll() {
      db.exec("DELETE FROM matches; DELETE FROM blocks; DELETE FROM event_books; DELETE FROM profiles;");
    },
  };
  return store;
}

type JsonDb = { profiles: Profile[]; matches: MatchRow[]; blocks: BlockRecord[]; eventBooks: Record<string, EventBook> };

function createJsonStore(filename: string): Store {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const read = (): JsonDb => {
    try {
      const parsed = JSON.parse(fs.readFileSync(filename, "utf8")) as Partial<Record<keyof JsonDb, unknown[]>>;
      return {
        profiles: (parsed.profiles ?? []).map(normalizeProfile).filter((row): row is Profile => Boolean(row)),
        matches: (parsed.matches ?? []).map(normalizeMatch).filter((row): row is MatchRow => Boolean(row)),
        blocks: (parsed.blocks ?? []) as BlockRecord[],
        eventBooks: Object.fromEntries(
          Object.entries(((parsed as Record<string, unknown>).eventBooks ?? {}) as Record<string, unknown>)
            .map(([id, book]) => [id, normalizeEventBook(book)] as const)
            .filter((entry): entry is [string, EventBook] => Boolean(entry[1])),
        ),
      };
    } catch {
      return { profiles: [], matches: [], blocks: [], eventBooks: {} };
    }
  };
  const write = (data: JsonDb) => {
    const tmp = `${filename}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, filename);
  };
  const store: Store = {
    version: STORE_VERSION,
    kind: "json",
    async createProfile(input) {
      const profile = buildProfile(input);
      const data = read();
      data.profiles.push(profile);
      write(data);
      return profile;
    },
    async getProfileByToken(token) {
      return read().profiles.find((profile) => profile.secretToken === token) ?? null;
    },
    async getProfileById(id) {
      return read().profiles.find((profile) => profile.id === id) ?? null;
    },
    async getProfileByPublicId(publicId) {
      return read().profiles.find((profile) => profile.publicId === publicId) ?? null;
    },
    async listProfiles() {
      return read().profiles;
    },
    async updateProfile(id, patch) {
      const data = read();
      const index = data.profiles.findIndex((profile) => profile.id === id);
      if (index < 0) return null;
      data.profiles[index] = applyProfilePatch(data.profiles[index], patch);
      write(data);
      return data.profiles[index];
    },
    async deleteProfile(id) {
      const data = read();
      data.profiles = data.profiles.filter((profile) => profile.id !== id);
      data.matches = data.matches.filter((match) => match.aId !== id && match.bId !== id);
      data.blocks = data.blocks.filter((block) => block.blockerId !== id && block.blockedId !== id);
      delete data.eventBooks[id];
      write(data);
    },
    async createMatch(input) {
      const [aId, bId] = canonicalPair(input.aId, input.bId);
      const data = read();
      const existing = data.matches.find((match) => match.aId === aId && match.bId === bId);
      if (existing) return existing;
      const match = initMatch({ ...input, aId, bId });
      data.matches.push(match);
      write(data);
      return match;
    },
    async getMatchById(id) {
      return read().matches.find((match) => match.id === id) ?? null;
    },
    async listMatches() {
      return read().matches;
    },
    async listMatchesFor(profileId) {
      return read().matches.filter((match) => match.aId === profileId || match.bId === profileId);
    },
    async patchMatch(id, patch) {
      const data = read();
      const index = data.matches.findIndex((item) => item.id === id);
      if (index < 0) return null;
      data.matches[index] = applyMatchPatch(data.matches[index], patch);
      write(data);
      return data.matches[index];
    },
    async deleteMatch(id) {
      const data = read();
      data.matches = data.matches.filter((match) => match.id !== id);
      write(data);
    },
    async addBlock(blockerId, blockedId) {
      const data = read();
      const existing = data.blocks.find((block) => block.blockerId === blockerId && block.blockedId === blockedId);
      if (existing) return existing;
      const record = { blockerId, blockedId, createdAt: new Date().toISOString() };
      data.blocks.push(record);
      write(data);
      return record;
    },
    async removeBlock(blockerId, blockedId) {
      const data = read();
      data.blocks = data.blocks.filter((block) => !(block.blockerId === blockerId && block.blockedId === blockedId));
      write(data);
    },
    async listBlocksFor(profileId) {
      return read().blocks.filter((block) => block.blockerId === profileId || block.blockedId === profileId);
    },
    async readEventBook(profileId) {
      return read().eventBooks[profileId] ?? null;
    },
    async updateEventBook(profileId, mutate) {
      const data = read();
      const next = mutate(data.eventBooks[profileId] ?? null);
      if (!next) return data.eventBooks[profileId] ?? null;
      data.eventBooks[profileId] = next;
      write(data);
      return next;
    },
    async deleteDemos() {
      const data = read();
      const demoIds = new Set(data.profiles.filter((profile) => profile.isDemo).map((profile) => profile.id));
      data.matches = data.matches.filter((match) => !demoIds.has(match.aId) && !demoIds.has(match.bId));
      data.blocks = data.blocks.filter((block) => !demoIds.has(block.blockerId) && !demoIds.has(block.blockedId));
      data.profiles = data.profiles.filter((profile) => !profile.isDemo);
      for (const id of demoIds) delete data.eventBooks[id];
      write(data);
    },
    async deleteAll() {
      write({ profiles: [], matches: [], blocks: [], eventBooks: {} });
    },
  };
  return store;
}

export function createFileStore(filename?: string): Store {
  const explicit = Boolean(filename);
  if (!filename) filename = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "afterflow.sqlite");
  try {
    const store = createSqliteStore(filename);
    console.log(`[afterflow] sqlite storage at ${filename}`);
    return store;
  } catch (error) {
    // A caller that names its own file (tests, scripts) gets a JSON file beside it,
    // never the shared default, so separate stores never see each other's rows.
    const jsonPath = explicit
      ? filename.replace(/\.[^./\\]+$/, "") + ".json"
      : process.env.JSON_PATH || path.join(process.cwd(), "data", "afterflow.json");
    if (!explicit) console.warn("[afterflow] SQLite unavailable, using JSON file", error);
    console.log(`[afterflow] json storage at ${jsonPath}`);
    return createJsonStore(jsonPath);
  }
}
