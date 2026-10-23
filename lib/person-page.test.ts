import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("app/m/[token]/c/[id]/page.tsx", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");
const sayHi = fs.readFileSync("components/say-hi.tsx", "utf8");

test("v4.1c person page: the chat-bubble layout Tanvir prefers (D19, overrides the v4.1a quote cards)", () => {
  // Centred pill header with their mark and name.
  assert.match(page, /className="namepill glass"[\s\S]{0,200}<Mark name=\{other\.name\} seed=\{other\.publicId\} size=\{30\}/);
  // "Met at {event} · {date}" divider with a chevron that opens Move to event.
  assert.match(page, /`Met at \$\{filedEvent\.label\}`/);
  assert.match(page, /className="event-line mt-1\.5"[\s\S]{0,400}<Icon name="chevDown"/);
  // Their words: left bubble in their hue with their mark and a name label; yours: right grey bubble.
  assert.match(page, /<p className="speaker">\{first\}<\/p>\s*<div className=\{`them hue-\$\{hueOf\(other\.publicId\)\}`\}>\s*<Mark[^>]*\/>\s*<p className="bubble">\{other\.answer\}<\/p>/);
  assert.match(page, /<div className="me rise[^"]*"[^>]*>\s*<p className="bubble">\{connection\.myAnswer\}<\/p>/);
  assert.match(css, /\.me \.bubble \{ background: var\(--fill\);/);
  // Page order: bubbles, "You both said yes", shared note, private note, Say hi, calendar.
  const order = ['className="speaker"', 'className="bubble">{connection.myAnswer}', "You both said yes", 'kind="shared"', 'kind="private"', "<SayHi", "<CalendarReminder"].map((n) => page.indexOf(n));
  assert.ok(order.every((i) => i > 0), JSON.stringify(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.equal(fs.existsSync("components/ui/quote-card.tsx"), false);
  assert.equal(/QuoteCard|className="quote"/.test(page), false);
});

test("not an in-app chat: no composer, send box or message input on the person page", () => {
  assert.equal(/<textarea/.test(page), false);
  assert.equal(/Type a message|Send message|role="log"|aria-live/i.test(page), false);
  // The only input is the optional private note while you confirm you met.
  const inputs = page.match(/<input\b/g) ?? [];
  assert.equal(inputs.length, 1);
  assert.match(page, /id="confirm-note"/);
});

test("Say hi keeps the prefilled message, copy button, Other ways to reach, and the v4.1a Username button", () => {
  assert.match(sayHi, /You both use \{CHANNEL_LABEL\[plan\.shared\]\}\. Say hi there\./);
  assert.match(sayHi, /Other ways to reach \{first\}/);
  assert.match(sayHi, /aria-label="Copy message"/);
  assert.match(sayHi, /aria-label="Copy username"[\s\S]{0,80}<Icon name="copy" size=\{17\} \/>\s*Username/);
});

test("How we built carries the v1.1 positioning line", () => {
  const how = fs.readFileSync("app/how-we-built/page.tsx", "utf8");
  assert.match(how, /Afterflow is the connector, not the connection\. You do the connecting\./);
});
