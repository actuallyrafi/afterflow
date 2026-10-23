import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

// v4.1b (per Tanvir, 23 Oct 2026): Delete card lives in one place, a Danger zone at the very
// bottom of My card, and it still needs a confirm step.

test("Delete my card lives in the Danger zone at the bottom of My card, and only there", () => {
  const card = fs.readFileSync("app/m/[token]/card/page.tsx", "utf8");
  const zone = card.indexOf('id="danger-zone"');
  assert.ok(zone > 0, "My card has a Danger zone section");
  assert.match(card, />\s*Danger zone\s*</);
  // It comes after everything else on the page: contacts, Edit my card and the reminder switch.
  for (const earlier of ["Show my QR", "Edit my card", "One gentle reminder", "{CONTACTS_HELP}"]) {
    assert.ok(card.indexOf(earlier) < zone, `${earlier} sits above the Danger zone`);
  }
  // One quiet red row that opens the confirm sheet; not a filled red button on the page.
  const section = card.slice(zone, card.indexOf("</section>", zone));
  assert.match(section, /text-hot">Delete my card</);
  assert.equal(/btn-hot/.test(section), false, "no big filled red block in the section");
  assert.match(section, /onClick=\{\(\) => setDeleting\(true\)\}/);
  assert.match(card, /<DeleteCardSheet token=\{token\} name=\{profile\.name\} open=\{deleting\}/);
  // Generous gap above it, and it clears the tab bar and the home indicator.
  const css = fs.readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.danger-zone \{ margin-top: 72px;[^}]*safe-area-inset-bottom/);

  // Gone from the ⋯ sheet on Your people, which now just points to My card.
  const people = fs.readFileSync("app/m/[token]/page.tsx", "utf8");
  assert.equal(/\/delete`/.test(people), false, "no delete link in Your people");
  assert.equal(/>\s*Delete my card\s*</.test(people), false);
  assert.match(people, /Danger zone at the bottom of My card/);
  // The old route only redirects to My card.
  const old = fs.readFileSync("app/m/[token]/delete/page.tsx", "utf8");
  assert.match(old, /redirect\(`\/m\/\$\{token\}\/card#danger-zone`\)/);
  assert.equal(/method: "DELETE"/.test(old), false);
});

test("deleting needs the confirm sheet: it says what goes, starts on Keep, and waits for your name", () => {
  const sheet = fs.readFileSync("components/delete-card-sheet.tsx", "utf8");
  assert.match(sheet, /role="alertdialog"/);
  assert.match(sheet, /Delete your card\?/);
  assert.match(sheet, /notes \(private and shared\), your events and all your connections are removed/);
  assert.match(sheet, /Nobody is told/);
  // Focus starts on the safe choice.
  assert.match(sheet, /Keep my card/);
  assert.match(sheet, /onClick=\{onClose\} disabled=\{busy\} data-autofocus>\s*Keep my card/);
  // The red button stays off until the typed name matches, and the request carries it.
  assert.match(sheet, /disabled=\{!matches \|\| busy\}/);
  assert.match(sheet, /const matches = nameMatches\(typed, name\)/);
  assert.match(sheet, /if \(!matches \|\| busy\) return;/);
  assert.match(sheet, /method: "DELETE", body: \{ name: typed \}/);
  // Afterwards, a neutral page with nothing personal on it.
  assert.match(sheet, /router\.replace\("\/deleted"\)/);
  assert.ok(fs.existsSync("app/deleted/page.tsx"));
});
