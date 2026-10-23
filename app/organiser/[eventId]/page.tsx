"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DeleteEventSheet, Headline, LinkRow, OnceNotice, dayLabel } from "@/components/organiser";
import { Sheet, Spinner, Toast, useToast } from "@/components/ui/chrome";
import type { EventSummary, OrganiserStats } from "@/lib/organiser";
import { MASTER_KEY, eventKeyName, joinUrl, keyFromHash, orgFetch, organiserUrl, readSession, writeSession, type EventReply } from "@/lib/organiser-client";

/**
 * v4.1h: one event's organiser page (D33). Opened with the event's private link
 * (/organiser/{id}#k=…, the key never reaches the server's logs) or with the master code.
 * Totals for this event only; the danger zone at the very bottom deletes this event's data only (D34).
 */
export default function EventOrganiserPage() {
  const params = useParams<{ eventId: string }>();
  const id = params?.eventId ?? "";
  const [auth, setAuth] = useState<{ key: string; master: string } | null>(null);
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [stats, setStats] = useState<OrganiserStats | null>(null);
  const [isMaster, setIsMaster] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const [code, setCode] = useState("");
  const [origin, setOrigin] = useState("");
  const [rotating, setRotating] = useState(false);
  const [rotateBusy, setRotateBusy] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { toast, show, hide } = useToast();

  useEffect(() => {
    setOrigin(window.location.origin);
    const fromHash = keyFromHash(window.location.hash);
    if (fromHash) {
      writeSession(eventKeyName(id), fromHash);
      // Take the key out of the address bar (screenshots, shoulder-surfing); this tab remembers it.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setAuth({ key: fromHash || readSession(eventKeyName(id)), master: readSession(MASTER_KEY) });
  }, [id]);

  const load = useCallback(async () => {
    if (!auth) return;
    if (!auth.key && !auth.master) {
      setLocked(true);
      return;
    }
    const result = await orgFetch<EventReply>(`/api/organiser/events/${encodeURIComponent(id)}`, auth);
    if (!result.ok) {
      setError(result.data.error || "That link or code doesn't work.");
      if (result.status === 401) {
        setLocked(true);
        writeSession(eventKeyName(id), "");
      }
      return;
    }
    setError("");
    setLocked(false);
    setEvent(result.data.event);
    setStats(result.data.stats);
    setIsMaster(result.data.master);
  }, [auth, id]);

  useEffect(() => {
    if (!auth || locked) return;
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [auth, locked, load]);

  async function rotate() {
    if (!auth || rotateBusy) return;
    setRotateBusy(true);
    const result = await orgFetch<{ key: string; event: EventSummary }>(`/api/organiser/events/${encodeURIComponent(id)}`, auth, { action: "rotate" });
    setRotateBusy(false);
    if (!result.ok) {
      show(result.data.error || "Couldn't make a new link. Try again.");
      return;
    }
    writeSession(eventKeyName(id), result.data.key);
    setAuth({ ...auth, key: result.data.key });
    setEvent(result.data.event);
    setNewKey(result.data.key);
  }

  async function removeData(confirm: string): Promise<string | null> {
    if (!auth) return "That link or code doesn't work.";
    const result = await orgFetch<{ stats: OrganiserStats; deleted: { connectionsDeleted: number; cardsDeleted: number } }>(
      `/api/organiser/events/${encodeURIComponent(id)}`,
      auth,
      { action: "delete-data", confirm },
    );
    if (!result.ok) return result.data.error || "Couldn't delete. Try again.";
    setStats(result.data.stats);
    setDeleting(false);
    show(`${event?.name ?? "This event"}'s data was deleted.`);
    return null;
  }

  return (
    <main className="shell page-top pb-16">
      <div className="flex items-center gap-2">
        <Link href="/" className="pill plate">
          Afterflow
        </Link>
        {isMaster ? (
          <Link href="/organiser" className="pill plate">
            All events
          </Link>
        ) : null}
      </div>
      <h1 className="t-display mt-4">Organiser</h1>
      {event ? (
        <p className="pill plate mt-2" data-event-name={event.name}>
          {event.name} · {dayLabel(event)}
        </p>
      ) : null}
      <p className="mt-2 text-[15px] text-muted">
        Totals only. Nothing here is per person, and nobody is ranked. Cards stay until people delete them.
      </p>
      {locked ? (
        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(submit) => {
            submit.preventDefault();
            writeSession(MASTER_KEY, code);
            setLocked(false);
            setAuth({ key: "", master: code });
          }}
        >
          <p className="text-[15px] leading-[21px]">Open this page from the organiser link you were sent. Or enter the master code.</p>
          {error ? (
            <p role="alert" className="text-[14px] text-hot">
              {error}
            </p>
          ) : null}
          <label className="field" htmlFor="passcode">
            <span className="field-label">Master code</span>
            <input id="passcode" type="password" autoComplete="off" value={code} onChange={(change) => setCode(change.target.value)} />
          </label>
          <button type="submit" className="btn btn-lg btn-ink w-full" disabled={!code}>
            Open
          </button>
        </form>
      ) : (
        <div className="mt-6">
          <Headline stats={stats} />
          <p className="mt-4 text-[13px] text-muted" id="org-context">
            This event: {stats?.connectionsRequested ?? "…"} connections requested · {stats?.signups ?? "…"} cards. Refreshes every few seconds.
          </p>
          {error ? <p className="mt-3 text-[14px] text-hot">{error}</p> : null}

          {event ? (
            <>
              <h2 className="tag mx-4 mt-8 mb-2">Links</h2>
              <div className="group">
                <LinkRow id="join-link" label="Attendee link" url={joinUrl(origin, event.id)} hint="People join this event when they make or open their card." />
                <button type="button" className="item flush items-center" onClick={() => setRotating(true)} aria-haspopup="dialog">
                  <span className="min-w-0 flex-1">
                    <span className="t block">Make a new organiser link</span>
                    <span className="s block">
                      {event.hasLink ? "The old link stops working straight away." : "This event has no organiser link yet."}
                    </span>
                  </span>
                </button>
              </div>
            </>
          ) : null}

          {/* D34: far below everything, quiet, and behind a typed confirm (per Tanvir). */}
          <section id="danger-zone" aria-labelledby="danger-title" className="danger-zone org-danger">
            <h2 id="danger-title" className="tag mx-4 mb-2">
              Danger zone
            </h2>
            <button type="button" className="btn btn-outline-quiet w-full" onClick={() => setDeleting(true)} aria-haspopup="dialog" disabled={!event}>
              Delete this event&apos;s data
            </button>
            <p className="mx-4 mt-2 text-[13px] leading-[18px] text-muted">
              Removes this event&apos;s connections and the list of who joined. Other events aren&apos;t touched. You&apos;ll be asked to type the
              event name.
            </p>
          </section>
        </div>
      )}

      <Sheet
        open={rotating}
        onClose={() => {
          if (rotateBusy) return;
          setRotating(false);
          setNewKey("");
        }}
        labelledBy="rotate-title"
      >
        <h2 id="rotate-title" className="round text-center text-[20px] leading-6 font-black">
          {newKey ? "Your new organiser link" : "Make a new organiser link?"}
        </h2>
        {newKey && event ? (
          <>
            <div className="group mt-3.5">
              <LinkRow id="new-organiser-link" label="Private organiser link" url={organiserUrl(origin, event.id, newKey)} />
            </div>
            <OnceNotice />
            <button
              type="button"
              className="btn btn-lg btn-ink mt-3.5 w-full"
              onClick={() => {
                setRotating(false);
                setNewKey("");
              }}
            >
              Done
            </button>
          </>
        ) : (
          <>
            <p className="mx-auto mt-1.5 max-w-[310px] text-center text-[15px] leading-[21px] text-muted">
              The old link stops working straight away, for everyone who has it. You&apos;ll see the new one once.
            </p>
            <button type="button" className="btn btn-lg btn-ink mt-3.5 w-full" onClick={() => void rotate()} disabled={rotateBusy} aria-busy={rotateBusy}>
              {rotateBusy ? <Spinner /> : null}
              Make a new link
            </button>
            <button type="button" className="btn btn-lg btn-plain-ink mt-1 w-full" onClick={() => setRotating(false)} disabled={rotateBusy}>
              Cancel
            </button>
          </>
        )}
      </Sheet>
      <DeleteEventSheet open={deleting} name={event?.name ?? ""} onClose={() => setDeleting(false)} onDelete={removeData} />
      <Toast toast={toast} onDone={hide} />
    </main>
  );
}
