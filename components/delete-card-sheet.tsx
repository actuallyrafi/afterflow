"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sheet, Spinner } from "@/components/ui/chrome";
import { Icon } from "@/components/ui/icons";
import { api, forgetToken } from "@/lib/api";
import { firstOf } from "@/lib/handoff";
import { nameMatches } from "@/lib/name-match";

/**
 * The one place to delete your card: a firm confirm sheet opened from the Danger zone at the
 * bottom of My card. It says exactly what goes, starts on "Keep my card", and the red button
 * stays off until you type your name.
 */
export function DeleteCardSheet({ token, name, open, onClose }: { token: string; name: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) return;
    setTyped("");
    setTouched(false);
    setError("");
  }, [open]);

  const target = firstOf(name);
  const matches = nameMatches(typed, name);
  const showMismatch = touched && typed.trim().length > 0 && !matches;

  async function remove() {
    if (!matches || busy) return;
    setBusy(true);
    setError("");
    const result = await api<{ deleted?: boolean }>(`/api/profiles/${token}`, { method: "DELETE", body: { name: typed } });
    if (!result.ok || !result.data.deleted) {
      setBusy(false);
      setError(result.data.error || "Couldn't delete your card. Try again.");
      return;
    }
    forgetToken();
    router.replace("/deleted");
  }

  return (
    <Sheet open={open} onClose={() => (busy ? undefined : onClose())} role="alertdialog" labelledBy="delete-title" describedBy="delete-desc">
      <div className="tile tile-hot mx-auto size-[52px]">
        <Icon name="trash" size={26} />
      </div>
      <h2 id="delete-title" className="round mt-3 text-center text-[20px] leading-6 font-black">
        Delete your card?
      </h2>
      <p id="delete-desc" className="mx-auto mt-1.5 max-w-[310px] text-center text-[15px] leading-[21px] text-muted">
        Your card and answer, your notes (private and shared), your events and all your connections are removed. Your QR link stops working.
      </p>
      <ul className="group mt-3.5">
        <li className="item flush">
          <span>
            <span className="t block !text-[15px]">Stays where it is</span>
            <span className="s block">Anything you&apos;ve already shared on WhatsApp, Discord, Instagram or email.</span>
          </span>
        </li>
        <li className="item flush">
          <span>
            <span className="t block !text-[15px]">Nobody is told</span>
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
        <label className={`field mt-3 ${showMismatch ? "invalid" : ""}`} htmlFor="confirm-name">
          <span className="field-label">Type your name to confirm: {target}</span>
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
            disabled={busy}
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
        <button type="submit" className="btn btn-lg btn-hot mt-3.5 w-full" disabled={!matches || busy} aria-busy={busy}>
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
      <button type="button" className="btn btn-lg btn-plain-ink mt-1 w-full" onClick={onClose} disabled={busy}>
        Keep my card
      </button>
    </Sheet>
  );
}
