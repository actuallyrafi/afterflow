"use client";

import { useEffect, useMemo, useState } from "react";
import {
  dayLabel,
  googleCalendarUrl,
  icsFilename,
  REMINDER_TIMES,
  reminderFor,
  timeRange,
  toIcs,
  type ReminderTime,
} from "@/lib/calendar";
import { firstOf } from "@/lib/handoff";
import { Sheet } from "./ui/chrome";
import { Icon } from "./ui/icons";

type Saved = { start: number; label: string };

/** "Sun 25 Oct, 11:00" */
function savedLabel(start: number): string {
  const d = new Date(start);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  return `${day}, ${time}`;
}

function CalendarTile({ start }: { start: number }) {
  const d = new Date(start);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "Europe/London" });
  const date = d.toLocaleDateString("en-GB", { day: "numeric", timeZone: "Europe/London" });
  return (
    <span aria-hidden="true" className="grid size-12 flex-none place-items-center overflow-hidden rounded-[40%] bg-panel text-center leading-none shadow-[inset_0_0_0_0.5px_var(--line)]">
      <span>
        <span className="block text-[10px] font-bold tracking-[0.06em] text-hot uppercase">{weekday}</span>
        <span className="round mt-0.5 block text-[20px] font-black">{date}</span>
      </span>
    </span>
  );
}

/**
 * "Add a reminder to my calendar" (spec v4.1 §4): the user-initiated one gentle reminder.
 * Built on this device: a Google Calendar link or a .ics Blob. It holds the title and a
 * token-free link (/c/{id}) only. Adding it switches off Afterflow's own reminder for this person.
 */
export function CalendarReminder({
  connectionId,
  theirName,
  metAt,
  onAdded,
  onToast,
}: {
  connectionId: string;
  theirName: string;
  metAt: string;
  onAdded: () => void;
  onToast: (text: string) => void;
}) {
  const key = `afterflow.calendar.${connectionId}`;
  const first = firstOf(theirName);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [origin, setOrigin] = useState("");
  const [time, setTime] = useState<ReminderTime | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Saved) : null;
      if (parsed && typeof parsed.start === "number") setSaved(parsed);
    } catch {
      // Private mode: just show the row.
    }
  }, [key]);

  const reminder = useMemo(
    () => reminderFor({ connectionId, theirName, metAt, origin: origin || "https://afterflow-f1.netlify.app", time: time ?? undefined }),
    [connectionId, theirName, metAt, origin, time],
  );

  function markAdded() {
    const next = { start: reminder.start, label: savedLabel(reminder.start) };
    setSaved(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Fine: the done state just won't survive a reload.
    }
    onAdded();
    window.setTimeout(() => setOpen(false), 60);
  }

  function download() {
    const blob = new Blob([toIcs(reminder)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = icsFilename(theirName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    markAdded();
    onToast("Downloaded. Open the file to add it to your calendar.");
  }

  return (
    <>
      {saved ? (
        <div className="mt-2.5">
          <div className="group">
            <div className="item flush items-center">
              <span className="grid size-10 flex-none place-items-center rounded-[40%] bg-live-tint text-live-deep">
                <Icon name="check" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="t block">In your calendar</span>
                <span className="s block">{saved.label} · only you see this</span>
              </span>
              <button type="button" className="btn btn-sm btn-fill" onClick={() => setOpen(true)}>
                Again
              </button>
            </div>
          </div>
          <p className="mx-4 mt-2 text-[13px] leading-[18px] text-muted">Afterflow won&apos;t send its own reminder for {first} as well.</p>
        </div>
      ) : (
        <button
          type="button"
          className="mt-2 flex min-h-[54px] w-full items-center gap-3 rounded-[18px] px-2 text-left text-[17px] hover:bg-fill/60"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
        >
          <Icon name="calendar" />
          <span className="flex-1">Add a reminder to my calendar</span>
          <Icon name="chev" className="chev" />
        </button>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="cal-title" describedBy="cal-sub">
        <h2 id="cal-title" className="round text-center text-[22px] leading-7 font-black">
          Add a reminder to my calendar
        </h2>
        <p id="cal-sub" className="mx-auto mt-1 mb-4 max-w-[300px] text-center text-[15px] leading-[21px] text-muted">
          A nudge in a few days, in your own calendar. You can ignore it.
        </p>
        <div className="group">
          <div className="item flush items-center">
            <CalendarTile start={reminder.start} />
            <span className="min-w-0 flex-1">
              <span className="t block font-bold">{reminder.title}</span>
              <span className="s block">
                {dayLabel(reminder.day)} · {timeRange(reminder)}
              </span>
            </span>
          </div>
        </div>
        <div role="radiogroup" aria-label="Time" className="seg mt-3">
          {REMINDER_TIMES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={reminder.time === option}
              onClick={() => setTime(option)}
              data-autofocus={reminder.time === option ? true : undefined}
            >
              {option.replace(/^0/, "")}
            </button>
          ))}
        </div>
        <p className="mx-2 mt-3.5 flex gap-2 text-[14px] leading-5 text-muted">
          <Icon name="lock" size={16} className="mt-0.5 flex-none" />
          Just the title and a link back to Afterflow. No numbers or usernames go into your calendar.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <a
            href={googleCalendarUrl(reminder)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-lg btn-ink w-full"
            onClick={() => {
              markAdded();
              onToast("Opened Google Calendar. Tap Save there to keep it.");
            }}
          >
            Open in Google Calendar
          </a>
          <button type="button" className="btn btn-lg btn-fill w-full" onClick={download}>
            <Icon name="download" />
            Download .ics file
          </button>
        </div>
        <p className="mt-3 text-center text-[13px] text-muted">This is your one reminder for {first}.</p>
      </Sheet>
    </>
  );
}
