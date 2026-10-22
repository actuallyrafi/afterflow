"use client";

import { clearPendingMeet, firstName, rememberMeet } from "@/lib/pending-meet";
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
  const [justSaved, setJustSaved] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("afterflow.token");
    setToken(saved);
    setJustSaved(new URLSearchParams(window.location.search).get("saved") === "1");
    setReady(true);
    if (!saved) rememberMeet(publicId);
  }, [publicId]);

  useEffect(() => {
    void fetch(`/api/people/${encodeURIComponent(publicId)}`, { cache: "no-store" })
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
      clearPendingMeet();
      window.location.assign(`/m/${token}/c/${payload.connection.id}`);
    } catch {
      setError("Could not reach Afterflow.");
      setBusy(false);
    }
  }

  const first = person ? firstName(person.name) : "";

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
          {token && justSaved ? (
            <p role="status" className="mb-5 border border-line bg-panel px-4 py-3 text-base">
              <span className="font-semibold text-accent">Card saved.</span> One tap left.
            </p>
          ) : null}
          <p className="text-sm uppercase tracking-[0.16em] text-muted">
            {token ? (justSaved ? "Step 2 of 2" : "Someone you met") : "Someone you met"}
          </p>
          <h1 className="mt-3 font-display text-5xl leading-none">
            {token ? `Did you meet ${first}?` : person.name}
          </h1>
          <p className="mt-3 text-muted">
            {token ? `${person.name} · ${person.role}` : person.role}
          </p>
          {person.isDemo ? <p className="mt-2 text-xs uppercase text-accent">Demo</p> : null}
          {!token ? (
            <div className="mt-8 border border-line bg-panel p-4">
              <p className="text-lg leading-snug">Two quick steps to connect with {first}:</p>
              <ol className="mt-4 flex flex-col gap-3">
                <li className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center bg-accent text-sm font-semibold text-accent-ink">1</span>
                  <span className="pt-0.5">Make your card. About 30 seconds.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center border border-line text-sm font-semibold">2</span>
                  <span className="pt-0.5">Tap &ldquo;Yes, we met&rdquo;. {first} confirms too.</span>
                </li>
              </ol>
              <Link
                href={`/survey?meet=${encodeURIComponent(publicId)}`}
                className="mt-6 flex min-h-14 w-full items-center justify-center bg-accent px-3 text-center text-base font-semibold text-accent-ink"
              >
                Make my card and connect with {first}
              </Link>
              <p className="mt-3 text-sm text-muted">Contacts stay hidden until you both confirm.</p>
            </div>
          ) : (
            <div className="mt-8 border border-line bg-panel p-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirm()}
                className="min-h-14 w-full bg-accent text-lg font-semibold text-accent-ink disabled:opacity-60"
              >
                {busy ? "Saving…" : "Yes, we met"}
              </button>
              {error ? <p className="mt-3 text-hot">{error}</p> : null}
              <p className="mt-3 text-sm text-muted">{first} confirms too. Contacts stay hidden until then.</p>
              <label className="mt-6 block border-t border-line pt-4">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">What you talked about</span>
                  <span className="text-sm text-muted">Optional</span>
                </span>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="e.g. the onboarding for your study app"
                  maxLength={180}
                  className="mt-2 w-full border border-line bg-bg px-3 py-3 text-base font-normal"
                />
              </label>
            </div>
          )}
        </div>
      ) : null}
      <p className="mt-auto pt-10 text-sm text-muted">Data deleted after the event</p>
    </main>
  );
}
