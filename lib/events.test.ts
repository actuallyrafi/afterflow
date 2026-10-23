import assert from "node:assert/strict";
import test from "node:test";
import { actOnConnection, addMet, editEvents, getConnection, listEvents, listHome } from "./connections";
import { applyEventEdit, autoFile, currentUntil, emptyBook, eventLabel, normalizeEventBook, SEED_CUTOFF, SEED_EVENT, seededBook } from "./events";
import { createNetlifyBlobStore } from "./netlify-blob-store";
import { memoryBlobs } from "./netlify-blob-store.test-helpers";
import type { Store } from "./store";
import { card, tempStore } from "./test-helpers";

type View = {
  events: { id: string; name: string; label: string; marks: { name: string; seed: string }[]; empty: boolean }[];
  unfiled: { marks: { name: string }[]; empty: boolean };
  current: { eventId: string; until: string } | null;
  eventId?: string;
  deleted?: { event: unknown; connectionIds: string[] };
  previous?: string;
};

async function ev(store: Store, token: string, body: Record<string, unknown>): Promise<View> {
  const result = await editEvents(store, token, body);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body as unknown as View;
}

async function connect(store: Store, left: { secretToken: string }, right: { secretToken: string; publicId: string }) {
  const added = await addMet(store, left.secretToken, right.publicId, "");
  if (!("connection" in added.body)) throw new Error("expected connection");
  return added.body.connection.id;
}

test("create an event, file someone in it, rename it; label reads 'Name · 22 Oct'", async () => {
  const store = tempStore("afterflow-events");
  const ada = await store.createProfile(card("Ada"));
  const jonah = await store.createProfile(card("Jonah"));
  const id = await connect(store, ada, jonah);

  const made = await ev(store, ada.secretToken, { action: "create", name: "  Builders   Breakfast ", date: "2026-10-30" });
  const eventId = made.eventId!;
  assert.equal(made.events.find((e) => e.id === eventId)?.label, "Builders Breakfast · 30 Oct");
  assert.equal(eventLabel({ name: "Grok Bot London", date: "2026-10-22" }), "Grok Bot London · 22 Oct");

  const filed = await ev(store, ada.secretToken, { action: "file", connectionId: id, eventId });
  assert.equal(filed.events.find((e) => e.id === eventId)?.marks.length, 1);
  assert.equal(filed.events.find((e) => e.id === eventId)?.empty, false);
  assert.notEqual(filed.previous, eventId, "Undo knows where they were before");
  assert.equal(typeof filed.previous, "string");
  const home = await listHome(store, ada.secretToken);
  assert.equal(home?.connections[0].eventId, eventId);

  const renamed = await ev(store, ada.secretToken, { action: "rename", eventId, name: "Breakfast club" });
  assert.equal(renamed.events.find((e) => e.id === eventId)?.name, "Breakfast club");

  // Bad input is refused, nothing changes.
  assert.equal((await editEvents(store, ada.secretToken, { action: "create", name: "", date: "2026-10-30" })).status, 400);
  assert.equal((await editEvents(store, ada.secretToken, { action: "create", name: "X", date: "2026-02-31" })).status, 400);
  assert.equal((await editEvents(store, ada.secretToken, { action: "file", connectionId: "not-mine", eventId })).status, 404);
  assert.equal((await editEvents(store, "nope", { action: "end" })).status, 404);

  // Move back out.
  const out = await ev(store, ada.secretToken, { action: "file", connectionId: id, eventId: null });
  assert.equal(out.events.find((e) => e.id === eventId)?.empty, true);
});

test("deleting an event moves people back to unfiled and never deletes connections", async () => {
  const store = tempStore("afterflow-events-delete");
  const ada = await store.createProfile(card("Ada"));
  const jonah = await store.createProfile(card("Jonah"));
  const mira = await store.createProfile(card("Mira"));
  const one = await connect(store, ada, jonah);
  const two = await connect(store, ada, mira);
  const { eventId } = await ev(store, ada.secretToken, { action: "create", name: "Meetup", date: "2026-10-24", startNow: true });
  await ev(store, ada.secretToken, { action: "file", connectionId: one, eventId });
  await ev(store, ada.secretToken, { action: "file", connectionId: two, eventId });

  const after = await ev(store, ada.secretToken, { action: "delete", eventId });
  assert.equal(after.events.some((e) => e.id === eventId), false);
  assert.equal(after.current, null, "deleting the current event ends it");
  const home = await listHome(store, ada.secretToken);
  assert.equal(home?.connections.length, 2);
  assert.deepEqual(home?.connections.map((c) => c.eventId), [null, null]);
  assert.equal((await store.listMatchesFor(ada.id)).length, 2);
});

test("I'm at an event now: new connections are filed automatically, for 24 hours or until ended", async () => {
  const store = tempStore("afterflow-events-current");
  const ada = await store.createProfile(card("Ada"));
  const jonah = await store.createProfile(card("Jonah"));
  const mira = await store.createProfile(card("Mira"));
  const sam = await store.createProfile(card("Sam"));
  const { eventId } = await ev(store, ada.secretToken, { action: "create", name: "Demo night", date: "2026-10-24", startNow: true });
  assert.equal((await listEvents(store, ada.secretToken))?.current?.eventId, eventId);

  // Ada scans Jonah: filed for Ada.
  const one = await connect(store, ada, jonah);
  assert.equal((await listHome(store, ada.secretToken))?.connections.find((c) => c.id === one)?.eventId, eventId);
  // Mira scans Ada: it's a new connection while Ada is at the event, so it's filed for Ada too.
  const two = await connect(store, mira, ada);
  assert.equal((await listHome(store, ada.secretToken))?.connections.find((c) => c.id === two)?.eventId, eventId);

  await ev(store, ada.secretToken, { action: "end" });
  const three = await connect(store, ada, sam);
  assert.equal((await listHome(store, ada.secretToken))?.connections.find((c) => c.id === three)?.eventId, null);

  // It runs out by itself: 12 hours, or 04:00 London time, whichever comes first.
  const t0 = Date.parse("2026-10-23T10:00:00Z");
  const book = applyEventEdit(emptyBook(), { action: "create", name: "X", date: "2026-10-24", startNow: true }, { now: t0, newId: () => "x" });
  assert.ok(book.ok);
  if (!book.ok) return;
  assert.equal(book.book.current?.until, "2026-10-23T22:00:00.000Z", "12 hours");
  assert.equal(autoFile(book.book, "c1", t0 + 12 * 3600_000 - 1)?.filed.c1, "x");
  assert.equal(autoFile(book.book, "c1", t0 + 12 * 3600_000 + 1), null);
  // Started at 21:00 BST on the night the clocks go back: off at 04:00 GMT, not 12 hours later.
  assert.equal(currentUntil(Date.parse("2026-10-24T20:00:00Z")), "2026-10-25T04:00:00.000Z");
  // Started at 01:00: off at 04:00 the same morning.
  assert.equal(currentUntil(Date.parse("2026-10-23T00:00:00Z")), "2026-10-23T03:00:00.000Z");
});

test("events are private per side: my filing doesn't change theirs, and they never see my events", async () => {
  const store = tempStore("afterflow-events-privacy");
  const ada = await store.createProfile(card("Ada"));
  const jonah = await store.createProfile(card("Jonah"));
  const id = await connect(store, ada, jonah);
  await actOnConnection(store, jonah.secretToken, id, { action: "confirm" });
  const { eventId } = await ev(store, ada.secretToken, { action: "create", name: "Ada's secret supper club", date: "2026-10-24" });
  await ev(store, ada.secretToken, { action: "file", connectionId: id, eventId });

  const jonahHome = await listHome(store, jonah.secretToken);
  assert.notEqual(jonahHome?.connections[0].eventId, eventId);
  assert.equal(JSON.stringify(jonahHome).includes("secret supper club"), false);
  const jonahView = await getConnection(store, jonah.secretToken, id);
  assert.equal(JSON.stringify(jonahView.body).includes("secret supper club"), false);
  // Jonah can't file into Ada's event by id.
  assert.equal((await editEvents(store, jonah.secretToken, { action: "file", connectionId: id, eventId })).status, 404);
  assert.equal((await listHome(store, ada.secretToken))?.connections[0].eventId, eventId);
});

test("migration is lazy: older cards see Grok Bot London with their older connections, and nothing is written until they edit", async () => {
  const blobs = memoryBlobs();
  const store = createNetlifyBlobStore(blobs);
  const before = new Date(SEED_CUTOFF - 6 * 60 * 60 * 1000).toISOString();
  // Records exactly as the live build wrote them: single contact, no events.
  blobs.raw("profiles/old-ada", { id: "old-ada", publicId: "pa", name: "Ada", contact: "email:ada@example.com", answer: "Bouldering", consentAt: before, createdAt: before, secretToken: "tok-ada", isDemo: false });
  blobs.raw("tokens/tok-ada", "old-ada");
  blobs.raw("public/pa", "old-ada");
  blobs.raw("profiles/old-jo", { id: "old-jo", publicId: "pj", name: "Jonah", contact: "discord:jonah", answer: "Film", consentAt: before, createdAt: before, secretToken: "tok-jo", isDemo: false });
  blobs.raw("tokens/tok-jo", "old-jo");
  blobs.raw("public/pj", "old-jo");
  blobs.raw("connections/m1", { id: "m1", aId: "old-ada", bId: "old-jo", aStatus: "accepted", bStatus: "accepted", createdAt: before, met: true, score: 71, explanation: "old" });
  blobs.raw("pairs/old-ada_old-jo", "m1");
  blobs.raw("for/old-ada/m1", "1");
  blobs.raw("for/old-jo/m1", "1");

  const home = await listHome(store, "tok-ada");
  assert.equal(home?.events.events[0]?.id, SEED_EVENT.id);
  assert.equal(home?.events.events[0]?.label, "Grok Bot London · 22 Oct");
  assert.deepEqual(home?.events.events[0]?.marks.map((mark) => mark.name), ["Jonah"]);
  assert.equal(home?.connections[0].eventId, SEED_EVENT.id);
  assert.equal(blobs.keys().some((key) => key.startsWith("eventbooks/")), false, "reading writes nothing");

  // First edit materialises Ada's book only; Jonah's stays virtual.
  await editEvents(store, "tok-ada", { action: "create", name: "Next one", date: "2026-11-05" });
  assert.deepEqual(blobs.keys().filter((key) => key.startsWith("eventbooks/")), ["eventbooks/old-ada"]);
  const again = await listHome(store, "tok-ada");
  assert.equal(again?.connections[0].eventId, SEED_EVENT.id);
  assert.equal(again?.events.events.length, 2);

  // New cards start empty, and the seed never catches newer connections.
  assert.deepEqual(seededBook({ createdAt: new Date(SEED_CUTOFF + 1000).toISOString() }, []), emptyBook());
  const seeded = seededBook({ createdAt: before }, [
    { id: "old", createdAt: before },
    { id: "new", createdAt: new Date(SEED_CUTOFF + 1000).toISOString() },
  ]);
  assert.deepEqual(Object.keys(seeded.filed), ["old"]);

  // Deleting a card removes its book too.
  await store.deleteProfile("old-ada");
  assert.equal(blobs.keys().some((key) => key.startsWith("eventbooks/")), false);
});

test("stored books are read tolerantly: unknown events and broken entries are dropped", () => {
  assert.equal(normalizeEventBook("not json"), null);
  const book = normalizeEventBook({
    events: [{ id: "a", name: "A", date: "2026-10-22" }, { id: "b", name: "", date: "2026-10-22" }, { id: "c", name: "C", date: "nope" }],
    filed: { m1: "a", m2: "zzz", m3: 4 },
    current: { eventId: "zzz", until: "2026-10-24T00:00:00Z" },
  });
  assert.deepEqual(book?.events.map((e) => e.id), ["a"]);
  assert.deepEqual(book?.filed, { m1: "a" });
  assert.equal(book?.current, null);
});

test("delete then Undo puts the event back with the same people; a move reports where they were", async () => {
  const store = tempStore("afterflow-events-undo");
  const ada = await store.createProfile(card("Ada"));
  const jo = await store.createProfile(card("Jonah"));
  const mi = await store.createProfile(card("Mira"));
  const one = await connect(store, ada, jo);
  const two = await connect(store, ada, mi);
  const { eventId } = await ev(store, ada.secretToken, { action: "create", name: "Climbing social", date: "" });
  assert.notEqual((await ev(store, ada.secretToken, { action: "file", connectionId: one, eventId })).previous, eventId);
  await ev(store, ada.secretToken, { action: "file", connectionId: two, eventId });
  const gone = await ev(store, ada.secretToken, { action: "delete", eventId });
  assert.deepEqual(gone.deleted?.connectionIds.sort(), [one, two].sort());
  assert.equal(gone.events.some((e) => e.id === eventId), false);
  const back = await ev(store, ada.secretToken, { action: "restore", event: gone.deleted?.event, connectionIds: gone.deleted?.connectionIds });
  assert.equal(back.eventId, eventId);
  assert.equal(back.events.find((e) => e.id === eventId)?.marks.length, 2);
  const home = await listHome(store, ada.secretToken);
  assert.ok(home?.connections.every((c) => c.eventId === eventId));
  // Restore can't file someone else's connection.
  const eve = await store.createProfile(card("Eve"));
  const r = await editEvents(store, eve.secretToken, { action: "restore", event: gone.deleted?.event, connectionIds: [one] });
  assert.equal(r.status, 200);
  assert.equal((r.body as unknown as View).events.find((e) => e.id === eventId)?.empty, true);
});

test("an event shows at most three marks and never a count", async () => {
  const store = tempStore("afterflow-events-marks");
  const ada = await store.createProfile(card("Ada"));
  const { eventId } = await ev(store, ada.secretToken, { action: "create", name: "Big night", date: "2026-10-24", startNow: true });
  for (const name of ["Bo", "Cy", "Di", "Ed", "Fa"]) {
    const other = await store.createProfile(card(name));
    await connect(store, ada, other);
  }
  const view = await listEvents(store, ada.secretToken);
  const big = view?.events.find((e) => e.id === eventId);
  assert.equal(big?.marks.length, 3);
  assert.equal(JSON.stringify(view).match(/"(people|count|total)"/), null, "no counts in the payload");
});

test("meet confirm can override the live event: '' means No event, an id files it there", async () => {
  const store = tempStore("afterflow-events-choice");
  const ada = await store.createProfile(card("Ada"));
  const { eventId: live } = await ev(store, ada.secretToken, { action: "create", name: "Live", date: "2026-10-24", startNow: true });
  const { eventId: other } = await ev(store, ada.secretToken, { action: "create", name: "Other", date: "2026-10-01" });
  const bo = await store.createProfile(card("Bo"));
  const cy = await store.createProfile(card("Cy"));
  const di = await store.createProfile(card("Di"));
  const a = await addMet(store, ada.secretToken, bo.publicId, "", "");
  const b = await addMet(store, ada.secretToken, cy.publicId, "", other);
  const c = await addMet(store, ada.secretToken, di.publicId, "");
  const id = (r: typeof a) => ("connection" in r.body ? r.body.connection.id : "");
  const home = await listHome(store, ada.secretToken);
  const where = (cid: string) => home?.connections.find((x) => x.id === cid)?.eventId ?? null;
  assert.equal(where(id(a)), null);
  assert.equal(where(id(b)), other);
  assert.equal(where(id(c)), live);
});
