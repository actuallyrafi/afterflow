import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { listHome, publicCard, searchPeople } from "./connections";
import { ensureBackupPair } from "./demo-backup";
import { DEMO_PROFILES } from "./demo-profiles";
import { card, tempStore } from "./test-helpers";

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sources(full));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test(-helpers)?\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

const APP_SOURCES = [...sources("app"), ...sources("components"), ...sources("lib")];

test("scoring code is gone, not hidden", () => {
  for (const file of ["lib/matching.ts", "lib/evidence.ts", "lib/next-step.ts", "lib/explain.ts"]) {
    assert.equal(fs.existsSync(file), false, file);
  }
  const banned = /scoreMatch|mutualReason|NOT_ENOUGH_EVIDENCE|pickNextStep|blobOf|STRONG_MATCH|selectStrong|templateMatchCopy|worth continuing/;
  for (const file of APP_SOURCES) {
    assert.equal(banned.test(fs.readFileSync(file, "utf8")), false, file);
  }
});

// v4.1 (approved by Tanvir, 23 Oct 2026): a three-tab bottom bar (Your people, Events, My card)
// is back, so the tab-bar ban is lifted. nav.test.ts checks it. Feeds, counts and rankings stay out.
test("no feed, counts, rankings or 'followed up' badges in the attendee UI", () => {
  const attendee = APP_SOURCES.filter((file) => file.startsWith("app") && !file.includes("organiser"));
  for (const file of attendee) {
    const text = fs.readFileSync(file, "utf8");
    assert.equal(/Followed up|shared people|My connections|Data deleted after the event|streak|leaderboard/i.test(text), false, file);
    assert.equal(/connections\??\.length\}/.test(text), false, `${file} renders a count`);
  }
  assert.equal(fs.existsSync(path.join("app", "api", "profiles", "[token]", "matches")), false);
  const people = fs.readFileSync("app/m/[token]/page.tsx", "utf8");
  assert.match(people, /Your people/);
});

test("there is no Report action; block, remove and mute are quiet", () => {
  for (const file of APP_SOURCES) {
    assert.equal(/\bReport\b/.test(fs.readFileSync(file, "utf8")), false, file);
  }
  const sheet = fs.readFileSync("components/person-sheet.tsx", "utf8");
  assert.match(sheet, /They won(?:'|&apos;)t know/);
  assert.match(sheet, /They won(?:'|&apos;)t be told/);
});

test("every seeded profile is marked demo on the card, search, and connection", async () => {
  const store = tempStore("afterflow-demos");
  const seeded = [];
  for (const demo of DEMO_PROFILES) seeded.push(await store.createProfile({ ...demo, isDemo: true }));
  const backup = await ensureBackupPair(store);
  const ada = await store.getProfileByToken(backup.token);
  const jonah = (await store.listProfiles()).find((profile) => profile.name === "Jonah Blake");
  assert.ok(ada && jonah);
  seeded.push(ada, jonah);
  const reader = await store.createProfile(card("Reader"));

  for (const file of ["app/m/[token]/page.tsx", "app/m/[token]/c/[id]/page.tsx", "app/meet/[publicId]/page.tsx"]) {
    assert.match(fs.readFileSync(file, "utf8"), /isDemo[\s\S]{0,200}Demo/, file);
  }

  for (const profile of seeded) {
    assert.equal(profile.isDemo, true, profile.name);
    assert.equal((await publicCard(store, profile.publicId))?.isDemo, true, profile.name);
    assert.equal((await listHome(store, profile.secretToken))?.profile.isDemo, true, profile.name);
    const found = await searchPeople(store, reader.secretToken, profile.name.slice(0, 4));
    assert.equal(found?.find((item) => item.publicId === profile.publicId)?.isDemo, true, profile.name);
  }
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
  // The public repo starts from one squashed commit (f055fc0) of the hackathon repo, so the
  // hackathon-era SHAs already cited in that commit's log are kept as history. Any SHA added
  // since then must be a real commit in this repo.
  let squashedLog = "";
  try {
    squashedLog = execSync("git show f055fc0:BUILD_LOG.md", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    squashedLog = "";
  }
  const grandfathered = new Set(squashedLog.match(/\b[0-9a-f]{40}\b/g) ?? []);
  for (const sha of new Set(shas)) {
    if (grandfathered.has(sha)) continue;
    const kind = execSync(`git cat-file -t ${sha}`, { encoding: "utf8" }).trim();
    assert.equal(kind, "commit", sha);
  }
});

test("docs and copy match the Bible: no old pitch, truthful card copy, PRD marked superseded", () => {
  const readme = fs.readFileSync("README.md", "utf8");
  for (const banned of [/make happen/i, /what's stopping you/i, /worth continuing/i, /deleted after the event/i, /scor(e|ing)/i, /\bmatching\b/i]) {
    assert.equal(banned.test(readme.replace(/doesn't match you with strangers, score anyone/, "")), false, String(banned));
  }
  assert.match(readme, /What's something you're into right now\?/);
  assert.ok(fs.existsSync("BIBLE.md"));
  assert.match(fs.readFileSync("PRD.md", "utf8").split("\n")[0], /Superseded.*BIBLE\.md/);
  const survey = fs.readFileSync(path.join("app", "survey", "page.tsx"), "utf8");
  assert.equal(/Only people you both confirm see it/.test(survey), false);
  assert.match(survey, /Your answer shows on your card link\. Your contact only shows once you both confirm\./);
});

test("organiser headline is talked again and mutual confirms, with no per-person data", () => {
  // v4.1h: the totals now live on each event's page; the headline component is shared.
  const page = fs.readFileSync(path.join("app", "organiser", "[eventId]", "page.tsx"), "utf8");
  const headline = fs.readFileSync(path.join("components", "organiser.tsx"), "utf8");
  assert.ok(page.indexOf("<Headline") < page.indexOf("connections requested"));
  assert.match(headline, /Talked again/);
  assert.match(headline, /mutualConfirms/);
  for (const src of [page, headline, fs.readFileSync(path.join("app", "organiser", "page.tsx"), "utf8")]) {
    assert.equal(/Sign-ups/.test(src), false);
    assert.equal(/rank|leaderboard|top \d/i.test(src.replace("nobody is ranked", "")), false);
  }
});
