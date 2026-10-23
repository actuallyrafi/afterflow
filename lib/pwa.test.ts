import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { buildManifest, PWA_COLORS, swMayCache, userManifestPath } from "./pwa";

const sw = fs.readFileSync("public/sw.js", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");

/** Load the real public/sw.js in a sandbox and pull out its mayCache(). */
function swRule(): (url: URL, method: string) => string | null {
  const listeners: Record<string, unknown> = {};
  const sandbox = { self: { addEventListener: (type: string, fn: unknown) => (listeners[type] = fn), location: { origin: "https://x.test" } }, caches: {}, fetch: () => null, URL, Response };
  vm.runInNewContext(`${sw}\n;globalThis.__mayCache = mayCache;`, sandbox);
  return (sandbox as unknown as { __mayCache: (url: URL, method: string) => string | null }).__mayCache;
}

test("manifest: Afterflow, standalone, design-token colours, 192/512/maskable icons that exist", () => {
  const m = buildManifest(null);
  assert.equal(m.name, "Afterflow");
  assert.equal(m.short_name, "Afterflow");
  assert.equal(m.display, "standalone");
  assert.equal(m.start_url, "/");
  assert.equal(m.scope, "/");
  assert.equal(m.theme_color, PWA_COLORS.light);
  assert.equal(m.background_color, PWA_COLORS.ink);
  assert.ok(css.includes(`--bg: ${PWA_COLORS.light};`) && css.includes(`--bg: ${PWA_COLORS.dark};`) && css.includes(`--ink: ${PWA_COLORS.ink};`), "colours come from the tokens");
  const layout = fs.readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /__html: THEME_BOOT/, "D29: theme-color meta written by the head script from THEME_COLOR (= PWA_COLORS)");
  assert.doesNotMatch(layout, /themeColor:/, "no second, media-based theme-color from Next");
  assert.ok(m.icons.some((i) => i.sizes === "192x192"));
  assert.ok(m.icons.some((i) => i.sizes === "512x512" && i.purpose === "any"));
  assert.ok(m.icons.some((i) => i.purpose === "maskable"));
  for (const icon of [...m.icons.map((i) => i.src), "/icons/apple-touch-icon-180.png"]) assert.ok(fs.existsSync(`public${icon}`), icon);
  assert.match(layout, /apple: \[\{ url: "\/icons\/apple-touch-icon-180\.png", sizes: "180x180" \}\]/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /"apple-mobile-web-app-capable": "yes"/);
  for (const f of ["icon-maskable-192.png", "afterflow-icon.svg", "afterflow-icon-maskable.svg"]) assert.ok(fs.existsSync(`public/icons/${f}`), f);
  assert.match(layout, /appleWebApp: \{ capable: true, title: "Afterflow"/);
});

test("per-user manifest on token pages: start_url /m/{token}, scope /, private no-store + noindex, never in the SW", async () => {
  const token = "abcDEF123_-xyz";
  assert.equal(buildManifest(token).start_url, `/m/${token}`);
  assert.equal(buildManifest(token).scope, "/");
  assert.equal(buildManifest(token).id, buildManifest(null).id, "one app, whichever page installed it");
  for (const bad of ["", "../../api", "a b", "x".repeat(200), "short"]) assert.equal(buildManifest(bad).start_url, "/");
  assert.equal(userManifestPath(token), `/m/${token}/manifest.webmanifest`);
  const mLayout = fs.readFileSync("app/m/[token]/layout.tsx", "utf8");
  assert.match(mLayout, /manifest: userManifestPath\(token\)/);
  // Chrome only reads a manifest <link> in <head>; Next streams dynamic metadata into <body> unless told not to.
  assert.match(fs.readFileSync("next.config.ts", "utf8"), /htmlLimitedBots: \/\.\*\//);
  const { GET } = await import("../app/m/[token]/manifest.webmanifest/route");
  const res = await GET(new Request(`https://x.test/m/${token}/manifest.webmanifest`), { params: Promise.resolve({ token }) });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Cache-Control"), "private, no-store");
  assert.match(res.headers.get("X-Robots-Tag") ?? "", /noindex/);
  assert.equal(res.headers.get("Content-Type"), "application/manifest+json");
  const body = await res.json();
  assert.equal(body.start_url, `/m/${token}`);
  assert.equal(body.scope, "/");
  const bad = await GET(new Request("https://x.test/m/x/manifest.webmanifest"), { params: Promise.resolve({ token: "a b" }) });
  assert.equal(bad.status, 404);
  const route = fs.readFileSync("app/m/[token]/manifest.webmanifest/route.ts", "utf8");
  assert.equal(/getStore|store\.|listHome|getProfile/.test(route), false, "reads no data");
  assert.equal(swRule()(new URL(`https://x.test/m/${token}/manifest.webmanifest`), "GET"), null);
  assert.equal(swMayCache(`/m/${token}/manifest.webmanifest`), null);
});

test("service worker never caches /api, /m (token routes), /c, /meet, or non-GET", () => {
  const rule = swRule();
  const at = (path: string, method = "GET") => rule(new URL(path, "https://x.test"), method);
  for (const path of ["/api/profiles", "/api/profiles/tok123456/connections", "/m/tok123456", "/m/tok123456/card", "/m/tok123456/manifest.webmanifest", "/c/abc", "/meet/pub", "/survey", "/organiser", "/api", "/m"]) {
    assert.equal(at(path), null, `sw: ${path}`);
    assert.equal(swMayCache(path), null, `lib: ${path}`);
  }
  assert.equal(at("/", "POST"), null);
  assert.equal(swMayCache("/", "POST"), null);
  // What it does keep: hashed static files, icons, and the public shell.
  assert.equal(at("/_next/static/chunks/app.js"), "static");
  assert.equal(at("/icons/icon-192.png"), "static");
  assert.equal(at("/"), "shell");
  assert.equal(at("/?token=1"), null, "no query strings in the shell cache");
  assert.equal(swMayCache("/_next/static/chunks/app.js"), "static");
  assert.equal(swMayCache("/"), "shell");
  // RSC payloads skip the worker; responses are only stored when same-origin and OK.
  assert.match(sw, /request\.headers\.get\("RSC"\)/);
  assert.match(sw, /response\.ok && response\.type === "basic"/);
});

test("Add to Home Screen hint: on My card, quiet, dismissible, hidden when standalone", () => {
  const hint = fs.readFileSync("components/pwa.tsx", "utf8");
  const card = fs.readFileSync("app/m/[token]/card/page.tsx", "utf8");
  assert.match(card, /<InstallHint myCardToken=\{token\} \/>/);
  assert.match(hint, /display-mode: standalone/);
  assert.match(hint, /navigator as Navigator & \{ standalone\?: boolean \}/);
  assert.match(hint, /beforeinstallprompt/);
  assert.match(hint, /aria-label="Dismiss"/);
  assert.match(hint, /afterflow\.installHint\.dismissed/);
});
