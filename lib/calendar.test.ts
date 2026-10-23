import assert from "node:assert/strict";
import test from "node:test";
import { googleCalendarUrl, icsFilename, reminderFor, toIcs } from "./calendar";
import { actOnConnection, addMet, calendarReminder, updateCard } from "./connections";
import { card, tempStore } from "./test-helpers";

const metAt = "2026-10-22T19:30:00.000Z";
const url = "https://afterflow.example/m/secret-token/c/conn-1";

test("the reminder is 'Say hi to Mira', about three days later at 6pm, with the private link", () => {
  const reminder = reminderFor({ connectionId: "conn-1", theirName: "Mira Okafor", metAt, url, now: Date.parse(metAt) });
  assert.equal(reminder.title, "Say hi to Mira");
  assert.equal(reminder.start, "20261025T180000");
  assert.equal(reminder.end, "20261025T181500");
  assert.ok(reminder.description.includes(url));
  // Already past? Then tomorrow, never in the past.
  const late = reminderFor({ connectionId: "conn-1", theirName: "Mira", metAt, url, now: Date.parse("2026-11-01T09:00:00Z") });
  assert.equal(late.start, "20261102T180000");
});

test(".ics output is valid RFC 5545: CRLF, folded lines, escaped text, one stable UID, an alarm", () => {
  const reminder = reminderFor({ connectionId: "conn-1", theirName: "Mira, the potter; hi", metAt, url, now: Date.parse(metAt) });
  const ics = toIcs(reminder, Date.parse("2026-10-23T08:00:00Z"));
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.equal(/[^\r]\n/.test(ics), false, "every line ends in CRLF");
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.match(ics, /\r\nUID:conn-1\.say-hi@afterflow\r\n/);
  assert.match(ics, /\r\nDTSTAMP:20261023T080000Z\r\n/);
  assert.match(ics, /\r\nDTSTART:20261025T180000\r\n/);
  assert.match(ics, /\r\nSUMMARY:Say hi to Mira\\,\r\n/);
  assert.match(ics, /BEGIN:VALARM\r\nACTION:DISPLAY/);
  const unfolded = ics.replace(/\r\n /g, "");
  assert.ok(unfolded.includes(`DESCRIPTION:Your hi to Mira\\, is ready in Afterflow. Open it here:\\n${url}`));
  assert.equal(icsFilename("Mira Okafor"), "say-hi-to-mira.ics");
  const google = new URL(googleCalendarUrl(reminder));
  assert.equal(google.searchParams.get("dates"), "20261025T180000/20261025T181500");
  assert.equal(google.searchParams.get("text"), "Say hi to Mira,");
});

test("the calendar reminder is only for mutual connections, only if reminders are on, never for muted people", async () => {
  const store = tempStore("afterflow-calendar");
  const sam = await store.createProfile(card("Sam"));
  const mira = await store.createProfile(card("Mira"));
  const added = await addMet(store, sam.secretToken, mira.publicId, "");
  if (!("connection" in added.body)) throw new Error("expected connection");
  const id = added.body.connection.id;
  const origin = "https://afterflow.example";
  assert.equal((await calendarReminder(store, sam.secretToken, id, origin)).status, 409, "not mutual yet");
  await actOnConnection(store, mira.secretToken, id, { action: "confirm" });
  assert.equal((await calendarReminder(store, sam.secretToken, id, origin)).status, 409, "reminders are off by default");
  await updateCard(store, sam.secretToken, { reminders: true });
  const ok = await calendarReminder(store, sam.secretToken, id, origin);
  assert.equal(ok.status, 200);
  if (!("reminder" in ok.body)) throw new Error("expected reminder");
  assert.equal(ok.body.reminder.url, `${origin}/m/${sam.secretToken}/c/${id}`);
  assert.equal(ok.body.reminder.title, "Say hi to Mira");
  await actOnConnection(store, sam.secretToken, id, { action: "mute" });
  assert.equal((await calendarReminder(store, sam.secretToken, id, origin)).status, 409, "muted");
  assert.equal((await calendarReminder(store, mira.secretToken, "nope", origin)).status, 404);
});
