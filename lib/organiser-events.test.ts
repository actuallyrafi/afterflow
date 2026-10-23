// v4.1h (D33, D34): per-event organiser access and the scoped delete. Temp stores only.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { actOnConnection, addMet } from "./connections";
import {
  createEvent,
  deleteEventData,
  eventStats,
  hashKey,
  joinEvent,
  keyMatches,
  LEGACY_EVENT_ID,
  legacyEvent,
  listEvents,
  statsFor,
  resetThrottle,
  rotateKey,
} from "./organiser";
import { SEED_CUTOFF } from "./events";
import type { Store } from "./store";
import { card, tempStore } from "./test-helpers";

const MASTER = "test-only-master-Q4z";

function useStore(store: Store) {
  process.env.STORAGE = "file";
  process.env.ORGANISER_PASSCODE = MASTER;
  (globalThis as unknown as { __afterflow?: Store }).__afterflow = store;
  resetThrottle();
}

const routes = async () => ({
  list: await import("../app/api/organiser/route"),
  one: await import("../app/api/organiser/events/[eventId]/route"),
});

const req = (url: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) =>
  new Request(`http://test${url}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: { "content-type": "application/json", "x-nf-client-connection-ip": "10.0.0.1", ...(init.headers ?? {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
const ctx = (eventId: string) => ({ params: Promise.resolve({ eventId }) });

/** Two events, each with two members who met, confirmed and (in A) marked talked again. */
async function twoEvents(store: Store) {
  const a = await createEvent(store, { name: "Event A", date: "2026-11-01" });
  const b = await createEvent(store, { name: "Event B", date: "2026-11-02" });
  if (!a.ok || !b.ok) throw new Error("events");
  const people = [];
  for (const [name, ev] of [["Ann", a], ["Abe", a], ["Bea", b], ["Bob", b]] as const) {
    const p = await store.createProfile(card(name));
    await joinEvent(store, ev.event.id, p.id);
    people.push(p);
  }
  const [ann, abe, bea, bob] = people;
  for (const [x, y] of [[ann, abe], [bea, bob]]) {
    const made = await addMet(store, x.secretToken, y.publicId, "");
    if (!("connection" in made.body)) throw new Error("connection");
    await actOnConnection(store, y.secretToken, made.body.connection.id, { action: "confirm" });
    if (x === ann) await actOnConnection(store, x.secretToken, made.body.connection.id, { action: "talked_again" });
  }
  return { a, b, ann, abe, bea, bob };
}

test("keys: random, URL-safe, only the hash is stored, constant-time match", async () => {
  const store = tempStore("af-org-keys");
  const made = await createEvent(store, { name: "Keys night", date: "" });
  if (!made.ok) throw new Error("event");
  assert.match(made.key, /^[A-Za-z0-9_-]{43}$/);
  const stored = await store.readOrganiserEvent(made.event.id);
  assert.equal(stored?.keyHash, hashKey(made.key));
  assert.equal(JSON.stringify(stored).includes(made.key), false);
  assert.equal(keyMatches(stored, made.key), true);
  assert.equal(keyMatches(stored, made.key.slice(0, -1) + (made.key.endsWith("A") ? "B" : "A")), false);
  assert.equal(keyMatches(stored, ""), false);
  assert.equal(keyMatches(stored, null), false);
  assert.equal(keyMatches({ keyHash: null }, ""), false);
});

test("stats are per event and only count that event's members and connections", async () => {
  const store = tempStore("af-org-stats");
  const { a, b } = await twoEvents(store);
  assert.deepEqual(await eventStats(store, a.event.id), { talkedAgainMarks: 1, pairsTalkedAgain: 1, mutualConfirms: 1, connectionsRequested: 1, signups: 2 });
  assert.deepEqual(await eventStats(store, b.event.id), { talkedAgainMarks: 0, pairsTalkedAgain: 0, mutualConfirms: 1, connectionsRequested: 1, signups: 2 });
});

test("API: key A can't read or delete event B; wrong or missing key gets the same 401", async () => {
  const store = tempStore("af-org-api");
  useStore(store);
  const { list, one } = await routes();
  const { a, b } = await twoEvents(store);
  const own = await one.GET(req(`/api/organiser/events/${a.event.id}`, { headers: { "x-organiser-key": a.key } }), ctx(a.event.id));
  assert.equal(own.status, 200);
  const body = (await own.json()) as { stats: { signups: number }; master: boolean };
  assert.equal(body.stats.signups, 2);
  assert.equal(body.master, false);
  assert.equal(own.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(own.headers.get("x-robots-tag"), "noindex, nofollow");

  const answers = [];
  for (const headers of [{ "x-organiser-key": a.key }, { "x-organiser-key": "wrong" }, {}, { "x-organiser-passcode": "nope" }] as Record<string, string>[]) {
    const read = await one.GET(req(`/api/organiser/events/${b.event.id}`, { headers }), ctx(b.event.id));
    answers.push([read.status, await read.text()]);
  }
  const unknown = await one.GET(req(`/api/organiser/events/ev-doesnotexist`, { headers: { "x-organiser-key": a.key } }), ctx("ev-doesnotexist"));
  answers.push([unknown.status, await unknown.text()]);
  for (const answer of answers) assert.deepEqual(answer, answers[0]);
  assert.equal(answers[0][0], 401);

  const del = await one.POST(req(`/api/organiser/events/${b.event.id}`, { headers: { "x-organiser-key": a.key }, body: { action: "delete-data", confirm: "Event B" } }), ctx(b.event.id));
  assert.equal(del.status, 401);
  assert.equal((await eventStats(store, b.event.id))?.connectionsRequested, 1);
  // Listing and creating need the master code; an event key isn't enough.
  assert.equal((await list.GET(req("/api/organiser", { headers: { "x-organiser-passcode": a.key } }))).status, 401);
  assert.equal((await list.POST(req("/api/organiser", { headers: { "x-organiser-key": a.key }, body: { action: "create", name: "Spam", date: "" } }))).status, 401);
});

test("API: the master code lists events and opens any one, still per event", async () => {
  const store = tempStore("af-org-master");
  useStore(store);
  const { list, one } = await routes();
  const { a, b } = await twoEvents(store);
  const listed = (await (await list.GET(req("/api/organiser", { headers: { "x-organiser-passcode": MASTER } }))).json()) as { events: { id: string }[] };
  const ids = listed.events.map((event) => event.id);
  for (const id of [a.event.id, b.event.id, LEGACY_EVENT_ID]) assert.ok(ids.includes(id), id);
  assert.equal(JSON.stringify(listed).includes("keyHash"), false);
  for (const ev of [a, b]) {
    const read = await one.GET(req(`/api/organiser/events/${ev.event.id}`, { headers: { "x-organiser-passcode": MASTER } }), ctx(ev.event.id));
    assert.equal(read.status, 200);
    const body = (await read.json()) as { stats: { signups: number }; master: boolean };
    assert.equal(body.stats.signups, 2);
    assert.equal(body.master, true);
  }
  const made = await list.POST(req("/api/organiser", { headers: { "x-organiser-passcode": MASTER }, body: { action: "create", name: "Fresh night", date: "2026-12-01" } }));
  assert.equal(made.status, 200);
  const fresh = (await made.json()) as { event: { id: string }; key: string };
  assert.match(fresh.key, /^[A-Za-z0-9_-]{43}$/);
  assert.equal((await one.GET(req(`/api/organiser/events/${fresh.event.id}`, { headers: { "x-organiser-key": fresh.key } }), ctx(fresh.event.id))).status, 200);
});

test("rotate: the new key works and the old one stops", async () => {
  const store = tempStore("af-org-rotate");
  useStore(store);
  const { one } = await routes();
  const { a } = await twoEvents(store);
  const rotated = await one.POST(req(`/api/organiser/events/${a.event.id}`, { headers: { "x-organiser-key": a.key }, body: { action: "rotate" } }), ctx(a.event.id));
  assert.equal(rotated.status, 200);
  const { key } = (await rotated.json()) as { key: string };
  assert.notEqual(key, a.key);
  assert.equal((await one.GET(req(`/api/organiser/events/${a.event.id}`, { headers: { "x-organiser-key": a.key } }), ctx(a.event.id))).status, 401);
  assert.equal((await one.GET(req(`/api/organiser/events/${a.event.id}`, { headers: { "x-organiser-key": key } }), ctx(a.event.id))).status, 200);
  assert.ok(await rotateKey(store, LEGACY_EVENT_ID), "the master can mint a link for the built-in event");
});

test("wrong keys are throttled after 10 tries from one address", async () => {
  const store = tempStore("af-org-throttle");
  useStore(store);
  const { one } = await routes();
  const { a } = await twoEvents(store);
  const statuses = [];
  for (let i = 0; i < 12; i++) statuses.push((await one.GET(req(`/api/organiser/events/${a.event.id}`, { headers: { "x-organiser-key": `guess-${i}` } }), ctx(a.event.id))).status);
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
  assert.equal(statuses[11], 429);
  resetThrottle();
});

test("delete: scoped to one event, typed name required, other events intact", async () => {
  const store = tempStore("af-org-delete");
  useStore(store);
  const { one } = await routes();
  const { a, b, ann, abe, bea, bob } = await twoEvents(store);
  // Abe also joined B and Ann has a connection outside any event: both keep their cards.
  await joinEvent(store, b.event.id, abe.id);
  const outsider = await store.createProfile(card("Olu"));
  await addMet(store, ann.secretToken, outsider.publicId, "");
  const before = await eventStats(store, b.event.id);

  const wrongName = await one.POST(req(`/api/organiser/events/${a.event.id}`, { headers: { "x-organiser-key": a.key }, body: { action: "delete-data", confirm: "event a" } }), ctx(a.event.id));
  assert.equal(wrongName.status, 400);
  assert.equal((await eventStats(store, a.event.id))?.connectionsRequested, 1);

  const done = await one.POST(req(`/api/organiser/events/${a.event.id}`, { headers: { "x-organiser-key": a.key }, body: { action: "delete-data", confirm: "Event A" } }), ctx(a.event.id));
  assert.equal(done.status, 200);
  const result = (await done.json()) as { deleted: { connectionsDeleted: number; cardsDeleted: number; membersRemoved: number } };
  assert.deepEqual(result.deleted, { connectionsDeleted: 1, cardsDeleted: 0, membersRemoved: 2 });
  assert.deepEqual(await eventStats(store, a.event.id), { talkedAgainMarks: 0, pairsTalkedAgain: 0, mutualConfirms: 0, connectionsRequested: 0, signups: 0 });
  assert.ok(await store.getProfileById(ann.id), "Ann keeps her card (non-event connection)");
  assert.ok(await store.getProfileById(abe.id), "Abe keeps his card (in event B)");
  assert.equal((await store.listMatchesFor(ann.id)).length, 1, "Ann's outside connection stays");
  // Event B untouched.
  assert.deepEqual(await eventStats(store, b.event.id), before);
  for (const p of [bea, bob]) assert.ok(await store.getProfileById(p.id));

  // Deleting B now: Bea and Bob were only there, so their cards go; Abe has no event and no connections left.
  const resultB = await deleteEventData(store, b.event.id);
  assert.deepEqual(resultB, { connectionsDeleted: 1, cardsDeleted: 3, membersRemoved: 3 });
  for (const p of [bea, bob, abe]) assert.equal(await store.getProfileById(p.id), null);
  assert.ok(await store.getProfileById(ann.id));
  assert.ok(await store.getProfileById(outsider.id));
});

test("the global delete-all refuses (410) for everyone, and the store has no wipe", async () => {
  const store = tempStore("af-org-410");
  useStore(store);
  const { list } = await routes();
  await twoEvents(store);
  const count = (await store.listProfiles()).length;
  for (const headers of [{ "x-organiser-passcode": MASTER }, {}] as Record<string, string>[]) {
    const response = await list.POST(req("/api/organiser", { headers, body: { action: "delete-all" } }));
    assert.equal(response.status, 410);
  }
  assert.equal((await store.listProfiles()).length, count);
  assert.equal("deleteAll" in store, false);
  for (const file of ["lib/store.ts", "lib/netlify-blob-store.ts", "lib/supabase-store.ts", "app/api/organiser/route.ts"]) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /\.deleteAll\(/, file);
  }
});

test("legacy: Grok Bot London is built in; cards and connections from before events shipped count for it", async () => {
  const store = tempStore("af-org-legacy");
  const old = new Date(SEED_CUTOFF - 3600_000).toISOString();
  const x = await store.createProfile(card("Old X"));
  const y = await store.createProfile(card("Old Y"));
  const z = await store.createProfile(card("New Z"));
  const made = await addMet(store, x.secretToken, y.publicId, "");
  if (!("connection" in made.body)) throw new Error("connection");
  const madeId = made.body.connection.id;
  await actOnConnection(store, y.secretToken, madeId, { action: "confirm" });
  const later = await addMet(store, z.secretToken, y.publicId, "");
  if (!("connection" in later.body)) throw new Error("connection");
  const events = await listEvents(store);
  assert.equal(events.find((event) => event.id === LEGACY_EVENT_ID)?.name, "Grok Bot London");
  // Pure check with the hackathon-night dates (no stored rows are rewritten: the rule is read-time).
  const profiles = (await store.listProfiles()).map((p) => (p.id === z.id ? p : { ...p, createdAt: old }));
  const matches = (await store.listMatches()).map((m) => (m.id === madeId ? { ...m, createdAt: old } : m));
  assert.deepEqual(statsFor(legacyEvent(), profiles, matches), { talkedAgainMarks: 0, pairsTalkedAgain: 0, mutualConfirms: 1, connectionsRequested: 1, signups: 2 });
  // A connection another event claimed never double-counts; after its delete the rule stops applying.
  assert.equal(statsFor(legacyEvent(), profiles, matches, new Set([madeId])).connectionsRequested, 0);
  assert.equal(statsFor({ ...legacyEvent(), legacyCleared: true }, profiles, matches).signups, 0);
  // Nothing was written for the legacy event just by reading it.
  assert.equal(await store.readOrganiserEvent(LEGACY_EVENT_ID), null);
});

test("SW never caches organiser or join pages; organiser pages are noindex", () => {
  const sw = fs.readFileSync("public/sw.js", "utf8");
  assert.match(sw, /"\/organiser"/);
  assert.match(sw, /"\/join\/"/);
  assert.match(sw, /"\/api\/"/);
  const layout = fs.readFileSync("app/organiser/layout.tsx", "utf8");
  assert.match(layout, /index: false/);
  const config = fs.readFileSync("next.config.ts", "utf8");
  assert.match(config, /\/organiser\/:path\*/);
  assert.match(config, /noindex, nofollow/);
});

test("organiser page: danger zone at the bottom, quiet outline button, typed-name sheet", () => {
  const page = fs.readFileSync("app/organiser/[eventId]/page.tsx", "utf8");
  const sheet = fs.readFileSync("components/organiser.tsx", "utf8");
  assert.ok(page.indexOf('id="danger-zone"') > page.indexOf("<Headline"));
  assert.ok(page.indexOf('id="danger-zone"') > page.indexOf("Make a new organiser link"));
  assert.match(page, /btn btn-outline-quiet/);
  assert.doesNotMatch(page, /btn-hot[^"]*"[^>]*>\s*Delete this event/);
  assert.doesNotMatch(page + sheet, /Delete all data/);
  assert.match(sheet, /disabled=\{!matches \|\| busy\}/);
  assert.match(sheet, /const matches = typed === name;/);
});
