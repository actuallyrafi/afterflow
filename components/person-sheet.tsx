"use client";

import { DemoTag } from "@/components/ui/demo-tag";
import { useEffect, useRef, useState } from "react";
import type { EventSummary } from "@/lib/connections";
import { firstOf } from "@/lib/handoff";
import { DateTile, londonToday } from "./event-sheets";
import { Sheet } from "./ui/chrome";
import { Icon } from "./ui/icons";
import { Mark } from "./ui/mark";

export type Step = "menu" | "remove" | "block" | "event";

/**
 * Mute, Remove, Block. All quiet: the other person is never told.
 * Graded confirms: Mute none, Remove a light in-sheet confirm, Block a dedicated red alert.
 */
export function PersonSheet({
  open,
  onClose,
  name,
  seed,
  muted,
  isDemo = false,
  busy,
  onMute,
  onRemove,
  onBlock,
  metLine,
  events = [],
  eventId = null,
  onFile,
  onCreateAndFile,
  initialStep = "menu",
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  seed: string;
  muted: boolean;
  isDemo?: boolean;
  busy: boolean;
  onMute: () => void;
  onRemove: () => void;
  onBlock: () => void;
  /** "Met at Grok Bot London · 22 Oct", or "Met 24 Oct" when not in an event. */
  metLine: string;
  events?: EventSummary[];
  eventId?: string | null;
  onFile?: (eventId: string | null) => void;
  onCreateAndFile?: (name: string, date: string) => void;
  initialStep?: Step;
}) {
  const [step, setStep] = useState<Step>("menu");
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState(londonToday());
  const [creating, setCreating] = useState(false);
  const current = events.find((event) => event.id === eventId) ?? null;

  useEffect(() => {
    if (open) setStep(initialStep);
  }, [open, initialStep]);
  const first = firstOf(name);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      const timer = window.setTimeout(() => {
        setStep("menu");
        setCreating(false);
        setNewName("");
      }, 260);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    // Firmer confirms start on the safe choice.
    if (step === "block") cancelRef.current?.focus();
    if (step === "remove") keepRef.current?.focus();
  }, [step]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      role={step === "block" ? "alertdialog" : "dialog"}
      labelledBy={step === "block" ? "block-title" : step === "remove" ? "remove-title" : step === "event" ? "event-title" : "sheet-title"}
      describedBy={step === "block" ? "block-consequences" : step === "remove" ? "remove-desc" : undefined}
    >
      {step === "menu" ? (
        <div className="swap">
          <div className="mb-3.5 flex items-center gap-3">
            <Mark name={name} seed={seed} size={56} state={muted ? "muted" : undefined} />
            <div className="min-w-0">
              <h2 id="sheet-title" className="round truncate text-[20px] leading-6 font-black">
                {name}
                {isDemo ? <DemoTag /> : null}
              </h2>
              <p className="text-[14px] text-muted">{metLine}</p>
            </div>
          </div>
          {onFile ? (
            <div className="group mb-2.5">
              <button type="button" className="item items-center" onClick={() => setStep("event")} disabled={busy}>
                <Icon name="calendar" />
                <span className="min-w-0 flex-1">
                  <span className="t block">Event</span>
                  <span className="s block truncate">{current ? current.label : "Not in an event"}</span>
                </span>
                <Icon name="chev" className="chev mt-0.5" />
              </button>
            </div>
          ) : null}
          <div className="group">
            <button type="button" className="item" onClick={onMute} disabled={busy} data-autofocus>
              <Icon name={muted ? "bell" : "bellOff"} />
              <span>
                <span className="t block">{muted ? `Unmute ${first}` : `Mute ${first}`}</span>
                <span className="s block">
                  {muted ? `Reminders about ${first} can come back. They won't know.` : `No reminders about ${first}. They won't know.`}
                </span>
              </span>
            </button>
            <button type="button" className="item" onClick={() => setStep("remove")} disabled={busy}>
              <Icon name="minus" />
              <span>
                <span className="t block">Remove connection</span>
                <span className="s block">{first} leaves your list. They won&apos;t be told. You could connect again later.</span>
              </span>
            </button>
            <button type="button" className="item hot" onClick={() => setStep("block")} disabled={busy}>
              <Icon name="block" />
              <span>
                <span className="t block">Block {first}</span>
                <span className="s block">You both disappear from each other, for good. They won&apos;t be told.</span>
              </span>
            </button>
          </div>
          <button type="button" className="group mt-2.5 block min-h-[54px] w-full text-[17px] font-semibold" onClick={onClose}>
            Cancel
          </button>
          <p className="mt-3 text-center text-[12px] text-muted">Anything already shared on WhatsApp or Discord stays there.</p>
        </div>
      ) : null}

      {step === "event" ? (
        <div className="swap">
          <h2 id="event-title" className="round text-center text-[22px] leading-7 font-black">
            Which event?
          </h2>
          <p className="mx-auto mt-1 mb-4 max-w-[300px] text-center text-[14px] leading-5 text-muted">
            Only for you. {first} won&apos;t see it, and it doesn&apos;t change how {first} filed you.
          </p>
          <div className="group" role="radiogroup" aria-label={`Event for ${first}`}>
            {events.map((event) => (
              <button
                key={event.id}
                type="button"
                role="radio"
                aria-checked={eventId === event.id}
                className="item flush items-center"
                disabled={busy}
                onClick={() => onFile?.(event.id)}
                data-autofocus={eventId === event.id ? true : undefined}
              >
                <DateTile id={event.id} date={event.date} size={40} />
                <span className="t min-w-0 flex-1 truncate">{event.label}</span>
                {eventId === event.id ? <Icon name="check" /> : null}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={!eventId}
              className="item flush items-center"
              disabled={busy}
              onClick={() => onFile?.(null)}
              data-autofocus={!eventId ? true : undefined}
            >
              <span className="app-chip hue-4 !size-10">
                <Icon name="minus" />
              </span>
              <span className="t flex-1">Not in an event</span>
              {!eventId ? <Icon name="check" /> : null}
            </button>
          </div>
          {creating ? (
            <form
              className="swap group mt-2.5 p-1"
              onSubmit={(event) => {
                event.preventDefault();
                if (newName.trim()) onCreateAndFile?.(newName, newDate);
              }}
            >
              <label className="field" htmlFor="sheet-event-name">
                <span className="field-label">New event</span>
                <input
                  id="sheet-event-name"
                  autoFocus
                  value={newName}
                  maxLength={60}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Name"
                  autoComplete="off"
                />
              </label>
              <label className="field border-t-[0.5px] border-line !rounded-none" htmlFor="sheet-event-date">
                <span className="field-label">Day</span>
                <input id="sheet-event-date" type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} />
              </label>
              <button type="submit" className="btn btn-ink m-2 w-[calc(100%-16px)]" disabled={busy || !newName.trim()} aria-busy={busy}>
                Make it and move {first}
              </button>
            </form>
          ) : (
            <button type="button" className="group mt-2.5 flex min-h-[54px] w-full items-center justify-center gap-2 text-[17px] font-semibold" onClick={() => setCreating(true)}>
              <Icon name="plus" />
              New event
            </button>
          )}
          <button type="button" className="btn btn-plain mt-1.5 w-full" onClick={() => (initialStep === "event" ? onClose() : setStep("menu"))}>
            {initialStep === "event" ? "Cancel" : "Back"}
          </button>
        </div>
      ) : null}

      {step === "remove" ? (
        <div className="swap pt-1">
          <h2 id="remove-title" className="round text-center text-[22px] leading-7 font-black">
            Remove {first}?
          </h2>
          <p id="remove-desc" className="mx-auto mt-2 max-w-[300px] text-center text-[15px] leading-[21px] text-muted">
            They won&apos;t be notified. Anything you&apos;ve already shared on WhatsApp or Discord stays there.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button type="button" className="btn btn-lg btn-ink w-full" onClick={onRemove} disabled={busy} aria-busy={busy}>
              Remove
            </button>
            <button ref={keepRef} type="button" className="btn btn-lg btn-fill w-full" onClick={onClose}>
              Keep
            </button>
          </div>
        </div>
      ) : null}

      {step === "block" ? (
        <div className="swap">
          <div className="tile tile-hot mx-auto mt-1 mb-3">
            <Icon name="block" size={28} />
          </div>
          <h2 id="block-title" className="round text-center text-[24px] leading-[30px] font-black">
            Block {first}?
          </h2>
          <ul id="block-consequences" className="group mt-4">
            <li className="item">
              <Icon name="people" />
              <span className="text-[15px] leading-5">You&apos;ll disappear from each other&apos;s lists.</span>
            </li>
            <li className="item">
              <Icon name="block" />
              <span className="text-[15px] leading-5">{first} can&apos;t send you a new request, even by scanning your card.</span>
            </li>
            <li className="item">
              <Icon name="lock" />
              <span className="text-[15px] leading-5">They won&apos;t be told, and nothing shows them it happened.</span>
            </li>
          </ul>
          <p className="mx-1 mt-3 mb-3.5 text-[13px] leading-[18px] text-muted">
            Chats on WhatsApp or Discord aren&apos;t affected. You can block there too. You can unblock later in Your people › Blocked.
          </p>
          <button type="button" className="btn btn-lg btn-hot w-full" onClick={onBlock} disabled={busy} aria-busy={busy}>
            Block {first}
          </button>
          <button ref={cancelRef} type="button" className="btn btn-lg btn-fill mt-2 w-full" onClick={onClose}>
            Cancel
          </button>
        </div>
      ) : null}
    </Sheet>
  );
}
