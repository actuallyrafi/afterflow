import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { listHome } from "./connections";
import { REMINDER_DELAY_MS } from "./event";
import { createNetlifyBlobStore } from "./netlify-blob-store";
import { memoryBlobs } from "./netlify-blob-store.test-helpers";
import { buildProfile, normalizeProfile, readReminders } from "./store";
import { card, tempStore } from "./test-helpers";

test("v4.1c: the one gentle reminder is on for new cards", async () => {
  assert.equal(buildProfile({ ...card("Ada") }).reminders, true);
  const store = tempStore("afterflow-remind-default");
  const ada = await store.createProfile(card("Ada"));
  assert.equal(ada.reminders, true);
  assert.equal((await store.getProfileById(ada.id))?.reminders, true);
  const blobs = createNetlifyBlobStore(memoryBlobs());
  assert.equal((await blobs.createProfile({ ...card("Jonah"), id: "jonah" })).reminders, true);
});

test("v4.1c: stored cards that never had the setting read as on; an explicit off stays off", () => {
  for (const unset of [undefined, null, ""]) assert.equal(readReminders(unset), true, `unset ${String(unset)}`);
  for (const off of [false, 0, "0", "false"]) assert.equal(readReminders(off), false, `off ${String(off)}`);
  for (const on of [true, 1, "1", "true"]) assert.equal(readReminders(on), true, `on ${String(on)}`);
  assert.equal(normalizeProfile({ id: "legacy", name: "Old card" })?.reminders, true, "hackathon-era row without the field");
  assert.equal(normalizeProfile({ id: "off", name: "Turned off", reminders: false })?.reminders, false);
});

test("v4.1c: lazy read-time default, no rewrite; turning it off sticks", async () => {
  const raw = memoryBlobs();
  const store = createNetlifyBlobStore(raw);
  const made = await store.createProfile({ ...card("Mira"), id: "mira", secretToken: "mira-token" });
  // Simulate a card stored before the field existed.
  const { reminders: _dropped, ...legacy } = made;
  void _dropped;
  raw.raw("profiles/mira", legacy);
  assert.equal((await store.getProfileById("mira"))?.reminders, true);
  assert.equal(JSON.parse(String(await raw.get("profiles/mira"))).reminders, undefined, "reading doesn't write it back");
  await store.updateProfile("mira", { reminders: false });
  assert.equal((await store.getProfileById("mira"))?.reminders, false);
  const later = Date.now() + REMINDER_DELAY_MS + 60_000;
  assert.equal((await listHome(store, "mira-token", { now: later }))?.reminder, null);
});

test("My card copy says the reminder is on unless you turn it off", () => {
  const page = fs.readFileSync("app/m/[token]/card/page.tsx", "utf8");
  assert.match(page, /At most once per person, never for anyone you mute\. Turn it off any time\./);
  assert.equal(/Off unless you turn it on/.test(page), false);
});
