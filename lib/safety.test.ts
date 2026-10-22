import assert from "node:assert/strict";
import test from "node:test";
import { actOnConnection, addMet, getConnection, listBlocked, listHome, PURGE_AFTER_MS, searchPeople, unblock } from "./connections";
import { card, tempStore } from "./test-helpers";

async function connected(label: string) {
  const store = tempStore(label);
  const sam = await store.createProfile(card("Sam Rivera"));
  const jonah = await store.createProfile(card("Jonah Blake", { contact: "whatsapp:+447700900123" }));
  const added = await addMet(store, sam.secretToken, jonah.publicId, "the bouldering chat");
  if (!("connection" in added.body)) throw new Error("expected connection");
  await actOnConnection(store, jonah.secretToken, added.body.connection.id, { action: "confirm" });
  return { store, sam, jonah, id: added.body.connection.id };
}

test("mute is private to the muter and undoable", async () => {
  const { store, sam, jonah, id } = await connected("afterflow-mute");
  const muted = await actOnConnection(store, sam.secretToken, id, { action: "mute" });
  if (!("connection" in muted.body)) throw new Error("expected connection");
  assert.equal(muted.body.connection.muted, true);
  const theirs = await getConnection(store, jonah.secretToken, id);
  if (!("connection" in theirs.body)) throw new Error("expected connection");
  assert.equal(theirs.body.connection.muted, false, "Jonah can't tell");
  assert.equal(JSON.stringify(await listHome(store, jonah.secretToken)).includes('"muted":true'), false);
  const back = await actOnConnection(store, sam.secretToken, id, { action: "unmute" });
  if (!("connection" in back.body)) throw new Error("expected connection");
  assert.equal(back.body.connection.muted, false);
});

test("remove hides it for both without telling anyone, undo restores, then it's deleted", async () => {
  const { store, sam, jonah, id } = await connected("afterflow-remove");
  const removed = await actOnConnection(store, sam.secretToken, id, { action: "remove" });
  assert.deepEqual(removed.body, { removed: true });
  assert.equal((await listHome(store, sam.secretToken))?.connections.length, 0);
  const theirs = await listHome(store, jonah.secretToken);
  assert.equal(theirs?.connections.length, 0);
  assert.equal(JSON.stringify(theirs).includes("remov"), false);

  // Only the remover can undo.
  assert.equal((await actOnConnection(store, jonah.secretToken, id, { action: "undo_remove" })).status, 404);
  const undone = await actOnConnection(store, sam.secretToken, id, { action: "undo_remove" });
  assert.equal(undone.status, 200);
  assert.equal((await listHome(store, jonah.secretToken))?.connections.length, 1);

  await actOnConnection(store, sam.secretToken, id, { action: "remove" });
  await listHome(store, sam.secretToken, { now: Date.now() + PURGE_AFTER_MS + 1000 });
  assert.equal(await store.getMatchById(id), null, "data is kept only until someone removes the connection");

  // Remove isn't a block: they can connect again later as a fresh request.
  const again = await addMet(store, jonah.secretToken, sam.publicId, "");
  assert.equal(again.status, 200);
  if (!("connection" in again.body)) throw new Error("expected connection");
  assert.equal(again.body.connection.status, "waiting_for_them");
  assert.equal((await listHome(store, sam.secretToken))?.connections[0].status, "waiting_for_you");
});

test("block hides you both, drops new requests silently, and only the blocker can see it", async () => {
  const { store, sam, jonah, id } = await connected("afterflow-block");
  const blocked = await actOnConnection(store, sam.secretToken, id, { action: "block" });
  assert.deepEqual(blocked.body, { blocked: true });
  assert.equal((await listHome(store, sam.secretToken))?.connections.length, 0);
  assert.equal((await listHome(store, jonah.secretToken))?.connections.length, 0);
  assert.equal((await getConnection(store, jonah.secretToken, id)).status, 404);

  // Toast undo restores everything as it was.
  const undone = await actOnConnection(store, sam.secretToken, id, { action: "undo_block" });
  assert.equal(undone.status, 200);
  assert.equal((await listHome(store, jonah.secretToken))?.connections[0].mutual, true);
  assert.equal((await listBlocked(store, sam.secretToken))?.length, 0);

  await actOnConnection(store, sam.secretToken, id, { action: "block" });
  await listHome(store, sam.secretToken, { now: Date.now() + PURGE_AFTER_MS + 1000 });
  assert.equal(await store.getMatchById(id), null, "notes and Say hi are gone for both");

  // Excluded from each other's search.
  assert.deepEqual(await searchPeople(store, sam.secretToken, "jon"), []);
  assert.deepEqual(await searchPeople(store, jonah.secretToken, "sam"), []);

  // Jonah scans Sam's card again: an ordinary "waiting" that never reaches Sam.
  const retry = await addMet(store, jonah.secretToken, sam.publicId, "hello again");
  assert.equal(retry.status, 200);
  if (!("connection" in retry.body)) throw new Error("expected connection");
  assert.equal(retry.body.connection.status, "waiting_for_them");
  const jonahHome = await listHome(store, jonah.secretToken);
  assert.equal(jonahHome?.connections.length, 1);
  assert.equal(jonahHome?.connections[0].status, "waiting_for_them");
  assert.equal(/block|shadow/i.test(JSON.stringify(jonahHome)), false, "no blocked field for them");
  assert.equal((await listHome(store, sam.secretToken))?.connections.length, 0);
  // Even confirming from Sam's side isn't possible: Sam can't see it.
  assert.equal((await actOnConnection(store, sam.secretToken, retry.body.connection.id, { action: "confirm" })).status, 404);
  // Sam re-adding Jonah is told plainly, because Sam knows.
  assert.equal((await addMet(store, sam.secretToken, jonah.publicId, "")).status, 409);

  const list = await listBlocked(store, sam.secretToken);
  assert.equal(list?.length, 1);
  assert.equal(list?.[0].name, "Jonah Blake");
  assert.ok(list?.[0].blockedAt);
  assert.deepEqual(await listBlocked(store, jonah.secretToken), []);

  // Unblocking doesn't reconnect you or tell them.
  const freed = await unblock(store, sam.secretToken, jonah.publicId);
  assert.equal(freed.status, 200);
  assert.equal((await listHome(store, sam.secretToken))?.connections.length, 0);
  assert.equal((await listHome(store, jonah.secretToken))?.connections.length, 0);
  assert.equal((await addMet(store, sam.secretToken, jonah.publicId, "")).status, 200);
});
