import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // v4.1c PWA: Next 15.5 streams metadata into <body> for dynamic pages, and Chrome only reads a
  // manifest <link> in <head>. Our generateMetadata reads no data, so render it in <head> for everyone.
  htmlLimitedBots: /.*/,
  // v4.1c PWA: the service worker is always revalidated (netlify.toml sets the same on Netlify).
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" }] }];
  },
};

export default nextConfig;
