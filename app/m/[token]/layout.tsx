import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { TOKEN_PATTERN, userManifestPath } from "@/lib/pwa";

// v4.1c: installing from your own pages makes the home-screen icon open your own Your people
// (the session key is in the URL; iOS home-screen apps don't share Safari's storage).
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  return TOKEN_PATTERN.test(token) ? { manifest: userManifestPath(token) } : {};
}

export default async function SignedInLayout({ children, params }: { children: ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="with-tabbar">
      {children}
      <BottomNav token={token} />
    </div>
  );
}
