"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleLink, TopBar } from "@/components/ui/chrome";
import { Icon } from "@/components/ui/icons";
import { hueOf, Mark } from "@/components/ui/mark";
import { Unavailable } from "@/components/unavailable";
import { api, savedToken } from "@/lib/api";
import type { PersonCard } from "@/lib/connections";
import { EVENT_SHORT } from "@/lib/event";
import { clearPendingMeet, firstName, rememberMeet } from "@/lib/pending-meet";

export default function MeetPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const [person, setPerson] = useState<PersonCard | null>(null);
  const [missing, setMissing] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = savedToken();
    setToken(saved);
    setJustSaved(new URLSearchParams(window.location.search).get("saved") === "1");
    setReady(true);
    // No card yet: remember who was scanned so card creation can come back here.
    if (!saved) rememberMeet(publicId);
  }, [publicId]);

  useEffect(() => {
    void api<{ person: PersonCard }>(`/api/people/${encodeURIComponent(publicId)}`).then((result) => {
      if (result.ok && result.data.person) setPerson(result.data.person);
      else setMissing(true);
    });
  }, [publicId]);

  async function confirm() {
    if (!token) return;
    setBusy(true);
    setError("");
    const result = await api<{ connection: { id: string } }>(`/api/profiles/${token}/connections`, {
      method: "POST",
      body: { publicId, note },
    });
    if (!result.ok || !result.data.connection) {
      setError(result.data.error || "Couldn't save that. Try again.");
      setBusy(false);
      return;
    }
    clearPendingMeet();
    window.location.assign(`/m/${token}/c/${result.data.connection.id}`);
  }

  if (missing) return <Unavailable />;

  const first = person ? firstName(person.name) : "";
  const exit = token ? `/m/${token}` : "/";

  return (
    <main className={`relative min-h-dvh pb-48 ${person ? `hue-${hueOf(person.publicId)}` : ""}`}>
      <TopBar left={<CircleLink href={exit} icon="back" label="Back" />} />
      <div className="hue-bg absolute inset-x-0 top-0 h-[300px] rounded-b-[34px]" aria-hidden="true" />
      <div className="shell">
        <div className="relative pt-[calc(env(safe-area-inset-top)+64px)] text-center">
          {person ? (
            <>
              <div className="pop flex justify-center">
                <Mark name={person.name} seed={person.publicId} size={96} onPlate />
              </div>
              <h1 className="t-display mt-3.5">{person.name}</h1>
              <span className="pill plate mt-2">You met at {EVENT_SHORT}</span>
              {person.isDemo ? (
                <p className="mt-2">
                  <span className="pill plate">Demo card</span>
                </p>
              ) : null}
            </>
          ) : (
            <div aria-busy="true" className="flex flex-col items-center">
              <div className="skeleton size-24 rounded-[40%]" />
              <div className="skeleton mt-4 h-8 w-48" />
            </div>
          )}
        </div>

        {person && ready ? (
          <div className="relative pt-[30px]">
            {justSaved && token ? (
              <p role="status" className="mb-3 flex items-center gap-2 rounded-[16px] bg-panel px-3.5 py-2.5 text-[14px]">
                <Icon name="check" size={18} className="text-[color:var(--h3-deep)]" />
                Card saved. One tap left.
              </p>
            ) : null}
            {person.answer ? (
              <>
                <p className="mx-1 mb-1 text-[12px] font-semibold text-muted">{first} is into</p>
                <p className="bubble !max-w-full rounded-tl-[8px] bg-panel">{person.answer}</p>
              </>
            ) : null}
            {token ? (
              <>
                <label className="field mt-4" htmlFor="meet-note">
                  <span className="field-label flex items-center gap-1.5">
                    <Icon name="lock" size={14} />
                    Private note · only you see this
                  </span>
                  <input
                    id="meet-note"
                    value={note}
                    maxLength={180}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="What you talked about"
                  />
                </label>
                <p className="mx-1 mt-2.5 text-[13px] leading-[18px] text-muted">
                  {first} says yes too before either of you sees contact details.
                </p>
              </>
            ) : (
              <p className="mx-1 mt-4 text-[15px] leading-[21px] text-muted">
                Make a quick card, then say yes. {first} says yes too before either of you sees contact details.
              </p>
            )}
            {error ? (
              <p role="alert" className="mx-1 mt-3 text-[14px] text-hot">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {person && ready ? (
        <div className="glass fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+26px)] z-20 mx-auto flex max-w-[416px] flex-col gap-0.5 rounded-[34px] p-[9px]">
          {token ? (
            <>
              <button type="button" className="btn btn-lg btn-ink w-full" disabled={busy} aria-busy={busy} onClick={() => void confirm()}>
                {busy ? "Saving…" : "Yes, we met"}
              </button>
              <Link
                href={exit}
                className="btn btn-plain w-full"
                onClick={() => {
                  clearPendingMeet();
                }}
              >
                We didn&apos;t meet
              </Link>
            </>
          ) : (
            <>
              <Link href={`/survey?meet=${encodeURIComponent(publicId)}`} className="btn btn-lg btn-ink w-full">
                Make my card to say yes
              </Link>
              <p className="py-2.5 text-center text-[13px] text-muted">About 30 seconds. Then one tap.</p>
            </>
          )}
        </div>
      ) : null}
    </main>
  );
}
