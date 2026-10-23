import assert from "node:assert/strict";
import test from "node:test";
import { actOnConnection, addMet, getConnection, listHome, updateCard } from "./connections";
import { planHandoff } from "./handoff";
import { createNetlifyBlobStore } from "./netlify-blob-store";
import { memoryBlobs } from "./netlify-blob-store.test-helpers";
import { normalizeProfile, sqlRowToMatch } from "./store";
import { readContacts, validateSubmission } from "./survey";
import { card, tempStore } from "./test-helpers";

const hi = "Hey Mira, it's Sam from the Grok Bot hackathon. Really good meeting you!";

test("the form takes several contact methods, at least one, and the starred one goes first", () => {
  const parsed = validateSubmission({
    name: "Mira",
    contacts: [
      { channel: "whatsapp", value: "07700 900123" },
      { channel: "instagram", value: "@Mira.Makes" },
      { channel: "email", value: "" },
    ],
    preferred: "instagram",
    answer: "Pottery on Thursdays",
    consent: true,
  });
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(parsed.value.contact, "instagram:mira.makes");
  assert.deepEqual(parsed.value.contacts, ["instagram:mira.makes", "whatsapp:+447700900123"]);

  const none = validateSubmission({ name: "Mira", contacts: [{ channel: "email", value: " " }], answer: "Pottery", consent: true });
  assert.equal(none.ok, false);
  const bad = validateSubmission({ name: "Mira", contacts: [{ channel: "email", value: "nope" }], answer: "Pottery", consent: true });
  assert.ok(!bad.ok && bad.error === "Check the email address.");
  // The older single-contact body still works.
  const old = validateSubmission({ name: "Mira", channel: "discord", contact: "mira", answer: "Pottery", consent: true });
  assert.ok(old.ok && old.value.contacts?.[0] === "discord:mira");
});

test("old single-contact records read without loss on every store path", () => {
  // Blob/JSON shape written by the live build: no `contacts`.
  assert.deepEqual(normalizeProfile({ id: "1", contact: "whatsapp:+447700900123" })?.contacts, ["whatsapp:+447700900123"]);
  // Pre-v4 bare email.
  assert.deepEqual(normalizeProfile({ id: "1", contact: "ada@example.com" })?.contacts, ["ada@example.com"]);
  // SQLite: TEXT column, '' for old rows; Supabase: jsonb array, [] for old rows.
  assert.deepEqual(normalizeProfile({ id: "1", contact: "discord:ada", contacts: "" })?.contacts, ["discord:ada"]);
  assert.deepEqual(normalizeProfile({ id: "1", contact: "discord:ada", contacts: [] })?.contacts, ["discord:ada"]);
  assert.deepEqual(
    normalizeProfile({ id: "1", contact: "discord:ada", contacts: '["discord:ada","email:a@b.co"]' })?.contacts,
    ["discord:ada", "email:a@b.co"],
  );
  // If an older build rewrote `contact`, it still wins the preferred slot and the rest survive.
  assert.deepEqual(readContacts("email:new@b.co", ["discord:ada", "email:old@b.co", "instagram:ada"]), [
    "email:new@b.co",
    "discord:ada",
    "instagram:ada",
  ]);
  assert.ok(sqlRowToMatch({ id: "m", a_id: "a", b_id: "b", state: "{}" }));
});

test("blob store: new records keep `contact` for the live build and add `contacts`", async () => {
  const blobs = memoryBlobs();
  const store = createNetlifyBlobStore(blobs);
  const mira = await store.createProfile({ ...card("Mira"), contact: "instagram:mira", contacts: ["instagram:mira", "email:mira@example.com"], id: "mira" });
  const raw = JSON.parse((await blobs.get("profiles/mira")) as string) as Record<string, unknown>;
  assert.equal(raw.contact, "instagram:mira", "the live build reads `contact`");
  assert.deepEqual(raw.contacts, ["instagram:mira", "email:mira@example.com"]);
  const read = await store.getProfileById(mira.id);
  assert.deepEqual(read?.contacts, ["instagram:mira", "email:mira@example.com"]);
});

test("contacts only show once both confirm, and the Edit card flow updates them all", async () => {
  const store = tempStore("afterflow-contacts");
  const sam = await store.createProfile(card("Sam", { contact: "whatsapp:+447700900111", contacts: ["whatsapp:+447700900111"] }));
  const mira = await store.createProfile(
    card("Mira", { contact: "instagram:mira.makes", contacts: ["instagram:mira.makes", "whatsapp:+447700900222", "email:mira-secret@example.com"] }),
  );
  const added = await addMet(store, sam.secretToken, mira.publicId, "");
  if (!("connection" in added.body)) throw new Error("expected connection");
  const id = added.body.connection.id;
  for (const view of [JSON.stringify(added.body), JSON.stringify(await listHome(store, sam.secretToken)), JSON.stringify((await getConnection(store, sam.secretToken, id)).body)]) {
    assert.equal(view.includes("mira-secret"), false);
    assert.equal(view.includes("900222"), false);
    assert.equal(view.includes("mira.makes"), false);
  }
  await actOnConnection(store, mira.secretToken, id, { action: "confirm" });
  const after = await getConnection(store, sam.secretToken, id);
  if (!("connection" in after.body)) throw new Error("expected connection");
  assert.deepEqual(after.body.connection.other.contacts, ["instagram:mira.makes", "whatsapp:+447700900222", "email:mira-secret@example.com"]);
  assert.equal(after.body.connection.other.contact, "instagram:mira.makes");
  assert.deepEqual(after.body.me.contacts, ["whatsapp:+447700900111"]);

  const edited = await updateCard(store, mira.secretToken, {
    name: "Mira",
    answer: "Pottery on Thursdays",
    contacts: [{ channel: "email", value: "mira@example.com" }, { channel: "discord", value: "mira" }],
    preferred: "discord",
  });
  assert.equal(edited.status, 200);
  const reread = await store.getProfileById(mira.id);
  assert.equal(reread?.contact, "discord:mira");
  assert.deepEqual(reread?.contacts, ["discord:mira", "email:mira@example.com"]);
  // Turning the reminder on doesn't touch contacts.
  await updateCard(store, mira.secretToken, { reminders: true });
  assert.deepEqual((await store.getProfileById(mira.id))?.contacts, ["discord:mira", "email:mira@example.com"]);
});

test("Say hi: an app you both use goes first; otherwise theirs in their preferred order", () => {
  const theirs = ["instagram:mira.makes", "whatsapp:+447700900222", "email:mira@example.com"];
  const shared = planHandoff(theirs, ["email:sam@example.com", "whatsapp:+447700900111"], "Mira", hi);
  assert.equal(shared.shared, "whatsapp", "their first shared app in their order");
  assert.deepEqual(shared.options.map((o) => o.channel), ["whatsapp", "instagram", "email"]);
  assert.ok(shared.options[0].href?.startsWith("https://wa.me/447700900222?text="));

  const none = planHandoff(theirs, ["discord:sam"], "Mira", hi);
  assert.equal(none.shared, null);
  assert.deepEqual(none.options.map((o) => o.channel), ["instagram", "whatsapp", "email"]);
  assert.equal(none.options[0].href, "https://instagram.com/mira.makes");
  const mail = none.options[2];
  assert.ok(mail.href?.startsWith("mailto:mira@example.com?") && mail.href.includes(encodeURIComponent(hi)));

  const discord = planHandoff(["discord:mira"], [], "Mira", hi, { handoff_discord: false });
  assert.equal(discord.options[0].href, null, "copy the username");
  assert.equal(planHandoff(["discord:mira"], [], "Mira", hi, { handoff_discord: true }).options[0].label, "Open in Discord");
});
