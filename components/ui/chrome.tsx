"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";

/** Fixed header. Glass appears once content scrolls under it (or always, for the connection page). */
export function TopBar({
  left,
  center,
  right,
  alwaysGlass = false,
  wideRight = false,
  shown,
  className = "",
}: {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  alwaysGlass?: boolean;
  /** Room for two circles on the right (Your people: + and ⋯). */
  wideRight?: boolean;
  /** Controlled: glass only when true (the person page's title bar). */
  shown?: boolean;
  className?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (alwaysGlass || shown !== undefined) return;
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [alwaysGlass, shown]);
  const glass = shown ?? (alwaysGlass || scrolled);
  return (
    <header className={`topbar ${glass ? "glass" : ""} ${className}`} data-shown={shown ? "" : undefined}>
      <div className={`topbar-inner ${wideRight ? "!grid-cols-[44px_1fr_auto]" : ""}`}>
        <div>{left}</div>
        <div className="flex min-w-0 justify-center">{center}</div>
        <div className="flex justify-end gap-2.5">{right}</div>
      </div>
    </header>
  );
}

export function CircleLink({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <Link href={href} aria-label={label} className="circle glass">
      <Icon name={icon} />
    </Link>
  );
}

export function CircleButton({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="circle glass">
      <Icon name={icon} />
    </button>
  );
}

/**
 * A bottom sheet on a real modal <dialog>: focus is trapped, Esc closes, the page behind is inert.
 * `role="alertdialog"` is used for the firmer confirms.
 */
export function Sheet({
  open,
  onClose,
  label,
  labelledBy,
  describedBy,
  role,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  role?: "dialog" | "alertdialog";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setClosing(false);
      dialog.showModal();
      window.requestAnimationFrame(() => dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus());
    }
    if (!open && dialog.open) {
      setClosing(true);
      const timer = window.setTimeout(() => {
        dialog.close();
        setClosing(false);
      }, 220);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`sheet glass ${closing ? "closing" : ""}`}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      role={role}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="grab" aria-hidden="true" />
      {open || closing ? children : null}
    </dialog>
  );
}

export type ToastState = { id: number; text: string; undo?: () => void | Promise<void>; ms: number } | null;

/** Polite status toast with optional Undo. It stays while hovered or focused. */
export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const show = useCallback((text: string, options: { undo?: () => void | Promise<void>; ms?: number } = {}) => {
    setToast({ id: Date.now(), text, undo: options.undo, ms: options.ms ?? 6000 });
  }, []);
  const hide = useCallback(() => setToast(null), []);
  return { toast, show, hide };
}

export function Toast({ toast, onDone }: { toast: ToastState; onDone: () => void }) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!toast || held) return;
    const timer = window.setTimeout(onDone, toast.ms);
    return () => window.clearTimeout(timer);
  }, [toast, held, onDone]);
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {toast ? (
        <div
          key={toast.id}
          className="toast"
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
        >
          <span className="line-clamp-2 py-2">{toast.text}</span>
          {toast.undo ? (
            <button
              type="button"
              onClick={() => {
                const undo = toast.undo;
                onDone();
                void undo?.();
              }}
            >
              Undo
            </button>
          ) : (
            <span className="w-3" />
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Carries a toast across a navigation (e.g. Remove → back to Your people). */
const PENDING_TOAST = "afterflow.toast";
export type PendingToast = { text: string; action?: string; connectionId?: string; until: number };

export function stashToast(toast: Omit<PendingToast, "until">, ms: number) {
  try {
    sessionStorage.setItem(PENDING_TOAST, JSON.stringify({ ...toast, until: Date.now() + ms }));
  } catch {
    // Storage refused: the action still happened, there's just no toast.
  }
}

export function takeToast(): (PendingToast & { ms: number }) | null {
  try {
    const raw = sessionStorage.getItem(PENDING_TOAST);
    sessionStorage.removeItem(PENDING_TOAST);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingToast;
    const ms = parsed.until - Date.now();
    return ms > 1000 ? { ...parsed, ms } : null;
  } catch {
    return null;
  }
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}
