"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TABS, tabFor } from "@/lib/nav";
import { LiquidLabel, LiquidPill, useLiquidSelect } from "./liquid";
import { Icon } from "./ui/icons";

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.tagName === "TEXTAREA") return true;
  if (target.tagName !== "INPUT") return false;
  const type = (target as HTMLInputElement).type;
  return !["checkbox", "radio", "button", "submit", "range", "color", "file"].includes(type);
}

/** Hidden while the on-screen keyboard is up, back 150ms after the field loses focus. */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let timer = 0;
    const viewport = window.visualViewport;
    const check = () => {
      if (viewport && viewport.height < window.innerHeight - 120) setOpen(true);
    };
    const onIn = (event: FocusEvent) => {
      if (!isTextField(event.target)) return;
      window.clearTimeout(timer);
      setOpen(true);
    };
    const onOut = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const keyboard = viewport ? viewport.height < window.innerHeight - 120 : false;
        setOpen(keyboard || isTextField(document.activeElement));
      }, 150);
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    viewport?.addEventListener("resize", check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
      viewport?.removeEventListener("resize", check);
    };
  }, []);
  return open;
}

/**
 * The tab bar: a plain navigation bar with three links. It appears only on the three root
 * screens (Your people, Events, My card); pushed screens (a connection, Blocked, Delete) hide it.
 */
export function BottomNav({ token }: { token: string }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const keyboard = useKeyboardOpen();
  const current = tabFor(pathname, token);
  // v4.1g: the liquid pill. The hook runs before the early return (rules of hooks); the controller
  // moves the pill at once on tap or drag release and onPick navigates.
  const ref = useLiquidSelect<HTMLElement>(current?.key, (index) => router.push(`/m/${token}${TABS[index].path}`));
  if (!current?.exact) return null;
  return (
    <nav ref={ref} className="tabbar glass lq" aria-label="Main" data-hidden={keyboard ? "" : undefined} aria-hidden={keyboard || undefined}>
      <LiquidPill variant="lens" />
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/m/${token}${tab.path}`}
          className="tab lq-opt"
          aria-current={current.key === tab.key ? "page" : undefined}
          tabIndex={keyboard ? -1 : undefined}
          onClick={(event) => {
            // A plain tap is handled by the controller (pill first, then onPick navigates once);
            // modified clicks (new tab/window) keep the browser's behaviour.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
          }}
        >
          <LiquidLabel>
            <Icon name={tab.icon} />
            <span>{tab.label}</span>
          </LiquidLabel>
        </Link>
      ))}
    </nav>
  );
}
