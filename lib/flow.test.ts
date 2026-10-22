import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { actOnConnection, addMet, listHome, searchPeople } from "./connections";
import { ensureBackupPair } from "./demo-backup";
import { NOT_ENOUGH_EVIDENCE } from "./evidence";
import { allowedNextSteps } from "./next-step";
import { organiserStats } from "./organiser";
import { createFileStore } from "./store";
import type { Submission } from "./survey";
import eventContextJson from "../event-context.json";
import type { EventContext } from "./next-step";

function submission(partial: Partial<Submission>): Submission {
  return {
    name: "Person",
    contact: "person@example.com",
    role: "Builder",
    offers: ["Coding"],
    topOffer: "Coding",
    needs: ["Design"],
    topNeed: "Design",
    availability: "Right now at the event",
    tryingTo: "Shipping something specific this month.",
    ...partial,
  };
}

test("people who met confirm before either contact is revealed", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "afterflow-"));
  const store = createFileStore(path.join(dir, "flow.sqlite"));
  const ada = await store.createProfile({
    ...submission({
      name: "Ada",
      contact: "ada-secret@example.com",
      role: "Full-stack engineer",
      offers: ["Coding"],
      topOffer: "Coding",
      needs: ["Design"],
      topNeed: "Design",
      tryingTo: "Shipping an AI study app but I can't design the onboarding",
    }),
    linkedin: "https://www.linkedin.com/in/ada-secret-profile",
  });
  const jonah = await store.createProfile({
    ...submission({
      name: "Jonah",
      contact: "jonah-secret#demo",
      role: "Product designer",
      offers: ["Design"],
      topOffer: "Design",
      needs: ["Coding"],
      topNeed: "Coding",
      tryingTo: "I can design onboarding flows and want a real AI product to put in my portfolio.",
    }),
    isDemo: true,
    linkedin: "https://www.linkedin.com/in/jonah-secret-profile",
  });
  const stranger = await store.createProfile(
    submission({
      name: "Stranger",
      contact: "nope-secret@example.com",
      role: "Host",
      offers: ["Marketing/Growth"],
      topOffer: "Marketing/Growth",
      needs: ["Community"],
      topNeed: "Community",
      tryingTo: "qqqq unrelated",
    }),
  );

  const found = await searchPeople(store, ada.secretToken, "jon");
  assert.ok(found);
  assert.equal(found.length, 1);
  assert.equal(found[0].name, "Jonah");
  assert.equal(JSON.stringify(found).includes("jonah-secret"), false);

  const self = await addMet(store, ada.secretToken, ada.publicId, "nope");
  assert.equal(self.status, 400);

  const added = await addMet(store, ada.secretToken, jonah.publicId, "the onboarding flow");
  assert.equal(added.status, 200);
  if (!("connection" in added.body)) throw new Error("expected connection");
  const connectionId = added.body.connection.id;
  assert.equal(added.body.connection.statusLabel, "Waiting for them");
  assert.equal(added.body.connection.other.contact, undefined);
  assert.equal(added.body.connection.journey, null);
  assert.equal(JSON.stringify(added.body).includes("jonah-secret"), false);
  assert.equal(JSON.stringify(added.body).includes("jonah-secret-profile"), false);
  assert.equal(JSON.stringify(added.body).includes(jonah.tryingTo), false);

  const adaHome = await listHome(store, ada.secretToken);
  const jonahHome = await listHome(store, jonah.secretToken);
  const strangerHome = await listHome(store, stranger.secretToken);
  assert.equal(adaHome?.connections.length, 1);
  assert.equal(adaHome?.connections[0].other.contact, undefined);
  assert.equal(adaHome?.connections[0].other.linkedin, undefined);
  assert.equal("contact" in (adaHome?.connections[0].other ?? {}), false);
  assert.equal("linkedin" in (adaHome?.connections[0].other ?? {}), false);
  assert.equal(jonahHome?.connections[0].other.contact, undefined);
  assert.equal(jonahHome?.connections[0].other.linkedin, undefined);
  assert.equal(JSON.stringify(adaHome).includes("jonah-secret"), false);
  assert.equal(JSON.stringify(adaHome).includes("jonah-secret-profile"), false);
  assert.equal(jonahHome?.connections.length, 1);
  assert.equal(jonahHome?.connections[0].statusLabel, "Needs my confirm");
  assert.equal(jonahHome?.connections[0].theirNote, "the onboarding flow");
  assert.equal(strangerHome?.connections.length, 0);
  assert.equal(JSON.stringify(jonahHome).includes("ada-secret"), false);
  assert.equal(JSON.stringify(jonahHome).includes("ada-secret-profile"), false);

  const mutual = await actOnConnection(store, jonah.secretToken, connectionId, { action: "confirm" });
  assert.equal(mutual.status, 200);
  if (!("connection" in mutual.body)) throw new Error("expected connection");
  assert.equal(mutual.body.connection.mutual, true);
  assert.equal(mutual.body.connection.statusLabel, "Connected");
  assert.equal(mutual.body.connection.other.contact, "ada-secret@example.com");
  assert.equal(mutual.body.connection.other.linkedin, "https://www.linkedin.com/in/ada-secret-profile");
  const journey = mutual.body.connection.journey;
  assert.ok(journey);
  assert.ok(journey.recap.some((line) => line.includes(`"${ada.tryingTo}"`)));
  assert.ok(journey.recap.some((line) => line.includes(`"${jonah.tryingTo}"`)));
  assert.ok(journey.recap.some((line) => line.includes('"the onboarding flow"')));
  assert.ok(journey.why.includes(`"${ada.tryingTo}"`));
  assert.ok(journey.why.includes(`"${jonah.tryingTo}"`));
  assert.ok(allowedNextSteps(eventContextJson as EventContext).includes(journey.communityStep));
  assert.match(journey.why, /Ada gets .+ from Jonah\. Ada wrote "/);
  assert.match(journey.why, /Jonah gets .+ from Ada\. Jonah wrote "/);
  assert.equal(journey.opener.includes("GREEN"), false);
  assert.equal(JSON.stringify(journey).includes("Now, in 10 min"), false);
  assert.equal(JSON.stringify(journey).includes("Main floor"), false);

  const linked = await actOnConnection(store, ada.secretToken, connectionId, {
    action: "share_link",
    link: "github.com/ada/study-app",
  });
  assert.equal(linked.status, 200);
  if (!("connection" in linked.body)) throw new Error("expected link");
  assert.equal(linked.body.connection.journey?.myLink, "https://github.com/ada/study-app");

  const timed = await actOnConnection(store, ada.secretToken, connectionId, {
    action: "suggest_time",
    time: "Thursday after work",
  });
  assert.equal(timed.status, 200);
  if (!("connection" in timed.body)) throw new Error("expected time");
  assert.equal(timed.body.connection.journey?.myTime, "Thursday after work");

  const followed = await actOnConnection(store, jonah.secretToken, connectionId, { action: "follow_up_yes" });
  assert.equal(followed.status, 200);
  if (!("connection" in followed.body)) throw new Error("expected follow-up");
  assert.equal(followed.body.connection.statusLabel, "Followed up");
  assert.ok(followed.body.connection.myFollowUpAt);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const changed = await actOnConnection(store, jonah.secretToken, connectionId, { action: "follow_up_not_yet" });
  assert.equal(changed.status, 200);
  if (!("connection" in changed.body)) throw new Error("expected changed follow-up");
  assert.equal(changed.body.connection.statusLabel, "Connected");
  assert.equal(changed.body.connection.myFollowUp, "not_yet");
  assert.notEqual(changed.body.connection.myFollowUpAt, followed.body.connection.myFollowUpAt);
  const again = await actOnConnection(store, jonah.secretToken, connectionId, { action: "follow_up_yes" });
  if (!("connection" in again.body)) throw new Error("expected follow-up restored");
  assert.equal(again.body.connection.myFollowUp, "yes");

  const blocked = await actOnConnection(store, jonah.secretToken, connectionId, { action: "simulate_demo_confirm" });
  assert.equal(blocked.status, 400);

  const stats = await organiserStats(store);
  assert.equal(stats.signups, 3);
  assert.equal(stats.connectionsMade, 1);
  assert.equal(stats.mutualConfirms, 1);
  assert.equal(stats.followedUp, 1);

  await store.deleteAll();
  assert.equal((await store.listProfiles()).length, 0);
  assert.equal((await store.listMatches()).length, 0);
});

test("decline hides the connection and a weak pair invents no reason", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "afterflow-gate-"));
  const store = createFileStore(path.join(dir, "flow.sqlite"));
  const ada = await store.createProfile({
    ...submission({ name: "Ada", contact: "ada-hidden@example.com", tryingTo: "A quiet note with no overlap." }),
    linkedin: "https://www.linkedin.com/in/ada-hidden-profile",
  });
  const sam = await store.createProfile(
    submission({
      name: "Sam",
      contact: "sam-hidden@example.com",
      offers: ["Marketing/Growth"],
      topOffer: "Marketing/Growth",
      needs: ["Community"],
      topNeed: "Community",
      tryingTo: "Another quiet note.",
    }),
  );
  const added = await addMet(store, ada.secretToken, sam.publicId, "");
  assert.equal(added.status, 200);
  if (!("connection" in added.body)) throw new Error("expected connection");
  assert.equal(JSON.stringify(added.body).includes("sam-hidden"), false);
  assert.equal(JSON.stringify(added.body).includes("ada-hidden-profile"), false);
  const declined = await actOnConnection(store, sam.secretToken, added.body.connection.id, { action: "decline" });
  assert.equal(declined.status, 200);
  assert.equal("connection" in declined.body, false);
  assert.equal((await listHome(store, ada.secretToken))?.connections.length, 0);
  assert.equal((await listHome(store, sam.secretToken))?.connections.length, 0);

  const again = await addMet(store, ada.secretToken, sam.publicId, "");
  if (!("connection" in again.body)) throw new Error("expected connection");
  const mutual = await actOnConnection(store, sam.secretToken, again.body.connection.id, { action: "confirm" });
  if (!("connection" in mutual.body)) throw new Error("expected connection");
  assert.equal(mutual.body.connection.journey?.why, NOT_ENOUGH_EVIDENCE);

  const backup = await ensureBackupPair(store);
  const home = await listHome(store, backup.token);
  const card = home?.connections.find((item) => item.id === backup.connectionId);
  assert.ok(card);
  assert.equal(card.mutual, true);
  assert.equal(card.other.isDemo, true);
  assert.ok(card.other.contact);
  assert.ok(card.other.linkedin);
  assert.ok(card.journey?.why.includes("wrote \""));
  assert.equal(card.myNote, "the onboarding screens for the study app");
  assert.equal(card.theirNote, "how the study app should feel on a phone");
});
