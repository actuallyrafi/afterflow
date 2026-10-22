import assert from "node:assert/strict";
import test from "node:test";
import { NO_STRONG_MATCH_MESSAGE } from "./survey";
import {
  directionPoints,
  keywordHits,
  keywords,
  scoreMatch,
  selectStrong,
  type ScoreInput,
} from "./matching";

function person(partial: Partial<ScoreInput>): ScoreInput {
  return {
    offers: [],
    topOffer: "",
    needs: [],
    topNeed: "",
    availability: "This week",
    tryingTo: "",
    role: "",
    ...partial,
  };
}

test("a top-priority tag is weighted 3x a normal complementary tag", () => {
  const normal = directionPoints(["Coding"], "Feedback", ["Coding"], "Design");
  const topNeed = directionPoints(["Coding"], "Coding", ["Coding"], "Design");
  const topOffer = directionPoints(["Coding"], "Feedback", ["Coding"], "Coding");
  assert.equal(normal, 12);
  assert.equal(topNeed, 36);
  assert.equal(topOffer, 36);
  assert.equal(topNeed / normal, 3);
});

test("mutual complements score higher than a one-way match, which stays hidden", () => {
  const coder = person({
    offers: ["Coding"],
    topOffer: "Coding",
    needs: ["Design"],
    topNeed: "Design",
    role: "engineer",
    tryingTo: "alpha uniquephrase",
    availability: "This week",
  });
  const designer = person({
    offers: ["Design"],
    topOffer: "Design",
    needs: ["Coding"],
    topNeed: "Coding",
    role: "designer",
    tryingTo: "beta otherphrase",
    availability: "This week",
  });
  const oneWay = person({
    offers: ["Design"],
    topOffer: "Design",
    needs: ["Marketing/Growth"],
    topNeed: "Marketing/Growth",
    role: "designer",
    tryingTo: "gamma somethingelse",
    availability: "This week",
  });
  const mutual = scoreMatch(coder, designer);
  const single = scoreMatch(coder, oneWay);
  assert.ok(mutual.score > single.score);
  assert.equal(mutual.show, true);
  assert.equal(single.show, false);
  assert.equal(single.mutual, false);
});

test("the same availability scores higher than a mismatch", () => {
  const left = person({
    offers: ["Coding"],
    topOffer: "Coding",
    needs: ["Design"],
    topNeed: "Design",
    role: "engineer",
    tryingTo: "alpha uniquephrase",
  });
  const together = person({
    offers: ["Design"],
    topOffer: "Design",
    needs: ["Coding"],
    topNeed: "Coding",
    role: "designer",
    tryingTo: "beta otherphrase",
    availability: "Right now at the event",
  });
  const apart = { ...together, availability: "This week" };
  const now = { ...left, availability: "Right now at the event" };
  assert.ok(scoreMatch(now, together).score > scoreMatch(now, apart).score);
});

test("free-text keywords overlap the other person's offers, role, and free text", () => {
  const plainA = person({
    offers: ["Coding"],
    topOffer: "Product",
    needs: ["Design"],
    topNeed: "Feedback",
    role: "zzrole",
    tryingTo: "qqqqq",
    availability: "Later tonight",
  });
  const plainB = person({
    offers: ["Design"],
    topOffer: "Product",
    needs: ["Coding"],
    topNeed: "Feedback",
    role: "yyrole",
    tryingTo: "wwwww",
    availability: "This week",
  });
  const richA = { ...plainA, tryingTo: "please design the onboarding" };
  const richB = { ...plainB, role: "Product designer", tryingTo: "onboarding work" };
  const plain = scoreMatch(plainA, plainB);
  const rich = scoreMatch(richA, richB);
  assert.ok(rich.score > plain.score);
  assert.ok(rich.keywordAB + rich.keywordBA > plain.keywordAB + plain.keywordBA);
  assert.ok(keywordHits("I can't design the onboarding", { offers: ["Design"], role: "x", tryingTo: "y" }) >= 1);
  assert.ok(
    keywordHits("need a designer for this", {
      offers: ["Coding"],
      role: "Product designer",
      tryingTo: "unrelated words here",
    }) >= 1,
  );
});

test("stemming and stopwords", () => {
  const words = keywords("Designing the onboarding");
  assert.ok(words.has("design"));
  assert.ok(words.has("onboard"));
  assert.equal(keywords("the and with this").size, 0);
});

test("no evidence is not a match and weak pairs are not forced", () => {
  const a = person({
    offers: ["Coding"],
    topOffer: "Coding",
    needs: ["Design"],
    topNeed: "Design",
    role: "pm",
    tryingTo: "zzzz",
    availability: "This week",
  });
  const b = person({
    offers: ["Marketing/Growth"],
    topOffer: "Marketing/Growth",
    needs: ["Community"],
    topNeed: "Community",
    role: "host",
    tryingTo: "qqqq",
    availability: "Later tonight",
  });
  const none = scoreMatch(a, b);
  assert.equal(none.score, 0);
  assert.equal(none.show, false);
  const onlyWeak = selectStrong([
    { id: "weak", score: none.score, show: none.show },
    { id: "also", score: 10, show: false },
  ]);
  assert.deepEqual(onlyWeak, []);
  assert.equal(NO_STRONG_MATCH_MESSAGE, "No strong match yet, we'll keep looking");
});

test("score is symmetric and only strong matches are kept, highest first", () => {
  const a = person({
    offers: ["Data"],
    topOffer: "Data",
    needs: ["Product"],
    topNeed: "Product",
    role: "analyst",
    tryingTo: "scoreboard privacy",
    availability: "This week",
  });
  const b = person({
    offers: ["Product"],
    topOffer: "Product",
    needs: ["Data"],
    topNeed: "Data",
    role: "pm",
    tryingTo: "privacy scoreboard",
    availability: "This week",
  });
  assert.equal(scoreMatch(a, b).score, scoreMatch(b, a).score);
  const picked = selectStrong([
    { id: "low", score: 30, show: true },
    { id: "hidden", score: 90, show: false },
    { id: "high", score: 80, show: true },
  ]);
  assert.deepEqual(
    picked.map((row) => row.id),
    ["high", "low"],
  );
});
