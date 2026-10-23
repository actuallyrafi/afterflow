"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EventFormSheet, londonToday, StartEventSheet, type EventDraft } from "@/components/event-sheets";
import { CircleButton, Toast, TopBar, useToast } from "@/components/ui/chrome";
import { Icon } from "@/components/ui/icons";
import { Mark } from "@/components/ui/mark";
import { Unavailable } from "@/components/unavailable";
import { api, rememberToken } from "@/lib/api";
import type { EventEditExtras, EventMark, EventsView, EventSummary } from "@/lib/connections";

type EditResponse = EventsView & EventEditExtras & { error?: string };

/** "Thu 22 Oct", or "No date". */
function shortDay(day: string): string {
  if (!day) return "No date";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
}

/** Up to three overlapping single-initial marks. Never a number, never "+N". */
function Marks({ marks }: { marks: EventMark[] }) {
  if (!marks.length) return null;
  return (
    <span className="stack flex-none" aria-hidden="true">
      {marks.slice(0, 3).map((mark) => (
        <Mark key={mark.seed} name={mark.name} seed={mark.seed} size={30} letters={1} />
      ))}
    </span>
  );
}

export default function EventsPage() {
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<EventsView | null>(null);
  const [missing, setMissing] = useState(false);
  const [form, setForm] = useState<{ event: EventSummary | null; startNow: boolean } | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { toast, show, hide } = useToast();

  const load = useCallback(async () => {
    const result = await api<EventsView>(`/api/profiles/${token}/events`);
    if (result.ok && result.data.events) {
      setView(result.data);
      return result.data;
    }
    if (result.status === 404) setMissing(true);
    return null;
  }, [token]);

  useEffect(() => {
    rememberToken(token);
    void load().then((loaded) => {
      const params = new URLSearchParams(window.location.search);
      const editId = params.get("edit");
      const editing = editId ? loaded?.events.find((event) => event.id === editId) : undefined;
      if (editing) setForm({ event: editing, startNow: false });
      else if (params.get("new") === "1") setForm({ event: null, startNow: false });
      if (editId || params.get("new")) window.history.replaceState(null, "", `/m/${token}/events`);
    });
  }, [token, load]);

  async function edit(body: Record<string, unknown>): Promise<EditResponse | null> {
    setBusy(true);
    setError("");
    const result = await api<EditResponse>(`/api/profiles/${token}/events`, { method: "POST", body });
    setBusy(false);
    if (!result.ok || !result.data.events) {
      setError(result.data.error || "Couldn't save that. Try again.");
      return null;
    }
    setView(result.data);
    return result.data;
  }

  async function save(draft: EventDraft) {
    if (form?.event) {
      if (await edit({ action: "rename", eventId: form.event.id, name: draft.name, date: draft.date })) {
        setForm(null);
        show("Event saved.");
      }
      return;
    }
    const startNow = form?.startNow ?? false;
    if (await edit({ action: "create", name: draft.name, date: draft.date, startNow })) {
      setForm(null);
      show(startNow ? `You're at ${draft.name}. New people go there.` : "Event added.");
    }
  }

  async function turnOn() {
    const events = view?.events ?? [];
    const today = events.find((event) => event.date === londonToday());
    if (today) {
      if (await edit({ action: "start", eventId: today.id })) show(`New people go into ${today.label}.`);
      return;
    }
    if (events.length) setPicking(true);
    else setForm({ event: null, startNow: true });
  }

  async function turnOff() {
    if (await edit({ action: "end" })) show("Stopped. New people won't be filed.");
  }

  if (missing) return <Unavailable />;

  const current = view?.current ?? null;
  const events = view?.events ?? [];

  return (
    <main className="shell page-top">
      <TopBar right={<CircleButton icon="plus" label="New event" onClick={() => setForm({ event: null, startNow: false })} />} />
      <h1 className="t-display">Events</h1>
      <p className="mt-1.5 mb-[18px] text-[15px] leading-[21px] text-muted">
        Only you see these. They just help you remember where you met people.
      </p>

      {!view ? (
        <div aria-busy="true">
          <div className="skeleton h-[76px] w-full rounded-[22px]" />
          <div className="skeleton mt-3.5 h-[160px] w-full rounded-[22px]" />
        </div>
      ) : (
        <>
          <div className="group">
            <div className="item flush items-center">
              <span className={`grid size-10 flex-none place-items-center rounded-[40%] ${current ? "bg-live-tint text-live-deep" : "bg-fill text-muted"}`}>
                <Icon name="pin" />
              </span>
              <span className="min-w-0 flex-1">
                <span id="now-label" className="t block">
                  I&apos;m at an event now
                </span>
                <span id="now-help" className="s block">
                  {current ? "Turns itself off at 4am." : "New people go into the event you pick."}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(current)}
                aria-labelledby="now-label"
                aria-describedby="now-help"
                className="toggle live-on"
                disabled={busy}
                onClick={() => void (current ? turnOff() : turnOn())}
              />
            </div>
            {current ? (
              <div className="item flush items-center">
                <span className="min-w-0 flex-1">
                  <span className="s block">New people go into</span>
                  <span className="t block truncate font-bold">{current.label}</span>
                </span>
                <button type="button" className="btn btn-sm btn-fill" onClick={() => setPicking(true)}>
                  Change
                </button>
              </div>
            ) : null}
          </div>

          {events.length ? (
            <>
              <h2 className="tag mx-4 mt-6 mb-2">Your events</h2>
              <ul className="group">
                {events.map((event) => {
                  const here = current?.eventId === event.id;
                  return (
                    <li key={event.id} className="row !min-h-[68px] !p-0">
                      <Link
                        href={`/m/${token}?event=${encodeURIComponent(event.id)}`}
                        className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4"
                        aria-label={`${event.name}, ${shortDay(event.date)}${here ? ", you're here now" : event.empty ? ", nobody yet" : ""}. Show these people.`}
                      >
                        <span className="row-main min-w-0 flex-1">
                          <span className="t-name block truncate">{event.name}</span>
                          <span className="row-line block">
                            {shortDay(event.date)}
                            {here ? (
                              <>
                                {" · "}
                                <span className="font-bold text-live-deep">you&apos;re here now</span>
                              </>
                            ) : event.empty ? (
                              " · nobody yet"
                            ) : null}
                          </span>
                        </span>
                        <Marks marks={event.marks} />
                      </Link>
                      {!event.empty ? (
                        <Link
                          href={`/m/${token}/recap/${encodeURIComponent(event.id)}`}
                          className="btn btn-sm btn-fill ml-2 flex-none"
                          aria-label={`Recap for ${event.name}`}
                        >
                          Recap
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="grid size-11 flex-none place-items-center text-muted"
                        aria-label={`Edit ${event.name}`}
                        onClick={() => setForm({ event, startNow: false })}
                      >
                        <Icon name="chev" className="chev" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {!view.unfiled.empty ? (
                <ul className="group mt-3.5">
                  <li className="row !min-h-[60px] !p-0">
                    <Link href={`/m/${token}?event=none`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 pl-4">
                      <span className="row-main min-w-0 flex-1">
                        <span className="t-name block">No event</span>
                        <span className="row-line block">People you haven&apos;t filed</span>
                      </span>
                      <Marks marks={view.unfiled.marks} />
                      <Icon name="chev" className="chev" />
                    </Link>
                  </li>
                </ul>
              ) : null}
            </>
          ) : (
            <div className="panel mt-6 px-5 py-7 text-center">
              <p className="round text-[20px] leading-6 font-extrabold">No events yet</p>
              <p className="mx-auto mt-1.5 max-w-[300px] text-[15px] leading-[21px] text-muted">
                Add one when you&apos;re heading out. Anyone you meet there gets filed under it, so you remember where you met.
              </p>
              <button type="button" className="btn btn-ink mt-4" onClick={() => setForm({ event: null, startNow: false })}>
                <Icon name="plus" />
                New event
              </button>
              <p className="mt-3 text-[13px] text-muted">Only you see your events.</p>
            </div>
          )}
        </>
      )}

      <EventFormSheet
        open={Boolean(form)}
        onClose={() => {
          setForm(null);
          setError("");
        }}
        event={form?.event ?? null}
        defaultDate={form?.startNow ? londonToday() : ""}
        busy={busy}
        error={error}
        onSave={(draft) => void save(draft)}
        onDelete={
          form?.event
            ? async () => {
                const name = form.event?.name ?? "";
                const done = await edit({ action: "delete", eventId: form.event?.id });
                if (!done) return;
                setForm(null);
                const deleted = done.deleted;
                show(`Event deleted. '${name}' people are now under No event`, {
                  ms: 8000,
                  undo: deleted
                    ? async () => {
                        if (await edit({ action: "restore", event: deleted.event, connectionIds: deleted.connectionIds })) show(`${name} is back.`);
                      }
                    : undefined,
                });
              }
            : undefined
        }
      />
      <StartEventSheet
        open={picking}
        onClose={() => setPicking(false)}
        events={events}
        busy={busy}
        onNew={() => {
          setPicking(false);
          setForm({ event: null, startNow: true });
        }}
        onStart={async (eventId) => {
          const done = await edit({ action: "start", eventId });
          setPicking(false);
          const label = done?.current?.label;
          if (label) show(`New people go into ${label}.`);
        }}
      />
      <Toast toast={toast} onDone={hide} />
    </main>
  );
}
