/**
 * v4.1e (D29): Appearance — System (default), Light or Dark, saved on this device only.
 * The dark styles hang off <html data-theme="dark">, set by THEME_BOOT in <head> before first paint,
 * so a saved choice never flashes the other scheme. The PWA theme-color meta follows it.
 */
export const THEME_KEY = "afterflow.theme";
export const THEMES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEMES)[number];
export const THEME_LABEL: Record<ThemeChoice, string> = { system: "System", light: "Light", dark: "Dark" };
import { PWA_COLORS } from "./pwa";

/** The --bg of each scheme (the same colours the manifest uses). */
export const THEME_COLOR = { light: PWA_COLORS.light, dark: PWA_COLORS.dark } as const;

export function themeChoice(value: unknown): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): "light" | "dark" {
  return choice === "system" ? (systemDark ? "dark" : "light") : choice;
}

/** The landing's sun/moon button: System → Light → Dark → System. */
export function nextTheme(choice: ThemeChoice): ThemeChoice {
  return choice === "system" ? "light" : choice === "light" ? "dark" : "system";
}

/**
 * Inline script for <head>. Defines window.__afTheme(choice?) which stores the choice (when given),
 * sets data-theme and color-scheme on <html>, and updates <meta name="theme-color">. Also follows the
 * system setting live while the choice is System.
 */
export const THEME_BOOT = `(function(){var K=${JSON.stringify(THEME_KEY)},C=${JSON.stringify(THEME_COLOR)};function q(){try{return window.matchMedia("(prefers-color-scheme: dark)")}catch(e){return null}}function g(){try{var v=localStorage.getItem(K);return v==="light"||v==="dark"?v:"system"}catch(e){return "system"}}function a(c){if(c){try{if(c==="system")localStorage.removeItem(K);else localStorage.setItem(K,c)}catch(e){}}var ch=c||g(),m=q(),t=ch==="system"?(m&&m.matches?"dark":"light"):ch,d=document.documentElement;d.setAttribute("data-theme",t);d.setAttribute("data-theme-choice",ch);d.style.colorScheme=t;var ms=document.querySelectorAll('meta[name="theme-color"]');if(!ms.length){var n=document.createElement("meta");n.setAttribute("name","theme-color");document.head.appendChild(n);ms=[n]}for(var i=0;i<ms.length;i++){ms[i].removeAttribute("media");ms[i].setAttribute("content",C[t])}return t}window.__afTheme=a;a();var m=q();if(m){var f=function(){if(g()==="system")a()};if(m.addEventListener)m.addEventListener("change",f);else if(m.addListener)m.addListener(f)}})();`;
