import type { Metadata } from "next";
import type { ReactNode } from "react";

// v4.1h: organiser pages are private. Never indexed; the key rides in the fragment (no referrer either).
export const metadata: Metadata = {
  title: "Organiser · Afterflow",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default function OrganiserLayout({ children }: { children: ReactNode }) {
  return children;
}
