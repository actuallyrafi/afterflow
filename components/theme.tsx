"use client";

import { useEffect, useState } from "react";
import { nextTheme, THEME_KEY, THEME_LABEL, themeChoice, THEMES, type ThemeChoice } from "@/lib/theme";
import { Icon } from "./ui/icons";

declare global {
  interface Window {
    __afTheme?: (choice?: ThemeChoice) => "light" | "dark";
  }
}

/** D29: the device's Appearance choice; setting it applies at once (no reload) and saves it. */
export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
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
    (next) => {
      setChoice(next);
      window.__afTheme?.(next);
    },
  ];
}

/** My card › settings: a segmented System / Light / Dark control. */
export function AppearanceControl() {
  const [choice, setTheme] = useTheme();
  return (
    <div className="item flush flex-col !items-stretch">
      <span id="appearance-label" className="t block">
        Appearance
      </span>
      <div role="radiogroup" aria-labelledby="appearance-label" className="seg" id="appearance">
        {THEMES.map((option) => (
          <button key={option} type="button" role="radio" aria-checked={choice === option} data-theme-option={option} onClick={() => setTheme(option)}>
            {THEME_LABEL[option]}
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
