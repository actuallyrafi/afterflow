"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { EventSummary } from "@/lib/connections";
import { EVENT_NAME_MAX } from "@/lib/events";
import { Sheet } from "./ui/chrome";
import { Icon } from "./ui/icons";
import { hueOf } from "./ui/mark";

/** Today in London, as YYYY-MM-DD for <input type="date">. */
export function londonToday(now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(now),
  );
}

/** "22 Oct 2026", or "No date". */
export function longDate(day: string): string {
  if (!day) return "No date";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
}

/** A small calendar tile in the event's own hue: month above, day below. No date: a folder. */
export function DateTile({ id, date, size = 48 }: { id: string; date: string; size?: 40 | 48 }) {
  const base = `hue-${hueOf(id)} hue-bg hue-fg grid flex-none place-items-center rounded-[40%] text-center leading-none`;
  if (!date) {
    return (
      <span aria-hidden="true" className={base} style={{ width: size, height: size }}>
        <Icon name="folder" />
      </span>
    );
  }
  const day = new Date(`${date}T12:00:00Z`);
  const month = day.toLocaleDateString("en-GB", { month: "short", timeZone: "Europe/London" });
  return (
    <span aria-hidden="true" className={base} style={{ width: size, height: size }}>
      <span>
        <span className="block text-[10px] font-bold tracking-[0.04em] uppercase">{month}</span>
        <span className="round block text-[19px] font-black">{day.getUTCDate()}</span>
      </span>
    </span>
  );
}

export type EventDraft = { name: string; date: string };

/** New event, or Edit event (rename, change the day, delete). Spec v4.1 §2.3. */
export function EventFormSheet({
  open,
  onClose,
  event,
  busy,
  error,
  onSave,
  onDelete,
  defaultDate = "",
}: {
  open: boolean;
  onClose: () => void;
  event?: EventSummary | null;
  busy: boolean;
  error: string;
  onSave: (draft: EventDraft) => void;
  onDelete?: () => void;
  /** "New event…" from the picker is pre-dated today. */
  defaultDate?: string;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // The delete confirm starts on the safe choice.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  useEffect(() => {
    if (!open) return;
    setName(event?.name ?? "");
    setDate(event ? event.date : defaultDate);
    setConfirming(false);
  }, [open, event, defaultDate]);

  const editing = Boolean(event);
  const tooLong = name.trim().length > EVENT_NAME_MAX;
  const shownError = tooLong ? "Keep it under 60 characters." : error;

  function submit(formEvent?: FormEvent) {
    formEvent?.preventDefault();
    if (!name.trim() || tooLong || busy) return;
    onSave({ name: name.trim(), date });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledBy="event-form-title"
      role={confirming ? "alertdialog" : "dialog"}
      describedBy={confirming ? "delete-event-desc" : undefined}
    >
      {!confirming ? (
        <form className="swap" onSubmit={submit} noValidate>
          <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center">
            <button type="button" className="btn btn-sm btn-plain-ink justify-self-start !px-1 font-normal" onClick={onClose}>
              Cancel
            </button>
            <h2 id="event-form-title" className="round text-[19px] leading-6 font-black">
              {editing ? "Edit event" : "New event"}
            </h2>
            <button type="submit" className="btn btn-sm btn-plain-ink justify-self-end !px-1 font-bold" disabled={busy || !name.trim() || tooLong} aria-busy={busy}>
              Save
            </button>
          </div>
          <div className="group">
            <label className={`field !rounded-none ${shownError ? "invalid" : ""}`} htmlFor="event-name">
              <span className="field-label">Name</span>
              <input
                id="event-name"
                data-autofocus
                value={name}
                onChange={(change) => setName(change.target.value)}
                placeholder="e.g. Climbing social"
                autoComplete="off"
                enterKeyHint="done"
                aria-invalid={shownError ? true : undefined}
                aria-describedby={shownError ? "event-error" : undefined}
              />
            </label>
            <label className="field !rounded-none border-t-[0.5px] border-line" htmlFor="event-date">
              <span className="field-label">Date · optional</span>
              <input id="event-date" type="date" value={date} onChange={(change) => setDate(change.target.value)} />
            </label>
          </div>
          {shownError ? (
            <p id="event-error" role="alert" className="mx-1 mt-2.5 flex items-center gap-1.5 text-[14px] text-hot">
              <Icon name="alert" size={16} />
              {shownError}
            </p>
          ) : null}
          <p className="mx-4 mt-2.5 text-[13px] leading-[18px] text-muted">Only you see this name.</p>
          {editing && onDelete ? (
            <div className="group mt-5">
              <button type="button" className="item flush items-center text-left" onClick={() => setConfirming(true)} disabled={busy}>
                <span className="flex-1">
                  <span className="t block text-hot">Delete event</span>
                  <span className="s block">The people in it stay. They move to No event.</span>
                </span>
              </button>
            </div>
          ) : null}
        </form>
      ) : (
        <div className="swap pt-1">
          <h2 id="event-form-title" className="round text-center text-[22px] leading-7 font-black">
            Delete &ldquo;{event?.name}&rdquo;?
          </h2>
          <p id="delete-event-desc" className="mx-auto mt-2 max-w-[300px] text-center text-[15px] leading-[21px] text-muted">
            Only the event goes. Everyone you met there stays in Your people, under No event. Nobody is told.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button type="button" className="btn btn-lg btn-hot w-full" onClick={onDelete} disabled={busy} aria-busy={busy}>
              Delete event
            </button>
            <button ref={cancelRef} type="button" className="btn btn-lg btn-fill w-full" onClick={() => setConfirming(false)} data-autofocus>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** Turning on "I'm at an event now" with nothing dated today: pick one, or "New event…" (pre-dated today). */
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
        New people go into the event you pick. Turns itself off at 4am.
      </p>
      <div className="group max-h-[50vh] overflow-y-auto">
        {events.map((event, index) => (
          <button
            key={event.id}
            type="button"
            className="item flush items-center"
            disabled={busy}
            onClick={() => onStart(event.id)}
            data-autofocus={index === 0 ? true : undefined}
          >
            <DateTile id={event.id} date={event.date} size={40} />
            <span className="min-w-0 flex-1 text-left">
              <span className="t block truncate">{event.name}</span>
              <span className="s block">{longDate(event.date)}</span>
            </span>
          </button>
        ))}
        <button type="button" className="item flush items-center" onClick={onNew} data-autofocus={events.length ? undefined : true}>
          <span className="grid size-10 flex-none place-items-center rounded-[40%] bg-fill">
            <Icon name="plus" />
          </span>
          <span className="t flex-1 text-left">New event…</span>
        </button>
      </div>
      <button type="button" className="group mt-2.5 block min-h-[54px] w-full text-[17px] font-semibold" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}
