import { buildManifest, TOKEN_PATTERN } from "@/lib/pwa";

// Your own manifest: the home-screen icon opens your own Your people (/m/{token}). Reads no data.
// Private: never stored by browsers, proxies or the service worker, and never indexed.
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" } as const;

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_PATTERN.test(token)) return new Response("Not found", { status: 404, headers: PRIVATE });
  return new Response(JSON.stringify(buildManifest(token)), { headers: { "Content-Type": "application/manifest+json", ...PRIVATE } });
}
