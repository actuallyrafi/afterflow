import assert from "node:assert/strict";
import test from "node:test";
import { CONNECTION_NEXT_STEPS, mutualReason, NOT_ENOUGH_EVIDENCE } from "./evidence";
import { normalizeLinkedIn } from "./survey";

test("mutual reason is one or two quoted sentences about what each person gets", () => {
  const both = mutualReason(
    {
      name: "Ada",
      offers: ["Coding"],
      needs: ["Design"],
      tryingTo: "Shipping an AI study app but I can't design the onboarding",
    },
    {
      name: "Jonah",
      offers: ["Design"],
      needs: ["Coding"],
      tryingTo: "I can design onboarding flows and want a real AI product to put in my portfolio.",
    },
  );
  assert.equal((both.match(/ gets /g) || []).length, 2);
  assert.match(both, /Ada gets Design from Jonah\. Ada wrote "Shipping an AI study app but I can't design the onboarding"\./);
  assert.match(both, /Jonah gets Coding from Ada\. Jonah wrote "I can design onboarding flows and want a real AI product to put in my portfolio\."/);

  const oneWay = mutualReason(
    { name: "Ada", offers: ["Coding"], needs: ["Design"], tryingTo: "Need a designer for the onboarding." },
    { name: "Sam", offers: ["Design"], needs: ["Marketing/Growth"], tryingTo: "I am looking for a marketer." },
  );
  assert.equal(oneWay.includes("Sam gets"), false);
  assert.match(oneWay, /Ada gets Design from Sam\. Ada wrote "Need a designer for the onboarding\."/);
});

test("no quotable overlap invents nothing", () => {
  const reason = mutualReason(
    { name: "Ada", offers: ["Coding"], needs: ["Teammate"], tryingTo: "A quiet note with no overlap." },
    { name: "Sam", offers: ["Marketing/Growth"], needs: ["Community"], tryingTo: "Another quiet note." },
  );
  assert.equal(reason, NOT_ENOUGH_EVIDENCE);
  assert.equal(reason.includes("gets"), false);
  assert.equal(reason.includes("Find "), false);
});

test("connection next steps stay at three and time is only a suggestion", () => {
  assert.equal(CONNECTION_NEXT_STEPS.length, 3);
  assert.equal(CONNECTION_NEXT_STEPS[0].id, "online");
  assert.equal(CONNECTION_NEXT_STEPS.find((step) => step.id === "time")?.suggestion, true);
});

test("linkedin is optional and must be a linkedin url", () => {
  assert.deepEqual(normalizeLinkedIn(""), { ok: true, value: "" });
  assert.deepEqual(normalizeLinkedIn("   "), { ok: true, value: "" });
  assert.equal(normalizeLinkedIn("linkedin.com/in/ada").ok, true);
  assert.equal(normalizeLinkedIn("https://www.linkedin.com/in/ada").ok, true);
  assert.equal(normalizeLinkedIn("https://evil.example/in/ada").ok, false);
  assert.equal(normalizeLinkedIn("not a url").ok, false);
});
