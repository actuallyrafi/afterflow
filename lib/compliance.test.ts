import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { actOnConnection, addMet, listHome, publicCard, searchPeople } from "./connections";
import { ensureBackupPair } from "./demo-backup";
import { DEMO_PROFILES } from "./demo-profiles";
import { explainMatch, LLM_TIMEOUT_MS } from "./explain";
import { mutualReason } from "./evidence";
import { templateMatchCopy, type EventContext } from "./next-step";
import { createFileStore, type Profile } from "./store";
import type { Submission } from "./survey";
import eventContextJson from "../event-context.json";

const eventContext = eventContextJson as EventContext;

function person(name: string, contact: string): Profile {
  return {
    id: name,
    publicId: name,
    secretToken: name,
    name,
    contact,
    linkedin: `https://www.linkedin.com/in/${contact}`,
    role: "Builder",
    offers: ["Coding"],
    topOffer: "Coding",
    needs: ["Design"],
    topNeed: "Design",
    availability: "Right now at the event",
    tryingTo: `${name} is trying to ship a specific thing this month and needs a partner.`,
    consentAt: "2026-10-22T20:00:00.000Z",
    createdAt: "2026-10-22T20:00:00.000Z",
    isDemo: false,
  };
}

test("stranger match routes and links are gone", () => {
  assert.equal(fs.existsSync(path.join("app", "api", "profiles", "[token]", "matches")), false);
  const home = fs.readFileSync("app/page.tsx", "utf8");
  const survey = fs.readFileSync("app/survey/page.tsx", "utf8");
  assert.equal(/top matches|my matches/i.test(home + survey), false);
});

test("connection copy is the template immediately with no LLM and when the call would hang", async () => {
  assert.ok(LLM_TIMEOUT_MS <= 4000);
  const saved = {
    LLM_API_KEY: process.env.LLM_API_KEY,
    XAI_API_KEY: process.env.XAI_API_KEY,
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_MODEL: process.env.LLM_MODEL,
  };
  const originalFetch = globalThis.fetch;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "afterflow-copy-"));
  const store = createFileStore(path.join(dir, "flow.sqlite"));
  try {
    for (const key of Object.keys(saved)) delete process.env[key];
    const ada = person("Ada", "ada-llm-secret");
    const jonah = person("Jonah", "jonah-llm-secret");
    const started = Date.now();
    const quiet = await explainMatch(ada, jonah);
    assert.ok(Date.now() - started < 50);
    assert.deepEqual(quiet, templateMatchCopy(ada, jonah, eventContext));

    const me = await store.createProfile({
      ...(ada as unknown as Submission),
      linkedin: ada.linkedin,
    });
    const them = await store.createProfile({
      ...(jonah as unknown as Submission),
      linkedin: jonah.linkedin,
      isDemo: true,
    });
    const added = await addMet(store, me.secretToken, them.publicId, "the onboarding");
    if (!("connection" in added.body)) throw new Error("expected connection");
    const opened = await actOnConnection(store, them.secretToken, added.body.connection.id, { action: "confirm" });
    if (!("connection" in opened.body)) throw new Error("expected connection");
    const elapsed = Date.now() - started;
    assert.equal(opened.body.connection.journey?.why, mutualReason(me, them));
    assert.ok(elapsed < 500);

    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://example.invalid/v1";
    globalThis.fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        let settled = false;
        const fail = () => {
          if (settled) return;
          settled = true;
          reject(new Error("aborted"));
        };
        const signal = init?.signal;
        if (signal?.aborted) fail();
        else signal?.addEventListener("abort", fail, { once: true });
        setTimeout(fail, LLM_TIMEOUT_MS);
      });
    const hungAt = Date.now();
    const fellBack = await explainMatch(ada, jonah);
    const waited = Date.now() - hungAt;
    assert.deepEqual(fellBack, templateMatchCopy(ada, jonah, eventContext));
    assert.ok(waited <= 4500);
    const again = await actOnConnection(store, me.secretToken, added.body.connection.id, { action: "follow_up_not_yet" });
    if (!("connection" in again.body)) throw new Error("expected connection");
    assert.equal(again.body.connection.journey?.why, mutualReason(me, them));
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("every seeded profile is marked demo on the card, search, and connection", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "afterflow-demos-"));
  const store = createFileStore(path.join(dir, "flow.sqlite"));
  const seeded = [];
  for (const demo of DEMO_PROFILES) {
    seeded.push(await store.createProfile({ ...demo, isDemo: true }));
  }
  const backup = await ensureBackupPair(store);
  const ada = await store.getProfileByToken(backup.token);
  const jonah = (await store.listProfiles()).find((profile) => profile.name === "Jonah Blake");
  assert.ok(ada && jonah);
  seeded.push(ada, jonah);

  const reader = await store.createProfile({
    name: "Reader",
    contact: "reader@example.com",
    linkedin: "",
    role: "Host",
    offers: ["Community"],
    topOffer: "Community",
    needs: ["Feedback"],
    topNeed: "Feedback",
    availability: "This week",
    tryingTo: "Checking the room.",
  });

  for (const file of ["app/m/[token]/page.tsx", "app/m/[token]/c/[id]/page.tsx", "app/meet/[publicId]/page.tsx"]) {
    assert.match(fs.readFileSync(file, "utf8"), /isDemo[\s\S]{0,160}Demo/, file);
  }

  for (const profile of seeded) {
    assert.equal(profile.isDemo, true, profile.name);
    const card = await publicCard(store, profile.publicId);
    assert.equal(card?.isDemo, true, profile.name);
    const home = await listHome(store, profile.secretToken);
    assert.equal(home?.profile.isDemo, true, profile.name);
    const found = await searchPeople(store, reader.secretToken, profile.name.slice(0, 4));
    const hit = found?.find((item) => item.publicId === profile.publicId);
    assert.equal(hit?.isDemo, true, profile.name);
  }

  const home = await listHome(store, backup.token);
  const pair = home?.connections.find((item) => item.id === backup.connectionId);
  assert.ok(pair?.journey?.recap.some((line) => line === "Ada Quinn is a demo profile."));
  assert.ok(pair?.journey?.recap.some((line) => line === "Jonah Blake is a demo profile."));
});

test("the build log has timestamps and only real commits", () => {
  const log = fs.readFileSync("BUILD_LOG.md", "utf8");
  const headings = log.split("\n").filter((line) => line.startsWith("### "));
  assert.ok(headings.length >= 5);
  for (const heading of headings) {
    assert.match(heading, /\d{1,2} Oct 2026, \d{2}:\d{2} BST/);
  }
  assert.equal(/https?:\/\//.test(log), false);
  const shas = log.match(/\b[0-9a-f]{40}\b/g) ?? [];
  assert.ok(shas.length >= 5);
  for (const sha of new Set(shas)) {
    const kind = execSync(`git cat-file -t ${sha}`, { encoding: "utf8" }).trim();
    assert.equal(kind, "commit", sha);
  }
});
