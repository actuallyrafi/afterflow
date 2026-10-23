"use client";

import { useEffect, useState } from "react";
import { googleCalendarUrl, reminderFor } from "@/lib/calendar";
import { firstOf } from "@/lib/handoff";
import { Icon } from "./ui/icons";

/**
 * The one gentle reminder, in your own calendar: "Say hi to Mira", about three days after you
 * connected, with the private link back to this page. Shown only if you turned reminders on.
 */
export function CalendarReminderCard({
  token,
  connectionId,
  theirName,
  metAt,
}: {
  token: string;
  connectionId: string;
  theirName: string;
  metAt: string;
}) {
  const key = `afterflow.calendar.${connectionId}`;
  const [added, setAdded] = useState(false);
  const [origin, setOrigin] = useState("");
  const first = firstOf(theirName);

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      setAdded(localStorage.getItem(key) === "1");
    } catch {
      // Private mode: just show the buttons.
    }
  }, [key]);

  const reminder = reminderFor({ connectionId, theirName, metAt, url: `${origin}/m/${token}/c/${connectionId}` });
  const when = (() => {
    const y = Number(reminder.start.slice(0, 4));
    const m = Number(reminder.start.slice(4, 6));
    const d = Number(reminder.start.slice(6, 8));
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  })();

  const mark = () => {
    setAdded(true);
    try {
      localStorage.setItem(key, "1");
    } catch {
      // Fine.
    }
  };

  return (
    <section className="panel mt-2.5 p-4" aria-labelledby="calendar-title">
      <div className="flex items-start gap-3">
        <span className="app-chip hue-2 !size-10">
          <Icon name={added ? "check" : "calendarPlus"} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="calendar-title" className="t-name">
            {added ? "In your calendar" : "Add a reminder to my calendar"}
          </h2>
          <p className="mt-0.5 text-[14px] leading-5 text-muted">
            &ldquo;{reminder.title}&rdquo; on {when}, 6pm. Just once, with a link back here. Only in your calendar.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <a
          href={`/api/profiles/${token}/connections/${connectionId}/reminder`}
          className="btn btn-fill min-w-0 flex-1"
          onClick={mark}
          aria-label={`Add “Say hi to ${first}” to Apple or other calendars (.ics file)`}
        >
          <Icon name="calendar" />
          Calendar
        </a>
        <a
          href={googleCalendarUrl(reminder)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-fill min-w-0 flex-1"
          onClick={mark}
          aria-label={`Add “Say hi to ${first}” to Google Calendar`}
        >
          Google Calendar
        </a>
      </div>
    </section>
  );
}
