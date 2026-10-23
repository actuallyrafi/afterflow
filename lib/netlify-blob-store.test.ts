import assert from "node:assert/strict";
import test from "node:test";
import { actOnConnection, addMet, listHome, publicCard } from "./connections";
import { createNetlifyBlobStore } from "./netlify-blob-store";
import { memoryBlobs } from "./netlify-blob-store.test-helpers";
import { card } from "./test-helpers";

test("blob store keeps a confirmed connection and hides contacts until both accept", async () => {
  const store = createNetlifyBlobStore(memoryBlobs());
  const ada = await store.createProfile({ ...card("Ada Quinn"), id: "ada", publicId: "ada-public", secretToken: "ada-token" });
  const jonah = await store.createProfile({ ...card("Jonah Blake"), id: "jonah" });
  assert.deepEqual(await store.getProfileByToken("ada-token"), ada);
  assert.equal((await store.getProfileByPublicId("ada-public"))?.id, "ada");

  const first = await store.createMatch({ aId: ada.id, bId: jonah.id, met: true, aNote: "Talked about memory.", aStatus: "accepted" });
  const again = await store.createMatch({ aId: jonah.id, bId: ada.id });
  assert.equal(again.id, first.id);
  assert.equal(again.aNote, "Talked about memory.");

  const confirmed = await store.patchMatch(first.id, { bStatus: "accepted" });
  assert.equal(confirmed?.aStatus, "accepted");
  assert.equal(confirmed?.bStatus, "accepted");
  const muted = await store.patchMatch(first.id, { aMuted: true, sharedNote: "Dumplings?" });
  assert.equal(muted?.aMuted, true);
  assert.equal(muted?.bMuted, false);
  assert.equal(muted?.sharedNote, "Dumplings?");
  assert.equal((await store.listMatchesFor(jonah.id)).length, 1);
  assert.equal((await store.listProfiles()).length, 2);

  await store.addBlock(ada.id, jonah.id);
  assert.equal((await store.listBlocksFor(jonah.id)).length, 1);
  assert.equal((await store.listBlocksFor(ada.id))[0].blockerId, ada.id);
  await store.removeBlock(ada.id, jonah.id);
  assert.equal((await store.listBlocksFor(jonah.id)).length, 0);

  await store.deleteMatch(first.id);
  assert.equal((await store.listMatchesFor(jonah.id)).length, 0);
  const fresh = await store.createMatch({ aId: jonah.id, bId: ada.id });
  assert.notEqual(fresh.id, first.id);
});

test("cards and connections saved before v4 still load, old fields ignored", async () => {
  const blobs = memoryBlobs();
  const old = {
    name: "Old Card",
    contact: "old@example.com",
    linkedin: "https://www.linkedin.com/in/old",
    role: "Full-stack engineer",
    offers: ["Coding"],
    topOffer: "Coding",
    needs: ["Design"],
    topNeed: "Design",
    availability: "Right now at the event",
    tryingTo: "Shipping an AI study app",
    id: "old-id",
    publicId: "old-public",
    consentAt: "2026-10-22T20:26:32.173Z",
    createdAt: "2026-10-22T20:26:32.173Z",
    secretToken: "old-token",
    isDemo: false,
  };
  const other = { ...old, name: "Other Old", contact: "otherhandle", id: "other-id", publicId: "other-public", secretToken: "other-token", tryingTo: "Design" };
  for (const row of [old, other]) {
    blobs.raw(`profiles/${row.id}`, row);
    blobs.raw(`tokens/${row.secretToken}`, row.id);
    blobs.raw(`public/${row.publicId}`, row.id);
  }
  const match = {
    id: "m1", aId: "old-id", bId: "other-id", score: 7, explanation: "Old reason", firstAction: "Post in #team-up",
    aStatus: "accepted", bStatus: "accepted", createdAt: "2026-10-22T20:30:00.000Z", aFollowUp: "yes",
    aFollowUpAt: "2026-10-22T21:00:00.000Z", bFollowUp: null, bFollowUpAt: null, met: true, aNote: "mine", bNote: "theirs",
    aLink: "https://github.com/x", bLink: "", aTime: "Thursday", bTime: "",
  };
  blobs.raw("connections/m1", match);
  blobs.raw("pairs/old-id_other-id", "m1");
  blobs.raw("for/old-id/m1", "1");
  blobs.raw("for/other-id/m1", "1");

  const store = createNetlifyBlobStore(blobs);
  const home = await listHome(store, "old-token");
  assert.ok(home);
  assert.equal(home.profile.answer, "Shipping an AI study app");
  assert.equal(home.profile.channel, "email");
  assert.equal(home.connections.length, 1);
  const conn = home.connections[0];
  assert.equal(conn.mutual, true);
  assert.equal(conn.talkedAgain, true);
  assert.equal(conn.myNote, "mine");
  assert.equal(conn.other.answer, "Design");
  assert.equal(conn.other.contact, "otherhandle");
  const json = JSON.stringify(home);
  for (const legacy of ["linkedin", "role", "offers", "Old reason", "#team-up", "github.com", "theirs"]) {
    assert.equal(json.includes(legacy), false, legacy);
  }
  assert.equal((await publicCard(store, "old-public"))?.answer, "Shipping an AI study app");
  const muted = await actOnConnection(store, "old-token", "m1", { action: "mute" });
  assert.equal(muted.status, 200);
  const added = await addMet(store, "other-token", "old-public", "");
  assert.equal(added.status, 200);
});

test("blob store deletes demo profiles and has no way to wipe the store", async () => {
  const store = createNetlifyBlobStore(memoryBlobs());
  await store.createProfile({ ...card("Demo Ada"), isDemo: true });
  const real = await store.createProfile(card("Real Person"));
  await store.deleteDemos();
  const left = await store.listProfiles();
  assert.deepEqual(left.map((profile) => profile.id), [real.id]);
  assert.equal("deleteAll" in store, false);
});
