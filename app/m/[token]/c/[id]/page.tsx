"use client";

import { CONNECTION_NEXT_STEPS } from "@/lib/evidence";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Journey = {
  recap: string[];
  why: string;
  communityStep: string;
  opener: string;
  myLink: string;
  theirLink: string;
  myTime: string;
  theirTime: string;
};

type ProfileHeader = { name: string; isDemo?: boolean };

type Connection = {
  id: string;
  status: string;
  statusLabel: string;
  mutual: boolean;
  myFollowUp: "yes" | "not_yet" | null;
  myFollowUpAt: string | null;
  myNote: string;
  theirNote: string;
  other: { name: string; role: string; isDemo: boolean; contact?: string; linkedin?: string };
  journey: Journey | null;
};

export default function ConnectionPage() {
  const params = useParams<{ token: string; id: string }>();
  const { token, id } = params;
  const [profile, setProfile] = useState<ProfileHeader | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");
  const [time, setTime] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`/api/profiles/${token}`, { cache: "no-store" });
      if (!response.ok) {
        setMissing(true);
        return;
      }
      const payload = (await response.json()) as { profile?: ProfileHeader; connections?: Connection[] };
      setProfile(payload.profile ?? null);
      const found = payload.connections?.find((item) => item.id === id) ?? null;
      setConnection(found);
      setMissing(!found);
      if (found?.journey) {
        setLink((current) => current || found.journey?.myLink || "");
        setTime((current) => current || found.journey?.myTime || "");
      }
    } catch {
      setMissing(true);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function act(action: string, extra?: { link?: string; time?: string }) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/profiles/${token}/connections/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const payload = (await response.json()) as { connection?: Connection; declined?: boolean; error?: string };
      if (payload.declined) {
        window.location.assign(`/m/${token}`);
        return;
      }
      if (!response.ok || !payload.connection) {
        setError(payload.error || "Could not save that.");
        setBusy(false);
        return;
      }
      setConnection(payload.connection);
      setMissing(false);
    } catch {
      setError("Could not reach Afterflow.");
    } finally {
      setBusy(false);
    }
  }

  async function copyOpener() {
    if (!connection?.journey) return;
    try {
      await navigator.clipboard.writeText(connection.journey.opener);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const followed =
    connection?.myFollowUp && connection.myFollowUpAt
      ? `You said ${connection.myFollowUp === "yes" ? "yes" : "not yet"} at ${new Date(connection.myFollowUpAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}`
      : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-6">
      <Link href={`/m/${token}`} className="text-sm uppercase tracking-[0.16em] text-muted">
        My connections
      </Link>
      {profile?.isDemo ? <p className="mt-4 text-xs uppercase text-accent">{profile.name} · Demo</p> : null}
      {!connection && !missing ? <p className="mt-10 text-lg">Loading…</p> : null}
      {missing ? (
        <div className="mt-10">
          <h1 className="font-display text-4xl">Connection not on this card</h1>
          <Link href={`/m/${token}`} className="mt-6 inline-flex min-h-12 items-center bg-accent px-4 font-semibold text-accent-ink">
            Back
          </Link>
        </div>
      ) : null}
      {connection ? (
        <div className="mt-6 flex flex-col gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide">{connection.statusLabel}</p>
            <h1 className="mt-2 font-display text-5xl leading-none">{connection.other.name}</h1>
            <p className="mt-2 text-muted">{connection.other.role}</p>
            {connection.other.isDemo ? <p className="mt-1 text-xs uppercase text-accent">Demo</p> : null}
          </div>

          {!connection.mutual ? (
            <section className="border border-line bg-panel p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide">Confirm you met</h2>
              {connection.theirNote ? <p className="mt-3 text-base leading-relaxed">They noted &ldquo;{connection.theirNote}&rdquo;.</p> : null}
              {connection.myNote ? <p className="mt-3 text-base leading-relaxed">You noted &ldquo;{connection.myNote}&rdquo;.</p> : null}
              <p className="mt-3 text-sm text-muted">Contact and LinkedIn stay hidden until you both say yes.</p>
              {connection.status === "waiting_for_you" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act("confirm")}
                  className="mt-4 min-h-12 w-full bg-accent font-semibold text-accent-ink disabled:opacity-60"
                >
                  Yes, we met
                </button>
              ) : (
                <p className="mt-4 text-base">Waiting for {connection.other.name} to confirm.</p>
              )}
              {connection.other.isDemo && connection.status === "waiting_for_them" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act("simulate_demo_confirm")}
                  className="mt-3 min-h-12 w-full border border-accent px-3 text-left text-sm"
                >
                  Demo only — simulate them confirming
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void act("decline")}
                className="mt-3 min-h-12 w-full text-sm text-muted"
              >
                We did not meet
              </button>
            </section>
          ) : (
            <div className="flex flex-col gap-4">
              <section className="border border-line bg-panel p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide">1 · Who you both are</h2>
                <ul className="mt-3 flex flex-col gap-2 text-base leading-relaxed">
                  {connection.journey?.recap.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {connection.other.contact ? (
                  <p className="mt-4 text-base">
                    <span className="font-semibold">Contact. </span>
                    {connection.other.contact}
                  </p>
                ) : null}
                {connection.other.linkedin ? (
                  <p className="mt-2 break-all text-base">
                    <span className="font-semibold">LinkedIn. </span>
                    <a href={connection.other.linkedin} className="underline">
                      {connection.other.linkedin}
                    </a>
                  </p>
                ) : null}
              </section>

              <section className="border border-line bg-panel p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide">2 · Why it is worth continuing</h2>
                <p className="mt-3 text-base leading-relaxed">{connection.journey?.why}</p>
              </section>

              <section className="border border-accent bg-panel p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide">3 · Three ways to keep going</h2>
                <p className="mt-2 text-sm text-muted">Optional. Pick any. Chatting online is a perfectly fine outcome.</p>

                <div className="mt-4 border-t border-line pt-4">
                  <h3 className="font-semibold">{CONNECTION_NEXT_STEPS[0].label}</h3>
                  <p className="mt-2 text-sm leading-relaxed">{connection.journey?.opener}</p>
                  <button type="button" onClick={() => void copyOpener()} className="mt-3 min-h-12 w-full bg-accent font-semibold text-accent-ink">
                    {copied ? "Opener copied" : "Copy opener for Discord, email, or LinkedIn"}
                  </button>
                </div>

                <form
                  className="mt-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void act("share_link", { link });
                  }}
                >
                  <p className="text-sm font-semibold">Or share a link or repo in that chat</p>
                  <input
                    value={link}
                    onChange={(event) => setLink(event.target.value)}
                    placeholder="github.com/you/project"
                    className="mt-2 w-full border border-line bg-bg px-3 py-3 text-base"
                  />
                  <button type="submit" disabled={busy} className="mt-2 min-h-12 w-full border border-line font-semibold disabled:opacity-60">
                    Save link
                  </button>
                  {connection.journey?.theirLink ? (
                    <p className="mt-2 break-all text-sm">
                      {connection.other.name} shared {connection.journey.theirLink}
                    </p>
                  ) : null}
                  {connection.journey?.myLink ? <p className="mt-2 break-all text-sm">You shared {connection.journey.myLink}</p> : null}
                </form>

                <div className="mt-4 border-t border-line pt-4">
                  <h3 className="font-semibold">{CONNECTION_NEXT_STEPS[1].label}</h3>
                  <p className="mt-2 text-base">{connection.journey?.communityStep}</p>
                </div>

                <form
                  className="mt-4 border-t border-line pt-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void act("suggest_time", { time });
                  }}
                >
                  <h3 className="font-semibold">{CONNECTION_NEXT_STEPS[2].label}</h3>
                  <p className="mt-1 text-sm text-muted">Suggestion only. Leave it blank and keep talking online.</p>
                  <input
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    placeholder="Thursday after work, or next Tuesday"
                    className="mt-2 w-full border border-line bg-bg px-3 py-3 text-base"
                  />
                  <button type="submit" disabled={busy} className="mt-2 min-h-12 w-full border border-line font-semibold disabled:opacity-60">
                    Save suggestion
                  </button>
                  {connection.journey?.theirTime ? (
                    <p className="mt-2 text-sm">
                      {connection.other.name} suggested {connection.journey.theirTime}
                    </p>
                  ) : null}
                  {connection.journey?.myTime ? <p className="mt-2 text-sm">You suggested {connection.journey.myTime}</p> : null}
                </form>
              </section>

              <section className="border border-line bg-panel p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide">Did you follow up?</h2>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act("follow_up_yes")}
                    className={`min-h-12 font-semibold ${connection.myFollowUp === "yes" ? "bg-accent text-accent-ink" : "border border-line"}`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act("follow_up_not_yet")}
                    className={`min-h-12 font-semibold ${connection.myFollowUp === "not_yet" ? "bg-accent text-accent-ink" : "border border-line"}`}
                  >
                    Not yet
                  </button>
                </div>
                {followed ? <p className="mt-2 text-sm">{followed}</p> : null}
              </section>
            </div>
          )}
          {error ? <p className="text-hot">{error}</p> : null}
        </div>
      ) : null}
      <p className="mt-auto pt-10 text-sm text-muted">Data deleted after the event</p>
    </main>
  );
}
