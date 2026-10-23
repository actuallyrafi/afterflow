// "Add a reminder to my calendar": one event, in the person's own calendar, a few days after
// you met. Built on the device (no server endpoint, no push, no email). It carries only a title
// and a token-free link (/c/{id}); never a phone number, handle, email or the private /m/{token} link.
import { REMINDER_DELAY_MS } from "./event";
import { firstOf } from "./handoff";

export const REMINDER_TIMES = ["09:00", "11:00", "12:30", "18:30"] as const;
export type ReminderTime = (typeof REMINDER_TIMES)[number];
export const REMINDER_MINUTES = 15;

export type Day = { y: number; m: number; d: number };

export type CalendarReminder = {
  title: string;
  description: string;
  /** UTC instants, computed from Europe/London wall time (DST-safe). */
  start: number;
  end: number;
  day: Day;
  time: ReminderTime;
  /** `{connectionId}-{unix}@{host}` */
  uid: string;
  /** Token-free: `{origin}/c/{connectionId}`. */
  url: string;
};

const TZ = "Europe/London";

function londonParts(ms: number) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date(ms))
    .reduce<Record<string, number>>((acc, part) => (part.type === "literal" ? acc : { ...acc, [part.type]: Number(part.value) }), {});
}

export function londonDay(ms: number): Day {
  const p = londonParts(ms);
  return { y: p.year, m: p.month, d: p.day };
}

/** The UTC instant of a London wall-clock time. */
export function londonToUtc(day: Day, hour: number, minute: number): number {
  const guess = Date.UTC(day.y, day.m - 1, day.d, hour, minute);
  const p = londonParts(guess);
  const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return guess - (shown - guess);
}

function addDays(day: Day, n: number): Day {
  const t = new Date(Date.UTC(day.y, day.m - 1, day.d + n, 12));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export function isWeekend(day: Day): boolean {
  const weekday = new Date(Date.UTC(day.y, day.m - 1, day.d, 12)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

/** 18:30 on weekdays, 11:00 at weekends. */
export function defaultTime(day: Day): ReminderTime {
  return isWeekend(day) ? "11:00" : "18:30";
}

/** The connection day + 3, in London. If that's already gone by, tomorrow. */
export function defaultDay(metAt: string, now = Date.now()): Day {
  const met = Date.parse(metAt);
  const day = addDays(londonDay(Number.isFinite(met) ? met : now), Math.round(REMINDER_DELAY_MS / 86_400_000));
  const [h, min] = defaultTime(day).split(":").map(Number);
  return londonToUtc(day, h, min) > now ? day : addDays(londonDay(now), 1);
}

export function reminderFor(input: {
  connectionId: string;
  theirName: string;
  metAt: string;
  origin: string;
  time?: ReminderTime;
  now?: number;
}): CalendarReminder {
  const now = input.now ?? Date.now();
  const day = defaultDay(input.metAt, now);
  const time = input.time ?? defaultTime(day);
  const [h, min] = time.split(":").map(Number);
  const start = londonToUtc(day, h, min);
  const url = `${input.origin.replace(/\/$/, "")}/c/${encodeURIComponent(input.connectionId)}`;
  let host = "afterflow";
  try {
    host = new URL(input.origin).host || host;
  } catch {
    // Keep the default.
  }
  return {
    title: `Say hi to ${firstOf(input.theirName)}`,
    description: `A gentle nudge you set in Afterflow.\n${url}`,
    start,
    end: start + REMINDER_MINUTES * 60_000,
    day,
    time,
    uid: `${input.connectionId}-${Math.floor(now / 1000)}@${host}`,
    url,
  };
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 line folding: at most 75 octets per line, continuation lines start with a space. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const width = encoder.encode(char).length;
    const limit = out.length ? 74 : 75;
    if (size + width > limit) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += width;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function utcStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function toIcs(reminder: CalendarReminder, now = Date.now()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Afterflow//Say hi reminder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${reminder.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(reminder.start)}`,
    `DTEND:${utcStamp(reminder.end)}`,
    `SUMMARY:${escapeText(reminder.title)}`,
    `DESCRIPTION:${escapeText(reminder.description)}`,
    `URL:${reminder.url}`,
    "CLASS:PRIVATE",
    "TRANSP:TRANSPARENT",
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(reminder.title)}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(reminder: CalendarReminder): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: reminder.title,
    dates: `${utcStamp(reminder.start)}/${utcStamp(reminder.end)}`,
    details: reminder.description,
    ctz: TZ,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function icsFilename(theirName: string): string {
  const safe = firstOf(theirName).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "them";
  return `say-hi-${safe.toLowerCase()}.ics`;
}

/** "Sun 25 Oct" */
export function dayLabel(day: Day): string {
  return new Date(Date.UTC(day.y, day.m - 1, day.d, 12)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** "11:00–11:15" */
export function timeRange(reminder: CalendarReminder): string {
  const fmt = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  return `${fmt(reminder.start)}–${fmt(reminder.end)}`;
}

/**
 * Where a token-free calendar link (/c/{id}) should go. With a saved session on this device
 * that can open the connection, to /m/{token}/c/{id}; otherwise nowhere (a neutral page).
 */
export function calendarLinkTarget(connectionId: string, savedToken: string | null, canOpen: boolean): string | null {
  if (!savedToken || !canOpen || !/^[A-Za-z0-9_-]+$/.test(savedToken)) return null;
  return `/m/${savedToken}/c/${encodeURIComponent(connectionId)}`;
}
