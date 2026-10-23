import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("app/m/[token]/c/[id]/page.tsx", "utf8");
const card = fs.readFileSync("components/ui/quote-card.tsx", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");
const sayHi = fs.readFileSync("components/say-hi.tsx", "utf8");

test("the connection page has quote cards, not a chat thread (spec v4.1a)", () => {
  // Two full-width figures under one section label, theirs first.
  assert.match(page, /What you both said/);
  const theirs = page.indexOf("label={`${first} said${at}`}");
  const yours = page.indexOf("label={`You said${at}`}");
  assert.ok(theirs > 0 && yours > theirs, "theirs first, then yours");
  assert.match(card, /<figure className="quote"/);
  assert.match(card, /<figcaption/);
  assert.match(card, /<blockquote>\{text\}<\/blockquote>/, "their own words, curly quotes from CSS");
  // No bubbles, tails, sender alignment, divider events, conversation header, live regions or times.
  for (const banned of [/className="bubble"/, /className="them\b/, /className="me\b/, /namepill/, /event-line/, /role="log"/, /aria-live/, /\breply\b/i, /Type a message/i]) {
    assert.equal(banned.test(page), false, String(banned));
  }
  assert.equal(/toLocaleTimeString|\d{2}:\d{2}/.test(card), false, "no times on a quote");
  // Page order: hand-off card, quotes, notes, calendar.
  const order = ["<SayHi", "{quotes}", 'id="notes-title"', "<CalendarReminder"].map((needle) => page.indexOf(needle));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.ok(order.every((index) => index > 0));
});

test("quote card styling: a 4px rule in the speaker's hue, deep in light, tint in dark, stronger under more contrast", () => {
  assert.match(css, /\.quote::before \{[^}]*width: 4px;[^}]*background: var\(--rule\)/);
  for (let hue = 1; hue <= 6; hue += 1) {
    assert.ok(css.includes(`.quote[data-hue="${hue}"] { --rule: var(--h${hue}-deep); }`));
    assert.ok(css.includes(`.quote[data-hue="${hue}"] { --rule: var(--h${hue}-tint); }`));
  }
  assert.match(css, /prefers-contrast: more\) \{ \.quote \{ box-shadow: inset 0 0 0 1px var\(--ink\); \} \.quote::before \{ width: 5px; \} \}/);
});

test("person header and title bar: the person is the page title; only a plain name fades in on scroll", () => {
  assert.match(page, /<Mark name=\{other\.name\} seed=\{other\.publicId\} size=\{72\}/);
  assert.match(page, /<h1 ref=\{titleRef\}>/);
  assert.match(page, /document\.title = `\$\{fullName\} · Afterflow`/);
  assert.match(page, /IntersectionObserver/);
  assert.match(page, /aria-label=\{`More about \$\{first\}`\}/);
  assert.match(page, /aria-label="Back to Your people"/);
  assert.match(page, /You both said yes · \$\{day\}/);
  assert.match(css, /\.topbar\.titlebar\[data-shown\] \.bar-title \{ opacity: 1; \}/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.topbar\.titlebar, \.topbar\.titlebar \.bar-title \{ transition: none; \} \}/);
});

test("Discord, flag off: copy icon + 'Username', labelled 'Copy username'; the mark next to Say hi is gone", () => {
  assert.match(sayHi, /aria-label="Copy username"[\s\S]{0,80}<Icon name="copy" size=\{17\} \/>\s*Username/);
  assert.equal(/<Mark /.test(sayHi), false);
  assert.match(sayHi, /Also on \{CHANNEL_LABEL\[option\.channel\]\}/);
});

test("How we built carries the v1.1 positioning line", () => {
  const how = fs.readFileSync("app/how-we-built/page.tsx", "utf8");
  assert.match(how, /Afterflow is the connector, not the connection\. You do the connecting\./);
});
