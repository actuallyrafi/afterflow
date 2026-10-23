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

test("the nav is on every signed-in page, labelled, marks the current tab and respects safe areas", () => {
  const layout = fs.readFileSync("app/m/[token]/layout.tsx", "utf8");
  assert.match(layout, /<BottomNav token=\{token\} \/>/);
  const nav = fs.readFileSync("components/bottom-nav.tsx", "utf8");
  assert.match(nav, /aria-label="Main"/);
  assert.match(nav, /aria-current=/);
  assert.match(nav, /tabbar glass/);
  const css = fs.readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.tabbar \{[\s\S]*?safe-area-inset-bottom/);
  assert.match(css, /\.with-tabbar \.shell \{ padding-bottom: calc\(env\(safe-area-inset-bottom\)/);
});

test("My card isn't duplicated in the ⋯ menu; Blocked stays there", () => {
  const page = fs.readFileSync("app/m/[token]/page.tsx", "utf8");
  const sheet = page.slice(page.indexOf('<Sheet open={settings}'), page.indexOf("</Sheet>", page.indexOf('<Sheet open={settings}')));
  assert.ok(sheet.length > 0);
  assert.match(sheet, /Blocked/);
  assert.equal(/My card/.test(sheet), false);
  // The floating My card pill is gone too; the tab replaces it.
  assert.equal(/<span className="round text-\[16px\] font-extrabold">My card<\/span>/.test(page), false);
});
