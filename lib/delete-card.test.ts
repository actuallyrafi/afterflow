import assert from "node:assert/strict";
import test from "node:test";
import { actOnConnection, addMet, deleteCard, listBlocked, listHome, publicCard, updateCard } from "./connections";
import { createNetlifyBlobStore } from "./netlify-blob-store";
import { memoryBlobs } from "./netlify-blob-store.test-helpers";
import type { Store } from "./store";
import { card, tempStore } from "./test-helpers";

async function scenario(store: Store) {
  const sam = await store.createProfile(card("Sam Rivera"));
  const jonah = await store.createProfile(card("Jonah Blake"));
  const pat = await store.createProfile(card("Pat Lee"));
  const keep = await store.createProfile(card("Keep Me"));
  const added = await addMet(store, sam.secretToken, jonah.publicId, "note");
  if (!("connection" in added.body)) throw new Error("expected connection");
  await actOnConnection(store, jonah.secretToken, added.body.connection.id, { action: "confirm" });
  await actOnConnection(store, jonah.secretToken, added.body.connection.id, { action: "shared_note", text: "shared" });
  const withPat = await addMet(store, pat.secretToken, sam.publicId, "");
  if (!("connection" in withPat.body)) throw new Error("expected connection");
  await actOnConnection(store, sam.secretToken, withPat.body.connection.id, { action: "block" });
  const others = await addMet(store, jonah.secretToken, keep.publicId, "");
  if (!("connection" in others.body)) throw new Error("expected connection");
  return { sam, jonah, pat, keep, keepConnection: others.body.connection.id };
}

async function checkDelete(store: Store) {
  const { sam, jonah, pat, keep, keepConnection } = await scenario(store);
  assert.equal((await listBlocked(store, sam.secretToken))?.length, 1);

  assert.equal((await deleteCard(store, sam.secretToken, "Someone else")).status, 400);
  assert.equal((await deleteCard(store, sam.secretToken, "")).status, 400);
  const done = await deleteCard(store, sam.secretToken, "  sam  ");
  assert.equal(done.status, 200);

  assert.equal(await store.getProfileById(sam.id), null);
  assert.equal(await store.getProfileByToken(sam.secretToken), null);
  assert.equal(await store.getProfileByPublicId(sam.publicId), null);
  assert.equal(await publicCard(store, sam.publicId), null, "the QR link stops working");
  assert.equal(await listHome(store, sam.secretToken), null);
  assert.equal((await store.listMatches()).some((match) => match.aId === sam.id || match.bId === sam.id), false);
  assert.deepEqual(await store.listBlocksFor(pat.id), []);
  assert.deepEqual(await store.listBlocksFor(sam.id), []);

  // Others quietly lose the row; everyone else's data stays.
  const jonahHome = await listHome(store, jonah.secretToken);
  assert.deepEqual(jonahHome?.connections.map((item) => item.id), [keepConnection]);
  assert.ok(await store.getProfileById(keep.id));
  assert.ok(await store.getProfileById(pat.id));
  assert.equal((await store.listProfiles()).length, 3);
  assert.equal((await deleteCard(store, sam.secretToken, "Sam")).status, 404);
  return sam;
}

test("delete my card removes the profile, tokens, public id, connections and blocks (file store)", async () => {
  await checkDelete(tempStore("afterflow-delete"));
});

test("delete my card does the same on Netlify Blobs and leaves no keys behind", async () => {
  const blobs = memoryBlobs();
  const store = createNetlifyBlobStore(blobs);
  const sam = await checkDelete(store);
  const left = blobs.keys().filter((key) => [sam.id, sam.secretToken, sam.publicId].some((part) => key.includes(part)));
  assert.deepEqual(left, []);
  assert.ok(blobs.keys().length > 0, "other people's keys stay");
});

test("edit my card and the reminder toggle", async () => {
  const store = tempStore("afterflow-edit");
  const sam = await store.createProfile(card("Sam"));
  const toggled = await updateCard(store, sam.secretToken, { reminders: true });
  assert.equal(toggled.status, 200);
  assert.equal((await store.getProfileById(sam.id))?.reminders, true);
  const edited = await updateCard(store, sam.secretToken, { name: "Sam R", channel: "email", contact: "sam@example.com", answer: "Pottery" });
  assert.equal(edited.status, 200);
  const after = await store.getProfileById(sam.id);
  assert.equal(after?.contact, "email:sam@example.com");
  assert.equal(after?.answer, "Pottery");
  assert.equal(after?.reminders, true);
  assert.equal((await updateCard(store, sam.secretToken, { name: "", channel: "email", contact: "x", answer: "y" })).status, 400);
});
