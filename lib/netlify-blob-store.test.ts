import assert from "node:assert/strict";
import test from "node:test";
import { createNetlifyBlobStore } from "./netlify-blob-store";
import type { Submission } from "./survey";

type Entry = { value: string; etag: string };

function memoryBlobs() {
  const data = new Map<string, Entry>();
  let n = 0;
  const next = () => `e${++n}`;

  return {
    async get(key: string, options?: { type?: "json" | "text" }) {
      const entry = data.get(key);
      if (!entry) return null;
      if (options?.type === "json") return JSON.parse(entry.value);
      return entry.value;
    },
    async getWithMetadata(key: string) {
      const entry = data.get(key);
      if (!entry) return null;
      return { data: JSON.parse(entry.value), etag: entry.etag };
    },
    async set(key: string, value: string, options?: { onlyIfNew?: boolean; onlyIfMatch?: string }) {
      const current = data.get(key);
      if (options?.onlyIfNew && current) return { modified: false };
      if (options?.onlyIfMatch && current?.etag !== options.onlyIfMatch) return { modified: false };
      const etag = next();
      data.set(key, { value, etag });
      return { modified: true, etag };
    },
    async setJSON(key: string, value: unknown, options?: { onlyIfNew?: boolean; onlyIfMatch?: string }) {
      return this.set(key, JSON.stringify(value), options);
    },
    async delete(key: string) {
      data.delete(key);
    },
    async deleteAll() {
      const deletedBlobs = data.size;
      data.clear();
      return { deletedBlobs };
    },
    list({ prefix }: { prefix?: string; paginate: true }) {
      const blobs = [...data.keys()]
        .filter((key) => (prefix ? key.startsWith(prefix) : true))
        .map((key) => ({ key }));
      return (async function* () {
        yield { blobs };
      })();
    },
  };
}

const card = (name: string): Submission => ({
  name,
  contact: `${name.split(" ")[0].toLowerCase()}@example.com`,
  linkedin: "",
  role: "Builder",
  offers: ["Introductions"],
  topOffer: "Introductions",
  needs: ["Feedback"],
  topNeed: "Feedback",
  availability: "This week",
  tryingTo: `${name} is looking for a follow-up.`,
});

test("blob store keeps a confirmed connection and hides nothing until both accept", async () => {
  const store = createNetlifyBlobStore(memoryBlobs());
  const ada = await store.createProfile({ ...card("Ada Quinn"), id: "ada", publicId: "ada-public", secretToken: "ada-token" });
  const jonah = await store.createProfile({ ...card("Jonah Blake"), id: "jonah" });
  assert.deepEqual(await store.getProfileByToken("ada-token"), ada);
  assert.equal((await store.getProfileByPublicId("ada-public"))?.id, "ada");

  const first = await store.createMatch({
    aId: ada.id,
    bId: jonah.id,
    score: 4,
    explanation: "Ada wants a follow-up. Jonah does too.",
    firstAction: "Chat in Discord.",
    met: true,
    aNote: "Talked about memory.",
    aStatus: "accepted",
  });
  const again = await store.createMatch({
    aId: jonah.id,
    bId: ada.id,
    score: 1,
    explanation: "duplicate",
    firstAction: "duplicate",
  });
  assert.equal(again.id, first.id);
  assert.equal(again.aNote, "Talked about memory.");

  const confirmed = await store.setStatus(first.id, "b", "accepted");
  assert.equal(confirmed?.aStatus, "accepted");
  assert.equal(confirmed?.bStatus, "accepted");
  const followed = await store.setFollowUp(first.id, "a", "yes");
  assert.equal(followed?.aFollowUp, "yes");
  assert.ok(followed?.aFollowUpAt);
  const noted = await store.setText(first.id, "b_note", "We swapped Discord handles.");
  assert.equal(noted?.bNote, "We swapped Discord handles.");

  const home = await store.listMatchesFor(jonah.id);
  assert.equal(home.length, 1);
  assert.equal((await store.listProfiles()).length, 2);
});

test("blob store deletes demo profiles and can wipe the store", async () => {
  const store = createNetlifyBlobStore(memoryBlobs());
  await store.createProfile({ ...card("Demo Ada"), isDemo: true });
  const real = await store.createProfile(card("Real Person"));
  await store.deleteDemos();
  const left = await store.listProfiles();
  assert.deepEqual(left.map((profile) => profile.id), [real.id]);
  await store.deleteAll();
  assert.equal((await store.listProfiles()).length, 0);
});
