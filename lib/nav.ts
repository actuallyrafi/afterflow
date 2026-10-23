// The signed-in tab bar: which tabs exist and which one a path belongs to.

export type TabKey = "people" | "events" | "card";

export const TABS: { key: TabKey; label: string; icon: "people" | "calendar" | "qr"; path: string }[] = [
  { key: "people", label: "Your people", icon: "people", path: "" },
  { key: "events", label: "Events", icon: "calendar", path: "/events" },
  { key: "card", label: "My card", icon: "qr", path: "/card" },
];

/** Which tab a signed-in path belongs to. People's own pages and Blocked live under Your people. */
export function tabFor(pathname: string, token: string): { key: TabKey; exact: boolean } | null {
  const base = `/m/${token}`;
  if (!pathname.startsWith(base)) return null;
  const rest = pathname.slice(base.length).replace(/\/$/, "");
  if (rest === "") return { key: "people", exact: true };
  if (rest === "/events") return { key: "events", exact: true };
  if (rest === "/card") return { key: "card", exact: true };
  if (rest.startsWith("/c/") || rest.startsWith("/settings")) return { key: "people", exact: false };
  return null;
}
