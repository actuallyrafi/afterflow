"use client";

import { EventQr } from "@/components/event-qr";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [resume, setResume] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("afterflow.token");
    if (token) setResume(`/m/${token}`);
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-6">
      <main className="grid flex-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-muted">
            Grok Bot Community Engineering London Hackathon · 22 Oct 2026
          </p>
          <h1 className="mt-3 font-display text-[clamp(3.4rem,11vw,7rem)] leading-[0.86] tracking-tight">
            Afterflow
          </h1>
          <p className="mt-5 max-w-xl text-[clamp(1.25rem,2.4vw,2rem)] leading-snug">
            You already met tonight. Afterflow gets the two of you talking again after the event.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/survey"
              className="inline-flex min-h-14 items-center justify-center bg-accent px-6 text-lg font-semibold text-accent-ink"
            >
              Start
            </Link>
            {resume ? (
              <Link href={resume} className="inline-flex min-h-14 items-center px-2 text-base underline">
                My connections
              </Link>
            ) : null}
          </div>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-muted">
            Make a card, then add someone you talked to. Your contact and LinkedIn stay hidden until you both confirm.
          </p>
        </div>
        <div>
          <p className="mb-3 text-center text-sm uppercase tracking-[0.16em] text-muted">Scan to open</p>
          <EventQr />
        </div>
      </main>
      <footer className="flex flex-wrap gap-x-4 gap-y-2 pt-8 text-sm text-muted">
        <span>Data deleted after the event</span>
        <Link href="/how-we-built" className="underline">
          How we built this
        </Link>
        <Link href="/organiser" className="underline">
          Organiser
        </Link>
      </footer>
    </div>
  );
}
