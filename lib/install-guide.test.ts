import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { tabFor } from "./nav";
import { afterCardPath, INSTALL_STEP_TITLE, ANDROID_MENU_STEPS, ANDROID_PROMPT_STEPS, INSTALL_FROM_MY_CARD, INSTALL_OPENS, IOS_STEPS, installSteps, platformOf } from "./install-guide";

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

test("guide: opened from the hint, the landing and right after making a card; hidden when standalone", () => {
  const guide = fs.readFileSync("components/install-guide.tsx", "utf8");
  const pwa = fs.readFileSync("components/pwa.tsx", "utf8");
  assert.match(guide, /if \(!ready \|\| standalone\) return null;/);
  assert.match(guide, /if \(ready && standalone\) return null;/);
  assert.match(pwa, /if \(dismissed \|\| isStandalone\(\)\) return;/);
  assert.match(pwa, /<InstallGuideSheet open=\{open\}/, "the hint opens the guide");
  assert.match(guide, /promptInstall\(\)/, "Android uses beforeinstallprompt when it's there");
  // D24: the landing keeps one short line only; no section, no footer link.
  const landing = fs.readFileSync("app/page.tsx", "utf8");
  assert.doesNotMatch(landing, /InstallGuideSection|InstallGuideLink/);
  assert.match(landing, /\{LANDING_INSTALL_LINE\}/);
  assert.match(fs.readFileSync("app/m/[token]/card/page.tsx", "utf8"), /<InstallHint myCardToken=\{token\} \/>/);
  assert.match(fs.readFileSync("app/survey/page.tsx", "utf8"), /afterCardPath\(token, \{ standalone: isStandalone\(\)/);
  assert.doesNotMatch(fs.readFileSync("app/m/[token]/page.tsx", "utf8"), /<InstallHint/, "the step replaces the hint on Your people");
  assert.match(fs.readFileSync("app/meet/[publicId]/page.tsx", "utf8"), /\{justSaved \? <InstallHint/);
});

test("D24: right after making a card, a phone in the browser gets the install step first", () => {
  assert.equal(afterCardPath("tok", { standalone: false, platform: "ios" }), "/m/tok/install");
  assert.equal(afterCardPath("tok", { standalone: false, platform: "android" }), "/m/tok/install");
  assert.equal(afterCardPath("tok", { standalone: true, platform: "ios" }), "/m/tok", "already on the home screen: skipped");
  assert.equal(afterCardPath("tok", { standalone: false, platform: "other" }), "/m/tok", "a computer: no phone steps to show");
  const step = fs.readFileSync("app/m/[token]/install/page.tsx", "utf8");
  assert.match(step, /\{INSTALL_STEP_TITLE\}/);
  assert.equal(INSTALL_STEP_TITLE, "Add Afterflow to your home screen");
  assert.match(step, /installSteps\(platform, canPrompt\)/, "only this device's steps");
  assert.doesNotMatch(step, /IOS_STEPS|ANDROID_MENU_STEPS/, "never both phones");
  assert.match(step, /btn-ink[\s\S]{0,120}>\s*Done\s*</, "Done is the primary");
  assert.match(step, />\s*Not now\s*</);
  assert.match(step, /standalone \|\| platform === "other"[\s\S]*window\.location\.replace\(home\)/, "skipped when standalone");
  assert.equal(tabFor("/m/tok/install", "tok"), null, "its own step: no tab bar");
});
