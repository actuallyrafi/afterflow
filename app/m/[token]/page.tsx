"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CircleButton, Sheet, takeToast, Toast, TopBar, useToast } from "@/components/ui/chrome";
import { Icon } from "@/components/ui/icons";
import { hueOf, Mark } from "@/components/ui/mark";
import { Unavailable } from "@/components/unavailable";
import { api, rememberToken } from "@/lib/api";
import type { ConnectionCard, HomeResult, PersonCard } from "@/lib/connections";
import { EVENT_LINE } from "@/lib/event";
import { firstOf } from "@/lib/handoff";

export default function YourPeople() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [home, setHome] = useState<HomeResult | null>(null);
  const [missing, setMissing] = useState(false);
  const [settings, setSettings] = useState(false);
  const [adding, setAdding] = useState(false);
  const [reminder, setReminder] = useState<HomeResult["reminder"]>(null);
  const { toast, show, hide } = useToast();

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

  const waiting = home?.connections.filter((item) => !item.mutual) ?? [];
  const people = home?.connections.filter((item) => item.mutual) ?? [];
  const me = home?.profile;

  return (
    <main className="shell page-top pb-40">
      <TopBar right={<CircleButton icon="more" label="Your people settings" onClick={() => setSettings(true)} />} />

      <h1 className="t-display">Your people</h1>
      <div className="mt-2.5 mb-[18px] flex flex-wrap gap-2">
        <span className="pill">{EVENT_LINE}</span>
        {me?.isDemo ? <span className="pill">Demo card</span> : null}
      </div>

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

      {me ? (
        <Link
          href={`/m/${token}/card`}
          className="glass fixed bottom-[calc(env(safe-area-inset-bottom)+30px)] left-[max(16px,calc(50%-204px))] z-20 flex h-[58px] items-center gap-2.5 rounded-[29px] pr-[18px] pl-[9px]"
        >
          <Mark name={me.name} seed={me.publicId} size={40} />
          <span className="round text-[16px] font-extrabold">My card</span>
        </Link>
      ) : null}
      <button
        type="button"
        aria-label="Add someone"
        onClick={() => setAdding(true)}
        className="glass fixed right-[max(16px,calc(50%-204px))] bottom-[calc(env(safe-area-inset-bottom)+30px)] z-20 grid size-[58px] place-items-center rounded-full"
      >
        <Icon name="plus" size={24} />
      </button>

      <Sheet open={settings} onClose={() => setSettings(false)} labelledBy="settings-title">
        <h2 id="settings-title" className="round mb-3.5 text-center text-[20px] font-black">
          Your people
        </h2>
        <div className="group">
          <Link href={`/m/${token}/settings/blocked`} className="item flush items-center" data-autofocus>
            <span className="t flex-1">Blocked</span>
            <Icon name="chev" className="chev" />
          </Link>
          <Link href={`/m/${token}/card`} className="item flush items-center">
            <span className="t flex-1">My card</span>
            <Icon name="chev" className="chev" />
          </Link>
        </div>
        <button type="button" className="group mt-2.5 block min-h-[54px] w-full text-[17px] font-semibold" onClick={() => setSettings(false)}>
          Cancel
        </button>
        <p className="mt-3 text-center text-[12px] text-muted">Only you see your list.</p>
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
          {item.other.isDemo ? <span className="ml-1.5 text-[12px] font-semibold text-faint">Demo</span> : null}
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
          {item.other.isDemo ? <span className="ml-1.5 text-[12px] font-semibold text-faint">Demo</span> : null}
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
                        {person.isDemo ? <span className="ml-1.5 text-[12px] font-semibold text-faint">Demo</span> : null}
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
