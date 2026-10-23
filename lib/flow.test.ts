import assert from "node:assert/strict";
import test from "node:test";
import { actOnConnection, addMet, getConnection, listHome, searchPeople } from "./connections";
import { ensureBackupPair } from "./demo-backup";
import { REMINDER_DELAY_MS } from "./event";
import { createEvent, deleteEventData, eventStats, joinEvent } from "./organiser";
import { card, tempStore } from "./test-helpers";

test("people who met both say yes before either contact is revealed", async () => {
  const store = tempStore();
  const ada = await store.createProfile(card("Ada", { contact: "email:ada-secret@example.com", answer: "Bouldering in Bermondsey" }));
  const jonah = await store.createProfile({ ...card("Jonah", { contact: "whatsapp:+447700900999" }), isDemo: true });
  const stranger = await store.createProfile(card("Stranger", { contact: "discord:nope.secret" }));
  const night = await createEvent(store, { name: "Flow night", date: "2026-11-01" });
  if (!night.ok) throw new Error("expected event");
  for (const person of [ada, jonah, stranger]) await joinEvent(store, night.event.id, person.id);

  const found = await searchPeople(store, ada.secretToken, "jon");
  assert.equal(found?.length, 1);
  assert.equal(found?.[0].name, "Jonah");
  assert.equal(JSON.stringify(found).includes("900999"), false);

  assert.equal((await addMet(store, ada.secretToken, ada.publicId, "nope")).status, 400);

  const added = await addMet(store, ada.secretToken, jonah.publicId, "the bouldering chat");
  assert.equal(added.status, 200);
  if (!("connection" in added.body)) throw new Error("expected connection");
  const id = added.body.connection.id;
  assert.equal(added.body.connection.status, "waiting_for_them");
  assert.equal(added.body.connection.other.contact, undefined);
  assert.equal(JSON.stringify(added.body).includes("900999"), false);

  const adaHome = await listHome(store, ada.secretToken);
  const jonahHome = await listHome(store, jonah.secretToken);
  assert.equal(adaHome?.connections.length, 1);
  assert.equal("contact" in (adaHome?.connections[0].other ?? {}), false);
  assert.equal(jonahHome?.connections[0].status, "waiting_for_you");
  assert.equal("contact" in (jonahHome?.connections[0].other ?? {}), false);
  assert.equal(JSON.stringify(jonahHome).includes("ada-secret"), false);
  // Own notes are private: Jonah never sees what Ada wrote about him.
  assert.equal(JSON.stringify(jonahHome).includes("the bouldering chat"), false);
  assert.equal(adaHome?.connections[0].myNote, "the bouldering chat");
  assert.equal((await listHome(store, stranger.secretToken))?.connections.length, 0);

  // The shared note and the talked-again mark open only once both say yes.
  assert.equal((await actOnConnection(store, ada.secretToken, id, { action: "shared_note", text: "x" })).status, 400);

  const mutual = await actOnConnection(store, jonah.secretToken, id, { action: "confirm" });
  if (!("connection" in mutual.body)) throw new Error("expected connection");
  assert.equal(mutual.body.connection.mutual, true);
  assert.equal(mutual.body.connection.status, "connected");
  assert.equal(mutual.body.connection.other.contact, "email:ada-secret@example.com");
  assert.equal(mutual.body.connection.other.answer, "Bouldering in Bermondsey");
  assert.equal(mutual.body.connection.myAnswer, jonah.answer);

  const shared = await actOnConnection(store, jonah.secretToken, id, { action: "shared_note", text: "Bouldering, then dumplings?" });
  assert.equal(shared.status, 200);
  const adaView = await getConnection(store, ada.secretToken, id);
  if (!("connection" in adaView.body)) throw new Error("expected connection");
  assert.equal(adaView.body.connection.sharedNote, "Bouldering, then dumplings?");
  assert.equal(adaView.body.connection.myNote, "the bouldering chat");

  await actOnConnection(store, ada.secretToken, id, { action: "my_note", text: "ask about the supper club" });
  const jonahView = await getConnection(store, jonah.secretToken, id);
  assert.equal(JSON.stringify(jonahView.body).includes("supper club"), false);

  // "Talked again?" is a private mark only the owner sees.
  const marked = await actOnConnection(store, ada.secretToken, id, { action: "talked_again" });
  if (!("connection" in marked.body)) throw new Error("expected connection");
  assert.equal(marked.body.connection.talkedAgain, true);
  assert.ok(marked.body.connection.talkedAgainAt);
  const theirSide = await getConnection(store, jonah.secretToken, id);
  if (!("connection" in theirSide.body)) throw new Error("expected connection");
  assert.equal(theirSide.body.connection.talkedAgain, false);
  const unmarked = await actOnConnection(store, ada.secretToken, id, { action: "talked_again_undo" });
  if (!("connection" in unmarked.body)) throw new Error("expected connection");
  assert.equal(unmarked.body.connection.talkedAgain, false);
  await actOnConnection(store, ada.secretToken, id, { action: "talked_again" });

  assert.equal((await actOnConnection(store, jonah.secretToken, id, { action: "simulate_demo_confirm" })).status, 400);

  let stats = await eventStats(store, night.event.id);
  if (!stats) throw new Error("expected stats");
  assert.deepEqual(stats, { talkedAgainMarks: 1, pairsTalkedAgain: 1, mutualConfirms: 1, connectionsRequested: 1, signups: 3 });
  await actOnConnection(store, jonah.secretToken, id, { action: "talked_again" });
  stats = await eventStats(store, night.event.id);
  assert.equal(stats?.talkedAgainMarks, 2);
  assert.equal(stats?.pairsTalkedAgain, 1);
  // Aggregates only: nothing per person, no names, no rankings.
  assert.equal(/ada|jonah|sam/i.test(JSON.stringify(stats)), false);

  // D34: the event's delete takes its connection and the cards that were only there.
  await deleteEventData(store, night.event.id);
  assert.equal((await store.listProfiles()).length, 0);
  assert.equal((await store.listMatches()).length, 0);
});

test("connections carry no score, reason or suggested step", async () => {
  const store = tempStore("afterflow-noscore");
  const ada = await store.createProfile(card("Ada"));
  const sam = await store.createProfile(card("Sam"));
  const added = await addMet(store, ada.secretToken, sam.publicId, "");
  if (!("connection" in added.body)) throw new Error("expected connection");
  await actOnConnection(store, sam.secretToken, added.body.connection.id, { action: "confirm" });
  const home = await listHome(store, ada.secretToken);
  const json = JSON.stringify(home);
  for (const word of ["score", "why", "explanation", "firstAction", "communityStep", "journey", "statusLabel"]) {
    assert.equal(json.includes(`"${word}"`), false, word);
  }
  const row = (await store.listMatches())[0] as unknown as Record<string, unknown>;
  assert.equal("score" in row, false);
});

test("We didn't meet hides it for both, and a later scan starts fresh", async () => {
  const store = tempStore("afterflow-decline");
  const ada = await store.createProfile(card("Ada"));
  const sam = await store.createProfile(card("Sam"));
  const added = await addMet(store, ada.secretToken, sam.publicId, "");
  if (!("connection" in added.body)) throw new Error("expected connection");
  const declined = await actOnConnection(store, sam.secretToken, added.body.connection.id, { action: "decline" });
  assert.deepEqual(declined.body, { declined: true });
  assert.equal((await listHome(store, ada.secretToken))?.connections.length, 0);
  assert.equal((await listHome(store, sam.secretToken))?.connections.length, 0);

  const again = await addMet(store, ada.secretToken, sam.publicId, "");
  if (!("connection" in again.body)) throw new Error("expected connection");
  assert.notEqual(again.body.connection.id, added.body.connection.id);
  assert.equal((await listHome(store, sam.secretToken))?.connections[0].status, "waiting_for_you");
});

test("one gentle reminder: on by default, can be turned off, at most once, skips muted people", async () => {
  const store = tempStore("afterflow-reminder");
  const ada = await store.createProfile(card("Ada"));
  const jonah = await store.createProfile(card("Jonah"));
  const mira = await store.createProfile(card("Mira"));
  for (const other of [jonah, mira]) {
    const added = await addMet(store, ada.secretToken, other.publicId, "");
    if (!("connection" in added.body)) throw new Error("expected connection");
    await actOnConnection(store, other.secretToken, added.body.connection.id, { action: "confirm" });
  }
  const later = Date.now() + REMINDER_DELAY_MS + 60_000;
  assert.equal(ada.reminders, true, "v4.1c: on for new cards");
  await store.updateProfile(ada.id, { reminders: false });
  assert.equal((await listHome(store, ada.secretToken, { now: later }))?.reminder, null, "turned off means none");

  await store.updateProfile(ada.id, { reminders: true });
  assert.equal((await listHome(store, ada.secretToken))?.reminder, null, "not before about three days");
  const home = await listHome(store, ada.secretToken, { now: later });
  const jonahCard = home?.connections.find((item) => item.other.name === "Jonah");
  await actOnConnection(store, ada.secretToken, jonahCard!.id, { action: "mute" });

  const first = await listHome(store, ada.secretToken, { now: later });
  assert.equal(first?.reminder?.name, "Mira");
  const second = await listHome(store, ada.secretToken, { now: later });
  assert.equal(second?.reminder, null, "never twice, and muted Jonah is skipped");
  assert.equal(JSON.stringify(second).match(/count|streak/i), null);
});

test("the demo pair is confirmed, labelled demo, with a shared note", async () => {
  const store = tempStore("afterflow-demo");
  const backup = await ensureBackupPair(store);
  const again = await ensureBackupPair(store);
  assert.equal(again.connectionId, backup.connectionId);
  const home = await listHome(store, backup.token);
  const pair = home?.connections.find((item) => item.id === backup.connectionId);
  assert.ok(pair);
  assert.equal(pair.mutual, true);
  assert.equal(pair.other.isDemo, true);
  assert.equal(home?.profile.isDemo, true);
  assert.ok(pair.other.contact?.startsWith("whatsapp:"));
  assert.equal(pair.sharedNote, "Bouldering, then dumplings on Tooley St?");
  assert.equal(pair.myNote, "the bouldering chat by the snacks");
});
