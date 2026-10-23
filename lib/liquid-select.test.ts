// v4.1g: liquid-glass selectors (design-spec-v41g-motion). Source-level guards; motion is checked in the engines script.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const css = read("app/globals.css");
const ctl = read("lib/liquid-select.ts");

test("controller only writes transform, opacity, width and will-change", () => {
  const writes = [...ctl.matchAll(/\.style\.([a-zA-Z]+)\s*=/g)].map((m) => m[1]);
  assert.ok(writes.length > 0);
  for (const prop of writes) assert.ok(["transform", "opacity", "width", "willChange"].includes(prop), prop);
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

test("appearance re-themes 200ms after the pill moves", () => {
  assert.match(read("components/theme.tsx"), /delayMs: 200/);
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
