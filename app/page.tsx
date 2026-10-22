"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EventQr } from "@/components/event-qr";
import { savedToken } from "@/lib/api";
import { EVENT_LINE } from "@/lib/event";

export default function HomePage() {
  const [resume, setResume] = useState<string | null>(null);

  useEffect(() => {
    const token = savedToken();
    if (token) setResume(`/m/${token}`);
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pt-[calc(env(safe-area-inset-top)+40px)] pb-8">
      <div className="grid flex-1 items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="pill">{EVENT_LINE}</span>
          <h1 className="round mt-4 text-[clamp(3rem,12vw,5.5rem)] leading-[0.95] font-black tracking-[-0.03em]">Afterflow</h1>
          <p className="mt-4 max-w-md text-[clamp(1.15rem,2.4vw,1.5rem)] leading-snug">Keep the people you meet in your life.</p>
          <p className="mt-3 max-w-md text-[15px] leading-[22px] text-muted">
            Make a quick card, show it to someone you just met, and both say yes. Later, say hi on WhatsApp, Discord, Instagram or email.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <Link href={resume ?? "/survey"} className="btn btn-lg btn-ink px-7">
              {resume ? "Your people" : "Make your card"}
            </Link>
            {resume ? (
              <Link href={`${resume}/card`} className="btn btn-lg btn-fill px-6">
                My card
              </Link>
            ) : null}
          </div>
        </div>
        <div className="panel mx-auto w-full max-w-[22rem] p-5 text-center">
          <p className="round text-[16px] font-extrabold">Scan to open Afterflow</p>
          <div className="mt-3">
            <EventQr />
          </div>
        </div>
      </div>
      <footer className="flex flex-wrap gap-x-5 gap-y-2 pt-10 text-[13px] text-muted">
        <span>Your card stays until you delete it.</span>
        <Link href="/how-we-built" className="underline underline-offset-2">
          How we built this
        </Link>
        <Link href="/organiser" className="underline underline-offset-2">
          Organiser
        </Link>
      </footer>
    </main>
  );
}
