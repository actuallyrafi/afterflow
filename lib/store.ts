import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Submission } from "./survey";

export type Profile = Submission & {
  id: string;
  publicId: string;
  linkedin: string;
  consentAt: string;
  createdAt: string;
  secretToken: string;
  isDemo: boolean;
};

export type MatchStatus = "pending" | "accepted" | "declined";
export type FollowUp = "yes" | "not_yet" | null;

export type MatchRow = {
  id: string;
  aId: string;
  bId: string;
  score: number;
  explanation: string;
  firstAction: string;
  aStatus: MatchStatus;
  bStatus: MatchStatus;
  createdAt: string;
  aFollowUp: FollowUp;
  aFollowUpAt: string | null;
  bFollowUp: FollowUp;
  bFollowUpAt: string | null;
  met: boolean;
  aNote: string;
  bNote: string;
  aLink: string;
  bLink: string;
  aTime: string;
  bTime: string;
};

export type MatchTextField = "a_note" | "b_note" | "a_link" | "b_link" | "a_time" | "b_time";

const MATCH_TEXT_FIELDS = new Set<MatchTextField>(["a_note", "b_note", "a_link", "b_link", "a_time", "b_time"]);

export type NewMatch = {
  aId: string;
  bId: string;
  score: number;
  explanation: string;
  firstAction: string;
  met?: boolean;
  aNote?: string;
  bNote?: string;
  aStatus?: MatchStatus;
  bStatus?: MatchStatus;
  id?: string;
};

export const STORE_VERSION = 6;

export type Store = {
  version: number;
  kind: "sqlite" | "json" | "supabase" | "netlify-blobs";
  createProfile(input: Submission & { isDemo?: boolean; id?: string; publicId?: string; secretToken?: string }): Promise<Profile>;
  getProfileByToken(token: string): Promise<Profile | null>;
  getProfileById(id: string): Promise<Profile | null>;
  getProfileByPublicId(publicId: string): Promise<Profile | null>;
  listProfiles(): Promise<Profile[]>;
  createMatch(input: NewMatch): Promise<MatchRow>;
  getMatchById(id: string): Promise<MatchRow | null>;
  listMatches(): Promise<MatchRow[]>;
  listMatchesFor(profileId: string): Promise<MatchRow[]>;
  setStatus(id: string, side: "a" | "b", status: MatchStatus): Promise<MatchRow | null>;
  setFollowUp(id: string, side: "a" | "b", value: "yes" | "not_yet"): Promise<MatchRow | null>;
  setText(id: string, field: MatchTextField, value: string): Promise<MatchRow | null>;
  setMet(id: string): Promise<MatchRow | null>;
  updateScore(id: string, score: number): Promise<MatchRow | null>;
  deleteDemos(): Promise<void>;
  deleteAll(): Promise<void>;
};

type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: (string | number | null)[]): unknown;
    get(...params: (string | number | null)[]): Record<string, unknown> | undefined;
    all(...params: (string | number | null)[]): Record<string, unknown>[];
  };
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  linkedin TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL,
  offers TEXT NOT NULL,
  top_offer TEXT NOT NULL,
  needs TEXT NOT NULL,
  top_need TEXT NOT NULL,
  availability TEXT NOT NULL,
  trying_to TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  secret_token TEXT NOT NULL UNIQUE,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  a_id TEXT NOT NULL,
  b_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  explanation TEXT NOT NULL,
  first_action TEXT NOT NULL,
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
  a_link TEXT NOT NULL DEFAULT '',
  b_link TEXT NOT NULL DEFAULT '',
  a_time TEXT NOT NULL DEFAULT '',
  b_time TEXT NOT NULL DEFAULT '',
  UNIQUE (a_id, b_id)
);
`;

export function canonicalPair(left: string, right: string): [string, string] {
  return left < right ? [left, right] : [right, left];
}

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
  for (const column of ["a_follow_up", "a_follow_up_at", "b_follow_up", "b_follow_up_at"]) {
    if (!matchColumns.has(column)) db.exec(`ALTER TABLE matches ADD COLUMN ${column} TEXT`);
  }
  for (const [column, ddl] of [
    ["met", "met INTEGER NOT NULL DEFAULT 0"],
    ["a_note", "a_note TEXT NOT NULL DEFAULT ''"],
    ["b_note", "b_note TEXT NOT NULL DEFAULT ''"],
    ["a_link", "a_link TEXT NOT NULL DEFAULT ''"],
    ["b_link", "b_link TEXT NOT NULL DEFAULT ''"],
    ["a_time", "a_time TEXT NOT NULL DEFAULT ''"],
    ["b_time", "b_time TEXT NOT NULL DEFAULT ''"],
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
  return db;
}

function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    publicId: String(row.public_id ?? ""),
    name: String(row.name),
    contact: String(row.contact),
    linkedin: row.linkedin ? String(row.linkedin) : "",
    role: String(row.role),
    offers: JSON.parse(String(row.offers)) as string[],
    topOffer: String(row.top_offer),
    needs: JSON.parse(String(row.needs)) as string[],
    topNeed: String(row.top_need),
    availability: String(row.availability),
    tryingTo: String(row.trying_to),
    consentAt: String(row.consent_at),
    createdAt: String(row.created_at),
    secretToken: String(row.secret_token),
    isDemo: Number(row.is_demo) === 1,
  };
}

function rowToMatch(row: Record<string, unknown>): MatchRow {
  return {
    id: String(row.id),
    aId: String(row.a_id),
    bId: String(row.b_id),
    score: Number(row.score),
    explanation: String(row.explanation),
    firstAction: String(row.first_action),
    aStatus: String(row.a_status) as MatchStatus,
    bStatus: String(row.b_status) as MatchStatus,
    createdAt: String(row.created_at),
    aFollowUp: row.a_follow_up === "yes" || row.a_follow_up === "not_yet" ? row.a_follow_up : null,
    aFollowUpAt: row.a_follow_up_at ? String(row.a_follow_up_at) : null,
    bFollowUp: row.b_follow_up === "yes" || row.b_follow_up === "not_yet" ? row.b_follow_up : null,
    bFollowUpAt: row.b_follow_up_at ? String(row.b_follow_up_at) : null,
    met: Number(row.met) === 1,
    aNote: row.a_note ? String(row.a_note) : "",
    bNote: row.b_note ? String(row.b_note) : "",
    aLink: row.a_link ? String(row.a_link) : "",
    bLink: row.b_link ? String(row.b_link) : "",
    aTime: row.a_time ? String(row.a_time) : "",
    bTime: row.b_time ? String(row.b_time) : "",
  };
}

export function initMatch(input: NewMatch): MatchRow {
  const swapped = input.aId > input.bId;
  const [aId, bId] = canonicalPair(input.aId, input.bId);
  return {
    id: input.id || crypto.randomUUID(),
    aId,
    bId,
    score: input.score,
    explanation: input.explanation,
    firstAction: input.firstAction,
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
    aLink: "",
    bLink: "",
    aTime: "",
    bTime: "",
  };
}

export function buildProfile(input: Submission & { isDemo?: boolean; id?: string; publicId?: string; secretToken?: string }): Profile {
  const now = new Date().toISOString();
  return {
    ...input,
    linkedin: input.linkedin ?? "",
    id: input.id || crypto.randomUUID(),
    publicId: input.publicId || crypto.randomBytes(9).toString("base64url"),
    consentAt: now,
    createdAt: now,
    secretToken: input.secretToken || crypto.randomBytes(24).toString("base64url"),
    isDemo: Boolean(input.isDemo),
  };
}

function createSqliteStore(filename: string): Store {
  const db = openSqlite(filename);
  const store: Store = {
    version: STORE_VERSION,
    kind: "sqlite",
    async createProfile(input) {
      const profile = buildProfile(input);
      db.prepare(
        `INSERT INTO profiles (
          id, public_id, name, contact, linkedin, role, offers, top_offer, needs, top_need, availability,
          trying_to, consent_at, created_at, secret_token, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        profile.id,
        profile.publicId,
        profile.name,
        profile.contact,
        profile.linkedin,
        profile.role,
        JSON.stringify(profile.offers),
        profile.topOffer,
        JSON.stringify(profile.needs),
        profile.topNeed,
        profile.availability,
        profile.tryingTo,
        profile.consentAt,
        profile.createdAt,
        profile.secretToken,
        profile.isDemo ? 1 : 0,
      );
      return profile;
    },
    async getProfileByToken(token) {
      const row = db.prepare("SELECT * FROM profiles WHERE secret_token = ?").get(token);
      return row ? rowToProfile(row) : null;
    },
    async getProfileById(id) {
      const row = db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
      return row ? rowToProfile(row) : null;
    },
    async getProfileByPublicId(publicId) {
      const row = db.prepare("SELECT * FROM profiles WHERE public_id = ?").get(publicId);
      return row ? rowToProfile(row) : null;
    },
    async listProfiles() {
      return db.prepare("SELECT * FROM profiles ORDER BY created_at ASC").all().map(rowToProfile);
    },
    async createMatch(input) {
      const [aId, bId] = canonicalPair(input.aId, input.bId);
      const existing = db.prepare("SELECT * FROM matches WHERE a_id = ? AND b_id = ?").get(aId, bId);
      if (existing) return rowToMatch(existing);
      const match = initMatch({ ...input, aId, bId });
      try {
        db.prepare(
          `INSERT INTO matches (
            id, a_id, b_id, score, explanation, first_action, a_status, b_status, created_at,
            met, a_note, b_note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          match.id,
          match.aId,
          match.bId,
          match.score,
          match.explanation,
          match.firstAction,
          match.aStatus,
          match.bStatus,
          match.createdAt,
          match.met ? 1 : 0,
          match.aNote,
          match.bNote,
        );
        return match;
      } catch (error) {
        const raced = db.prepare("SELECT * FROM matches WHERE a_id = ? AND b_id = ?").get(aId, bId);
        if (raced) return rowToMatch(raced);
        throw error;
      }
    },
    async getMatchById(id) {
      const row = db.prepare("SELECT * FROM matches WHERE id = ?").get(id);
      return row ? rowToMatch(row) : null;
    },
    async listMatches() {
      return db.prepare("SELECT * FROM matches ORDER BY created_at ASC").all().map(rowToMatch);
    },
    async listMatchesFor(profileId) {
      return db
        .prepare("SELECT * FROM matches WHERE a_id = ? OR b_id = ?")
        .all(profileId, profileId)
        .map(rowToMatch);
    },
    async setStatus(id, side, status) {
      const column = side === "a" ? "a_status" : "b_status";
      db.prepare(`UPDATE matches SET ${column} = ? WHERE id = ?`).run(status, id);
      return store.getMatchById(id);
    },
    async updateScore(id, score) {
      db.prepare("UPDATE matches SET score = ? WHERE id = ?").run(score, id);
      return store.getMatchById(id);
    },
    async setFollowUp(id, side, value) {
      const column = side === "a" ? "a_follow_up" : "b_follow_up";
      const atColumn = side === "a" ? "a_follow_up_at" : "b_follow_up_at";
      db.prepare(`UPDATE matches SET ${column} = ?, ${atColumn} = ? WHERE id = ?`).run(value, new Date().toISOString(), id);
      return store.getMatchById(id);
    },
    async setText(id, field, value) {
      if (!MATCH_TEXT_FIELDS.has(field)) return null;
      db.prepare(`UPDATE matches SET ${field} = ? WHERE id = ?`).run(value, id);
      return store.getMatchById(id);
    },
    async setMet(id) {
      db.prepare("UPDATE matches SET met = 1 WHERE id = ?").run(id);
      return store.getMatchById(id);
    },
    async deleteDemos() {
      db.exec(`
        DELETE FROM matches WHERE a_id IN (SELECT id FROM profiles WHERE is_demo = 1)
          OR b_id IN (SELECT id FROM profiles WHERE is_demo = 1);
        DELETE FROM profiles WHERE is_demo = 1;
      `);
    },
    async deleteAll() {
      db.exec("DELETE FROM matches; DELETE FROM profiles;");
    },
  };
  return store;
}

type JsonDb = { profiles: Profile[]; matches: MatchRow[] };

function createJsonStore(filename: string): Store {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const read = (): JsonDb => {
    try {
      const parsed = JSON.parse(fs.readFileSync(filename, "utf8")) as JsonDb;
      let dirty = false;
      const profiles = (parsed.profiles ?? []).map((profile) => {
        const next = {
          ...profile,
          publicId: profile.publicId || crypto.randomBytes(9).toString("base64url"),
          linkedin: profile.linkedin ?? "",
        };
        if (!profile.publicId || profile.linkedin == null) dirty = true;
        return next;
      });
      const matches = (parsed.matches ?? []).map((match) => ({
        ...match,
        aFollowUp: match.aFollowUp === "yes" || match.aFollowUp === "not_yet" ? match.aFollowUp : null,
        aFollowUpAt: match.aFollowUpAt ?? null,
        bFollowUp: match.bFollowUp === "yes" || match.bFollowUp === "not_yet" ? match.bFollowUp : null,
        bFollowUpAt: match.bFollowUpAt ?? null,
        met: Boolean(match.met),
        aNote: match.aNote ?? "",
        bNote: match.bNote ?? "",
        aLink: match.aLink ?? "",
        bLink: match.bLink ?? "",
        aTime: match.aTime ?? "",
        bTime: match.bTime ?? "",
      }));
      const data = { profiles, matches };
      if (dirty) write(data);
      return data;
    } catch {
      return { profiles: [], matches: [] };
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
    async setStatus(id, side, status) {
      const data = read();
      const match = data.matches.find((item) => item.id === id);
      if (!match) return null;
      if (side === "a") match.aStatus = status;
      else match.bStatus = status;
      write(data);
      return match;
    },
    async updateScore(id, score) {
      const data = read();
      const match = data.matches.find((item) => item.id === id);
      if (!match) return null;
      match.score = score;
      write(data);
      return match;
    },
    async setFollowUp(id, side, value) {
      const data = read();
      const match = data.matches.find((item) => item.id === id);
      if (!match) return null;
      const at = new Date().toISOString();
      if (side === "a") {
        match.aFollowUp = value;
        match.aFollowUpAt = at;
      } else {
        match.bFollowUp = value;
        match.bFollowUpAt = at;
      }
      write(data);
      return match;
    },
    async setText(id, field, value) {
      if (!MATCH_TEXT_FIELDS.has(field)) return null;
      const data = read();
      const match = data.matches.find((item) => item.id === id);
      if (!match) return null;
      if (field === "a_note") match.aNote = value;
      if (field === "b_note") match.bNote = value;
      if (field === "a_link") match.aLink = value;
      if (field === "b_link") match.bLink = value;
      if (field === "a_time") match.aTime = value;
      if (field === "b_time") match.bTime = value;
      write(data);
      return match;
    },
    async setMet(id) {
      const data = read();
      const match = data.matches.find((item) => item.id === id);
      if (!match) return null;
      match.met = true;
      write(data);
      return match;
    },
    async deleteDemos() {
      const data = read();
      const demoIds = new Set(data.profiles.filter((profile) => profile.isDemo).map((profile) => profile.id));
      data.matches = data.matches.filter((match) => !demoIds.has(match.aId) && !demoIds.has(match.bId));
      data.profiles = data.profiles.filter((profile) => !profile.isDemo);
      write(data);
    },
    async deleteAll() {
      write({ profiles: [], matches: [] });
    },
  };
  return store;
}

export function createFileStore(filename = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "afterflow.sqlite")): Store {
  try {
    const store = createSqliteStore(filename);
    console.log(`[afterflow] sqlite storage at ${filename}`);
    return store;
  } catch (error) {
    const jsonPath = process.env.JSON_PATH || path.join(process.cwd(), "data", "afterflow.json");
    console.warn("[afterflow] SQLite unavailable, using JSON file", error);
    console.log(`[afterflow] json storage at ${jsonPath}`);
    return createJsonStore(jsonPath);
  }
}

