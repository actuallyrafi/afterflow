import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { collectTabs, validateSubmission } from "./survey";

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

test("D30: a sheet focuses itself on open, never its first control; focus goes back on close", () => {
  const chrome = fs.readFileSync("components/ui/chrome.tsx", "utf8");
  const sheet = chrome.slice(chrome.indexOf("export function Sheet"), chrome.indexOf("export type ToastState"));
  assert.match(sheet, /dialog\.showModal\(\);\s*dialog\.focus\(\{ preventScroll: true \}\);/);
  assert.match(sheet, /tabIndex=\{-1\}/);
  assert.doesNotMatch(sheet, /querySelector[^\n]*\.focus\(\)/, "no first-control focus");
  assert.match(sheet, /back\.focus\(\{ preventScroll: true \}\)/, "restores focus to the opener");
  assert.match(sheet, /onCancel=/, "Escape still closes");
  assert.match(fs.readFileSync("app/globals.css", "utf8"), /dialog\.sheet:focus, dialog\.sheet:focus-visible \{ outline: none; \}/);
  assert.match(fs.readFileSync("app/globals.css", "utf8"), /:focus-visible \{ outline: 3px solid var\(--focus\)/, "keyboard rings stay");
  for (const file of [...files("app"), ...files("components")]) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(text, /data-autofocus/, file);
    // Buttons are never focused on their own when something opens (text fields may be, for typing).
    assert.doesNotMatch(text, /<button[^>]*\sautoFocus/, file);
  }
  for (const file of ["components/person-sheet.tsx", "components/event-sheets.tsx"]) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /Ref\.current\?\.focus\(\)/, `${file}: steps focus the sheet, not a button`);
  }
});

test("D30: the selected time chip shows by fill and weight, not a ring", () => {
  const css = fs.readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.seg button\[aria-checked="true"\] \{ font-weight: 700; background: var\(--panel\);/);
});

test("D30: calendar sheet subtitle drops 'You can ignore it.'", () => {
  const cal = fs.readFileSync("components/calendar-reminder.tsx", "utf8");
  assert.match(cal, /"A nudge in a few days, in your own calendar\."/);
  for (const file of [...files("app"), ...files("components"), ...files("lib")]) {
    if (file.endsWith("sheets.test.ts")) continue;
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /You can ignore it/, file);
  }
});

test("D30 (item 3): contacts never reach the answer; the answer is only what was typed", () => {
  const collected = collectTabs({ email: "rafi@example.com", whatsapp: "+44 7700 900123" }, ["email", "whatsapp"]);
  const saved = validateSubmission({ name: "Rafi", contacts: collected.contacts, preferred: collected.preferred, answer: "asdfg", consent: true });
  assert.ok(saved.ok);
  assert.equal(saved.value.answer, "asdfg");
  assert.ok(!saved.value.answer.includes("@"));
  const form = fs.readFileSync("app/survey/page.tsx", "utf8");
  assert.equal((form.match(/setAnswer\(/g) ?? []).length, 2, "set only by typing and by loading your own card to edit");
  assert.match(form, /setAnswer\(result\.data\.profile\.answer\)/);
  assert.match(form, /id="answer"[\s\S]*?autoComplete="off"/, "Safari contact AutoFill kept out of the answer");
});
