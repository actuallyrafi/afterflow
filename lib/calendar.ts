// "Add a reminder to my calendar": one event, in the person's own calendar, about three days
// after they connected. No server push, no email, no accounts. Works on phones via .ics.
import { REMINDER_DELAY_MS } from "./event";
import { firstOf } from "./handoff";

export type CalendarReminder = {
  title: string;
  description: string;
  /** Floating local times (no zone): the phone shows them in its own time zone. */
  start: string;
  end: string;
  /** Stable per connection, so adding it again updates the same event instead of stacking. */
  uid: string;
  url: string;
};

const HOUR = 60 * 60 * 1000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** The London calendar day of an instant, as Y/M/D numbers. */
function londonDay(ms: number): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(ms))
    .reduce<Record<string, string>>((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day) };
}

function floating(day: { y: number; m: number; d: number }, hour: number, minute: number) {
  return `${day.y}${pad(day.m)}${pad(day.d)}T${pad(hour)}${pad(minute)}00`;
}

/**
 * About three days after you connected, at 6pm. If that's already gone by, tomorrow at 6pm.
 */
export function reminderFor(input: {
  connectionId: string;
  theirName: string;
  metAt: string;
  url: string;
  now?: number;
}): CalendarReminder {
  const now = input.now ?? Date.now();
  const met = Date.parse(input.metAt);
  let at = (Number.isFinite(met) ? met : now) + REMINDER_DELAY_MS;
  if (at < now + HOUR) at = now + 24 * HOUR;
  const day = londonDay(at);
  const first = firstOf(input.theirName);
  return {
    title: `Say hi to ${first}`,
    description: `Your hi to ${first} is ready in Afterflow. Open it here:\n${input.url}\n\nThis link is private to you. Don't share it.`,
    start: floating(day, 18, 0),
    end: floating(day, 18, 15),
    uid: `${input.connectionId}.say-hi@afterflow`,
    url: input.url,
  };
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 line folding: at most 75 octets per line, continuation lines start with a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const width = new TextEncoder().encode(char).length;
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

function utcStamp(ms: number): string {
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
    `DTSTART:${reminder.start}`,
    `DTEND:${reminder.end}`,
    `SUMMARY:${escapeText(reminder.title)}`,
    `DESCRIPTION:${escapeText(reminder.description)}`,
    `URL:${reminder.url}`,
    "TRANSP:TRANSPARENT",
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
    dates: `${reminder.start}/${reminder.end}`,
    details: reminder.description,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function icsFilename(theirName: string): string {
  const safe = firstOf(theirName).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "them";
  return `say-hi-to-${safe.toLowerCase()}.ics`;
}
