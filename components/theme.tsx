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

/** D29: the device's Appearance choice; setting it applies at once (no reload) and saves it. */
export function useTheme(): [ThemeChoice, (choice: ThemeChoice, options?: { delayMs?: number }) => void] {
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
      // v4.1g: the Appearance pill lands first, then the colours change (spec §6.3, 200ms).
      if (options.delayMs) window.setTimeout(() => window.__afTheme?.(next), options.delayMs);
      else window.__afTheme?.(next);
    },
  ];
}

/** My card › settings: a segmented System / Light / Dark control. */
export function AppearanceControl() {
  const [choice, setTheme] = useTheme();
  const seg = useLiquidSelect<HTMLDivElement>(choice, (index) => setTheme(THEMES[index], { delayMs: 200 }));
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
            onClick={() => setTheme(option, { delayMs: 200 })}
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
