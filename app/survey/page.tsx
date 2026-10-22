"use client";

import {
  AVAILABILITIES,
  CONSENT_TEXT,
  FREE_TEXT_EXAMPLES,
  FREE_TEXT_HELP,
  FREE_TEXT_LABEL,
  FREE_TEXT_NUDGE,
  NEEDS,
  OFFERS,
  wordCount,
} from "@/lib/survey";
import { clearPendingMeet, firstName, readPendingMeet, rememberMeet } from "@/lib/pending-meet";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type MeetPerson = { publicId: string; name: string; role: string; isDemo: boolean };

function MultiSelect({
  legend,
  options,
  selected,
  top,
  onChange,
}: {
  legend: string;
  options: readonly string[];
  selected: string[];
  top: string;
  onChange: (selected: string[], top: string) => void;
}) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      const next = selected.filter((item) => item !== value);
      onChange(next, top === value ? (next[0] ?? "") : top);
      return;
    }
    onChange([...selected, value], top || value);
  }

  return (
    <fieldset>
      <legend className="text-base font-semibold">{legend}</legend>
      <p className="mt-1 text-sm text-muted">Tap to select. Tap Top to mark your strongest.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const on = selected.includes(option);
          const isTop = top === option;
          return (
            <div
              key={option}
              className={`flex min-h-12 items-stretch border ${on ? "border-accent" : "border-line"} ${isTop ? "bg-accent text-accent-ink" : ""}`}
            >
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(option)}
                className="px-3 py-2 text-left text-base"
              >
                {option}
              </button>
              {on ? (
                <button
                  type="button"
                  aria-pressed={isTop}
                  onClick={() => onChange(selected, option)}
                  className="border-l border-current px-2 text-xs font-semibold uppercase"
                >
                  {isTop ? "Top" : "Set top"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function SurveyPage() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [role, setRole] = useState("");
  const [offers, setOffers] = useState<string[]>([]);
  const [topOffer, setTopOffer] = useState("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [topNeed, setTopNeed] = useState("");
  const [availability, setAvailability] = useState("");
  const [tryingTo, setTryingTo] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [meetId, setMeetId] = useState<string | null>(null);
  const [meetPerson, setMeetPerson] = useState<MeetPerson | null>(null);

  useEffect(() => {
    const pending = readPendingMeet(new URLSearchParams(window.location.search).get("meet"));
    if (!pending) return;
    setMeetId(pending);
    rememberMeet(pending);
    void fetch(`/api/people/${encodeURIComponent(pending)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { person?: MeetPerson };
        if (payload.person) setMeetPerson(payload.person);
      })
      .catch(() => undefined);
  }, []);

  const meetFirst = meetPerson ? firstName(meetPerson.name) : "";

  const words = wordCount(tryingTo);
  const showNudge = tryingTo.trim().length > 0 && words < 8;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          contact,
          linkedin,
          role,
          offers,
          topOffer,
          needs,
          topNeed,
          availability,
          tryingTo,
          consent,
        }),
      });
      const payload = (await response.json()) as { token?: string; error?: string };
      if (!response.ok || !payload.token) {
        setError(payload.error || "Could not save. Try again.");
        setSaving(false);
        return;
      }
      localStorage.setItem("afterflow.token", payload.token);
      const pending = meetId || readPendingMeet(new URLSearchParams(window.location.search).get("meet"));
      clearPendingMeet();
      window.location.assign(pending ? `/meet/${encodeURIComponent(pending)}?saved=1` : `/m/${payload.token}`);
    } catch {
      setError("Could not reach Afterflow. Check the connection and try again.");
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-6">
      {meetPerson ? (
        <div className="sticky top-0 z-10 -mx-4 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center bg-accent text-base font-semibold text-accent-ink"
              >
                {meetFirst.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">Connecting with {meetPerson.name}</p>
                <p className="truncate text-sm text-muted">
                  {meetPerson.role}
                  {meetPerson.isDemo ? <span className="ml-2 text-accent">Demo</span> : null}
                </p>
              </div>
            </div>
            <p className="shrink-0 text-sm text-muted">Step 1 of 2</p>
          </div>
        </div>
      ) : null}
      <div className="pt-6">
        <Link href="/" className="text-sm uppercase tracking-[0.16em] text-muted">
          Afterflow
        </Link>
      </div>
      <h1 className="mt-3 font-display text-4xl leading-none">
        {meetPerson ? `Make your card to connect with ${meetFirst}` : "Your Afterflow card"}
      </h1>
      <p className="mt-3 text-muted">
        {meetPerson
          ? `About 30 seconds. Then one tap to confirm you met ${meetFirst}. Your contact stays hidden until you both confirm.`
          : "A short card so someone you already met tonight can find you again. About 30 seconds."}
      </p>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-7">
        <label className="block">
          <span className="font-semibold">Name</span>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            className="mt-2 w-full border border-line bg-panel px-3 py-3 text-base"
          />
        </label>
        <label className="block">
          <span className="font-semibold">Email or Discord</span>
          <input
            required
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            placeholder="you@email.com or discord handle"
            autoComplete="email"
            className="mt-2 w-full border border-line bg-panel px-3 py-3 text-base"
          />
        </label>
        <label className="block">
          <span className="font-semibold">LinkedIn URL</span>
          <span className="ml-2 text-sm text-muted">Optional. Shown only after you both confirm.</span>
          <input
            value={linkedin}
            onChange={(event) => setLinkedin(event.target.value)}
            placeholder="linkedin.com/in/your-name"
            inputMode="url"
            className="mt-2 w-full border border-line bg-panel px-3 py-3 text-base"
          />
        </label>
        <label className="block">
          <span className="font-semibold">One-line role</span>
          <input
            required
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder="Backend engineer, designer, community lead"
            className="mt-2 w-full border border-line bg-panel px-3 py-3 text-base"
          />
        </label>
        <MultiSelect
          legend="What you offer"
          options={OFFERS}
          selected={offers}
          top={topOffer}
          onChange={(next, top) => {
            setOffers(next);
            setTopOffer(top);
          }}
        />
        <MultiSelect
          legend="What you are looking for"
          options={NEEDS}
          selected={needs}
          top={topNeed}
          onChange={(next, top) => {
            setNeeds(next);
            setTopNeed(top);
          }}
        />
        <fieldset>
          <legend className="font-semibold">When you are free</legend>
          <div className="mt-3 grid gap-2">
            {AVAILABILITIES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={availability === option}
                onClick={() => setAvailability(option)}
                className={`min-h-12 border px-3 text-left text-base ${availability === option ? "border-accent bg-accent text-accent-ink" : "border-line"}`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="trying" className="font-semibold">
            {FREE_TEXT_LABEL}
          </label>
          <p className="mt-1 text-sm text-muted">{FREE_TEXT_HELP}</p>
          <div className="mt-3 flex flex-col gap-2">
            {FREE_TEXT_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setTryingTo(example)}
                className="border border-line px-3 py-2 text-left text-sm leading-snug text-muted"
              >
                {example}
              </button>
            ))}
          </div>
          <textarea
            id="trying"
            required
            value={tryingTo}
            onChange={(event) => setTryingTo(event.target.value)}
            rows={4}
            className="mt-3 w-full border border-line bg-panel px-3 py-3 text-base"
          />
          {showNudge ? <p className="mt-2 text-sm text-accent">{FREE_TEXT_NUDGE}</p> : null}
        </div>
        <label className="flex items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            required
            className="mt-1 size-6 accent-[#e2ff4d]"
          />
          <span>{CONSENT_TEXT}</span>
        </label>
        {error ? (
          <p role="alert" className="text-hot">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="min-h-14 bg-accent text-lg font-semibold text-accent-ink disabled:opacity-60"
        >
          {saving ? "Saving…" : meetPerson ? `Save and continue to ${meetFirst}` : "Save my card"}
        </button>
      </form>
      <p className="py-8 text-sm text-muted">Data deleted after the event</p>
    </main>
  );
}
