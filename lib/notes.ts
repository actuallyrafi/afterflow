/** v4.1e (D26): the quiet line under a shared note the other person changed. */
import type { ConnectionCard } from "./connections";
import { firstOf } from "./handoff";

function dayKey(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

/** "08:14" today, "yesterday", otherwise "Thu 22 Oct". */
export function noteWhen(at: string, now: number, tz: string): string {
  const ms = Date.parse(at);
  if (dayKey(ms, tz) === dayKey(now, tz)) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(ms);
  }
  if (dayKey(ms + 86_400_000, tz) === dayKey(now, tz)) return "yesterday";
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(ms).replace(",", "");
}

/** Only when they changed it (never for your own edits) and only once you're both connected. */
export function noteUpdatedLine(card: Pick<ConnectionCard, "mutual" | "sharedNoteAt" | "sharedNoteByThem" | "other">, now: number, tz: string): string | null {
  if (!card.mutual || !card.sharedNoteByThem || !card.sharedNoteAt) return null;
  return `Updated by ${firstOf(card.other.name)} · ${noteWhen(card.sharedNoteAt, now, tz)}`;
}

export const NOTE_CONFLICT = (name: string) => `${name} changed this note while you were editing. Theirs is below; save again to replace it.`;
