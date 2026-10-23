import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { PWA_COLORS } from "./pwa";
import { nextTheme, resolveTheme, THEME_BOOT, THEME_COLOR, THEME_KEY, themeChoice } from "./theme";

/** Runs the <head> script against a tiny fake page. */
function boot(stored: string | null, systemDark: boolean, metas = 2) {
  const attrs: Record<string, string> = {};
  const store = new Map<string, string>(stored ? [[THEME_KEY, stored]] : []);
  const metaEls = Array.from({ length: metas }, () => {
    const a: Record<string, string> = { name: "theme-color", media: "(prefers-color-scheme: dark)" };
    return { a, setAttribute: (k: string, v: string) => (a[k] = v), removeAttribute: (k: string) => delete a[k] };
  });
  const window: Record<string, unknown> = {
    matchMedia: () => ({ matches: systemDark, addEventListener: () => undefined }),
  };
  const document = {
    documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v), style: {} as Record<string, string> },
    querySelectorAll: () => metaEls,
    createElement: () => metaEls[0],
    head: { appendChild: () => undefined },
  };
  const localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
  vm.runInNewContext(THEME_BOOT, { window, document, localStorage });
  return { attrs, metas: metaEls.map((m) => m.a), store, apply: window.__afTheme as (c?: string) => string, doc: document };
}

test("D29: choices, defaults and the landing cycle", () => {
  assert.equal(themeChoice(null), "system");
  assert.equal(themeChoice("purple"), "system");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.deepEqual([nextTheme("system"), nextTheme("light"), nextTheme("dark")], ["light", "dark", "system"]);
  assert.deepEqual(THEME_COLOR, { light: PWA_COLORS.light, dark: PWA_COLORS.dark });
});

test("D29: the head script applies the saved choice before paint, and theme-color follows it", () => {
  const sys = boot(null, true);
  assert.equal(sys.attrs["data-theme"], "dark", "System follows the phone");
  assert.equal(sys.attrs["data-theme-choice"], "system");
  const light = boot("light", true);
  assert.equal(light.attrs["data-theme"], "light", "a saved Light beats a dark phone");
  assert.deepEqual(light.metas.map((m) => m.content), [PWA_COLORS.light, PWA_COLORS.light]);
  assert.ok(light.metas.every((m) => !("media" in m)), "media queries dropped so the choice wins");
  const dark = boot("dark", false);
  assert.equal(dark.attrs["data-theme"], "dark");
  assert.equal(dark.doc.documentElement.style.colorScheme, "dark");
  assert.equal(dark.metas[0].content, PWA_COLORS.dark);
  // Choosing System clears the saved value; choosing Dark saves it.
  dark.apply("system");
  assert.equal(dark.store.has(THEME_KEY), false);
  assert.equal(dark.attrs["data-theme"], "light");
  dark.apply("dark");
  assert.equal(dark.store.get(THEME_KEY), "dark");
});

test("D29: every dark style hangs off data-theme (no media-query-only dark left); boot runs in <head>", () => {
  const css = fs.readFileSync("app/globals.css", "utf8");
  assert.doesNotMatch(css, /prefers-color-scheme:\s*dark/, "sheets, recap and everything else follow the override");
  assert.match(css, /:root\[data-theme="dark"\] \{\s*--bg: #0e0f12;/);
  assert.match(css, /:root\[data-theme="dark"\] \.hue-1/);
  const layout = fs.readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /<head>\s*<script dangerouslySetInnerHTML=\{\{ __html: THEME_BOOT \}\} \/>/, "first thing in <head>: no flash");
  assert.match(fs.readFileSync("app/m/[token]/card/page.tsx", "utf8"), /<AppearanceControl \/>/);
  assert.match(fs.readFileSync("app/page.tsx", "utf8"), /<ThemeToggle \/>/);
  const control = fs.readFileSync("components/theme.tsx", "utf8");
  assert.match(control, /role="radiogroup"/);
  assert.match(control, /window\.__afTheme\?\.\(next\)/);
});
