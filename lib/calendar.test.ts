import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calendarLinkTarget, dayLabel, defaultTime, googleCalendarUrl, icsFilename, reminderFor, timeRange, toIcs } from "./calendar";

const metAt = "2026-10-22T19:30:00.000Z"; // Thu 22 Oct, 20:30 BST
const origin = "https://afterflow-f1.netlify.app";

test("defaults: met Thu 22 Oct -> Sun 25 Oct 11:00-11:15 (weekend), written as UTC after the clocks go back", () => {
  const reminder = reminderFor({ connectionId: "c1", theirName: "Mira Sato", metAt, origin, now: Date.parse(metAt) });
  assert.equal(reminder.title, "Say hi to Mira");
  assert.equal(dayLabel(reminder.day), "Sun 25 Oct");
  assert.equal(reminder.time, "11:00");
  assert.equal(timeRange(reminder), "11:00–11:15");
  assert.equal(new Date(reminder.start).toISOString(), "2026-10-25T11:00:00.000Z");
  assert.equal(reminder.end - reminder.start, 15 * 60_000);
  // Weekdays get 18:30 (BST before the change: 17:30Z).
  assert.equal(defaultTime({ y: 2026, m: 10, d: 21 }), "18:30");
  const weekday = reminderFor({ connectionId: "c1", theirName: "Mira", metAt: "2026-10-19T12:00:00Z", origin, now: Date.parse("2026-10-19T12:00:00Z") });
  assert.equal(new Date(weekday.start).toISOString(), "2026-10-22T17:30:00.000Z");
  // A chosen time wins.
  const nine = reminderFor({ connectionId: "c1", theirName: "Mira", metAt, origin, time: "09:00", now: Date.parse(metAt) });
  assert.equal(new Date(nine.start).toISOString(), "2026-10-25T09:00:00.000Z");
  // Already past? Then tomorrow, never in the past.
  const late = reminderFor({ connectionId: "c1", theirName: "Mira", metAt, origin, now: Date.parse("2026-11-01T09:00:00Z") });
  assert.equal(dayLabel(late.day), "Mon 2 Nov");
});

test(".ics has the exact spec fields: CRLF, folded at 75 octets, private, transparent, an alarm, UTC times", () => {
  const reminder = reminderFor({ connectionId: "c1", theirName: "Mira, the potter; hi", metAt, origin, now: Date.parse("2026-10-23T01:45:00Z") });
  const ics = toIcs(reminder, Date.parse("2026-10-23T01:45:00Z"));
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Afterflow//Say hi reminder//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n"));
  assert.ok(ics.endsWith("END:VEVENT\r\nEND:VCALENDAR\r\n"));
  assert.equal(/[^\r]\n/.test(ics), false, "every line ends in CRLF");
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  const unfolded = ics.replace(/\r\n /g, "");
  for (const line of [
    `UID:c1-${Math.floor(Date.parse("2026-10-23T01:45:00Z") / 1000)}@afterflow-f1.netlify.app`,
    "DTSTAMP:20261023T014500Z",
    "DTSTART:20261025T110000Z",
    "DTEND:20261025T111500Z",
    "SUMMARY:Say hi to Mira\\,",
    `DESCRIPTION:A gentle nudge you set in Afterflow.\\n${origin}/c/c1`,
    `URL:${origin}/c/c1`,
    "CLASS:PRIVATE",
    "TRANSP:TRANSPARENT",
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:PT0M",
  ]) {
    assert.ok(unfolded.includes(`\r\n${line}\r\n`), line);
  }
  assert.equal(icsFilename("Mira Sato"), "say-hi-mira.ics");
});

test("nothing private goes into the calendar: no token link, no contact, no organiser or guests", () => {
  const reminder = reminderFor({ connectionId: "c1", theirName: "Mira", metAt, origin, now: Date.parse(metAt) });
  const ics = toIcs(reminder);
  const google = googleCalendarUrl(reminder);
  for (const text of [ics, google, decodeURIComponent(google)]) {
    assert.equal(/\/m\//.test(text), false, "never the private /m/{token} link");
    assert.equal(/ORGANIZER|ATTENDEE|LOCATION|wa\.me|mailto:|instagram|discord|@example/i.test(text.replace(/@afterflow-f1\.netlify\.app/, "")), false);
  }
  const url = new URL(google);
  assert.equal(url.origin + url.pathname, "https://calendar.google.com/calendar/render");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(url.searchParams.get("text"), "Say hi to Mira");
  assert.equal(url.searchParams.get("dates"), "20261025T110000Z/20261025T111500Z");
  assert.equal(url.searchParams.get("details"), `A gentle nudge you set in Afterflow.\n${origin}/c/c1`);
  assert.equal(url.searchParams.get("ctz"), "Europe/London");
  assert.equal(url.searchParams.has("location"), false);
  assert.equal(url.searchParams.has("add"), false);
});

test("/c/{id} opens the connection only with this device's saved session; otherwise a neutral page", () => {
  assert.equal(calendarLinkTarget("c1", "tok", true), "/m/tok/c/c1");
  assert.equal(calendarLinkTarget("c1", null, false), null, "no saved card on this device");
  assert.equal(calendarLinkTarget("c1", "tok", false), null, "this device's card can't open it");
  assert.equal(calendarLinkTarget("c/../x", "tok", true), "/m/tok/c/c%2F..%2Fx");
  assert.equal(calendarLinkTarget("c1", "../evil", true), null, "a tampered saved token goes nowhere");
  // The neutral page never renders a name or contact: it only knows the id.
  const page = readFileSync(new URL("../app/c/[id]/calendar-link.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("Open Afterflow on the phone you used"));
  assert.equal(/other\.|\.name\b|contact/i.test(page.replace(/Nothing here shows who it&apos;s about\./, "")), false);
  assert.equal(/robots: \{ index: false/.test(readFileSync(new URL("../app/c/[id]/page.tsx", import.meta.url), "utf8")), true);
});
