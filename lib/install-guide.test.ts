import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { ANDROID_MENU_STEPS, ANDROID_PROMPT_STEPS, INSTALL_FROM_MY_CARD, INSTALL_OPENS, IOS_STEPS, installSteps, platformOf } from "./install-guide";

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
  assert.match(fs.readFileSync("app/page.tsx", "utf8"), /<InstallGuideSection \/>[\s\S]*<InstallGuideLink/);
  assert.match(fs.readFileSync("app/m/[token]/card/page.tsx", "utf8"), /<InstallHint myCardToken=\{token\} \/>/);
  assert.match(fs.readFileSync("app/survey/page.tsx", "utf8"), /`\/m\/\$\{token\}\?new=1`/);
  assert.match(fs.readFileSync("app/m/[token]/page.tsx", "utf8"), /\{justMade \? <InstallHint/);
  assert.match(fs.readFileSync("app/meet/[publicId]/page.tsx", "utf8"), /\{justSaved \? <InstallHint/);
});
