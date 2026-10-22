import assert from "node:assert/strict";
import test from "node:test";
import { cleanMeetId, decodeStoredMeet, encodeStoredMeet, firstName, MEET_TTL_MS } from "./pending-meet";

test("a stored meet id expires after an hour and bare legacy ids are ignored", () => {
  const now = 1_800_000_000_000;
  assert.equal(decodeStoredMeet(encodeStoredMeet("abc_-1", now), now + 1000), "abc_-1");
  assert.equal(decodeStoredMeet(encodeStoredMeet("abc", now), now + MEET_TTL_MS + 1), null);
  assert.equal(decodeStoredMeet("abc", now), null);
  assert.equal(decodeStoredMeet(encodeStoredMeet("../x", now), now), null);
});

test("meet ids are restricted to url-safe characters", () => {
  assert.equal(cleanMeetId(" abc-123_X "), "abc-123_X");
  assert.equal(cleanMeetId("a/b"), null);
  assert.equal(cleanMeetId(42), null);
  assert.equal(firstName("  Jonah  Blake "), "Jonah");
});
