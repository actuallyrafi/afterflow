"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleLink, Spinner, TopBar } from "@/components/ui/chrome";
import { Icon } from "@/components/ui/icons";
import { Unavailable } from "@/components/unavailable";
import { api, forgetToken } from "@/lib/api";
import { nameMatches } from "@/lib/name-match";
import type { HomeResult } from "@/lib/connections";
import { firstOf } from "@/lib/handoff";

export default function DeleteCard() {
  const { token } = useParams<{ token: string }>();
  const [name, setName] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [typed, setTyped] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    void api<HomeResult>(`/api/profiles/${token}`).then((result) => {
      if (result.ok && result.data.profile) setName(result.data.profile.name);
      else if (result.status === 404) setMissing(true);
    });
  }, [token]);

  if (done) {
    return (
      <main className="shell flex min-h-dvh flex-col items-center justify-center px-9 text-center">
        <div className="tile tile-ok pop size-[72px]">
          <Icon name="check" size={34} />
        </div>
        <h1 className="round mt-[18px] text-[28px] leading-[34px] font-black" tabIndex={-1} ref={(el) => el?.focus()}>
          Your card is deleted
        </h1>
        <p className="mt-2 text-[16px] leading-[23px] text-muted">
          Thanks for coming along. If you meet people at the next one, you can make a new card anytime.
        </p>
        <Link href="/" className="btn btn-lg btn-ink mt-[26px] w-[220px]">
          Done
        </Link>
      </main>
    );
  }

  if (missing) return <Unavailable />;

  const target = name ? firstOf(name) : "";
  const matches = name ? nameMatches(typed, name) : false;
  const showMismatch = touched && typed.trim().length > 0 && !matches;

  async function remove() {
    if (!matches) return;
    setBusy(true);
    setError("");
    const result = await api<{ deleted?: boolean }>(`/api/profiles/${token}`, { method: "DELETE", body: { name: typed } });
    if (!result.ok || !result.data.deleted) {
      setBusy(false);
      setError(result.data.error || "Couldn't delete your card. Try again.");
      return;
    }
    forgetToken();
    setDone(true);
  }

  return (
    <main className="shell page-top pb-16">
      <TopBar left={<CircleLink href={`/m/${token}/card`} icon="back" label="Back to My card" />} />
      <div className="tile tile-hot">
        <Icon name="trash" size={28} />
      </div>
      <h1 className="t-title mt-3.5">Delete your card?</h1>
      <p className="mt-1.5 mb-3.5 text-[15px] leading-[21px] text-muted">Take your time. Here&apos;s exactly what happens.</p>
      <ul className="group">
        <li className="item">
          <Icon name="trash" className="hot" />
          <span>
            <span className="t block !text-[16px]">Removed from Afterflow</span>
            <span className="s block">
              Your card and answer, your notes (private and shared), and all your connections. Your QR link stops working.
            </span>
          </span>
        </li>
        <li className="item">
          <Icon name="chat" />
          <span>
            <span className="t block !text-[16px]">Stays where it is</span>
            <span className="s block">Anything you&apos;ve already shared on WhatsApp, Discord, Instagram or email.</span>
          </span>
        </li>
        <li className="item">
          <Icon name="lock" />
          <span>
            <span className="t block !text-[16px]">Nobody is told</span>
            <span className="s block">You&apos;ll quietly leave other people&apos;s lists.</span>
          </span>
        </li>
      </ul>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void remove();
        }}
      >
        <label className={`field mt-3.5 ${showMismatch ? "invalid" : ""}`} htmlFor="confirm-name">
          <span className="field-label">Type your name to confirm: {target || "…"}</span>
          <input
            id="confirm-name"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={() => setTouched(true)}
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            aria-invalid={showMismatch}
            aria-describedby="confirm-help"
            disabled={!name || busy}
          />
        </label>
        <p id="confirm-help" className="mx-1 mt-2 text-[12px] text-muted" aria-live="polite">
          {showMismatch ? "That doesn't match your name yet." : "This can't be undone."}
        </p>
        {error ? (
          <p role="alert" className="mx-1 mt-2 text-[14px] text-hot">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-lg btn-hot mt-4 w-full" disabled={!matches || busy} aria-busy={busy}>
          {busy ? (
            <>
              <Spinner />
              Deleting…
            </>
          ) : (
            "Delete my card"
          )}
        </button>
      </form>
      <Link href={`/m/${token}/card`} className="btn btn-lg btn-plain-ink mt-1 w-full">
        Keep my card
      </Link>
    </main>
  );
}
