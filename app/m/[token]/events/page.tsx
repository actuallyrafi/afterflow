"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DateTile, EventFormSheet, longDate, StartEventSheet, untilLabel, type EventDraft } from "@/components/event-sheets";
import { Toast, TopBar, useToast } from "@/components/ui/chrome";
import { Icon } from "@/components/ui/icons";
import { Unavailable } from "@/components/unavailable";
import { api, rememberToken } from "@/lib/api";
import type { EventsView, EventSummary } from "@/lib/connections";

function peopleLabel(n: number): string {
  return n === 1 ? "1 person" : `${n} people`;
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
    if (result.ok && result.data.events) setView(result.data);
    else if (result.status === 404) setMissing(true);
  }, [token]);

  useEffect(() => {
    rememberToken(token);
    void load();
    if (new URLSearchParams(window.location.search).get("new") === "1") setForm({ event: null, startNow: false });
  }, [token, load]);

  async function edit(body: Record<string, unknown>): Promise<(EventsView & { eventId?: string }) | null> {
    setBusy(true);
    setError("");
    const result = await api<EventsView & { eventId?: string }>(`/api/profiles/${token}/events`, { method: "POST", body });
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
      const done = await edit({ action: "rename", eventId: form.event.id, name: draft.name, date: draft.date });
      if (done) {
        setForm(null);
        show("Event saved");
      }
      return;
    }
    const done = await edit({ action: "create", name: draft.name, date: draft.date, startNow: draft.startNow });
    if (done) {
      setForm(null);
      show(draft.startNow ? "You're at the event. New people go there." : "Event made");
    }
  }

  if (missing) return <Unavailable />;

  const current = view?.current ?? null;
  const events = view?.events ?? [];

  return (
    <main className="shell page-top">
      <TopBar />
      <div className="flex items-center justify-between gap-3">
        <h1 className="t-display">Events</h1>
        <button type="button" aria-label="New event" className="btn btn-fill btn-icon bg-panel" onClick={() => setForm({ event: null, startNow: false })}>
          <Icon name="plus" size={22} />
        </button>
      </div>
      <p className="mt-1.5 mb-[18px] text-[15px] leading-[21px] text-muted">Where you met people. Only you see these.</p>

      {!view ? (
        <div aria-busy="true">
          <div className="skeleton h-[76px] w-full rounded-[22px]" />
          <div className="skeleton mt-3.5 h-[160px] w-full rounded-[22px]" />
        </div>
      ) : (
        <>
          {current ? (
            <section className="panel p-4" aria-labelledby="now-title">
              <div className="flex items-center gap-3">
                <span className="app-chip hue-3 !size-10">
                  <Icon name="pin" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="now-title" className="t-name truncate">
                    At {current.label}
                  </h2>
                  <p className="text-[14px] leading-5 text-muted">New people are filed here {untilLabel(current.until)}.</p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-fill mt-3 w-full"
                disabled={busy}
                onClick={async () => {
                  if (await edit({ action: "end" })) show("Ended. New people won't be filed.");
                }}
              >
                I&apos;ve left
              </button>
            </section>
          ) : (
            <div className="group">
              <div className="item flush items-center">
                <span className="flex-1">
                  <span id="now-label" className="t block">
                    I&apos;m at an event now
                  </span>
                  <span id="now-help" className="s block">
                    For 24 hours, people you connect with are filed under it.
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={false}
                  aria-labelledby="now-label"
                  aria-describedby="now-help"
                  className="toggle"
                  onClick={() => (events.length ? setPicking(true) : setForm({ event: null, startNow: true }))}
                />
              </div>
            </div>
          )}

          <h2 className="tag mx-4 mt-6 mb-2">Your events</h2>
          {events.length ? (
            <ul className="group">
              {events.map((event) => (
                <li key={event.id} className="row !min-h-[72px] !p-0">
                  <Link href={`/m/${token}?event=${encodeURIComponent(event.id)}`} className="flex min-w-0 flex-1 items-center gap-3.5 py-3 pl-4">
                    <DateTile id={event.id} date={event.date} />
                    <span className="row-main min-w-0 flex-1">
                      <span className="t-name block truncate">{event.name}</span>
                      <span className="row-line block">
                        {longDate(event.date)} · {peopleLabel(event.people)}
                        {current?.eventId === event.id ? " · Now" : ""}
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="circle mr-2 flex-none text-muted"
                    aria-label={`Edit ${event.name}`}
                    onClick={() => setForm({ event, startNow: false })}
                  >
                    <Icon name="more" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="panel px-5 py-7 text-center">
              <p className="round text-[20px] leading-6 font-extrabold">No events yet.</p>
              <p className="mx-auto mt-1.5 max-w-[290px] text-[15px] leading-[21px] text-muted">
                Make one for the next meetup, or turn on &ldquo;I&apos;m at an event now&rdquo; when you get there.
              </p>
              <button type="button" className="btn btn-ink mt-4" onClick={() => setForm({ event: null, startNow: false })}>
                <Icon name="plus" />
                New event
              </button>
            </div>
          )}
          <p className="mx-4 mt-3 text-[13px] leading-[18px] text-muted">
            Open an event to see the people you met there. Move someone from their page, under Event.
          </p>
        </>
      )}

      <EventFormSheet
        open={Boolean(form)}
        onClose={() => {
          setForm(null);
          setError("");
        }}
        event={form?.event ?? null}
        startNowDefault={form?.startNow ?? false}
        busy={busy}
        error={error}
        onSave={(draft) => void save(draft)}
        onDelete={
          form?.event
            ? async () => {
                const name = form.event?.name ?? "";
                if (await edit({ action: "delete", eventId: form.event?.id })) {
                  setForm(null);
                  show(`Deleted ${name}. Everyone's still in Your people.`);
                }
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
          if (done) show("You're at the event. New people go there.");
        }}
      />
      <Toast toast={toast} onDone={hide} />
    </main>
  );
}
