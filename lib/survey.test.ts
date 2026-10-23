import assert from "node:assert/strict";
import test from "node:test";
import { CONSENT_TEXT, normalizeContact, parseContact, QUESTION, QUESTION_HELP, validateSubmission } from "./survey";

const ok = { name: "Sam", channel: "whatsapp", contact: "07700 900123", answer: "Running a supper club", consent: true };

test("the card is a name, ways to reach you (preferred first), one question and consent", () => {
  const parsed = validateSubmission(ok);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.value, {
    name: "Sam",
    contact: "whatsapp:+447700900123",
    contacts: ["whatsapp:+447700900123"],
    answer: "Running a supper club",
  });
  assert.deepEqual(Object.keys(parsed.value).sort(), ["answer", "contact", "contacts", "name"]);
  assert.equal(QUESTION, "What's something you're into right now?");
  assert.equal(QUESTION_HELP, "A project, a hobby, a place — anything.");
});

test("old questionnaire fields are ignored, never stored", () => {
  const parsed = validateSubmission({
    ...ok,
    role: "Engineer",
    offers: ["Coding"],
    topOffer: "Coding",
    needs: ["Design"],
    linkedin: "https://linkedin.com/in/sam",
    availability: "This week",
    tryingTo: "x",
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(JSON.stringify(parsed.value).includes("linkedin"), false);
});

test("consent is required and the copy says the card stays until you delete it", () => {
  assert.equal(validateSubmission({ ...ok, consent: false }).ok, false);
  assert.equal(validateSubmission({ ...ok, consent: "yes" }).ok, false);
  assert.match(CONSENT_TEXT, /stays until I delete it/);
  assert.equal(/after the event/i.test(CONSENT_TEXT), false);
});

test("name and answer lengths", () => {
  assert.equal(validateSubmission({ ...ok, name: "  " }).ok, false);
  assert.equal(validateSubmission({ ...ok, name: "x".repeat(41) }).ok, false);
  assert.equal(validateSubmission({ ...ok, name: "x".repeat(40) }).ok, true);
  assert.equal(validateSubmission({ ...ok, answer: "hi" }).ok, false);
  assert.equal(validateSubmission({ ...ok, answer: "x".repeat(201) }).ok, false);
  assert.equal(validateSubmission({ ...ok, answer: "x".repeat(200) }).ok, true);
});

test("each channel is validated and stored as channel:value", () => {
  assert.deepEqual(normalizeContact("whatsapp", "+44 7700 900123"), { ok: true, value: "whatsapp:+447700900123" });
  assert.deepEqual(normalizeContact("whatsapp", "0044 7700 900123"), { ok: true, value: "whatsapp:+447700900123" });
  assert.equal(normalizeContact("whatsapp", "12345").ok, false);
  assert.deepEqual(normalizeContact("discord", "@Ada_Q"), { ok: true, value: "discord:ada_q" });
  assert.equal(normalizeContact("discord", "a").ok, false);
  assert.equal(normalizeContact("discord", "has space").ok, false);
  assert.deepEqual(normalizeContact("instagram", "@ada.climbs"), { ok: true, value: "instagram:ada.climbs" });
  assert.deepEqual(normalizeContact("email", "Ada@Example.com"), { ok: true, value: "email:ada@example.com" });
  assert.equal(normalizeContact("email", "ada@").ok, false);
  assert.equal(normalizeContact("linkedin", "ada").ok, false);
  const prefixed = validateSubmission({ name: "Ada", contact: "email:ada@example.com", answer: "Bouldering", consent: true });
  assert.equal(prefixed.ok, true);
});

test("old bare contacts still read", () => {
  assert.deepEqual(parseContact("ada@example.com"), { channel: "email", value: "ada@example.com" });
  assert.deepEqual(parseContact("@ada"), { channel: "discord", value: "ada" });
  assert.deepEqual(parseContact("whatsapp:+447700900123"), { channel: "whatsapp", value: "+447700900123" });
});

// ---- D25: "Best way to reach you" saves every filled tab ----
import fs from "node:fs";
import { collectTabs, fillOrder, TABS_HELP, type Channel, type TabValues } from "./survey";

/** Plays the form: type into a tab, switch, type into the next. Returns the state the form holds. */
function play(steps: [Channel, string][]) {
  let values: TabValues = {};
  let order: Channel[] = [];
  for (const [channel, value] of steps) {
    values = { ...values, [channel]: value };
    order = fillOrder(order, channel, value);
  }
  return { values, order };
}

test("D25: filling all four tabs saves four contacts; contact is the starred (first filled) one", () => {
  const { values, order } = play([
    ["whatsapp", "+44 7700 900123"],
    ["discord", "rafi.dev"],
    ["instagram", "@rafi"],
    ["email", "rafi@example.com"],
  ]);
  const collected = collectTabs(values, order);
  assert.equal(collected.invalid, null);
  assert.equal(collected.contacts.length, 4);
  assert.equal(collected.preferred, "whatsapp");
  const saved = validateSubmission({ name: "Rafi", contacts: collected.contacts, preferred: collected.preferred, answer: "Bouldering", consent: true });
  assert.ok(saved.ok);
  assert.deepEqual(saved.value.contacts, ["whatsapp:+447700900123", "discord:rafi.dev", "instagram:rafi", "email:rafi@example.com"]);
  assert.equal(saved.value.contact, "whatsapp:+447700900123", "the old single-contact reader still gets the starred one");
});

test("D25: switching tabs keeps every value; the first filled tab stays starred", () => {
  const { values, order } = play([
    ["discord", "rafi.dev"],
    ["email", "rafi@example.com"],
    ["whatsapp", "+44 7700 900123"],
  ]);
  assert.equal(values.discord, "rafi.dev", "switching away never clears");
  assert.deepEqual(order, ["discord", "email", "whatsapp"]);
  const collected = collectTabs(values, order);
  assert.equal(collected.preferred, "discord");
  assert.deepEqual(collected.contacts.map((item) => item.channel), ["discord", "email", "whatsapp"]);
  // Emptying the starred tab passes the star to the next one filled.
  const after = fillOrder(order, "discord", "  ");
  assert.equal(collectTabs({ ...values, discord: "" }, after).preferred, "email");
});

test("D25: an empty tab is ignored; nothing at all asks for one", () => {
  const { values, order } = play([
    ["whatsapp", "+44 7700 900123"],
    ["instagram", "   "],
  ]);
  const collected = collectTabs(values, order);
  assert.deepEqual(collected.contacts.map((item) => item.channel), ["whatsapp"]);
  assert.equal(collectTabs({}, []).invalid?.error, "Add at least one way to reach you.");
});

test("D25: each value is checked on its own; the bad tab is named so the form switches to it", () => {
  const { values, order } = play([
    ["whatsapp", "+44 7700 900123"],
    ["discord", "Not A Name!"],
  ]);
  const collected = collectTabs(values, order);
  assert.equal(collected.invalid?.channel, "discord");
  assert.match(collected.invalid?.error ?? "", /Discord usernames/);
  assert.equal(collected.contacts.length, 0, "nothing saves until it's fixed");
});

test("D25: one way to add contacts on the form: tabs with ticks, the quiet line, no 'Add another way'", () => {
  const form = fs.readFileSync("app/survey/page.tsx", "utf8");
  const fields = fs.readFileSync("components/contact-fields.tsx", "utf8");
  assert.match(form, /<ContactTabs/);
  assert.doesNotMatch(form, /Add another way|addWay|<ContactWay/);
  assert.match(form, /setActive\(collected\.invalid\.channel\)/, "a bad value switches to its tab");
  assert.match(fields, /data-filled=\{filled \? "" : undefined\}/);
  assert.match(fields, /\{TABS_HELP\}/);
  assert.equal(TABS_HELP, "Fill in any you use. We'll save them all.");
  assert.match(form, /contacts: collected\.contacts, preferred: collected\.preferred/, "the edit form (PATCH) sends the same list");
});
