"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/chrome";
import { Icon } from "@/components/ui/icons";
import { api, savedToken } from "@/lib/api";
import { RECAP_COPY, recapLinkTarget } from "@/lib/recap";

export function RecapLink({ eventId }: { eventId: string }) {
  const [state, setState] = useState<"checking" | "elsewhere">("checking");

  useEffect(() => {
    const token = savedToken();
    if (!token) {
      setState("elsewhere");
      return;
    }
    // Only this device's saved session opens it; the server checks the token owns the event.
    void api(`/api/profiles/${encodeURIComponent(token)}/recap/${encodeURIComponent(eventId)}`).then((result) => {
      const target = recapLinkTarget(eventId, token, result.ok);
      if (target) window.location.replace(target);
      else setState("elsewhere");
    });
  }, [eventId]);

  if (state === "checking") {
    return (
      <main className="shell grid place-items-center" aria-busy="true">
        <Spinner />
        <span className="sr-only">Opening Afterflow…</span>
      </main>
    );
  }

  return (
    <main className="shell flex flex-col items-center justify-center pb-16 text-center">
      <div className="tile tile-ok mb-4">
        <Icon name="calendar" size={28} />
      </div>
      <h1 className="t-title max-w-[300px]">{RECAP_COPY.signedOut}</h1>
      <p className="mt-2 max-w-[300px] text-[15px] leading-[21px] text-muted">
        This reminder opens on the device where you saved your card. Nothing here shows who it&apos;s about.
      </p>
      <Link href="/" className="btn btn-lg btn-fill mt-6 w-[240px]">
        Go to Afterflow
      </Link>
    </main>
  );
}
