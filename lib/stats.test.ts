import assert from "node:assert/strict";
import test from "node:test";
import { average, matchedMinutesLabel, median, minutesBetween } from "./stats";

test("average and median", () => {
  assert.equal(average([]), null);
  assert.equal(median([]), null);
  assert.equal(average([2, 4]), 3);
  assert.equal(median([1, 3, 10]), 3);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test("minutes after joining", () => {
  assert.equal(minutesBetween("2026-10-22T18:00:00.000Z", "2026-10-22T18:04:59.000Z"), 4);
  assert.equal(minutesBetween("2026-10-22T18:10:00.000Z", "2026-10-22T18:00:00.000Z"), 0);
  assert.equal(matchedMinutesLabel(0), "matched 0 minutes after joining");
  assert.equal(matchedMinutesLabel(1), "matched 1 minute after joining");
  assert.equal(matchedMinutesLabel(5), "matched 5 minutes after joining");
});
