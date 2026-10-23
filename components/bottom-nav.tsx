"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TABS, tabFor } from "@/lib/nav";
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
  const keyboard = useKeyboardOpen();
  const current = tabFor(pathname, token);
  if (!current?.exact) return null;
  return (
    <nav className="tabbar glass" aria-label="Main" data-hidden={keyboard ? "" : undefined} aria-hidden={keyboard || undefined}>
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/m/${token}${tab.path}`}
          className="tab"
          aria-current={current.key === tab.key ? "page" : undefined}
          tabIndex={keyboard ? -1 : undefined}
        >
          <Icon name={tab.icon} />
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
