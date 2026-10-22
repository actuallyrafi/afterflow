"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { OrganiserStats } from "@/lib/organiser";

type Stats = Partial<OrganiserStats> & { message?: string; error?: string };

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
            sessionStorage.setItem("afterflow.organiser", passcode);
            setReady(true);
            setError("");
          }}
        >
          <label className="field">
            <span className="field-label">Passcode</span>
            <input id="passcode" type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} />
          </label>
          {error ? <p className="text-[14px] text-hot">{error}</p> : null}
          <button type="submit" className="btn btn-lg btn-ink w-full">
            Open
          </button>
        </form>
      ) : (
        <div className="mt-6">
          {deleted ? <p className="mb-4 text-[17px] font-semibold">All data deleted</p> : null}
          <Headline stats={stats} />
          <p className="mt-4 text-[13px] text-muted">
            Context: {stats?.connectionsRequested ?? "…"} connections requested · {stats?.signups ?? "…"} cards. Refreshes every few seconds.
          </p>
          {error ? <p className="mt-3 text-[14px] text-hot">{error}</p> : null}
          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} className="btn btn-lg btn-hot mt-8 w-full">
              Delete all data
            </button>
          ) : (
            <div className="panel mt-8 p-4">
              <p className="text-[15px]">This wipes every card and connection.</p>
              <button type="button" onClick={() => void removeAll()} className="btn btn-lg btn-hot mt-3 w-full">
                Yes, delete everything
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="btn btn-plain mt-1 w-full">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function Headline({ stats }: { stats: Stats | null }) {
  const value = (n: number | undefined) => (stats && typeof n === "number" ? n : "…");
  return (
    <div className="grid grid-cols-2 gap-3">
      <section className="panel p-4" aria-label="Talked again">
        <p className="text-[13px] font-semibold text-muted">Talked again</p>
        <p className="round mt-1 text-[44px] leading-none font-black">{value(stats?.talkedAgainMarks)}</p>
        <p className="mt-2 text-[12px] leading-4 text-muted">
          Private marks, added up. Across {value(stats?.pairsTalkedAgain)} connections.
        </p>
      </section>
      <section className="panel p-4" aria-label="Mutual confirms">
        <p className="text-[13px] font-semibold text-muted">Both said yes</p>
        <p className="round mt-1 text-[44px] leading-none font-black">{value(stats?.mutualConfirms)}</p>
        <p className="mt-2 text-[12px] leading-4 text-muted">Connections confirmed by both people.</p>
      </section>
    </div>
  );
}
