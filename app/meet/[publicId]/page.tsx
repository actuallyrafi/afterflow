"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Person = { publicId: string; name: string; role: string; isDemo: boolean };

export default function MeetPage() {
  const params = useParams<{ publicId: string }>();
  const publicId = params.publicId;
  const [person, setPerson] = useState<Person | null>(null);
  const [missing, setMissing] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("afterflow.token");
    setToken(saved);
    setReady(true);
    if (!saved) {
      sessionStorage.setItem("afterflow.meet", publicId);
      localStorage.setItem("afterflow.meet", publicId);
    }
  }, [publicId]);

  useEffect(() => {
    void fetch(`/api/people/${publicId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          setMissing(true);
          return;
        }
        const payload = (await response.json()) as { person: Person };
        setPerson(payload.person);
      })
      .catch(() => setMissing(true));
  }, [publicId]);

  async function confirm() {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/profiles/${token}/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId, note }),
      });
      const payload = (await response.json()) as { connection?: { id: string }; error?: string };
      if (!response.ok || !payload.connection) {
        setError(payload.error || "Could not save that.");
        setBusy(false);
        return;
      }
      sessionStorage.removeItem("afterflow.meet");
      window.location.assign(`/m/${token}/c/${payload.connection.id}`);
    } catch {
      setError("Could not reach Afterflow.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-6">
      <Link href="/" className="text-sm uppercase tracking-[0.16em] text-muted">
        Afterflow
      </Link>
      {missing ? (
        <div className="mt-10">
          <h1 className="font-display text-4xl">No card on this link</h1>
          <p className="mt-3 text-muted">Ask them to open their Afterflow card and show the code again.</p>
        </div>
      ) : null}
      {!person && !missing ? <p className="mt-10 text-lg">Looking up that card…</p> : null}
      {person && ready ? (
        <div className="mt-6">
          <p className="text-sm uppercase tracking-[0.16em] text-muted">Someone you met</p>
          <h1 className="mt-3 font-display text-5xl leading-none">{person.name}</h1>
          <p className="mt-2 text-muted">{person.role}</p>
          {person.isDemo ? <p className="mt-2 text-xs uppercase text-accent">Demo</p> : null}
          {!token ? (
            <div className="mt-8 border border-line bg-panel p-4">
              <p className="text-lg">Make your card first, then you can confirm you met {person.name}.</p>
              <Link href={`/survey?meet=${encodeURIComponent(publicId)}`} className="mt-4 inline-flex min-h-12 items-center bg-accent px-4 font-semibold text-accent-ink">
                Make my card
              </Link>
            </div>
          ) : (
            <div className="mt-8 border border-line bg-panel p-4">
              <label className="block font-semibold">
                What you talked about or worked on
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional, one line"
                  className="mt-2 w-full border border-line bg-bg px-3 py-3 text-base font-normal"
                />
              </label>
              {error ? <p className="mt-3 text-hot">{error}</p> : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirm()}
                className="mt-4 min-h-14 w-full bg-accent text-lg font-semibold text-accent-ink disabled:opacity-60"
              >
                {busy ? "Saving…" : "Yes, we met"}
              </button>
              <p className="mt-3 text-sm text-muted">They confirm too. Contacts stay hidden until then.</p>
            </div>
          )}
        </div>
      ) : null}
      <p className="mt-auto pt-10 text-sm text-muted">Data deleted after the event</p>
    </main>
  );
}
