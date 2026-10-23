"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LinkRow, OnceNotice, dayLabel } from "@/components/organiser";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/chrome";
import type { EventSummary } from "@/lib/organiser";
import { MASTER_KEY, eventKeyName, joinUrl, orgFetch, organiserUrl, readSession, writeSession } from "@/lib/organiser-client";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

/**
 * v4.1h organiser landing (master code). Make an event in one step and get its attendee join link and
 * the private organiser link to send to that event's organiser. Totals live on each event's page.
 */
export default function OrganiserHome() {
  const [code, setCode] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ event: EventSummary; key: string } | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    setDate(today());
    const saved = readSession(MASTER_KEY);
    if (saved) {
      setCode(saved);
      setReady(true);
    }
  }, []);

  const load = useCallback(async (master: string) => {
    const result = await orgFetch<{ events: EventSummary[] }>("/api/organiser", { master });
    if (!result.ok) {
      setError(result.data.error || "That link or code doesn't work.");
      setReady(false);
      writeSession(MASTER_KEY, "");
      return;
    }
    setError("");
    setEvents(result.data.events);
  }, []);

  useEffect(() => {
    if (ready && code) void load(code);
  }, [ready, code, load]);

  async function create() {
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await orgFetch<{ event: EventSummary; key: string }>("/api/organiser", { master: code }, { action: "create", name, date });
    setBusy(false);
    if (!result.ok) {
      setError(result.data.error || "Couldn't make the event. Try again.");
      return;
    }
    // This tab can open the event straight away; the link itself is shown once below.
    writeSession(eventKeyName(result.data.event.id), result.data.key);
    setMade(result.data);
    setName("");
    void load(code);
  }

  return (
    <main className="shell page-top pb-16">
      <Link href="/" className="pill plate">
        Afterflow
      </Link>
      <h1 className="t-display mt-4">Organiser</h1>
      <p className="mt-2 text-[15px] text-muted">
        Totals only. Nothing here is per person, and nobody is ranked. Cards stay until people delete them.
      </p>
      {!ready ? (
        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            writeSession(MASTER_KEY, code);
            setReady(true);
            setError("");
          }}
        >
          <p className="text-[15px] leading-[21px]">
            Got an organiser link for one event? Just open it. This page is for making events, with the master code.
          </p>
          <label className="field" htmlFor="passcode">
            <span className="field-label">Master code</span>
            <input id="passcode" type="password" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} />
          </label>
          {error ? (
            <p role="alert" className="text-[14px] text-hot">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-lg btn-ink w-full" disabled={!code}>
            Open
          </button>
        </form>
      ) : made ? (
        <section className="mt-6" aria-labelledby="made-title" id="event-made">
          <div className="tile tile-ok size-[52px]">
            <Icon name="check" size={26} />
          </div>
          <h2 id="made-title" className="round mt-3 text-[24px] leading-7 font-black">
            {made.event.name} is ready
          </h2>
          <p className="mt-1 text-[15px] text-muted">{dayLabel(made.event)}</p>
          <div className="group mt-4">
            <LinkRow id="join-link" label="Attendee link" url={joinUrl(origin, made.event.id)} hint="Share it or show it as a QR at the door. People join this event when they make or open their card." />
          </div>
          <div className="group mt-3">
            <LinkRow id="organiser-link" label="Private organiser link" url={organiserUrl(origin, made.event.id, made.key)} hint="Opens this event's totals. Only this event." />
          </div>
          <OnceNotice />
          <Link href={`/organiser/${made.event.id}`} className="btn btn-lg btn-ink mt-4 w-full">
            Open the event&apos;s page
          </Link>
          <button type="button" className="btn btn-lg btn-plain-ink mt-1 w-full" onClick={() => setMade(null)}>
            Done
          </button>
        </section>
      ) : (
        <div className="mt-6">
          <form
            className="panel p-4"
            aria-labelledby="new-event-title"
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <h2 id="new-event-title" className="round text-[20px] leading-6 font-black">
              New event
            </h2>
            <p className="mt-1 text-[14px] leading-5 text-muted">You&apos;ll get the attendee link and a private organiser link in one go.</p>
            <label className="field !bg-[var(--fill)] mt-3" htmlFor="event-name">
              <span className="field-label">Name</span>
              <input id="event-name" value={name} maxLength={60} autoComplete="off" onChange={(event) => setName(event.target.value)} placeholder="Builders' Breakfast" />
            </label>
            <label className="field !bg-[var(--fill)] mt-2" htmlFor="event-date">
              <span className="field-label">Day</span>
              <input id="event-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            {error ? (
              <p role="alert" className="mt-2 text-[14px] text-hot">
                {error}
              </p>
            ) : null}
            <button type="submit" className="btn btn-lg btn-ink mt-3 w-full" disabled={!name.trim() || busy} aria-busy={busy}>
              {busy ? <Spinner /> : null}
              Make event and links
            </button>
          </form>
          <h2 className="tag mx-4 mt-8 mb-2">Events</h2>
          <ul className="group" aria-label="Events">
            {events === null ? (
              <li className="item flush">
                <span className="s">Loading…</span>
              </li>
            ) : (
              events.map((event) => (
                <li key={event.id}>
                  <Link href={`/organiser/${event.id}`} className="item flush items-center">
                    <span className="min-w-0 flex-1">
                      <span className="t block truncate">{event.name}</span>
                      <span className="s block">
                        {dayLabel(event)} · {event.hasLink ? "Organiser link made" : "No organiser link yet"}
                      </span>
                    </span>
                    <Icon name="chev" size={18} className="text-faint" />
                  </Link>
                </li>
              ))
            )}
          </ul>
          <p className="mx-4 mt-2 text-[13px] leading-[18px] text-muted">Each event&apos;s organiser sees only that event. Open one to see its totals.</p>
        </div>
      )}
    </main>
  );
}
