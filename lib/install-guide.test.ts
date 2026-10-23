import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { INSTALL_STEP_TITLE, popInstallNow, shouldPromptInstall, ANDROID_MENU_STEPS, ANDROID_PROMPT_STEPS, INSTALL_FROM_MY_CARD, INSTALL_OPENS, IOS_STEPS, installSteps, platformOf } from "./install-guide";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const PIXEL = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const IPAD_DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

test("guide: three steps for the visitor's device", () => {
  assert.equal(platformOf(IPHONE), "ios");
  assert.equal(platformOf(IPAD_DESKTOP_UA, 5), "ios");
  assert.equal(platformOf(IPAD_DESKTOP_UA, 0), "other");
  assert.equal(platformOf(PIXEL), "android");
  assert.deepEqual(installSteps("ios", false).map((s) => s.title), ["Tap Share", "Tap Add to Home Screen", "Tap Add"]);
  assert.equal(installSteps("ios", true), IOS_STEPS, "iOS has no install prompt");
  assert.equal(installSteps("android", true), ANDROID_PROMPT_STEPS);
  assert.equal(installSteps("android", false), ANDROID_MENU_STEPS);
  assert.match(ANDROID_MENU_STEPS[1].title, /Install app or Add to Home screen/);
  for (const steps of [IOS_STEPS, ANDROID_PROMPT_STEPS, ANDROID_MENU_STEPS]) assert.equal(steps.length, 3);
  assert.match(INSTALL_OPENS, /opens straight into your card and your people/);
  assert.match(INSTALL_FROM_MY_CARD, /from your own My card page so it opens signed in/);
});

test("guide: opened from the My card hint; hidden when standalone; landing keeps one line", () => {
  const guide = fs.readFileSync("components/install-guide.tsx", "utf8");
  const pwa = fs.readFileSync("components/pwa.tsx", "utf8");
  assert.match(guide, /if \(!ready \|\| standalone\) return null;/);
  assert.match(pwa, /if \(dismissed \|\| isStandalone\(\)\) return;/);
  assert.match(pwa, /<InstallGuideSheet open=\{open\}/, "the hint opens the guide");
  assert.match(guide, /promptInstall\(\)/, "Android uses beforeinstallprompt when it's there");
  const landing = fs.readFileSync("app/page.tsx", "utf8");
  assert.doesNotMatch(landing, /InstallGuideSection|InstallGuideLink/);
  assert.match(landing, /\{LANDING_INSTALL_LINE\}/);
  assert.match(fs.readFileSync("app/m/[token]/card/page.tsx", "utf8"), /<InstallHint myCardToken=\{token\} \/>/);
  assert.doesNotMatch(fs.readFileSync("app/m/[token]/page.tsx", "utf8"), /<InstallHint/);
  assert.doesNotMatch(fs.readFileSync("app/meet/[publicId]/page.tsx", "utf8"), /<InstallHint/, "the pop-up replaces it");
});

test("D28: making a card on a phone queues the pop-up; never on a computer or from the home screen", () => {
  assert.equal(shouldPromptInstall({ standalone: false, platform: "ios" }), true);
  assert.equal(shouldPromptInstall({ standalone: false, platform: "android" }), true);
  assert.equal(shouldPromptInstall({ standalone: true, platform: "ios" }), false);
  assert.equal(shouldPromptInstall({ standalone: false, platform: "other" }), false);
  const survey = fs.readFileSync("app/survey/page.tsx", "utf8");
  assert.match(survey, /if \(shouldPromptInstall\(\{ standalone: isStandalone\(\)[\s\S]*localStorage\.setItem\(INSTALL_PENDING_KEY, "1"\)/);
  assert.match(survey, /`\/meet\/\$\{encodeURIComponent\(pending\)\}\?saved=1` : next/, "both creation paths");
});

test("D28: the pop-up shows once; after Not now (or Done) it never pops up again", () => {
  const base = { pending: true, seen: null, standalone: false, platform: "ios" as const };
  assert.equal(popInstallNow(base), true);
  assert.equal(popInstallNow({ ...base, seen: "later" }), false, "Not now");
  assert.equal(popInstallNow({ ...base, seen: "done" }), false);
  assert.equal(popInstallNow({ ...base, pending: false }), false, "only right after making a card");
  assert.equal(popInstallNow({ ...base, standalone: true }), false);
  assert.equal(popInstallNow({ ...base, platform: "other" }), false);
  const guide = fs.readFileSync("components/install-guide.tsx", "utf8");
  const pop = guide.slice(guide.indexOf("export function InstallPrompt"));
  assert.match(pop, /<Sheet open=\{open\} onClose=\{\(\) => close\("later"\)\}/, "a modal sheet; dismissing counts as Not now");
  assert.match(pop, /installSteps\(platform, canPrompt\)/, "this device's steps only");
  assert.match(pop, /platform === "android" && canPrompt[\s\S]*Install/);
  assert.match(pop, /btn-ink[\s\S]{0,120}>\s*Done\s*</, "Done is the primary");
  assert.match(pop, />\s*Not now\s*</);
  assert.match(fs.readFileSync("app/m/[token]/layout.tsx", "utf8"), /<InstallPrompt \/>/, "on the first signed-in page of either path");
  assert.equal(INSTALL_STEP_TITLE, "Add Afterflow to your home screen");
});
