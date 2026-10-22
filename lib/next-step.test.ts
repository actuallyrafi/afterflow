import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  allowedNextSteps,
  pickNextStep,
  quotesBothFreeTexts,
  templateMatchCopy,
  type EventContext,
  type SurveyQuote,
} from "./next-step";

const ctx = JSON.parse(readFileSync(path.join(process.cwd(), "event-context.json"), "utf8")) as EventContext;

function quote(partial: Partial<SurveyQuote>): SurveyQuote {
  return {
    name: "A",
    role: "builder",
    offers: ["Coding"],
    topOffer: "Coding",
    needs: ["Design"],
    topNeed: "Design",
    availability: "Right now at the event",
    tryingTo: "A quiet project with no partner keywords.",
    ...partial,
  };
}

test("next step is one entry copied from event context", () => {
  const allowed = allowedNextSteps(ctx);
  const samples = [
    pickNextStep(quote({ tryingTo: "We need a postgres backend" }), quote({ name: "B", tryingTo: "supabase auth is the gap" }), ctx),
    pickNextStep(quote({ tryingTo: "A quiet project with no partner keywords." }), quote({ name: "B", tryingTo: "Another quiet note." }), ctx),
    pickNextStep(quote({ tryingTo: "Oscar Falemara from Outpost" }), quote({ name: "B", tryingTo: "venue stuff" }), ctx),
    pickNextStep(quote({ tryingTo: "unicorn mafia intro please" }), quote({ name: "B", tryingTo: "community" }), ctx),
  ];
  for (const step of samples) {
    assert.ok(allowed.includes(step), step);
    assert.equal((step.match(/Find |Post in /g) || []).length, 1);
  }
  assert.equal(
    pickNextStep(quote({ tryingTo: "We need a postgres backend" }), quote({ name: "B", tryingTo: "supabase auth is the gap" }), ctx),
    "Find Isabelle Roser (Supabase)",
  );
  assert.equal(
    pickNextStep(quote({ tryingTo: "A quiet project with no partner keywords." }), quote({ name: "B", tryingTo: "Another quiet note." }), ctx),
    "Post in #team-up",
  );
  assert.equal(
    pickNextStep(quote({ tryingTo: "Oscar Falemara from Outpost" }), quote({ name: "B", tryingTo: "venue stuff" }), ctx),
    "Find Oscar Falemara (Outpost)",
  );
});

test("the template quotes both free-text answers word for word", () => {
  const a = quote({
    name: "Maya",
    role: "Full-stack engineer",
    tryingTo: "Shipping an AI study app but I can't design the onboarding",
  });
  const b = quote({
    name: "Jonah",
    role: "Product designer",
    offers: ["Design"],
    topOffer: "Design",
    needs: ["Coding"],
    topNeed: "Coding",
    tryingTo: "I can design onboarding flows and want a real AI product to put in my portfolio.",
  });
  const copy = templateMatchCopy(a, b, ctx);
  assert.equal(quotesBothFreeTexts(copy.explanation, a.tryingTo, b.tryingTo), true);
  assert.ok(copy.explanation.includes('"Shipping an AI study app but I can\'t design the onboarding"'));
  assert.ok(allowedNextSteps(ctx).includes(copy.firstAction));
  assert.equal(templateMatchCopy(a, b, ctx).firstAction, copy.firstAction);
});
