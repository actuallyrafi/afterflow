"use client";

import { DemoTag } from "@/components/ui/demo-tag";
import { useEffect, useRef, useState } from "react";
import type { EventSummary } from "@/lib/connections";
import { firstOf } from "@/lib/handoff";
import { londonToday } from "./event-sheets";
import { Sheet } from "./ui/chrome";
import { Icon } from "./ui/icons";
import { Mark } from "./ui/mark";

export type Step = "menu" | "remove" | "block" | "event";

/** "Thu 22 Oct", or "No date". */
function shortDay(day: string): string {
  if (!day) return "No date";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
}

/**
 * Move to event, Mute, Remove, Block (Block last and red). All quiet: the other person is never told.
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
  events = [],
  eventId = null,
  onMove,
  onCreateEvent,
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
  events?: EventSummary[];
  eventId?: string | null;
  /** Move them: an event id, or null for No event. */
  onMove?: (eventId: string | null) => void;
  /** Make a new event; resolves to its id (it gets selected), or null with an error. */
  onCreateEvent?: (name: string, date: string) => Promise<string | null>;
  initialStep?: Step;
}) {
  const [step, setStep] = useState<Step>("menu");
  const [choice, setChoice] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const current = events.find((event) => event.id === eventId) ?? null;

  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setChoice(eventId ?? "");
    }
  }, [open, initialStep, eventId]);
  const first = firstOf(name);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      const timer = window.setTimeout(() => {
        setStep("menu");
        setCreating(false);
        setNewName("");
        setCreateError("");
      }, 260);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    // D30: a new step moves focus to the sheet itself (no unasked-for ring); Tab reaches the safe choice first.
    if (step === "block") cancelRef.current?.closest("dialog")?.focus({ preventScroll: true });
    if (step === "remove") keepRef.current?.closest("dialog")?.focus({ preventScroll: true });
  }, [step]);

  async function create() {
    if (!newName.trim() || !onCreateEvent) return;
    setCreateError("");
    const id = await onCreateEvent(newName.trim(), newDate || londonToday());
    if (!id) {
      setCreateError("Couldn't make that event. Try another name.");
      return;
    }
    setChoice(id);
    setCreating(false);
    setNewName("");
  }

  const options = [...events.map((event) => ({ id: event.id, name: event.name, sub: shortDay(event.date) })), { id: "", name: "No event", sub: "" }];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      role={step === "block" ? "alertdialog" : "dialog"}
      labelledBy={step === "block" ? "block-title" : step === "remove" ? "remove-title" : step === "event" ? "event-title" : "sheet-title"}
      describedBy={step === "block" ? "block-consequences" : step === "remove" ? "remove-desc" : step === "event" ? "event-desc" : undefined}
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
              {onMove ? <p className="text-[14px] text-muted">{current ? current.label : "No event"}</p> : null}
            </div>
          </div>
          <div className="group">
            {onMove ? (
              <button type="button" className="item" onClick={() => setStep("event")} disabled={busy}>
                <Icon name="folder" />
                <span>
                  <span className="t block">Move to event</span>
                  <span className="s block">Only you see where {first} is filed.</span>
                </span>
              </button>
            ) : null}
            <button type="button" className="item" onClick={onMute} disabled={busy}>
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
                <span className="s block">{first} leaves your list. They won&apos;t be told.</span>
              </span>
            </button>
            <button type="button" className="item hot" onClick={() => setStep("block")} disabled={busy}>
              <Icon name="block" />
              <span>
                <span className="t block">Block {first}</span>
                <span className="s block">You both disappear from each other, for good.</span>
              </span>
            </button>
          </div>
          <button type="button" className="group mt-2.5 block min-h-[54px] w-full text-[17px] font-semibold" onClick={onClose}>
            Cancel
          </button>
        </div>
      ) : null}

      {step === "event" ? (
        <div className="swap">
          <div className="mb-3.5 flex items-center gap-3">
            <Mark name={name} seed={seed} size={56} state={muted ? "muted" : undefined} />
            <div className="min-w-0">
              <h2 id="event-title" className="round truncate text-[20px] leading-6 font-black">
                Move {first} to…
              </h2>
              <p id="event-desc" className="text-[14px] leading-5 text-muted">
                Only changes your list. {first} won&apos;t see it.
              </p>
            </div>
          </div>
          <div className="group max-h-[42vh] overflow-y-auto" role="radiogroup" aria-label={`Move ${first} to`}>
            {options.map((option) => (
              <button
                key={option.id || "none"}
                type="button"
                role="radio"
                aria-checked={choice === option.id}
                className="item flush items-center"
                disabled={busy}
                onClick={() => setChoice(option.id)}
               
              >
                <span className="radio" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-left">
                  <span className={`t block truncate ${option.id ? "" : "text-muted"}`}>{option.name}</span>
                  {option.sub ? <span className="s block">{option.sub}</span> : null}
                </span>
              </button>
            ))}
          </div>
          {creating ? (
            <form
              className="swap group mt-2.5"
              onSubmit={(event) => {
                event.preventDefault();
                void create();
              }}
              noValidate
            >
              <label className={`field !rounded-none ${createError ? "invalid" : ""}`} htmlFor="sheet-event-name">
                <span className="field-label">Name</span>
                <input
                  id="sheet-event-name"
                  autoFocus
                  value={newName}
                  maxLength={60}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="e.g. Climbing social"
                  autoComplete="off"
                  enterKeyHint="done"
                />
              </label>
              <label className="field !rounded-none border-t-[0.5px] border-line" htmlFor="sheet-event-date">
                <span className="field-label">Date · optional</span>
                <input id="sheet-event-date" type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} />
              </label>
              {createError ? (
                <p role="alert" className="mx-4 mt-1 flex items-center gap-1.5 text-[14px] text-hot">
                  <Icon name="alert" size={16} />
                  {createError}
                </p>
              ) : null}
              <div className="flex gap-2 p-2">
                <button type="button" className="btn btn-fill flex-1" onClick={() => setCreating(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-ink flex-1" disabled={busy || !newName.trim()} aria-busy={busy}>
                  Add event
                </button>
              </div>
            </form>
          ) : onCreateEvent ? (
            <button
              type="button"
              className="group mt-2.5 flex min-h-[54px] w-full items-center gap-3 px-4 text-[17px]"
              onClick={() => {
                setNewDate(londonToday());
                setCreating(true);
              }}
            >
              <Icon name="plus" />
              New event…
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-lg btn-ink mt-3 w-full"
            disabled={busy || creating}
            aria-busy={busy}
            onClick={() => (choice === (eventId ?? "") ? onClose() : onMove?.(choice || null))}
          >
            Move {first}
          </button>
          <button type="button" className="btn btn-plain mt-1 w-full" onClick={() => (initialStep === "event" ? onClose() : setStep("menu"))}>
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
