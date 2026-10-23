"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { Sheet, Spinner } from "@/components/ui/chrome";
import type { OrganiserStats } from "@/lib/organiser";

/** The two headline totals, unchanged from v4: totals only, never per person. */
export function Headline({ stats }: { stats: Partial<OrganiserStats> | null }) {
  const value = (n: number | undefined) => (stats && typeof n === "number" ? n : "…");
  return (
    <div className="grid grid-cols-2 gap-3">
      <section className="panel p-4" aria-label="Talked again">
        <p className="text-[13px] font-semibold text-muted">Talked again</p>
        <p className="round mt-1 text-[44px] leading-none font-black" data-stat="talked">
          {value(stats?.talkedAgainMarks)}
        </p>
        <p className="mt-2 text-[12px] leading-4 text-muted">Private marks, added up. Across {value(stats?.pairsTalkedAgain)} connections.</p>
      </section>
      <section className="panel p-4" aria-label="Mutual confirms">
        <p className="text-[13px] font-semibold text-muted">Both said yes</p>
        <p className="round mt-1 text-[44px] leading-none font-black" data-stat="mutual">
          {value(stats?.mutualConfirms)}
        </p>
        <p className="mt-2 text-[12px] leading-4 text-muted">Connections confirmed by both people.</p>
      </section>
    </div>
  );
}

export function dayLabel(event: { date: string }) {
  if (!event.date) return "No date";
  return new Date(`${event.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
}

/** A link in a row with Copy (and Share where the phone has it). */
export function LinkRow({ label, url, hint, id }: { label: string; url: string; hint?: string; id: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      (document.getElementById(id) as HTMLInputElement | null)?.select();
    }
  }
  return (
    <div className="item flush flex-col !items-stretch !gap-2">
      <label htmlFor={id} className="t block !text-[15px] font-semibold">
        {label}
      </label>
      <input id={id} readOnly value={url} className="org-link" onFocus={(event) => event.currentTarget.select()} spellCheck={false} autoComplete="off" />
      {hint ? <span className="s block">{hint}</span> : null}
      <div className="flex gap-2">
        <button type="button" className="btn btn-sm btn-fill" onClick={() => void copy()}>
          <Icon name={copied ? "check" : "copy"} size={16} />
          {copied ? "Copied" : "Copy"}
        </button>
        {canShare ? (
          <button type="button" className="btn btn-sm btn-fill" onClick={() => void navigator.share({ url }).catch(() => undefined)}>
            <Icon name="share" size={16} />
            Share
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** "Save this link, it's only shown once." */
export function OnceNotice() {
  return (
    <p className="org-once" role="note">
      <Icon name="lock" size={16} className="mt-0.5 flex-none" />
      <span>
        <b>Save this link now. It&apos;s only shown once.</b> Anyone with it can see this event&apos;s totals and delete its data, so send it only to
        the other organiser.
      </span>
    </p>
  );
}

/** D34: the typed-name confirm for "Delete this event's data". */
export function DeleteEventSheet({
  open,
  name,
  onClose,
  onDelete,
}: {
  open: boolean;
  name: string;
  onClose: () => void;
  onDelete: (confirm: string) => Promise<string | null>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) return;
    setTyped("");
    setError("");
    setBusy(false);
  }, [open]);
  const matches = typed === name;
  const showMismatch = typed.length > 0 && !matches;
  async function submit() {
    if (!matches || busy) return;
    setBusy(true);
    setError("");
    const problem = await onDelete(typed);
    setBusy(false);
    if (problem) setError(problem);
  }
  return (
    <Sheet open={open} onClose={() => (busy ? undefined : onClose())} role="alertdialog" labelledBy="del-event-title" describedBy="del-event-desc">
      <div className="tile tile-hot mx-auto size-[52px]">
        <Icon name="trash" size={26} />
      </div>
      <h2 id="del-event-title" className="round mt-3 text-center text-[20px] leading-6 font-black">
        Delete this event&apos;s data?
      </h2>
      <p id="del-event-desc" className="mx-auto mt-1.5 max-w-[320px] text-center text-[15px] leading-[21px] text-muted">
        Only {name}. Its connections, their notes and marks, and the list of who joined are removed. Other events aren&apos;t touched.
      </p>
      <ul className="group mt-3.5">
        <li className="item flush">
          <span>
            <span className="t block !text-[15px]">Cards made just for this event</span>
            <span className="s block">Deleted, when the person isn&apos;t in another event and has no other connections.</span>
          </span>
        </li>
        <li className="item flush">
          <span>
            <span className="t block !text-[15px]">Everyone else keeps their card</span>
            <span className="s block">They just leave this event. Their other connections stay.</span>
          </span>
        </li>
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className={`field mt-3 ${showMismatch ? "invalid" : ""}`} htmlFor="confirm-event">
          <span className="field-label">Type the event name to confirm: {name}</span>
          <input
            id="confirm-event"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={showMismatch}
            aria-describedby="confirm-event-help"
            disabled={busy}
          />
        </label>
        <p id="confirm-event-help" className="mx-1 mt-2 text-[12px] text-muted" aria-live="polite">
          {showMismatch ? "That doesn't match the event name yet." : "This can't be undone."}
        </p>
        {error ? (
          <p role="alert" className="mx-1 mt-2 text-[14px] text-hot">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-lg btn-hot mt-3.5 w-full" disabled={!matches || busy} aria-busy={busy}>
          {busy ? (
            <>
              <Spinner />
              Deleting…
            </>
          ) : (
            "Delete this event's data"
          )}
        </button>
      </form>
      <button type="button" className="btn btn-lg btn-plain-ink mt-1 w-full" onClick={onClose} disabled={busy}>
        Keep the data
      </button>
    </Sheet>
  );
}
