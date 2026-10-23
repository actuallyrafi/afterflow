import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { TABS, tabFor } from "./nav";

test("the bottom nav has Your people, Events and My card, and knows the current tab", () => {
  assert.deepEqual(TABS.map((tab) => tab.label), ["Your people", "Events", "My card"]);
  assert.deepEqual(tabFor("/m/tok", "tok"), { key: "people", exact: true });
  assert.deepEqual(tabFor("/m/tok/events", "tok"), { key: "events", exact: true });
  assert.deepEqual(tabFor("/m/tok/card", "tok"), { key: "card", exact: true });
  assert.deepEqual(tabFor("/m/tok/c/abc", "tok"), { key: "people", exact: false });
  assert.deepEqual(tabFor("/m/tok/settings/blocked", "tok"), { key: "people", exact: false });
  assert.equal(tabFor("/survey", "tok"), null);
});

test("the nav is a labelled <nav> on the three roots only, hides with the keyboard and respects safe areas", () => {
  const layout = fs.readFileSync("app/m/[token]/layout.tsx", "utf8");
  assert.match(layout, /<BottomNav token=\{token\} \/>/);
  const nav = fs.readFileSync("components/bottom-nav.tsx", "utf8");
  assert.match(nav, /aria-label="Main"/);
  assert.match(nav, /aria-current=/);
  assert.match(nav, /tabbar glass/);
  // Pushed screens (a connection, Blocked, Delete) have no tab bar.
  assert.match(nav, /if \(!current\?\.exact\) return null;/);
  // Hidden while the keyboard is open.
  assert.match(nav, /visualViewport/);
  assert.match(nav, /data-hidden=/);
  const css = fs.readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.tabbar \{[\s\S]*?safe-area-inset-bottom/);
  assert.match(css, /\.tabbar\[data-hidden\]/);
  // Only pages that show the bar get the extra bottom padding.
  assert.match(css, /\.with-tabbar:has\(> \.tabbar\) \.shell \{ padding-bottom: calc\(64px/);
});

test("My card isn't duplicated in the ⋯ menu; it keeps Blocked, Privacy and your data, Help and feedback", () => {
  const page = fs.readFileSync("app/m/[token]/page.tsx", "utf8");
  const sheet = page.slice(page.indexOf('<Sheet open={settings}'), page.indexOf("</Sheet>", page.indexOf('<Sheet open={settings}')));
  assert.ok(sheet.length > 0);
  assert.match(sheet, />Blocked</);
  assert.match(sheet, />Privacy and your data</);
  assert.match(sheet, />Help and feedback</);
  assert.equal(/href=\{`\/m\/\$\{token\}\/card`\}/.test(sheet), false, "no My card link in the menu");
  // + lives in the header now, not a floating button.
  assert.match(page, /<CircleButton icon="plus" label="Add someone"/);
  // The floating My card pill is gone too; the tab replaces it.
  assert.equal(/<span className="round text-\[16px\] font-extrabold">My card<\/span>/.test(page), false);
});
