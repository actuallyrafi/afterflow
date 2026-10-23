/**
 * v4.1c PWA (D21): the web app manifest and the service worker's caching rules.
 * Kept as plain data so tests can check them without a browser.
 */

/** Design tokens (app/globals.css). A manifest has one theme colour, so it carries light --bg; the
 * <meta name="theme-color"> tags in app/layout.tsx switch the bar to dark --bg in dark mode.
 * background_color (the splash behind the icon) is --ink, per Pixel's spec §6.2. */
export const PWA_COLORS = { light: "#f4f4f2", dark: "#0e0f12", ink: "#16181d" } as const;

/** A saved session's private key, as minted by buildProfile (base64url). */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export type WebManifest = {
  id: string;
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: "standalone";
  background_color: string;
  theme_color: string;
  icons: { src: string; sizes: string; type: string; purpose?: "any" | "maskable" }[];
};

/** Where the per-user manifest lives: only on your own token pages. */
export const userManifestPath = (token: string) => `/m/${token}/manifest.webmanifest`;

/**
 * Generic manifest (public pages): start_url "/". The landing shows Your people when this phone has a
 * saved card. Per-user manifest (your own /m/{token}/* pages): start_url is your own Your people,
 * /m/{token}, because the session key lives in the URL and iOS home-screen apps don't share Safari's
 * storage, so "/" would lose the session there. Icons and tags: design-spec-v41c.md §6 (Pixel).
 */
export function buildManifest(token?: string | null): WebManifest {
  const start = token && TOKEN_PATTERN.test(token) ? `/m/${token}` : "/";
  return {
    id: "/",
    name: "Afterflow",
    short_name: "Afterflow",
    description: "Keep the people you meet in your life.",
    start_url: start,
    scope: "/",
    display: "standalone",
    background_color: PWA_COLORS.ink,
    theme_color: PWA_COLORS.light,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-1024.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/afterflow-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}

/**
 * What the service worker (public/sw.js) may keep. Mirrors the rules in sw.js; the test checks both.
 * Never: API calls, your own pages (/m/*, which carry your private key), connection links (/c/*),
 * card links (/meet/*), your per-user manifest (/m/{token}/manifest.webmanifest), or anything that isn't a plain GET.
 */
export const SW_NEVER = ["/api/", "/m/", "/c/", "/meet/", "/survey", "/organiser", "/join/", "/demo", "/deleted"] as const;
export const SW_STATIC = ["/_next/static/", "/icons/"] as const;
export const SW_SHELL = ["/", "/how-we-built"] as const;

export function swMayCache(pathname: string, method = "GET"): "static" | "shell" | null {
  if (method !== "GET") return null;
  if (SW_NEVER.some((prefix) => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix))) return null;
  if (SW_STATIC.some((prefix) => pathname.startsWith(prefix))) return "static";
  if ((SW_SHELL as readonly string[]).includes(pathname)) return "shell";
  return null;
}
