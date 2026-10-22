"use client";

import { PersonalQr } from "@/components/personal-qr";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Person = { publicId: string; name: string; role: string; isDemo: boolean };

type Connection = {
  id: string;
  statusLabel: string;
  other: { name: string; role: string; isDemo: boolean };
};

type Home = {
  profile?: { name: string; role: string; publicId: string; isDemo?: boolean };
  connections?: Connection[];
  error?: string;
};

export default function ConnectionsHome() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<Home | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [picked, setPicked] = useState<Person | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`/api/profiles/${token}`, { cache: "no-store" });
      const payload = (await response.json()) as Home;
      setFailed(!response.ok);
      setData(payload);
    } catch {
      setFailed(true);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    localStorage.setItem("afterflow.token", token);
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [token, load]);

  useEffect(() => {
    if (data?.profile?.publicId) {
      setShareUrl(`${window.location.origin}/meet/${data.profile.publicId}`);
    }
  }, [data?.profile?.publicId]);

  useEffect(() => {
    if (!token || query.trim().length < 2) {
      setPeople([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void fetch(`/api/profiles/${token}/people?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((payload: { people?: Person[] }) => setPeople(payload.people ?? []))
        .catch(() => setPeople([]));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, token]);

  async function addPerson(person: Person) {
    setBusy(true);
    setFormError("");
    try {
      const response = await fetch(`/api/profiles/${token}/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: person.publicId, note }),
      });
      const payload = (await response.json()) as { connection?: { id: string }; error?: string };
      if (!response.ok || !payload.connection) {
        setFormError(payload.error || "Could not add them.");
        setBusy(false);
        return;
      }
      window.location.assign(`/m/${token}/c/${payload.connection.id}`);
    } catch {
      setFormError("Could not reach Afterflow.");
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-6">
      <Link href="/" className="text-sm uppercase tracking-[0.16em] text-muted">
        Afterflow
      </Link>
      {!data && !failed ? <p className="mt-10 text-lg">Loading your card…</p> : null}
      {failed ? (
        <div className="mt-10">
          <h1 className="font-display text-4xl">Card not found</h1>
          <p className="mt-3 text-muted">{data?.error || "Make a card again."}</p>
          <Link href="/survey" className="mt-6 inline-flex min-h-12 items-center bg-accent px-4 font-semibold text-accent-ink">
            Start
          </Link>
        </div>
      ) : null}
      {data?.profile ? (
        <div className="mt-6 flex flex-col gap-8">
          <div>
            <h1 className="font-display text-5xl leading-none">{data.profile.name}</h1>
            <p className="mt-2 text-muted">{data.profile.role}</p>
            {data.profile.isDemo ? <p className="mt-1 text-xs uppercase text-accent">Demo</p> : null}
          </div>

          <section className="border border-line bg-panel p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide">Your code</h2>
            <p className="mt-2 text-sm text-muted">Someone you met can scan this, or open your link.</p>
            <div className="mt-4 flex justify-center">
              <PersonalQr value={shareUrl} />
            </div>
            <button type="button" onClick={() => void copyLink()} className="mt-4 min-h-12 w-full border border-line font-semibold">
              {copied ? "Link copied" : "Copy my link"}
            </button>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide">Add someone I met</h2>
            <p className="mt-2 text-sm text-muted">Search people who have a card. Two letters of their name is enough.</p>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPicked(null);
              }}
              placeholder="Search by name"
              className="mt-3 w-full border border-line bg-panel px-3 py-3 text-base"
            />
            {people.length > 0 ? (
              <ul className="mt-2 border border-line">
                {people.map((person) => (
                  <li key={person.publicId}>
                    <button
                      type="button"
                      onClick={() => setPicked(person)}
                      className={`flex min-h-12 w-full items-center justify-between px-3 text-left ${picked?.publicId === person.publicId ? "bg-accent text-accent-ink" : ""}`}
                    >
                      <span>
                        <span className="font-semibold">{person.name}</span>
                        <span className="ml-2 text-sm">{person.role}</span>
                      </span>
                      {person.isDemo ? <span className="text-xs uppercase">Demo</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {picked ? (
              <div className="mt-3 border border-line bg-panel p-3">
                <p className="font-semibold">Yes, I met {picked.name}</p>
                <label className="mt-3 block text-sm">
                  What you talked about or worked on
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Optional, one line"
                    className="mt-2 w-full border border-line bg-bg px-3 py-3 text-base"
                  />
                </label>
                {formError ? <p className="mt-2 text-hot">{formError}</p> : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void addPerson(picked)}
                  className="mt-3 min-h-12 w-full bg-accent font-semibold text-accent-ink disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Yes, we met"}
                </button>
              </div>
            ) : null}
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide">My connections</h2>
            {data.connections && data.connections.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {data.connections.map((connection) => (
                  <li key={connection.id}>
                    <Link href={`/m/${token}/c/${connection.id}`} className="block border border-line bg-panel p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xl font-semibold">{connection.other.name}</p>
                          <p className="text-sm text-muted">{connection.other.role}</p>
                          {connection.other.isDemo ? <p className="mt-1 text-xs uppercase text-accent">Demo</p> : null}
                        </div>
                        <p className="text-sm font-semibold">{connection.statusLabel}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 border border-line bg-panel p-4 text-lg leading-snug">
                No one added yet. Scan the code of someone you talked to, or search their name.
              </p>
            )}
          </section>
        </div>
      ) : null}
      <p className="mt-auto pt-10 text-sm text-muted">Data deleted after the event</p>
    </main>
  );
}
