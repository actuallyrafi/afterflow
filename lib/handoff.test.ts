import assert from "node:assert/strict";
import test from "node:test";
import { defaultOpener, handoffFor } from "./handoff";

const message = "Hey Jonah, it's Sam from the Grok Bot hackathon. Really good meeting you!";

test("the opener is fixed and editable, never generated from answers", () => {
  assert.equal(defaultOpener("Jonah Blake", "Sam Rivera"), message);
});

test("WhatsApp opens wa.me with the message filled in", () => {
  const hand = handoffFor("whatsapp:+447700900123", "Jonah Blake", message);
  assert.equal(hand.label, "Message on WhatsApp");
  assert.equal(hand.href, `https://wa.me/447700900123?text=${encodeURIComponent(message)}`);
});

test("Discord is copy-only until handoff_discord is on", () => {
  const off = handoffFor("discord:jonah", "Jonah", message, { handoff_discord: false });
  assert.equal(off.label, null);
  assert.equal(off.href, null);
  assert.equal(off.display, "jonah");
  const on = handoffFor("discord:jonah", "Jonah", message, { handoff_discord: true });
  assert.equal(on.label, "Open in Discord");
  assert.equal(on.copyFirst, true);
});

test("Instagram copies then opens their profile; email uses mailto with the body", () => {
  const ig = handoffFor("instagram:jonah.cooks", "Jonah", message);
  assert.equal(ig.href, "https://instagram.com/jonah.cooks");
  assert.equal(ig.copyFirst, true);
  const mail = handoffFor("email:jonah@example.com", "Jonah Blake", message);
  assert.equal(mail.label, "Email Jonah");
  assert.ok(mail.href?.startsWith("mailto:jonah@example.com?"));
  assert.ok(mail.href?.includes(encodeURIComponent(message)));
});
