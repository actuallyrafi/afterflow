import assert from "node:assert/strict";
import test from "node:test";
import { CONSENT_TEXT, normalizeContact, parseContact, QUESTION, QUESTION_HELP, validateSubmission } from "./survey";

const ok = { name: "Sam", channel: "whatsapp", contact: "07700 900123", answer: "Running a supper club", consent: true };

test("the card is a name, one way to reach you, one question and consent", () => {
  const parsed = validateSubmission(ok);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.value, { name: "Sam", contact: "whatsapp:+447700900123", answer: "Running a supper club" });
  assert.deepEqual(Object.keys(parsed.value).sort(), ["answer", "contact", "name"]);
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
