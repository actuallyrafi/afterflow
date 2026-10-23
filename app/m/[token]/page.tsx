"use client";

import { DemoTag } from "@/components/ui/demo-tag";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EventMenu, filterLabel, type EventFilter } from "@/components/event-menu";
import { CircleButton, Sheet, takeToast, Toast, TopBar, useToast } from "@/components/ui/chrome";
import { Icon } from "@/components/ui/icons";
import { RecapCardView } from "@/components/recap";
import { recapCard, RECAP_COPY } from "@/lib/recap";
import { hueOf, Mark } from "@/components/ui/mark";
import { Unavailable } from "@/components/unavailable";
import { api, rememberToken } from "@/lib/api";
import type { ConnectionCard, HomeResult, PersonCard } from "@/lib/connections";
import { firstOf } from "@/lib/handoff";

export default function YourPeople() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [home, setHome] = useState<HomeResult | null>(null);
  const [missing, setMissing] = useState(false);
  const [settings, setSettings] = useState(false);
  const [adding, setAdding] = useState(false);
  const [reminder, setReminder] = useState<HomeResult["reminder"]>(null);
  const [filter, setFilter] = useState<EventFilter>("all");
  const { toast, show, hide } = useToast();

  const [chosen, setChosen] = useState(false);
  const [settingsStep, setSettingsStep] = useState<"menu" | "privacy" | "help">("menu");
  const filterKey = `afterflow.filter.${token}`;

  // The filter lasts for the session (resets on the next launch). ?event=… from the Events tab wins.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("event");
    let fromSession: string | null = null;
    try {
      fromSession = sessionStorage.getItem(filterKey);
    } catch {
      // No storage: start at All events.
    }
    const value = fromUrl || fromSession;
    if (value) {
      setFilter(value);
      setChosen(true);
    }
  }, [filterKey]);

  // While you're at an event, Your people opens on it (unless you picked something this session).
  const liveId = home?.events.current?.eventId ?? null;
  useEffect(() => {
    if (liveId && !chosen) setFilter(liveId);
  }, [liveId, chosen]);

  function chooseFilter(next: EventFilter) {
    setFilter(next);
    setChosen(true);
    try {
      sessionStorage.setItem(filterKey, next);
    } catch {
      // Fine.
    }
    const url = next === "all" ? `/m/${token}` : `/m/${token}?event=${encodeURIComponent(next)}`;
    window.history.replaceState(null, "", url);
  }

  async function turnOff() {
    const result = await api(`/api/profiles/${token}/events`, { method: "POST", body: { action: "end" } });
    if (result.ok) {
      show("Stopped. New people won't be filed.");
      await load();
    } else show("Couldn't turn it off. Try again.");
  }

  // v4.1d: the next-morning recap card (D23). Worked out on this device, in this device's time zone.
  const [hiddenNow, setHiddenNow] = useState<string[]>([]);
  const recap =
    home
      ? recapCard({
          now: Date.now(),
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
          connections: home.connections,
          events: { ...home.events, recapHidden: [...(home.events.recapHidden ?? []), ...hiddenNow] },
        })
      : null;

  async function hideRecap(eventId: string) {
    setHiddenNow((current) => [...current, eventId]);
    const result = await api(`/api/profiles/${token}/events`, { method: "POST", body: { action: "recap_hide", eventId } });
    if (!result.ok) {
      setHiddenNow((current) => current.filter((id) => id !== eventId));
      show("Couldn't save that. Try again.");
      return;
    }
    show(RECAP_COPY.hiddenToast, {
      undo: async () => {
        await api(`/api/profiles/${token}/events`, { method: "POST", body: { action: "recap_show", eventId } });
        setHiddenNow((current) => current.filter((id) => id !== eventId));
        await load();
      },
    });
    await load();
  }

  const load = useCallback(async () => {
    const result = await api<HomeResult>(`/api/profiles/${token}`);
    if (result.ok && result.data.profile) {
      setHome(result.data);
      setMissing(false);
      // The one reminder is served once; keep it on screen until it's answered.
      if (result.data.reminder) setReminder(result.data.reminder);
    } else if (result.status === 404) {
      setMissing(true);
    }
  }, [token]);

  useEffect(() => {
    rememberToken(token);
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [token, load]);

  useEffect(() => {
    const pending = takeToast();
    if (!pending) return;
    show(pending.text, {
      ms: pending.ms,
      undo:
        pending.action && pending.connectionId
          ? async () => {
              await api(`/api/profiles/${token}/connections/${pending.connectionId}`, {
                method: "POST",
                body: { action: pending.action },
              });
              await load();
            }
          : undefined,
    });
  }, [token, show, load]);

  async function dismissReminder(goTo?: string) {
    if (!reminder) return;
    const id = reminder.connectionId;
    setReminder(null);
    await api(`/api/profiles/${token}/connections/${id}`, { method: "POST", body: { action: "reminder_done" } });
    if (goTo) router.push(goTo);
  }

  if (missing) return <Unavailable />;

  const events = home?.events.events ?? [];
  // A filter for an event that was deleted elsewhere falls back to everyone.
  const activeFilter = filter === "all" || filter === "none" || events.some((event) => event.id === filter) || !home ? filter : "all";
  const shown =
    home?.connections.filter((item) =>
      activeFilter === "all" ? true : activeFilter === "none" ? !item.eventId : item.eventId === activeFilter,
    ) ?? [];
  const waiting = shown.filter((item) => !item.mutual);
  const people = shown.filter((item) => item.mutual);
  const me = home?.profile;
  const current = home?.events.current ?? null;

  return (
    <main className="shell page-top pb-28">
      <TopBar
        wideRight
        right={
          <>
            <CircleButton icon="plus" label="Add someone" onClick={() => setAdding(true)} />
            <CircleButton
              icon="more"
              label="Your people settings"
              onClick={() => {
                setSettingsStep("menu");
                setSettings(true);
              }}
            />
          </>
        }
      />

      <h1 className="t-display">Your people</h1>
      <div className="mt-3 mb-3 flex flex-wrap items-center gap-2">
        {home ? (
          <EventMenu token={token} events={events} showNone={!home.events.unfiled.empty} value={activeFilter} onChange={chooseFilter} />
        ) : (
          <div className="skeleton h-[38px] w-36 rounded-full" />
        )}
        {activeFilter !== "all" && activeFilter !== "none" ? (
          <Link href={`/m/${token}/events?edit=${encodeURIComponent(activeFilter)}`} className="btn btn-sm btn-plain-ink">
            Edit event
          </Link>
        ) : null}
        {me?.isDemo ? <DemoTag /> : null}
      </div>
      {current ? (
        <div role="status" className="live mb-3">
          <span className="dot" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            At {current.name} now · new people go here
          </span>
          <button type="button" className="btn btn-sm" onClick={() => void turnOff()}>
            Turn off
          </button>
        </div>
      ) : null}


      {!home ? (
        <div aria-busy="true" className="panel p-4">
          {[0, 1, 2].map((key) => (
            <div key={key} className="flex items-center gap-3.5 py-3">
              <div className="skeleton size-12 rounded-[40%]" />
              <div className="flex-1">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton mt-2 h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {recap ? <RecapCardView token={token} card={recap} onHide={() => void hideRecap(recap.eventId)} /> : null}

      {reminder ? (
        <section className="panel mb-3 p-4" aria-label="A gentle reminder">
          <p className="text-[16px] leading-[22px]">Thinking of saying hi to {reminder.name}? Your message is ready.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn btn-ink flex-1" onClick={() => void dismissReminder(`/m/${token}/c/${reminder.connectionId}`)}>
              Say hi
            </button>
            <button type="button" className="btn btn-fill flex-1" onClick={() => void dismissReminder()}>
              Not now
            </button>
          </div>
        </section>
      ) : null}

      {waiting.length ? (
        <ul className="panel mb-3">
          {waiting.map((item) => (
            <li key={item.id}>
              <PendingRow token={token} item={item} />
            </li>
          ))}
        </ul>
      ) : null}

      {people.length ? (
        <ul className="panel">
          {people.map((item) => (
            <li key={item.id}>
              <PersonRow token={token} item={item} />
            </li>
          ))}
        </ul>
      ) : null}

      {home && home.connections.length && !shown.length ? (
        <div className="panel px-5 py-7 text-center">
          {activeFilter === "none" ? (
            <p className="mx-auto max-w-[290px] text-[15px] leading-[21px] text-muted">Everyone&apos;s filed under an event.</p>
          ) : (
            <>
              <p className="round text-[20px] leading-6 font-extrabold">Nobody here yet</p>
              <p className="mx-auto mt-1.5 max-w-[290px] text-[15px] leading-[21px] text-muted">
                When you meet someone at {events.find((event) => event.id === activeFilter)?.name ?? filterLabel(activeFilter, events)},
                they&apos;ll show up here.
              </p>
            </>
          )}
          <button type="button" className="btn btn-fill mt-4" onClick={() => chooseFilter("all")}>
            Show all events
          </button>
        </div>
      ) : null}

      {home && !home.connections.length ? (
        <div className="panel px-5 py-7 text-center">
          <p className="round text-[20px] leading-6 font-extrabold">No one here yet.</p>
          <p className="mx-auto mt-1.5 max-w-[280px] text-[15px] leading-[21px] text-muted">
            When you meet someone, show them your card.
          </p>
          <Link href={`/m/${token}/card`} className="btn btn-ink mt-4">
            <Icon name="qr" />
            Show my card
          </Link>
        </div>
      ) : null}

      <Sheet open={settings} onClose={() => setSettings(false)} labelledBy="settings-title">
        {settingsStep === "menu" ? (
          <div className="swap">
            <h2 id="settings-title" className="round mb-3.5 text-center text-[20px] font-black">
              Your people
            </h2>
            <div className="group">
              <Link href={`/m/${token}/settings/blocked`} className="item flush items-center" data-autofocus>
                <span className="t flex-1">Blocked</span>
                <Icon name="chev" className="chev" />
              </Link>
              <button type="button" className="item flush items-center" onClick={() => setSettingsStep("privacy")}>
                <span className="t flex-1">Privacy and your data</span>
                <Icon name="chev" className="chev" />
              </button>
              <button type="button" className="item flush items-center" onClick={() => setSettingsStep("help")}>
                <span className="t flex-1">Help and feedback</span>
                <Icon name="chev" className="chev" />
              </button>
            </div>
            <button type="button" className="group mt-2.5 block min-h-[54px] w-full text-[17px] font-semibold" onClick={() => setSettings(false)}>
              Cancel
            </button>
            <p className="mt-3 text-center text-[12px] text-muted">Only you see your list.</p>
          </div>
        ) : settingsStep === "privacy" ? (
          <div className="swap">
            <h2 id="settings-title" className="round mb-3 text-center text-[20px] font-black">
              Privacy and your data
            </h2>
            <ul className="group">
              {[
                "Your card: your name, your answer and the ways to reach you.",
                "Your contacts only show to people you both said you met.",
                "Your notes, events, mutes and Talked again marks are only yours.",
                "No feed, no public profile, no counts. Afterflow doesn't read your chats.",
                "You can delete your card anytime, from the Danger zone at the bottom of My card.",
              ].map((line) => (
                <li key={line} className="item flush">
                  <span className="text-[15px] leading-5">{line}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-plain mt-1.5 w-full" onClick={() => setSettingsStep("menu")} data-autofocus>
              Back
            </button>
          </div>
        ) : (
          <div className="swap">
            <h2 id="settings-title" className="round mb-3 text-center text-[20px] font-black">
              Help and feedback
            </h2>
            <ul className="group">
              {[
                "Met someone? Show them My card, or scan theirs with your camera.",
                "You both say yes before either of you sees how to reach the other.",
                "Say hi opens the app you already use. Afterflow is the connector, not the chat.",
              ].map((line) => (
                <li key={line} className="item flush">
                  <span className="text-[15px] leading-5">{line}</span>
                </li>
              ))}
            </ul>
            <a
              href="https://github.com/actuallyrafi/afterflow/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-2.5 flex min-h-[54px] w-full items-center justify-center gap-2 text-[17px] font-semibold"
            >
              Send feedback
              <Icon name="external" size={18} />
            </a>
            <button type="button" className="btn btn-plain mt-1.5 w-full" onClick={() => setSettingsStep("menu")} data-autofocus>
              Back
            </button>
          </div>
        )}
      </Sheet>

      <AddSomeone token={token} open={adding} onClose={() => setAdding(false)} />
      <Toast toast={toast} onDone={hide} />
    </main>
  );
}

function PendingRow({ token, item }: { token: string; item: ConnectionCard }) {
  const first = firstOf(item.other.name);
  return (
    <Link href={`/m/${token}/c/${item.id}`} className="row rounded-[28px]">
      <Mark name={item.other.name} seed={item.other.publicId} size={48} state="pending" />
      <span className="row-main">
        <span className="t-name block truncate">
          {item.other.name}
          {item.other.isDemo ? <DemoTag /> : null}
        </span>
        <span className="row-line block">
          {item.status === "waiting_for_you" ? "Did you meet? Say yes when you're ready" : `Waiting for ${first} to say yes`}
        </span>
      </span>
      <span className={`pill hue hue-${hueOf(item.other.publicId)}`}>Waiting</span>
    </Link>
  );
}

function PersonRow({ token, item }: { token: string; item: ConnectionCard }) {
  return (
    <Link href={`/m/${token}/c/${item.id}`} className="row">
      <Mark name={item.other.name} seed={item.other.publicId} size={48} state={item.muted ? "muted" : undefined} />
      <span className="row-main">
        <span className="t-name block truncate">
          {item.other.name}
          {item.other.isDemo ? <DemoTag /> : null}
        </span>
        <span className="row-line block">{item.other.answer ? `“${item.other.answer}”` : "Met at the hackathon"}</span>
      </span>
      {item.muted ? <span className="pill">Muted</span> : <Icon name="chev" className="chev" />}
    </Link>
  );
}

function AddSomeone({ token, open, onClose }: { token: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonCard[]>([]);
  const [picked, setPicked] = useState<PersonCard | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setPicked(null);
      setNote("");
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const result = await api<{ people: PersonCard[] }>(`/api/profiles/${token}/people?q=${encodeURIComponent(query.trim())}`);
      setResults(result.ok ? result.data.people : []);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, token]);

  async function add() {
    if (!picked) return;
    setBusy(true);
    setError("");
    const result = await api<{ connection: { id: string } }>(`/api/profiles/${token}/connections`, {
      method: "POST",
      body: { publicId: picked.publicId, note },
    });
    if (!result.ok || !result.data.connection) {
      setError(result.data.error || "Couldn't add them. Try again.");
      setBusy(false);
      return;
    }
    router.push(`/m/${token}/c/${result.data.connection.id}`);
  }

  return (
    <Sheet open={open} onClose={onClose} labelledBy="add-title">
      <h2 id="add-title" className="round text-center text-[22px] leading-7 font-black">
        Add someone you met
      </h2>
      <p className="mx-auto mt-1 mb-4 max-w-[300px] text-center text-[14px] leading-5 text-muted">
        Easiest: show them your card, or scan theirs with your phone&apos;s camera.
      </p>
      <Link href={`/m/${token}/card`} className="btn btn-fill w-full">
        <Icon name="qr" />
        Show my card
      </Link>
      {!picked ? (
        <>
          <label className="field mt-3 flex items-center gap-2" htmlFor="search-people">
            <Icon name="search" className="text-faint" />
            <span className="sr-only">Search by name</span>
            <input
              id="search-people"
              data-autofocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Or search their name"
              autoComplete="off"
              className="!mt-0"
            />
          </label>
          {results.length ? (
            <ul className="group mt-2">
              {results.map((person) => (
                <li key={person.publicId}>
                  <button type="button" className="row !min-h-[64px]" onClick={() => setPicked(person)}>
                    <Mark name={person.name} seed={person.publicId} size={40} />
                    <span className="row-main">
                      <span className="t-name block truncate">
                        {person.name}
                        {person.isDemo ? <DemoTag /> : null}
                      </span>
                      {person.answer ? <span className="row-line block">“{person.answer}”</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim().length >= 2 ? (
            <p className="mt-3 text-center text-[13px] text-muted">No one by that name yet.</p>
          ) : null}
        </>
      ) : (
        <div className="swap mt-3">
          <div className="group flex items-center gap-3 p-3">
            <Mark name={picked.name} seed={picked.publicId} size={48} />
            <div className="min-w-0 flex-1">
              <p className="t-name truncate">{picked.name}</p>
              {picked.answer ? <p className="row-line">“{picked.answer}”</p> : null}
            </div>
            <button type="button" className="btn btn-sm btn-fill" onClick={() => setPicked(null)}>
              Change
            </button>
          </div>
          <label className="field mt-2.5" htmlFor="add-note">
            <span className="field-label flex items-center gap-1.5">
              <Icon name="lock" size={14} />
              Private note · only you see this
            </span>
            <input id="add-note" value={note} maxLength={180} onChange={(event) => setNote(event.target.value)} placeholder="What you talked about" />
          </label>
          <p className="mx-1 mt-2 text-[13px] leading-[18px] text-muted">
            {firstOf(picked.name)} says yes too before either of you sees contact details.
          </p>
          {error ? (
            <p role="alert" className="mt-2 text-[14px] text-hot">
              {error}
            </p>
          ) : null}
          <button type="button" className="btn btn-lg btn-ink mt-3 w-full" disabled={busy} aria-busy={busy} onClick={() => void add()}>
            {busy ? "Saving…" : "Yes, we met"}
          </button>
        </div>
      )}
      <button type="button" className="btn btn-plain mt-1.5 w-full" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}
