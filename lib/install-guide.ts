/** v4.1c "Use it like an app" guide (D22): the copy, per device. Plain data so tests can read it. */
export type InstallPlatform = "ios" | "android" | "other";

export type InstallStep = { title: string; detail?: string };

export const INSTALL_TITLE = "Use it like an app";
export const INSTALL_OPENS = "It opens straight into your card and your people, full screen, no browser bar.";
export const INSTALL_FROM_MY_CARD = "Add it from your own My card page so it opens signed in.";
export const INSTALL_ON_MY_CARD = "You're on your My card page, so it will open signed in.";

export function platformOf(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return "ios";
  if (/Android/.test(userAgent)) return "android";
  return "other";
}

export const IOS_STEPS: InstallStep[] = [
  { title: "Tap Share", detail: "The square with an arrow, in Safari's toolbar." },
  { title: "Tap Add to Home Screen", detail: "Scroll down the list if you don't see it." },
  { title: "Tap Add", detail: "Afterflow appears on your Home Screen." },
];

/** With Chrome's install prompt available, the button in the guide does steps 1 and 2. */
export const ANDROID_PROMPT_STEPS: InstallStep[] = [
  { title: "Tap Install below" },
  { title: "Tap Install again to confirm" },
  { title: "Open Afterflow from your home screen" },
];

export const ANDROID_MENU_STEPS: InstallStep[] = [
  { title: "Tap Chrome's menu", detail: "The three dots, top right." },
  { title: "Tap Install app or Add to Home screen" },
  { title: "Tap Install", detail: "Afterflow appears on your home screen." },
];

export function installSteps(platform: InstallPlatform, canPrompt: boolean): InstallStep[] {
  if (platform === "ios") return IOS_STEPS;
  return canPrompt ? ANDROID_PROMPT_STEPS : ANDROID_MENU_STEPS;
}

/** v4.1d (D24): the install step shown right after making a card, before Your people. */
export const INSTALL_STEP_TITLE = "Add Afterflow to your home screen";
export const INSTALL_STEP_SIGNED_IN = "You're adding it from your own card, so it opens signed in.";
export const LANDING_INSTALL_LINE = "Once your card is made, we'll show you how to add Afterflow to your home screen.";

/** D28: storage keys for the pop-up after making a card. */
export const INSTALL_PENDING_KEY = "afterflow.install.pending";
export const INSTALL_SEEN_KEY = "afterflow.install.step";

/**
 * D28: whether making a card should queue the "Add Afterflow to your home screen" pop-up. Phones in
 * the browser only: never on a computer, never when already running from the home screen.
 */
export function shouldPromptInstall(device: { standalone: boolean; platform: InstallPlatform }): boolean {
  return !device.standalone && device.platform !== "other";
}

/** D28: show the queued pop-up now? Never again after Not now (or Done). */
export function popInstallNow(state: { pending: boolean; seen: string | null; standalone: boolean; platform: InstallPlatform }): boolean {
  return state.pending && !state.seen && shouldPromptInstall(state);
}
