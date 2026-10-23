"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS, tabFor } from "@/lib/nav";
import { Icon } from "./ui/icons";

/** The persistent tab bar on signed-in pages: a glass capsule above the home indicator. */
export function BottomNav({ token }: { token: string }) {
  const pathname = usePathname() ?? "";
  // Deleting your card is a focused flow; nothing to switch to afterwards.
  if (pathname.endsWith("/delete")) return null;
  const current = tabFor(pathname, token);
  return (
    <nav className="tabbar glass" aria-label="Main">
      {TABS.map((tab) => {
        const active = current?.key === tab.key;
        return (
          <Link
            key={tab.key}
            href={`/m/${token}${tab.path}`}
            className="tab"
            data-active={active ? "true" : undefined}
            aria-current={active ? (current?.exact ? "page" : "true") : undefined}
          >
            <Icon name={tab.icon} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
