"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { dayLabel } from "@/components/organiser";
import { Spinner } from "@/components/ui/chrome";
import { api, savedToken } from "@/lib/api";
import { JOIN_EVENT_KEY } from "@/lib/organiser-client";

/**
 * v4.1h attendee join link: /join/{eventId}. With a card on this phone it joins straight away;
 * without one it remembers the event and the new card joins it. The organiser only ever sees totals.
 */
export default function JoinEventPage() {
  const params = useParams<{ eventId: string }>();
  const id = params?.eventId ?? "";
  const router = useRouter();
  const [event, setEvent] = useState<{ id: string; name: string; date: string } | null>(null);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(savedToken());
    void api<{ event: { id: string; name: string; date: string } }>(`/api/join/${encodeURIComponent(id)}`).then((result) => {
      if (result.ok) setEvent(result.data.event);
      else setError(result.data.error || "This event link doesn't work.");
    });
  }, [id]);

  async function joinWithCard() {
    if (!token || busy) return;
    setBusy(true);
    const result = await api(`/api/join/${encodeURIComponent(id)}`, { method: "POST", body: { token } });
    if (!result.ok) {
      setBusy(false);
      setError(result.data.error || "Couldn't join. Try again.");
      return;
    }
    router.replace(`/m/${token}`);
  }

  function makeCard() {
    try {
      localStorage.setItem(JOIN_EVENT_KEY, id);
    } catch {
      // Private mode: the card is still made, just without the event.
    }
    router.push("/survey");
  }

  return (
    <main className="shell page-top pb-16">
      <Link href="/" className="pill plate">
        Afterflow
      </Link>
      {error && !event ? (
        <>
          <h1 className="t-title mt-4">This event link doesn&apos;t work</h1>
          <p className="mt-2 text-[15px] text-muted">Ask the organiser for the link again.</p>
        </>
      ) : (
        <>
          <p className="tag mt-6">You&apos;re joining</p>
          <h1 className="t-display mt-1" data-join-name={event?.name ?? ""}>
            {event ? event.name : "…"}
          </h1>
          {event ? <p className="mt-1 text-[15px] text-muted">{dayLabel(event)}</p> : null}
          <p className="mt-4 text-[15px] leading-[21px]">
            Afterflow keeps the door open. You two walk through it. The organiser only sees totals for the night, never who you met.
          </p>
          {error ? (
            <p role="alert" className="mt-3 text-[14px] text-hot">
              {error}
            </p>
          ) : null}
          {token ? (
            <button type="button" className="btn btn-lg btn-ink mt-6 w-full" onClick={() => void joinWithCard()} disabled={!event || busy} aria-busy={busy}>
              {busy ? <Spinner /> : null}
              Join with my card
            </button>
          ) : (
            <button type="button" className="btn btn-lg btn-ink mt-6 w-full" onClick={makeCard} disabled={!event}>
              Make my card
            </button>
          )}
        </>
      )}
    </main>
  );
}
