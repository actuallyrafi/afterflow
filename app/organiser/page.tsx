"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Stats = {
  signups: number;
  connectionsMade: number;
  mutualConfirms: number;
  followedUp: number;
  message?: string;
  error?: string;
};

export default function OrganiserPage() {
  const [passcode, setPasscode] = useState("");
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("afterflow.organiser");
    if (saved) {
      setPasscode(saved);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready || !passcode) return;
    let stop = false;
    async function load() {
      try {
        const response = await fetch("/api/organiser", {
          cache: "no-store",
          headers: { "x-organiser-passcode": passcode },
        });
        const payload = (await response.json()) as Stats;
        if (stop) return;
        if (!response.ok) {
          setError(payload.error || "Wrong passcode.");
          setReady(false);
          sessionStorage.removeItem("afterflow.organiser");
          return;
        }
        setError("");
        setStats(payload);
      } catch {
        if (!stop) setError("Could not load counts.");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [ready, passcode]);

  async function removeAll() {
    const response = await fetch("/api/organiser", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-organiser-passcode": passcode },
      body: JSON.stringify({ action: "delete-all" }),
    });
    const payload = (await response.json()) as Stats;
    if (!response.ok) {
      setError(payload.error || "Could not delete.");
      return;
    }
    setStats(payload);
    setDeleted(true);
    setConfirming(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-6">
      <Link href="/" className="text-sm uppercase tracking-[0.16em] text-muted">
        Afterflow
      </Link>
      <h1 className="mt-3 font-display text-5xl leading-none">Organiser</h1>
      <p className="mt-4 text-lg">Data deleted after the event</p>
      {!ready ? (
        <form
          className="mt-8 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            sessionStorage.setItem("afterflow.organiser", passcode);
            setReady(true);
            setError("");
          }}
        >
          <label className="font-semibold" htmlFor="passcode">
            Passcode
          </label>
          <input
            id="passcode"
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            className="border border-line bg-panel px-3 py-3 text-base"
          />
          {error ? <p className="text-hot">{error}</p> : null}
          <button type="submit" className="min-h-12 bg-accent font-semibold text-accent-ink">
            Open the funnel
          </button>
        </form>
      ) : (
        <div className="mt-8">
          {deleted ? <p className="mb-4 text-2xl font-semibold">Data deleted after the event</p> : null}
          <Funnel stats={stats} />
          <p className="mt-3 text-sm text-muted">The funnel refreshes every few seconds. Followed up: {stats?.followedUp ?? "…"}</p>
          {error ? <p className="mt-3 text-hot">{error}</p> : null}
          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} className="mt-8 min-h-12 bg-hot px-4 font-semibold text-white">
              Delete all data
            </button>
          ) : (
            <div className="mt-8 border border-hot p-4">
              <p>This wipes every signup and connection.</p>
              <button type="button" onClick={() => void removeAll()} className="mt-3 min-h-12 bg-hot px-4 font-semibold text-white">
                Yes, delete everything
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function Funnel({ stats }: { stats: Stats | null }) {
  const steps = [
    ["Sign-ups", stats?.signups],
    ["Connections requested", stats?.connectionsMade],
    ["Mutual confirms", stats?.mutualConfirms],
    ["Followed up", stats?.followedUp],
  ] as const;
  const top = Math.max(stats?.signups ?? 0, 1);
  return (
    <ol className="flex flex-col gap-2">
      {steps.map(([label, value], index) => {
        const count = value ?? 0;
        const width = stats ? Math.max(count === 0 ? 0 : 8, Math.round((count / top) * 100)) : 0;
        return (
          <li key={label} className="border border-line bg-panel p-3">
            <div className="flex items-end justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-wide">{label}</p>
              <p className="font-display text-4xl leading-none">{stats ? count : "…"}</p>
            </div>
            <div className="mt-3 h-2 bg-bg">
              <div className="h-2 bg-accent" style={{ width: `${stats ? width : 0}%` }} />
            </div>
            {index < steps.length - 1 ? <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted">then</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
