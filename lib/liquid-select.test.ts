// v4.1g/v4.1h: liquid-glass selectors (design-spec-v41g-motion, design-spec-v41h). Source-level guards plus the curve.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const css = read("app/globals.css");
const ctl = read("lib/liquid-select.ts");

test("controller only writes transform, opacity and width; animations are transform/opacity only", () => {
  const writes = [...ctl.matchAll(/\.style\.([a-zA-Z]+)\s*=/g)].map((m) => m[1]);
  assert.ok(writes.length > 0);
  for (const prop of writes) assert.ok(["transform", "opacity", "width"].includes(prop), prop);
  const keyframes = [...ctl.matchAll(/\.animate\(\s*[^,]*?\(\{\s*([a-z]+):/g)].map((m) => m[1]);
  assert.ok(keyframes.length >= 3, "pill, lens and labels animate with WAAPI");
  for (const prop of keyframes) assert.ok(["transform", "opacity"].includes(prop), prop);
  assert.doesNotMatch(ctl, /getBoundingClientRect|getComputedStyle/, "no layout or style reads in the controller");
});

test("the spring curve: ~3% overshoot, settles, stretch scales with distance", async () => {
  const { springCurve } = await import("./liquid-select");
  const one = springCurve(0, 100, 0, 100, false);
  const three = springCurve(0, 300, 0, 100, false);
  assert.ok(Math.max(...one.xs) > 102 && Math.max(...one.xs) < 104, `overshoot ${Math.max(...one.xs)}`);
  assert.ok(one.ms > 300 && one.ms < 420, `duration ${one.ms}`);
  assert.equal(one.xs.at(-1), 100);
  assert.ok(Math.abs(Math.max(...one.sx) - 1.12) < 0.005, `1-step peak ${Math.max(...one.sx)}`);
  assert.ok(Math.abs(Math.max(...three.sx) - 1.18) < 0.005, `3-step peak ${Math.max(...three.sx)}`);
  const reduced = springCurve(0, 100, 0, 100, true);
  assert.equal(reduced.ms, 120);
  assert.ok(reduced.sx.every((s) => s === 1) && Math.max(...reduced.xs) <= 100);
});

test("no React state on tap: the options have no onClick of their own (the controller picks)", () => {
  for (const file of ["components/contact-fields.tsx", "components/calendar-reminder.tsx", "components/theme.tsx"]) {
    const src = read(file);
    const seg = src.slice(src.indexOf('className="seg lq'), src.indexOf("</div>", src.indexOf('className="seg lq')));
    assert.doesNotMatch(seg, /onClick=/, file);
  }
  assert.match(read("components/bottom-nav.tsx"), /commit: "frame"/);
});

test("spring constants and stretch formula follow the spec", () => {
  for (const s of ["520", "34", "1 / 240", "1.12 + 0.06", "0.45", "2500"]) assert.ok(ctl.includes(s), s);
});

test("every segmented control and the tab bar use the liquid pill", () => {
  for (const file of ["components/contact-fields.tsx", "components/calendar-reminder.tsx", "components/theme.tsx", "components/bottom-nav.tsx"]) {
    const src = read(file);
    assert.match(src, /useLiquidSelect/, file);
    assert.match(src, /<LiquidPill variant="(lens|solid)" \/>/, file);
    assert.doesNotMatch(src, /className="seg(?! lq)[ "]/, `${file}: a .seg without .lq`);
  }
  assert.match(read("components/bottom-nav.tsx"), /className="tabbar glass lq"/);
  assert.match(read("components/bottom-nav.tsx"), /<LiquidPill variant="lens" \/>/);
});

test("tab bar calls the hook before its early return", () => {
  const src = read("components/bottom-nav.tsx");
  assert.ok(src.indexOf("useLiquidSelect<") < src.indexOf("if (!current?.exact) return null"));
});

test("contact tabs keep the filled dot outside the duplicated label", () => {
  const src = read("components/contact-fields.tsx");
  assert.match(src, /<LiquidLabel>\{CHANNEL_LABEL\[option\]\}<\/LiquidLabel>\s*\{\/\*[^*]*\*\/\}\s*\{filled \? <span className="seg-dot"/);
});

test("radiogroups use a roving tabIndex", () => {
  for (const file of ["components/contact-fields.tsx", "components/calendar-reminder.tsx", "components/theme.tsx"]) {
    assert.match(read(file), /tabIndex=\{[^}]+ \? 0 : -1\}/, file);
  }
});

test("appearance starts re-theming two frames after the tap (no 380ms wait), with a crossfade", () => {
  const src = read("components/theme.tsx");
  assert.doesNotMatch(src, /delayMs/);
  assert.match(src, /setTheme\(THEMES\[index\], \{ fade: true \}\), \{ commit: "frame" \}\)/);
  assert.match(read("app/globals.css"), /\.af-theme-fade/);
});

test("contact controls commit two frames in, so typing never lands in the previous app's field", () => {
  const src = read("components/contact-fields.tsx");
  assert.equal(src.match(/\{ commit: "frame" \}/g)?.length, 2);
});

test("Simple Icons CC0 licence and disclaimer ship with the repo", () => {
  for (const file of ["licenses/simple-icons/LICENSE.md", "licenses/simple-icons/DISCLAIMER.md"]) assert.ok(read(file).length > 100, file);
  assert.match(read("licenses/simple-icons/LICENSE.md"), /CC0 1\.0 Universal/);
});

test("brand glyphs: filled official paths, real names, lighter line set", () => {
  const brand = read("components/ui/brand-icons.tsx");
  assert.match(brand, /Simple Icons 16\.35\.0/);
  assert.match(brand, /CC0-1\.0/);
  for (const name of ["whatsapp", "discord", "instagram"]) assert.match(brand, new RegExp(`${name}: "M`), name);
  for (const file of ["components/say-hi.tsx", "components/contact-fields.tsx"]) {
    assert.match(read(file), /instagram: "instagram", email: "email"/, file);
  }
  assert.match(css, /\.i \{[^}]*stroke-width: 1\.75/);
  assert.match(css, /\.i-brand \{ fill: currentColor; stroke: none; \}/);
});

test("CSS: targets, old transitions removed, fallbacks present", () => {
  assert.match(css, /\.seg button \{[^}]*height: 38px/);
  assert.doesNotMatch(css, /\.seg button \{[^}]*transition/);
  assert.doesNotMatch(css, /\.tab \{[^}]*transition/);
  assert.doesNotMatch(css, /\.tab:active/);
  assert.match(css, /\.tab \{[^}]*min-height: 50px/);
  assert.match(css, /@supports not \(transition-timing-function: linear\(0, 1\)\)/);
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /\.lq:not\(\.lq-ready\) \.lq-pill \{ display: none; \}/);
  assert.match(css, /\.tabbar\.lq \{ position: fixed; \}/);
  assert.match(css, /\.lq-opt:focus:not\(:focus-visible\) \{ outline: none; \}/);
});
