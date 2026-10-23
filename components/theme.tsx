"use client";

import { useEffect, useState } from "react";
import { nextTheme, THEME_KEY, THEME_LABEL, themeChoice, THEMES, type ThemeChoice } from "@/lib/theme";
import { LiquidLabel, LiquidPill, useLiquidSelect } from "./liquid";
import { Icon } from "./ui/icons";

declare global {
  interface Window {
    __afTheme?: (choice?: ThemeChoice) => "light" | "dark";
  }
}

let fadeTimer = 0;

/** D29: the device's Appearance choice; setting it applies at once (no reload) and saves it. */
export function useTheme(): [ThemeChoice, (choice: ThemeChoice, options?: { fade?: boolean }) => void] {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => {
    try {
      setChoice(themeChoice(localStorage.getItem(THEME_KEY)));
    } catch {
      // Private mode: System.
    }
  }, []);
  return [
    choice,
    (next, options = {}) => {
      setChoice(next);
      // v4.1i: the colours start changing at once (a short crossfade) while the pill, on the compositor,
      // finishes its glide. No delay: waiting for the pill to land (~380ms) felt laggy (per Tanvir).
      const root = document.documentElement;
      const fade = options.fade && !matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (fade) {
        root.classList.add("af-theme-fade");
        window.clearTimeout(fadeTimer);
        fadeTimer = window.setTimeout(() => root.classList.remove("af-theme-fade"), 260);
      }
      window.__afTheme?.(next);
    },
  ];
}

/** My card › settings: a segmented System / Light / Dark control. */
export function AppearanceControl() {
  const [choice, setTheme] = useTheme();
  // v4.1i (review of Pixel's patch): commit two frames in, not when the pill lands, so the theme starts
  // changing ~33ms after the tap (well inside 120ms) and crossfades while the pill keeps gliding.
  const seg = useLiquidSelect<HTMLDivElement>(choice, (index) => setTheme(THEMES[index], { fade: true }), { commit: "frame" });
  return (
    <div className="item flush flex-col !items-stretch">
      <span id="appearance-label" className="t block">
        Appearance
      </span>
      <div ref={seg} role="radiogroup" aria-labelledby="appearance-label" className="seg lq" id="appearance">
        <LiquidPill variant="solid" />
        {THEMES.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            className="lq-opt"
            aria-checked={choice === option}
            tabIndex={choice === option ? 0 : -1}
            data-theme-option={option}
          >
            <LiquidLabel>{THEME_LABEL[option]}</LiquidLabel>
          </button>
        ))}
      </div>
      <span className="s mt-1.5 block">Saved on this phone only.</span>
    </div>
  );
}

/** Landing header: a small sun/moon button. System → Light → Dark → System. */
export function ThemeToggle() {
  const [choice, setTheme] = useTheme();
  const icon = choice === "light" ? "sun" : choice === "dark" ? "moon" : "contrast";
  return (
    <button
      type="button"
      className="circle glass"
      id="theme-toggle"
      onClick={() => setTheme(nextTheme(choice))}
      aria-label={`Appearance: ${THEME_LABEL[choice]}. Switch to ${THEME_LABEL[nextTheme(choice)]}`}
      title={`Appearance: ${THEME_LABEL[choice]}`}
    >
      <Icon name={icon} />
    </button>
  );
}
