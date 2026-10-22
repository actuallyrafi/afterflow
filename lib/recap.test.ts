import assert from "node:assert/strict";
import test from "node:test";
import { decodeStoredMeet, encodeStoredMeet, MEET_TTL_MS } from "./pending-meet";
import { splitSentences, withoutRepeats } from "./recap";

test("sentences split outside quotes only", () => {
  assert.deepEqual(splitSentences('Ada gets Design. Ada wrote "Ship it. Then sleep.". Done.'), [
    "Ada gets Design.",
    'Ada wrote "Ship it. Then sleep.".',
    "Done.",
  ]);
});

test("the reason drops quotes the recap already shows and keeps the rest verbatim", () => {
  const recap = ['Jonah wrote "I can design onboarding flows."', 'You wrote "Shipping an AI study app".'];
  const why =
    'Ada Quinn gets Design from Jonah Blake. Ada Quinn wrote "Shipping an AI study app". Jonah Blake gets Coding from Ada Quinn. Jonah Blake wrote "I can design onboarding flows.".';
  assert.equal(withoutRepeats(why, recap), "Ada Quinn gets Design from Jonah Blake. Jonah Blake gets Coding from Ada Quinn.");
  assert.equal(withoutRepeats("Not enough to go on yet, add a note", recap), "Not enough to go on yet, add a note");
});

test("a stored meet id expires after an hour and bare legacy ids are ignored", () => {
  const now = 1_800_000_000_000;
  assert.equal(decodeStoredMeet(encodeStoredMeet("abc_-1", now), now + 1000), "abc_-1");
  assert.equal(decodeStoredMeet(encodeStoredMeet("abc", now), now + MEET_TTL_MS + 1), null);
  assert.equal(decodeStoredMeet("abc", now), null);
  assert.equal(decodeStoredMeet(encodeStoredMeet("../x", now), now), null);
});
