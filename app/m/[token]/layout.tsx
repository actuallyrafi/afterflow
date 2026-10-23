import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";

export default async function SignedInLayout({ children, params }: { children: ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="with-tabbar">
      {children}
      <BottomNav token={token} />
    </div>
  );
}
