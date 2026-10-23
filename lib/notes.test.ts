import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { actOnConnection, addMet, getConnection, type ConnectionCard } from "./connections";
import { createNetlifyBlobStore } from "./netlify-blob-store";
import { memoryBlobs } from "./netlify-blob-store.test-helpers";
import { NOTE_CONFLICT, noteUpdatedLine, noteWhen } from "./notes";
import type { Store } from "./store";
import { card, tempStore } from "./test-helpers";

async function pair(store: Store) {
  const ada = await store.createProfile(card("Ada Quinn", { contact: "whatsapp:+447700900111" }));
  const mira = await store.createProfile(card("Mira Sato", { contact: "whatsapp:+447700900112" }));
  const added = await addMet(store, ada.secretToken, mira.publicId, "");
  if (!("connection" in added.body)) throw new Error("expected connection");
  const id = added.body.connection.id;
  await actOnConnection(store, mira.secretToken, id, { action: "confirm" });
  return { ada, mira, id };
}

async function view(store: Store, token: string, id: string): Promise<ConnectionCard> {
  const result = await getConnection(store, token, id);
  if (!("connection" in result.body)) throw new Error("expected connection");
  return result.body.connection;
}

const note = (store: Store, token: string, id: string, text: string, base?: string | null) =>
  actOnConnection(store, token, id, { action: "shared_note", text, ...(base !== undefined ? { base } : {}) });

for (const [label, make] of [
  ["file store", () => tempStore("afterflow-notes")],
  ["blob store (prod)", () => createNetlifyBlobStore(memoryBlobs())],
] as const) {
  test(`D26 ${label}: A edits, B sees it; then B edits, A sees it`, async () => {
    const store = make();
    const { ada, mira, id } = await pair(store);
    const a0 = await view(store, ada.secretToken, id);
    assert.equal((await note(store, ada.secretToken, id, "Dumplings on Brick Lane?", a0.sharedNoteAt)).status, 200);

    const b1 = await view(store, mira.secretToken, id);
    assert.equal(b1.sharedNote, "Dumplings on Brick Lane?", "B sees A's edit on reload");
    assert.equal(b1.sharedNoteByThem, true, "and that it was A");
    assert.match(noteUpdatedLine(b1, Date.now(), "Europe/London") ?? "", /^Updated by Ada · /);
    assert.equal((await view(store, ada.secretToken, id)).sharedNoteByThem, false, "A's own edit has no 'Updated by' line");

    assert.equal((await note(store, mira.secretToken, id, "Dumplings, Saturday 1pm", b1.sharedNoteAt)).status, 200);
    const a2 = await view(store, ada.secretToken, id);
    assert.equal(a2.sharedNote, "Dumplings, Saturday 1pm", "A sees B's edit");
    assert.equal(a2.sharedNoteByThem, true);
    assert.match(noteUpdatedLine(a2, Date.now(), "Europe/London") ?? "", /^Updated by Mira · /);
    assert.equal((await view(store, mira.secretToken, id)).sharedNoteByThem, false);
  });

  test(`D26 ${label}: a stale page can't overwrite a newer note (409 with theirs), then can on purpose`, async () => {
    const store = make();
    const { ada, mira, id } = await pair(store);
    const seenByA = (await view(store, ada.secretToken, id)).sharedNoteAt; // A opens the page: empty note
    await note(store, mira.secretToken, id, "Mira's plan", null);
    const stale = await note(store, ada.secretToken, id, "Ada's plan", seenByA);
    assert.equal(stale.status, 409);
    const body = stale.body as { conflict?: boolean; connection?: ConnectionCard };
    assert.equal(body.conflict, true);
    assert.equal(body.connection?.sharedNote, "Mira's plan", "the reply carries their newer note");
    assert.equal((await store.getMatchById(id))?.sharedNote, "Mira's plan", "no stale overwrite");
    const again = await note(store, ada.secretToken, id, "Ada's plan", body.connection?.sharedNoteAt ?? null);
    assert.equal(again.status, 200, "saving again after seeing theirs replaces it");
    assert.equal((await store.getMatchById(id))?.sharedNote, "Ada's plan");
    // Older clients (prod 500bba0) send no base: last write wins, as before.
    assert.equal((await note(store, mira.secretToken, id, "Old client")).status, 200);
    assert.equal((await store.getMatchById(id))?.sharedNote, "Old client");
  });
}

test("D26 blob store: two writes racing on one etag both land; the guard re-runs on the fresh row", async () => {
  const blobs = memoryBlobs();
  const store = createNetlifyBlobStore(blobs);
  const { ada, mira, id } = await pair(store);
  // Concurrent: A's private note and B's shared note at the same moment.
  await Promise.all([
    actOnConnection(store, ada.secretToken, id, { action: "my_note", text: "Ask about the bike" }),
    note(store, mira.secretToken, id, "Saturday?", null),
  ]);
  const row = await store.getMatchById(id);
  assert.equal(row?.sharedNote, "Saturday?", "no lost write");
  assert.ok(row?.aNote === "Ask about the bike" || row?.bNote === "Ask about the bike", "no lost write");
  // Two people saving against the same version at once: exactly one wins, the other gets 409.
  const base = row?.sharedNoteAt ?? null;
  const [one, two] = await Promise.all([note(store, ada.secretToken, id, "From Ada", base), note(store, mira.secretToken, id, "From Mira", base)]);
  assert.deepEqual([one.status, two.status].sort(), [200, 409]);
  const final = (await store.getMatchById(id))?.sharedNote;
  assert.equal(final, one.status === 200 ? "From Ada" : "From Mira");
});

test("D26: the updated line's time reads naturally", () => {
  const now = Date.parse("2026-10-23T09:00:00Z");
  assert.equal(noteWhen("2026-10-23T07:14:00Z", now, "Europe/London"), "08:14");
  assert.equal(noteWhen("2026-10-22T19:00:00Z", now, "Europe/London"), "yesterday");
  assert.equal(noteWhen("2026-10-20T19:00:00Z", now, "Europe/London"), "Tue 20 Oct");
  assert.equal(NOTE_CONFLICT("Mira"), "Mira changed this note while you were editing. Theirs is below; save again to replace it.");
});

test("D26: the person page refetches on focus and visibility; no polling or typing state once connected", () => {
  const page = fs.readFileSync("app/m/[token]/c/[id]/page.tsx", "utf8");
  assert.match(page, /addEventListener\("visibilitychange", refresh\)/);
  assert.match(page, /addEventListener\("focus", refresh\)/);
  assert.match(page, /base: data\.connection\.sharedNoteAt/, "saves against the version it saw");
  assert.match(page, /updated=\{noteUpdatedLine\(connection/);
  assert.doesNotMatch(page, /EventSource|WebSocket|is typing/i);
});
