"use client";

import { useEffect, useState } from "react";
import { InstallGuideSheet } from "./install-guide";
import { Icon } from "./ui/icons";

/** Chrome's install prompt, kept so the hint on My card can use it. */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISSED_KEY = "afterflow.installHint.dismissed";
let deferred: InstallPrompt | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPrompt;
    window.dispatchEvent(new Event("afterflow:installable"));
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    window.dispatchEvent(new Event("afterflow:installed"));
  });
}

/** Registers the service worker (production builds only). Rendered once in the root layout. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone) || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

export function canPromptInstall(): boolean {
  return deferred !== null;
}

/** Chrome's own install dialog. Resolves "unavailable" when the browser hasn't offered one. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const prompt = deferred;
  if (!prompt) return "unavailable";
  await prompt.prompt();
  const choice = await prompt.userChoice.catch(() => null);
  deferred = null;
  window.dispatchEvent(new Event("afterflow:installable"));
  return choice?.outcome ?? "dismissed";
}

export function onInstallChange(fn: () => void): () => void {
  window.addEventListener("afterflow:installable", fn);
  window.addEventListener("afterflow:installed", fn);
  const media = window.matchMedia?.("(display-mode: standalone)");
  media?.addEventListener?.("change", fn);
  return () => {
    window.removeEventListener("afterflow:installable", fn);
    window.removeEventListener("afterflow:installed", fn);
    media?.removeEventListener?.("change", fn);
  };
}

/**
 * One quiet line (My card; Your people right after you make a card). It opens the "Use it like an
 * app" guide. Hidden once dismissed, or when already running from the home screen.
 */
export function InstallHint({ myCardToken = null, className = "mt-3" }: { myCardToken?: string | null; className?: string }) {
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {}
    if (dismissed || isStandalone()) return;
    setShow(true);
    const done = () => {
      if (isStandalone()) setShow(false);
    };
    window.addEventListener("afterflow:installed", done);
    return () => window.removeEventListener("afterflow:installed", done);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setShow(false);
  };

  return (
    <>
      <div id="install-hint" className={`${className} flex min-h-11 items-center gap-1 rounded-full bg-fill py-1 pr-1 pl-4 text-[14px] leading-5`} role="note" aria-label="Add to Home Screen">
        <button type="button" className="min-w-0 flex-1 py-1.5 text-left text-muted" onClick={() => setOpen(true)} aria-haspopup="dialog">
          Add it to your Home Screen. <span className="font-semibold text-ink">How</span>
        </button>
        <button type="button" className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink" aria-label="Dismiss" onClick={dismiss}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <InstallGuideSheet open={open} onClose={() => setOpen(false)} myCardToken={myCardToken} />
    </>
  );
}
