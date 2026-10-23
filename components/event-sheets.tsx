"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { EventSummary } from "@/lib/connections";
import { Sheet } from "./ui/chrome";
import { Icon } from "./ui/icons";
import { hueOf } from "./ui/mark";

/** Today in London, as YYYY-MM-DD for <input type="date">. */
export function londonToday(now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(now),
  );
}

export function longDate(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
}

/** "until 18:40" today, or "until tomorrow, 18:40". */
export function untilLabel(iso: string, now = Date.now()): string {
  const time = new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  return londonToday(Date.parse(iso)) === londonToday(now) ? `until ${time}` : `until tomorrow, ${time}`;
}

/** A small calendar tile in the event's own hue: month above, day below. */
export function DateTile({ id, date, size = 48 }: { id: string; date: string; size?: 40 | 48 }) {
  const day = new Date(`${date}T12:00:00Z`);
  const month = day.toLocaleDateString("en-GB", { month: "short", timeZone: "Europe/London" });
  return (
    <span
      aria-hidden="true"
      className={`hue-${hueOf(id)} hue-bg hue-fg grid flex-none place-items-center rounded-[40%] text-center leading-none`}
      style={{ width: size, height: size }}
    >
      <span>
        <span className="block text-[10px] font-bold tracking-[0.04em] uppercase">{month}</span>
        <span className="round block text-[19px] font-black">{day.getUTCDate()}</span>
      </span>
    </span>
  );
}

export type EventDraft = { name: string; date: string; startNow: boolean };

/** New event, or edit one (rename, change the day, delete). */
export function EventFormSheet({
  open,
  onClose,
  event,
  busy,
  error,
  onSave,
  onDelete,
  offerStartNow = true,
  startNowDefault = false,
}: {
  open: boolean;
  onClose: () => void;
  event?: EventSummary | null;
  busy: boolean;
  error: string;
  onSave: (draft: EventDraft) => void;
  onDelete?: () => void;
  offerStartNow?: boolean;
  startNowDefault?: boolean;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(londonToday());
  const [startNow, setStartNow] = useState(startNowDefault);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(event?.name ?? "");
    setDate(event?.date ?? londonToday());
    setStartNow(startNowDefault);
    setConfirming(false);
  }, [open, event, startNowDefault]);

  const editing = Boolean(event);

  function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    onSave({ name, date, startNow: offerStartNow && !editing && startNow });
  }

  return (
    <Sheet open={open} onClose={onClose} labelledBy="event-form-title" role={confirming ? "alertdialog" : "dialog"} describedBy={confirming ? "delete-event-desc" : undefined}>
      {!confirming ? (
        <form className="swap" onSubmit={submit} noValidate>
          <h2 id="event-form-title" className="round text-center text-[22px] leading-7 font-black">
            {editing ? "Edit event" : "New event"}
          </h2>
          <p className="mx-auto mt-1 mb-4 max-w-[290px] text-center text-[14px] leading-5 text-muted">
            Only you see your events. Filing someone here doesn&apos;t change anything for them.
          </p>
          <div className="group">
            <label className="field !rounded-none" htmlFor="event-name">
              <span className="field-label">Name</span>
              <input
                id="event-name"
                data-autofocus
                value={name}
                maxLength={60}
                onChange={(change) => setName(change.target.value)}
                placeholder="Grok Bot London"
                autoComplete="off"
              />
            </label>
            <label className="field !rounded-none border-t-[0.5px] border-line" htmlFor="event-date">
              <span className="field-label">Day</span>
              <input id="event-date" type="date" value={date} onChange={(change) => setDate(change.target.value)} />
            </label>
          </div>
          {offerStartNow && !editing ? (
            <div className="group mt-2.5">
              <div className="item flush items-center">
                <span className="flex-1">
                  <span id="start-now-label" className="t block">
                    I&apos;m here now
                  </span>
                  <span id="start-now-help" className="s block">
                    New people go in this event for 24 hours, or until you end it.
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={startNow}
                  aria-labelledby="start-now-label"
                  aria-describedby="start-now-help"
                  className="toggle"
                  onClick={() => setStartNow((value) => !value)}
                />
              </div>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="mx-1 mt-3 text-[14px] text-hot">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-lg btn-ink mt-4 w-full" disabled={busy || !name.trim()} aria-busy={busy}>
            {busy ? "Saving…" : editing ? "Save" : "Make event"}
          </button>
          {editing && onDelete ? (
            <button type="button" className="btn btn-plain mt-1 w-full !text-hot" onClick={() => setConfirming(true)} disabled={busy}>
              Delete event
            </button>
          ) : (
            <button type="button" className="btn btn-plain mt-1 w-full" onClick={onClose}>
              Cancel
            </button>
          )}
        </form>
      ) : (
        <div className="swap pt-1">
          <h2 id="event-form-title" className="round text-center text-[22px] leading-7 font-black">
            Delete {event?.name}?
          </h2>
          <p id="delete-event-desc" className="mx-auto mt-2 max-w-[300px] text-center text-[15px] leading-[21px] text-muted">
            Only the event goes. Everyone in it stays in Your people, just not in an event.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button type="button" className="btn btn-lg btn-ink w-full" onClick={onDelete} disabled={busy} aria-busy={busy}>
              Delete event
            </button>
            <button type="button" className="btn btn-lg btn-fill w-full" onClick={() => setConfirming(false)} data-autofocus>
              Keep it
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** "I'm at an event now": pick one of yours, or make a new one. */
export function StartEventSheet({
  open,
  onClose,
  events,
  busy,
  onStart,
  onNew,
}: {
  open: boolean;
  onClose: () => void;
  events: EventSummary[];
  busy: boolean;
  onStart: (eventId: string) => void;
  onNew: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="start-title">
      <h2 id="start-title" className="round text-center text-[22px] leading-7 font-black">
        Where are you?
      </h2>
      <p className="mx-auto mt-1 mb-4 max-w-[300px] text-center text-[14px] leading-5 text-muted">
        For the next 24 hours, people you connect with are filed under it for you. End it anytime.
      </p>
      <div className="group">
        <button type="button" className="item flush items-center" onClick={onNew} data-autofocus>
          <span className="app-chip hue-4">
            <Icon name="plus" />
          </span>
          <span className="t flex-1">New event</span>
        </button>
        {events.map((event) => (
          <button key={event.id} type="button" className="item flush items-center" disabled={busy} onClick={() => onStart(event.id)}>
            <DateTile id={event.id} date={event.date} size={40} />
            <span className="t min-w-0 flex-1 truncate">{event.name}</span>
            <span className="text-[13px] text-muted">{longDate(event.date)}</span>
          </button>
        ))}
      </div>
      <button type="button" className="group mt-2.5 block min-h-[54px] w-full text-[17px] font-semibold" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}
