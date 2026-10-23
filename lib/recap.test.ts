import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { actOnConnection, addMet, editEvents, listHome, type ConnectionCard, type EventsView } from "./connections";
import { datePill, recapCard, recapLinkTarget, recapPeople, recapReminderFor, recapWindow, relativeDay, rowDone, RECAP_COPY } from "./recap";
import { normalizeEventBook } from "./events";
import { normalizeMatch } from "./store";
import { card, tempStore } from "./test-helpers";

const LDN = "Europe/London";
const iso = (s: string) => Date.parse(s);

function conn(id: string, partial: Partial<ConnectionCard> = {}): ConnectionCard {
  return {
    id,
    status: "connected",
    mutual: true,
    muted: false,
    talkedAgain: false,
    talkedAgainAt: null,
    myNote: "",
    mutualAt: "2026-10-22T20:00:00.000Z",
    hello: null,
    sharedNote: "",
    myAnswer: "",
    metAt: "2026-10-22T19:55:00.000Z",
    eventId: "ev1",
    other: { name: `Person ${id}`, publicId: `p-${id}`, isDemo: false, answer: "Something" },
    ...partial,
  };
}

function view(ids: { id: string; name?: string; date?: string }[], hidden: string[] = []): EventsView {
  return {
    events: ids.map((e) => ({ id: e.id, name: e.name ?? e.id, date: e.date ?? "2026-10-22", label: "", marks: [], empty: false, seeded: false })),
    unfiled: { marks: [], empty: true },
    current: null,
    recapHidden: hidden,
  };
}

test("window: 07:00 the day after the last mutual connection to 23:59:59 on day 3, zoned (BST -> GMT on 25 Oct)", () => {
  // Last connection Thu 22 Oct 23:10 London (22:10Z).
  const { start, end } = recapWindow(iso("2026-10-22T22:10:00Z"), LDN);
  assert.equal(new Date(start).toISOString(), "2026-10-23T06:00:00.000Z", "Fri 07:00 BST");
  assert.equal(new Date(end).toISOString(), "2026-10-25T23:59:59.000Z", "Sun 23:59:59 GMT, after the clocks go back");
  // The device's zone decides "local": a traveller in New York gets 07:00 there.
  const ny = recapWindow(iso("2026-10-22T22:10:00Z"), "America/New_York");
  assert.equal(new Date(ny.start).toISOString(), "2026-10-23T11:00:00.000Z");
});

test("card shows only inside the window", () => {
  const connections = [conn("a", { mutualAt: "2026-10-22T22:10:00.000Z" })];
  const events = view([{ id: "ev1", name: "Grok Bot London" }]);
  const at = (s: string) => recapCard({ now: iso(s), tz: LDN, connections, events });
  assert.equal(at("2026-10-23T05:59:59Z"), null, "before 07:00 on day 1");
  assert.equal(at("2026-10-23T06:00:00Z")?.eventId, "ev1");
  assert.equal(at("2026-10-23T06:00:00Z")?.when, "yesterday");
  assert.equal(at("2026-10-24T12:00:00Z")?.when, "Thursday");
  assert.equal(at("2026-10-25T23:59:59Z")?.eventId, "ev1", "last second of day 3");
  assert.equal(at("2026-10-26T00:00:00Z"), null, "gone on day 4");
  assert.equal(at("2026-10-23T06:00:00Z")?.eventName, "Grok Bot London");
});

test("eligibility: events only; mutual, unmuted people; ordered by when you both said yes", () => {
  const list = [
    conn("late", { mutualAt: "2026-10-22T21:00:00.000Z" }),
    conn("early", { mutualAt: "2026-10-22T19:00:00.000Z" }),
    conn("muted", { muted: true }),
    conn("pending", { status: "waiting_for_them", mutual: false, mutualAt: null }),
    conn("unfiled", { eventId: null }),
    conn("other", { eventId: "ev2" }),
  ];
  assert.deepEqual(recapPeople(list, "ev1").map((c) => c.id), ["early", "late"]);
  // Unfiled people never make a recap, even inside the window.
  const onlyUnfiled = recapCard({ now: iso("2026-10-23T08:00:00Z"), tz: LDN, connections: [conn("u", { eventId: null })], events: view([{ id: "ev1" }]) });
  assert.equal(onlyUnfiled, null);
  // An event where nobody is mutual and unmuted gets no card.
  assert.equal(recapCard({ now: iso("2026-10-23T08:00:00Z"), tz: LDN, connections: [conn("m", { muted: true })], events: view([{ id: "ev1" }]) }), null);
});

test("one card at a time: the event with the latest last mutual connection", () => {
  const connections = [conn("a", { eventId: "old", mutualAt: "2026-10-21T20:00:00.000Z" }), conn("b", { eventId: "new", mutualAt: "2026-10-22T20:00:00.000Z" })];
  const got = recapCard({ now: iso("2026-10-23T09:00:00Z"), tz: LDN, connections, events: view([{ id: "old" }, { id: "new" }]) });
  assert.equal(got?.eventId, "new");
  // A late connection filed later moves the window forward.
  const late = [conn("a", { mutualAt: "2026-10-22T20:00:00.000Z" }), conn("b", { mutualAt: "2026-10-24T20:00:00.000Z" })];
  assert.ok(recapCard({ now: iso("2026-10-27T09:00:00Z"), tz: LDN, connections: late, events: view([{ id: "ev1" }]) }));
});

test("dismiss: a hidden recap never shows again, even after a later connection", () => {
  const connections = [conn("a"), conn("b", { mutualAt: "2026-10-23T20:00:00.000Z" })];
  assert.equal(recapCard({ now: iso("2026-10-24T09:00:00Z"), tz: LDN, connections, events: view([{ id: "ev1" }], ["ev1"]) }), null);
});

test("all done: every row opened or talked ends the card; Mark as talked counts at any time", () => {
  const now = iso("2026-10-23T09:00:00Z");
  const events = view([{ id: "ev1" }]);
  const opened = { via: "whatsapp" as const, at: "2026-10-23T08:00:00.000Z" };
  assert.ok(recapCard({ now, tz: LDN, connections: [conn("a", { hello: opened }), conn("b")], events }));
  assert.equal(recapCard({ now, tz: LDN, connections: [conn("a", { hello: opened }), conn("b", { talkedAgain: true })], events }), null);
  assert.equal(rowDone(conn("x", { talkedAgain: true })), true, "talked without opening a hello");
  assert.equal(rowDone(conn("x")), false);
});

test("relative day and date pill", () => {
  assert.equal(relativeDay(iso("2026-10-23T08:00:00Z"), iso("2026-10-22T22:10:00Z"), LDN), "yesterday");
  assert.equal(relativeDay(iso("2026-10-25T08:00:00Z"), iso("2026-10-22T22:10:00Z"), LDN), "Thursday");
  assert.equal(datePill("2026-10-22"), "Thu 22 Oct");
});

test("copy is truthful: no counts, no progress", () => {
  const all = JSON.stringify(RECAP_COPY) + RECAP_COPY.emptyBody("Grok Bot London");
  assert.equal(/\d+ of \d+|progress|streak|%/i.test(all), false);
  assert.match(RECAP_COPY.sub, /Nothing is sent from here\./);
  const screen = fs.readFileSync("components/recap.tsx", "utf8");
  assert.equal(/role="progressbar"|<progress|\.length\}/.test(screen), false, "no counts or bars");
});

test("neutral route: /recap/{eventId} opens only with this device's session and an event you own", () => {
  assert.equal(recapLinkTarget("ev1", null, false), null);
  assert.equal(recapLinkTarget("ev1", "tok", false), null, "someone else's or unknown event: neutral");
  assert.equal(recapLinkTarget("ev1", "tok", true), "/m/tok/recap/ev1");
  const page = fs.readFileSync("app/recap/[eventId]/page.tsx", "utf8");
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  const client = fs.readFileSync("app/recap/[eventId]/recap-link.tsx", "utf8");
  assert.match(client, /savedToken\(\)/);
  assert.match(client, /RECAP_COPY\.signedOut/);
});

test("recap calendar reminder: token-free /recap link, title only, a sensible slot", () => {
  const r = recapReminderFor({ eventId: "ev1", eventName: "Grok Bot London", lastMutual: iso("2026-10-22T22:10:00Z"), origin: "https://afterflow-f1.netlify.app", now: iso("2026-10-23T08:00:00Z") });
  assert.equal(r.title, "Say hi to people from Grok Bot London");
  assert.equal(r.url, "https://afterflow-f1.netlify.app/recap/ev1");
  assert.equal(new Date(r.start).toISOString(), "2026-10-23T17:30:00.000Z", "Fri 18:30 BST");
  assert.equal(/\/m\//.test(r.description + r.url), false);
});

test("server: mutualAt on confirm, hello_opened is private to you, recap_hide sticks in your book", async () => {
  const store = tempStore("afterflow-recap");
  const ada = await store.createProfile(card("Ada", { contact: "whatsapp:+447700900111" }));
  const sam = await store.createProfile(card("Sam", { contact: "whatsapp:+447700900112" }));
  const made = await editEvents(store, ada.secretToken, { action: "create", name: "Grok Bot London", date: "2026-10-22" });
  const eventId = (made.body as { eventId: string }).eventId;
  const added = await addMet(store, ada.secretToken, sam.publicId, "");
  if (!("connection" in added.body)) throw new Error("expected connection");
  const id = added.body.connection.id;
  assert.equal((await store.getMatchById(id))?.mutualAt, null);
  await actOnConnection(store, sam.secretToken, id, { action: "confirm" });
  assert.ok((await store.getMatchById(id))?.mutualAt, "set when both said yes");
  await editEvents(store, ada.secretToken, { action: "file", connectionId: id, eventId });

  const bad = await actOnConnection(store, ada.secretToken, id, { action: "hello_opened", via: "carrier-pigeon" });
  assert.equal(bad.status, 400);
  await actOnConnection(store, ada.secretToken, id, { action: "hello_opened", via: "whatsapp" });
  const adaHome = await listHome(store, ada.secretToken);
  assert.equal(adaHome?.connections[0].hello?.via, "whatsapp");
  assert.equal((await listHome(store, sam.secretToken))?.connections[0].hello, null, "Sam never sees Ada's hello");

  await editEvents(store, ada.secretToken, { action: "recap_hide", eventId });
  assert.deepEqual((await listHome(store, ada.secretToken))?.events.recapHidden, [eventId]);
  await editEvents(store, ada.secretToken, { action: "file", connectionId: id, eventId: null });
  assert.deepEqual((await listHome(store, ada.secretToken))?.events.recapHidden, [eventId], "other edits keep it");
  await editEvents(store, ada.secretToken, { action: "recap_show", eventId });
  assert.deepEqual((await listHome(store, ada.secretToken))?.events.recapHidden, []);
  await editEvents(store, ada.secretToken, { action: "recap_hide", eventId });
  await editEvents(store, ada.secretToken, { action: "delete", eventId });
  assert.deepEqual((await listHome(store, ada.secretToken))?.events.recapHidden, [], "deleting the event clears it");
});

test("old rows read fine: no mutualAt falls back to when it was made; unknown recapHidden ids are dropped", () => {
  const row = normalizeMatch({ id: "m", aId: "a", bId: "b", aStatus: "accepted", bStatus: "accepted", createdAt: "2026-10-22T19:00:00.000Z" });
  assert.equal(row?.mutualAt, null);
  assert.equal(row?.aHelloVia, null);
  const book = normalizeEventBook({ events: [{ id: "e", name: "X", date: "2026-10-22" }], filed: {}, recapHidden: ["e", "gone", 3] });
  assert.deepEqual(book?.recapHidden, ["e"]);
});
