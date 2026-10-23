"use client";
/* v4.1g liquid-glass sliding selectors (design-spec-v41g-motion §6.2): one hook + two markup helpers. */
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { LiquidSelect, type LiquidOptions } from "@/lib/liquid-select";

/**
 * Attaches a LiquidSelect to the returned ref. Differs from the spec's hook in one way: it re-checks
 * the element after every render, so controls that mount later (the tab bar after an early return,
 * segmented controls inside a sheet that only renders when open) get a controller too, and a
 * replaced element gets a fresh one. `sync()` runs when the selected key changes.
 */
export function useLiquidSelect<T extends HTMLElement>(selectedKey: unknown, onPick?: LiquidOptions["onPick"]) {
  const ref = useRef<T>(null);
  const ctl = useRef<LiquidSelect | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  useLayoutEffect(() => {
    const el = ref.current;
    if (ctl.current && ctl.current.root !== el) {
      ctl.current.destroy();
      ctl.current = null;
    }
    if (el && !ctl.current) ctl.current = new LiquidSelect(el, { onPick: (i, item) => pick.current?.(i, item) });
  });
  useLayoutEffect(() => () => {
    ctl.current?.destroy();
    ctl.current = null;
  }, []);
  useLayoutEffect(() => {
    ctl.current?.sync();
  }, [selectedKey]); // route change / state change from elsewhere
  return ref;
}

/** The pill. variant "lens" = inside a glass bar (no blur of its own); "solid" = on an opaque panel. */
export function LiquidPill({ variant }: { variant: "lens" | "solid" }) {
  return (
    <span className="lq-pill" aria-hidden="true">
      <span className="lq-press">
        <span className={`lq-lens lq-lens--${variant}`} />
      </span>
    </span>
  );
}

/** Two stacked copies of the label: the muted one and the ink one that fades in under the pill. */
export function LiquidLabel({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="lq-lbl">{children}</span>
      <span className="lq-lbl lq-on" aria-hidden="true">
        {children}
      </span>
    </>
  );
}
