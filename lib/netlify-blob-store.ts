import { getStore as getBlobStore, type Store as NetlifyStore } from "@netlify/blobs";
import { normalizeEventBook, type EventBook } from "./events";
import { normalizeOrganiserEvent, type OrganiserEvent } from "./organiser";
import {
  resolveUpdate,
  applyProfilePatch,
  buildProfile,
  canonicalPair,
  initMatch,
  normalizeMatch,
  normalizeProfile,
  STORE_VERSION,
  type BlockRecord,
  type MatchUpdate,
  type MatchRow,
  type NewMatch,
  type NewProfile,
  type Profile,
  type ProfilePatch,
  type Store,
} from "./store";

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
function blockKey(blockerId: string, blockedId: string) {
  return `blocks/${blockerId}/${blockedId}`;
}
function blockedByKey(blockedId: string, blockerId: string) {
  return `blockedby/${blockedId}/${blockerId}`;
}
/** v4.1: one private book of events per person. Builds before v4.1 never read or write these keys. */
function eventBookKey(profileId: string) {
  return `eventbooks/${profileId}`;
}

/** v4.1h: one record per organiser event (D33). The live main build never reads or writes these keys. */
function organiserEventKey(id: string) {
  return `orgevents/${id}`;
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
  return guardReads(real as unknown as GuardedClient, loose as unknown as BlobClient);
}

const READ_CAP_MS = 2500;

type GuardedClient = BlobClient & {
  getMetadata(key: string, options?: { consistency?: "strong" }): Promise<unknown>;
};

/**
 * Wraps the real client's reads so a missing key answers null fast (see below). Exported for tests.
 */
export function guardReads(client: GuardedClient, looseClient: BlobClient, capMs = READ_CAP_MS): BlobClient {
  const originalGet = client.get.bind(client);
  const originalGetWithMetadata = client.getWithMetadata.bind(client);
  // Measured on the v4.1 preview (23 Oct 2026): inside Netlify's function runtime a get() of a key
  // that does not exist never resolves (strong or eventual), while getMetadata() on the same key
  // answers null in ~20ms and reads of existing keys take ~30-60ms. Every first visit reads at least
  // one missing key (the event book), so each page load waited out both 2.5s caps: ~5s.
  // So: ask for the metadata alongside the read; if the key is missing, answer null at once.
  // Existing keys cost no extra latency (both run in parallel). The caps stay as a last resort.
  const missing = (key: string, options?: { consistency?: "strong" }) =>
    client
      .getMetadata(key, options?.consistency ? { consistency: options.consistency } : undefined)
      .then((meta) => meta === null)
      .catch(() => false);
  const capped = <T,>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<"__timeout__">((resolve) => setTimeout(() => resolve("__timeout__"), ms))]);
  const orMissing = async <T,>(key: string, read: Promise<T>, options?: { consistency?: "strong" }): Promise<T | "__missing__"> => {
    read.catch(() => undefined);
    const gone = missing(key, options).then((isMissing): Promise<T | "__missing__"> | "__missing__" => (isMissing ? "__missing__" : read));
    return Promise.race<T | "__missing__">([read, gone]);
  };
  client.get = (async (key: string, options?: { type?: "json" | "text"; consistency?: "strong" }) => {
    const first = await capped(orMissing(key, originalGet(key, options), options), capMs);
    if (first === "__missing__") return null;
    if (first !== "__timeout__") return first;
    const rest = { ...(options ?? {}) };
    delete rest.consistency;
    const second = await capped(orMissing(key, looseClient.get(key, rest)), capMs);
    return second === "__timeout__" || second === "__missing__" ? null : second;
  }) as BlobClient["get"];
  client.getWithMetadata = (async (key: string, options: { type: "json"; consistency?: "strong" }) => {
    const result = await capped(orMissing(key, originalGetWithMetadata(key, options), options), capMs);
    if (result === "__missing__") return null;
    if (result === "__timeout__") throw new Error("Storage is slow right now. Try again.");
    return result;
  }) as BlobClient["getWithMetadata"];
  return client;
}

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

  // Reads go through normalize*, so cards and connections saved by older versions
  // (role, offers, score, links…) load without crashing and the old fields are ignored.
  async function readProfile(id: string): Promise<Profile | null> {
    const data = await blobs().get(profileKey(id), { type: "json", ...STRONG });
    return data ? normalizeProfile(data) : null;
  }

  async function readMatch(id: string): Promise<MatchRow | null> {
    const data = await blobs().get(connectionKey(id), { type: "json", ...STRONG });
    return data ? normalizeMatch(data) : null;
  }

  async function readProfiles(ids: string[]): Promise<Profile[]> {
    const rows = await Promise.all(ids.map((id) => readProfile(id)));
    return rows.filter((row): row is Profile => Boolean(row));
  }

  async function readMatches(ids: string[]): Promise<MatchRow[]> {
    const rows = await Promise.all(ids.map((id) => readMatch(id)));
    return rows.filter((row): row is MatchRow => Boolean(row));
  }

  async function updateMatch(id: string, mutate: (row: MatchRow) => MatchRow | null): Promise<MatchRow | null> {
    const key = connectionKey(id);
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await blobs().getWithMetadata(key, { type: "json", ...STRONG });
      const row = current?.data ? normalizeMatch(current.data) : null;
      if (!current || !row) return null;
      // Worked out again from the fresh row on every attempt, so a lost etag race never writes stale data.
      const next = mutate(row);
      if (!next) return row;
      const options = current.etag ? { onlyIfMatch: current.etag } : undefined;
      const wrote = await blobs().setJSON(key, next, options);
      if (wrote.modified || !current.etag) return next;
    }
    throw new Error("Could not save that connection. Try again.");
  }

  async function updateProfileRow(id: string, mutate: (row: Profile) => Profile): Promise<Profile | null> {
    const key = profileKey(id);
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await blobs().getWithMetadata(key, { type: "json", ...STRONG });
      const row = current?.data ? normalizeProfile(current.data) : null;
      if (!current || !row) return null;
      const next = mutate(row);
      const options = current.etag ? { onlyIfMatch: current.etag } : undefined;
      const wrote = await blobs().setJSON(key, next, options);
      if (wrote.modified || !current.etag) return next;
    }
    throw new Error("Could not save that card. Try again.");
  }

  async function indexConnection(row: MatchRow) {
    await blobs().set(forKey(row.aId, row.id), "1");
    await blobs().set(forKey(row.bId, row.id), "1");
  }

  async function deleteConnection(row: Pick<MatchRow, "id" | "aId" | "bId">) {
    await blobs().delete(connectionKey(row.id));
    await blobs().delete(pairKey(row.aId, row.bId));
    await blobs().delete(forKey(row.aId, row.id));
    await blobs().delete(forKey(row.bId, row.id));
  }

  async function readBlock(blockerId: string, blockedId: string): Promise<BlockRecord | null> {
    const data = await blobs().get(blockKey(blockerId, blockedId), { type: "json", ...STRONG });
    if (!data || typeof data !== "object") return null;
    const row = data as Partial<BlockRecord>;
    return { blockerId, blockedId, createdAt: typeof row.createdAt === "string" ? row.createdAt : "" };
  }

  async function deleteBlock(blockerId: string, blockedId: string) {
    await blobs().delete(blockKey(blockerId, blockedId));
    await blobs().delete(blockedByKey(blockedId, blockerId));
  }

  const store: Store = {
    version: STORE_VERSION,
    kind: "netlify-blobs",

    async createProfile(input: NewProfile) {
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

    async updateProfile(id: string, patch: ProfilePatch) {
      return updateProfileRow(id, (row) => applyProfilePatch(row, patch));
    },

    async deleteProfile(id: string) {
      const profile = await readProfile(id);
      // Connections, found through this person's index and, in case an index write was lost,
      // through the pair keys that name them.
      const matches = await store.listMatchesFor(id);
      for (const match of matches) await deleteConnection(match);
      for (const key of await listKeys("pairs/")) {
        const ids = key.slice("pairs/".length).split("_");
        if (!ids.includes(id)) continue;
        const connectionId = await blobs().get(key, { ...STRONG });
        if (typeof connectionId === "string" && connectionId) {
          const [aId, bId] = ids;
          await deleteConnection({ id: connectionId, aId, bId });
        } else {
          await blobs().delete(key);
        }
      }
      for (const key of await listKeys(`for/${id}/`)) await blobs().delete(key);
      for (const block of await store.listBlocksFor(id)) await deleteBlock(block.blockerId, block.blockedId);
      if (profile) {
        if (profile.secretToken) await blobs().delete(tokenKey(profile.secretToken));
        if (profile.publicId) await blobs().delete(publicKey(profile.publicId));
      }
      await blobs().delete(eventBookKey(id));
      await blobs().delete(profileKey(id));
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
          // A stale pair claim with no connection behind it: take it over.
          await blobs().set(key, row.id);
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

    async patchMatch(id: string, patch: MatchUpdate) {
      return updateMatch(id, (row) => resolveUpdate(row, patch));
    },

    async deleteMatch(id: string) {
      const row = await readMatch(id);
      if (row) await deleteConnection(row);
      else await blobs().delete(connectionKey(id));
    },

    async addBlock(blockerId: string, blockedId: string) {
      const existing = await readBlock(blockerId, blockedId);
      if (existing) return existing;
      const record: BlockRecord = { blockerId, blockedId, createdAt: new Date().toISOString() };
      await blobs().setJSON(blockKey(blockerId, blockedId), record);
      await blobs().set(blockedByKey(blockedId, blockerId), "1");
      return record;
    },

    async removeBlock(blockerId: string, blockedId: string) {
      await deleteBlock(blockerId, blockedId);
    },

    async listBlocksFor(profileId: string) {
      const mine = (await listKeys(`blocks/${profileId}/`)).map((key) => key.slice(`blocks/${profileId}/`.length));
      const theirs = (await listKeys(`blockedby/${profileId}/`)).map((key) => key.slice(`blockedby/${profileId}/`.length));
      const rows = await Promise.all([
        ...mine.map((blockedId) => readBlock(profileId, blockedId)),
        ...theirs.map((blockerId) => readBlock(blockerId, profileId)),
      ]);
      return rows.filter((row): row is BlockRecord => Boolean(row));
    },

    async readEventBook(profileId: string) {
      const data = await blobs().get(eventBookKey(profileId), { type: "json", ...STRONG });
      return data ? normalizeEventBook(data) : null;
    },

    async updateEventBook(profileId: string, mutate: (current: EventBook | null) => EventBook | null) {
      const key = eventBookKey(profileId);
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = await blobs().getWithMetadata(key, { type: "json", ...STRONG });
        const book = current?.data ? normalizeEventBook(current.data) : null;
        const next = mutate(book);
        if (!next) return book;
        const options = current?.etag ? { onlyIfMatch: current.etag } : current ? undefined : { onlyIfNew: true };
        const wrote = await blobs().setJSON(key, next, options);
        if (wrote.modified || (current && !current.etag)) return next;
      }
      throw new Error("Could not save your events. Try again.");
    },

    async deleteDemos() {
      const profiles = await store.listProfiles();
      for (const profile of profiles) {
        if (!profile.isDemo) continue;
        await store.deleteProfile(profile.id);
      }
    },

    async listOrganiserEvents() {
      const keys = await listKeys("orgevents/");
      const rows = await Promise.all(keys.map((key) => blobs().get(key, { type: "json", ...STRONG })));
      return rows.map((row) => normalizeOrganiserEvent(row)).filter((row): row is OrganiserEvent => Boolean(row));
    },

    async readOrganiserEvent(id: string) {
      const data = await blobs().get(organiserEventKey(id), { type: "json", ...STRONG });
      return data ? normalizeOrganiserEvent(data) : null;
    },

    async updateOrganiserEvent(id: string, mutate: (current: OrganiserEvent | null) => OrganiserEvent | null) {
      const key = organiserEventKey(id);
      for (let attempt = 0; attempt < 6; attempt++) {
        const current = await blobs().getWithMetadata(key, { type: "json", ...STRONG });
        const row = current?.data ? normalizeOrganiserEvent(current.data) : null;
        const next = mutate(row);
        if (!next) return row;
        const options = current?.etag ? { onlyIfMatch: current.etag } : current ? undefined : { onlyIfNew: true };
        const wrote = await blobs().setJSON(key, next, options);
        if (wrote.modified || (current && !current.etag)) return next;
      }
      throw new Error("Could not save the event. Try again.");
    },
  };
  return store;
}
