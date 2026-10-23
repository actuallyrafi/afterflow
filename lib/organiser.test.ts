import assert from "node:assert/strict";
import test from "node:test";
import { organiserAuthorised } from "./organiser";

function withPasscode(value: string | undefined, fn: () => void) {
  const before = process.env.ORGANISER_PASSCODE;
  if (value === undefined) delete process.env.ORGANISER_PASSCODE;
  else process.env.ORGANISER_PASSCODE = value;
  try {
    fn();
  } finally {
    if (before === undefined) delete process.env.ORGANISER_PASSCODE;
    else process.env.ORGANISER_PASSCODE = before;
  }
}

test("organiser: no passcode set refuses everything, including the old public default", () => {
  withPasscode(undefined, () => {
    for (const guess of ["afterflow", "", "admin", "password", null]) {
      assert.equal(organiserAuthorised(guess), false, String(guess));
    }
  });
});

test("organiser: an empty passcode counts as unset", () => {
  withPasscode("", () => {
    assert.equal(organiserAuthorised(""), false);
    assert.equal(organiserAuthorised(null), false);
    assert.equal(organiserAuthorised("afterflow"), false);
  });
});

test("organiser: only the configured passcode is accepted", () => {
  withPasscode("test-only-Xy7q", () => {
    assert.equal(organiserAuthorised("test-only-Xy7q"), true);
    assert.equal(organiserAuthorised("test-only-Xy7Q"), false);
    assert.equal(organiserAuthorised("test-only-Xy7"), false);
    assert.equal(organiserAuthorised("afterflow"), false);
    assert.equal(organiserAuthorised(null), false);
  });
});

test("organiser: no fallback default left in the source or README", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync("lib/organiser.ts", "utf8");
  assert.doesNotMatch(src, /ORGANISER_PASSCODE\s*\|\|/);
  const readme = fs.readFileSync("README.md", "utf8");
  assert.doesNotMatch(readme, /default `[^`]+`; change it/);
  assert.doesNotMatch(readme, /default passcode/i);
});
