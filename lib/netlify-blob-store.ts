import { getStore as getBlobStore, type Store as NetlifyStore } from "@netlify/blobs";
import type { Submission } from "./survey";
import {
  buildProfile,
  canonicalPair,
  initMatch,
  STORE_VERSION,
  type MatchRow,
  type MatchStatus,
  type MatchTextField,
  type NewMatch,
  type Profile,
  type Store,
} from "./store";

const MATCH_TEXT: Record<MatchTextField, keyof MatchRow> = {
  a_note: "aNote",
  b_note: "bNote",
  a_link: "aLink",
  b_link: "bLink",
  a_time: "aTime",
  b_time: "bTime",
};

type WriteResult = { modified: boolean; etag?: string };

type BlobClient = {
  get(key: string, options?: { type?: "json" | "text"; consistency?: "strong" }): Promise<unknown>;
  getWithMetadata(
    key: string,
    options: { type: "json"; consistency?: "strong" },
  ): Promise<{ data: unknown; etag?: string } | null>;
  set(key: string, data: string, options?: { onlyIfNew?: boolean; onlyIfMatch?: string }): Promise<WriteResult>;
  setJSON(key: string, data: unknown, options?: { onlyIfNew?: boolean; onlyIfMatch?: string }): Promise<WriteResult>;
  delete(key: string): Promise<void>;
  deleteAll(): Promise<{ deletedBlobs: number }>;
  list(options: { prefix?: string; paginate: true }): AsyncIterable<{ blobs: { key: string }[] }>;
};

const STRONG = { consistency: "strong" as const };

function profileKey(id: string) {
  return `profiles/${id}`;
}
function tokenKey(token: string) {
  return `tokens/${token}`;
}
function publicKey(publicId: string) {
  return `public/${publicId}`;
}
function connectionKey(id: string) {
  return `connections/${id}`;
}
function pairKey(aId: string, bId: string) {
  return `pairs/${[aId, bId].sort().join("_")}`;
}
function forKey(profileId: string, connectionId: string) {
  return `for/${profileId}/${connectionId}`;
}

function openClient(): BlobClient {
  const name = process.env.NETLIFY_BLOBS_STORE || "afterflow";
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  const real: NetlifyStore =
    siteID && token
      ? getBlobStore({ name, siteID, token, consistency: "strong" })
      : getBlobStore({ name, consistency: "strong" });
  const loose: NetlifyStore =
    siteID && token ? getBlobStore({ name, siteID, token }) : getBlobStore({ name });
  const client = real as unknown as BlobClient;
  const looseClient = loose as unknown as BlobClient;
  const originalGet = client.get.bind(client);
  // On Netlify's runtime a strong read of a key that does not exist can hang until the
  // function times out. Cap strong reads and fall back to a normal read, then to "missing".
  client.get = (async (key: string, options?: { type?: "json" | "text"; consistency?: "strong" }) => {
    const capped = <T,>(p: Promise<T>, ms: number) =>
      Promise.race([p, new Promise<"__timeout__">((resolve) => setTimeout(() => resolve("__timeout__"), ms))]);
    const first = await capped(originalGet(key, options), READ_CAP_MS);
    if (first !== "__timeout__") return first;
    const { consistency: _ignored, ...rest } = options ?? {};
    const second = await capped(looseClient.get(key, rest), READ_CAP_MS);
    return second === "__timeout__" ? null : second;
  }) as BlobClient["get"];
  return client;
}

const READ_CAP_MS = 2500;

export function createNetlifyBlobStore(injected?: BlobClient): Store {
  let cached = injected;
  const blobs = () => {
    if (!cached) cached = openClient();
    return cached;
  };

  async function listKeys(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    for await (const page of blobs().list({ prefix, paginate: true })) {
      for (const blob of page.blobs) keys.push(blob.key);
    }
    return keys;
  }

  async function readProfile(id: string): Promise<Profile | null> {
    const data = await blobs().get(profileKey(id), { type: "json", ...STRONG });
    return data ? (data as Profile) : null;
  }

  async function readMatch(id: string): Promise<MatchRow | null> {
    const data = await blobs().get(connectionKey(id), { type: "json", ...STRONG });
    return data ? (data as MatchRow) : null;
  }

  async function readProfiles(ids: string[]): Promise<Profile[]> {
    const rows = await Promise.all(ids.map((id) => readProfile(id)));
    return rows.filter((row): row is Profile => Boolean(row));
  }

  async function readMatches(ids: string[]): Promise<MatchRow[]> {
    const rows = await Promise.all(ids.map((id) => readMatch(id)));
    return rows.filter((row): row is MatchRow => Boolean(row));
  }

  async function updateMatch(id: string, mutate: (row: MatchRow) => void): Promise<MatchRow | null> {
    const key = connectionKey(id);
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await blobs().getWithMetadata(key, { type: "json", ...STRONG });
      if (!current?.data) return null;
      const row = current.data as MatchRow;
      mutate(row);
      const options = current.etag ? { onlyIfMatch: current.etag } : undefined;
      const wrote = await blobs().setJSON(key, row, options);
      if (wrote.modified || !current.etag) return row;
    }
    throw new Error("Could not save that connection. Try again.");
  }

  async function indexConnection(row: MatchRow) {
    await blobs().set(forKey(row.aId, row.id), "1");
    await blobs().set(forKey(row.bId, row.id), "1");
  }

  async function deleteConnection(row: MatchRow) {
    await blobs().delete(connectionKey(row.id));
    await blobs().delete(pairKey(row.aId, row.bId));
    await blobs().delete(forKey(row.aId, row.id));
    await blobs().delete(forKey(row.bId, row.id));
  }

  return {
    version: STORE_VERSION,
    kind: "netlify-blobs",

    async createProfile(input: Submission & { isDemo?: boolean; id?: string; publicId?: string; secretToken?: string }) {
      if (input.id) {
        const existing = await readProfile(input.id);
        if (existing) return existing;
      }
      const fixed = Boolean(input.id || input.publicId || input.secretToken);
      for (let attempt = 0; attempt < 4; attempt++) {
        const profile = buildProfile(input);
        const wrote = await blobs().setJSON(profileKey(profile.id), profile, { onlyIfNew: true });
        if (!wrote.modified) {
          const existing = await readProfile(profile.id);
          if (existing) return existing;
          if (fixed) break;
          continue;
        }
        const tokenWrote = await blobs().set(tokenKey(profile.secretToken), profile.id, { onlyIfNew: true });
        const publicWrote = await blobs().set(publicKey(profile.publicId), profile.id, { onlyIfNew: true });
        if (tokenWrote.modified && publicWrote.modified) return profile;
        await blobs().delete(profileKey(profile.id));
        if (tokenWrote.modified) await blobs().delete(tokenKey(profile.secretToken));
        if (publicWrote.modified) await blobs().delete(publicKey(profile.publicId));
        if (fixed) break;
      }
      throw new Error("Could not save that card. Try again.");
    },

    async getProfileByToken(token: string) {
      const id = await blobs().get(tokenKey(token), { ...STRONG });
      if (typeof id !== "string" || !id) return null;
      return readProfile(id);
    },

    async getProfileById(id: string) {
      return readProfile(id);
    },

    async getProfileByPublicId(publicId: string) {
      const id = await blobs().get(publicKey(publicId), { ...STRONG });
      if (typeof id !== "string" || !id) return null;
      return readProfile(id);
    },

    async listProfiles() {
      const keys = await listKeys("profiles/");
      return readProfiles(keys.map((key) => key.slice("profiles/".length)));
    },

    async createMatch(input: NewMatch) {
      if (input.id) {
        const existing = await readMatch(input.id);
        if (existing) return existing;
      }
      const [aId, bId] = canonicalPair(input.aId, input.bId);
      const key = pairKey(aId, bId);
      const claimedId = await blobs().get(key, { ...STRONG });
      if (typeof claimedId === "string" && claimedId) {
        const existing = await readMatch(claimedId);
        if (existing) return existing;
      }
      const row = initMatch({ ...input, aId, bId });
      const claim = await blobs().set(key, row.id, { onlyIfNew: true });
      if (!claim.modified) {
        const winner = await blobs().get(key, { ...STRONG });
        if (typeof winner === "string" && winner && winner !== row.id) {
          const existing = await readMatch(winner);
          if (existing) return existing;
          row.id = winner;
        }
      }
      await blobs().setJSON(connectionKey(row.id), row);
      await indexConnection(row);
      return row;
    },

    async getMatchById(id: string) {
      return readMatch(id);
    },

    async listMatches() {
      const keys = await listKeys("connections/");
      return readMatches(keys.map((key) => key.slice("connections/".length)));
    },

    async listMatchesFor(profileId: string) {
      const keys = await listKeys(`for/${profileId}/`);
      const ids = keys.map((key) => key.slice(`for/${profileId}/`.length));
      return readMatches(ids);
    },

    async setStatus(id: string, side: "a" | "b", status: MatchStatus) {
      return updateMatch(id, (row) => {
        if (side === "a") row.aStatus = status;
        else row.bStatus = status;
      });
    },

    async setFollowUp(id: string, side: "a" | "b", value: "yes" | "not_yet") {
      const at = new Date().toISOString();
      return updateMatch(id, (row) => {
        if (side === "a") {
          row.aFollowUp = value;
          row.aFollowUpAt = at;
        } else {
          row.bFollowUp = value;
          row.bFollowUpAt = at;
        }
      });
    },

    async setText(id: string, field: MatchTextField, value: string) {
      const prop = MATCH_TEXT[field];
      return updateMatch(id, (row) => {
        (row[prop] as string) = value;
      });
    },

    async setMet(id: string) {
      return updateMatch(id, (row) => {
        row.met = true;
      });
    },

    async updateScore(id: string, score: number) {
      return updateMatch(id, (row) => {
        row.score = score;
      });
    },

    async deleteDemos() {
      const profiles = await this.listProfiles();
      for (const profile of profiles) {
        if (!profile.isDemo) continue;
        const matches = await this.listMatchesFor(profile.id);
        for (const match of matches) await deleteConnection(match);
        await blobs().delete(profileKey(profile.id));
        await blobs().delete(tokenKey(profile.secretToken));
        await blobs().delete(publicKey(profile.publicId));
      }
    },

    async deleteAll() {
      await blobs().deleteAll();
    },
  };
}
