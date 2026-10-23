// v4.1d next-morning event recap (design-spec-v41c §3, §5; Manager decisions D23).
// Pure functions, so the window, eligibility and copy are testable without a browser.
// - Events only: people with no event get no recap.
// - Separate from the per-person reminder (D20): it shows whatever that setting is, and it doesn't
//   switch any per-person reminder off. No push.
// - Window: 07:00 local on the day after the event's last mutual connection, to 23:59:59 local on
//   the third day after it. Ends early when hidden or when every row is done. One card at a time.
import type { CalendarReminder, ReminderTime } from "./calendar";
import { defaultTime, REMINDER_MINUTES } from "./calendar";
import type { ConnectionCard, EventsView } from "./connections";
import type { HelloVia } from "./store";

export type Day = { y: number; m: number; d: number };

function partsIn(ms: number, tz: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date(ms))
    .reduce<Record<string, number>>((acc, part) => (part.type === "literal" ? acc : { ...acc, [part.type]: Number(part.value) }), {});
}

/** The calendar day of an instant in a zone. */
export function localDay(ms: number, tz: string): Day {
  const p = partsIn(ms, tz);
  return { y: p.year, m: p.month, d: p.day };
}

export function addDays(day: Day, n: number): Day {
  const t = new Date(Date.UTC(day.y, day.m - 1, day.d + n, 12));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** The UTC instant of a wall-clock time in a zone (DST-safe: corrected twice for the zone offset). */
export function zonedInstant(day: Day, hour: number, minute: number, second: number, tz: string): number {
  const wall = Date.UTC(day.y, day.m - 1, day.d, hour, minute, second);
  let guess = wall;
  for (let i = 0; i < 2; i += 1) {
    const p = partsIn(guess, tz);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += wall - shown;
  }
  return guess;
}

export function recapWindow(lastMutualMs: number, tz: string): { start: number; end: number } {
  const day = localDay(lastMutualMs, tz);
  return { start: zonedInstant(addDays(day, 1), 7, 0, 0, tz), end: zonedInstant(addDays(day, 3), 23, 59, 59, tz) };
}

/** A row is done once a hello was opened for them or you marked that you talked. */
export function rowDone(card: Pick<ConnectionCard, "hello" | "talkedAgain">): boolean {
  return Boolean(card.hello) || card.talkedAgain;
}

const mutualMs = (card: ConnectionCard) => Date.parse(card.mutualAt ?? card.metAt);

/**
 * Who's in an event's recap: mutual, not muted, filed under that event. Removed and blocked people
 * never reach the client. Order: the order you both said yes (no ranking).
 */
export function recapPeople(connections: ConnectionCard[], eventId: string): ConnectionCard[] {
  return connections
    .filter((card) => card.eventId === eventId && card.mutual && card.status === "connected" && !card.muted)
    .sort((left, right) => mutualMs(left) - mutualMs(right));
}

export type RecapCard = {
  eventId: string;
  eventName: string;
  /** "yesterday", or the weekday of the last connection ("Thursday"). */
  when: string;
  last: number;
  people: ConnectionCard[];
};

export function relativeDay(now: number, last: number, tz: string): string {
  const a = localDay(last, tz);
  const b = localDay(now, tz);
  const diff = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
  if (diff === 1) return "yesterday";
  return new Date(Date.UTC(a.y, a.m - 1, a.d, 12)).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
}

/** At most one card: the eligible event with the latest last mutual connection. */
export function recapCard(input: { now: number; tz: string; connections: ConnectionCard[]; events: EventsView }): RecapCard | null {
  const hidden = new Set(input.events.recapHidden ?? []);
  let best: RecapCard | null = null;
  for (const event of input.events.events) {
    if (hidden.has(event.id)) continue;
    const people = recapPeople(input.connections, event.id);
    if (!people.length) continue;
    const last = Math.max(...people.map(mutualMs).filter(Number.isFinite));
    if (!Number.isFinite(last)) continue;
    const { start, end } = recapWindow(last, input.tz);
    if (input.now < start || input.now > end) continue;
    if (people.every(rowDone)) continue;
    if (!best || last > best.last) {
      best = { eventId: event.id, eventName: event.name, when: relativeDay(input.now, last, input.tz), last, people };
    }
  }
  return best;
}

export const HELLO_LABEL: Record<HelloVia, string> = {
  whatsapp: "Opened WhatsApp",
  instagram: "Opened Instagram",
  email: "Opened email",
  discord: "Opened Discord",
  discord_copy: "Copied for Discord",
};

/** "Thu 22 Oct" for the date pill, from the event's own calendar date. */
export function datePill(date: string): string {
  if (!date) return "";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");
}

export const RECAP_COPY = {
  cardTitle: "Say hi to the people you met",
  hideLabel: "Hide this recap",
  hiddenToast: "Hidden. You can still open it from Events.",
  sub: "Say hi while it's fresh. Each button opens their app with a hello ready. Nothing is sent from here.",
  doneTitle: "You've opened a hello for everyone",
  /** Truthful variant: someone was marked as talked without a hello opened from here. */
  doneTitleTalked: "You've said hi or talked with everyone",
  doneBody: "We can't see what you sent, and that's on purpose. What happens next happens in their apps, at their own pace.",
  emptyTitle: "Nobody here yet",
  emptyBody: (event: string) => `When you and someone from ${event} both say yes, they'll show up here, ready for a hello.`,
  signedOut: "Open Afterflow on the phone you used at the event.",
  calRow: "Remind me in my calendar",
} as const;

const TZ_LONDON = "Europe/London";

/**
 * "Remind me in my calendar" for a recap: one event titled "Say hi to people from {Event}" with a
 * token-free /recap/{eventId} link. No names beyond the title, no contacts, no token.
 * Day: the window's first day, or the next day whose slot is still ahead. London wall time, like v4.1.
 */
export function recapReminderFor(input: {
  eventId: string;
  eventName: string;
  lastMutual: number;
  origin: string;
  time?: ReminderTime;
  now?: number;
}): CalendarReminder {
  const now = input.now ?? Date.now();
  const at = (day: Day, time: ReminderTime) => {
    const [h, m] = time.split(":").map(Number);
    return zonedInstant(day, h, m, 0, TZ_LONDON);
  };
  let day = addDays(localDay(input.lastMutual, TZ_LONDON), 1);
  const today = localDay(now, TZ_LONDON);
  if (Date.UTC(day.y, day.m - 1, day.d) < Date.UTC(today.y, today.m - 1, today.d)) day = today;
  if (at(day, input.time ?? defaultTime(day)) <= now) day = addDays(day, 1);
  const time = input.time ?? defaultTime(day);
  const start = at(day, time);
  const url = `${input.origin.replace(/\/$/, "")}/recap/${encodeURIComponent(input.eventId)}`;
  let host = "afterflow";
  try {
    host = new URL(input.origin).host || host;
  } catch {
    // Keep the default.
  }
  return {
    title: `Say hi to people from ${input.eventName}`,
    description: `A gentle nudge you set in Afterflow.\n${url}`,
    start,
    end: start + REMINDER_MINUTES * 60_000,
    day,
    time,
    uid: `recap-${input.eventId}-${Math.floor(now / 1000)}@${host}`,
    url,
  };
}

/** Where the token-free /recap/{eventId} link goes on this device, or null for the neutral page. */
export function recapLinkTarget(eventId: string, savedToken: string | null, ownsEvent: boolean): string | null {
  if (!savedToken || !ownsEvent) return null;
  return `/m/${encodeURIComponent(savedToken)}/recap/${encodeURIComponent(eventId)}`;
}
