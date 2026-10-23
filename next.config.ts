import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // v4.1c PWA: Next 15.5 streams metadata into <body> for dynamic pages, and Chrome only reads a
  // manifest <link> in <head>. Our generateMetadata reads no data, so render it in <head> for everyone.
  htmlLimitedBots: /.*/,
  // v4.1c PWA: the service worker is always revalidated (netlify.toml sets the same on Netlify).
  async headers() {
    // v4.1h: organiser pages are private: never cached, never indexed, no referrer.
    const privateHeaders = [
      { key: "Cache-Control", value: "no-store, max-age=0" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ];
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" }] },
      { source: "/organiser", headers: privateHeaders },
      { source: "/organiser/:path*", headers: privateHeaders },
      { source: "/api/organiser/:path*", headers: privateHeaders },
    ];
  },
};

export default nextConfig;
