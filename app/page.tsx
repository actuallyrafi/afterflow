"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EventQr } from "@/components/event-qr";
import { InstallGuideLink, InstallGuideSection } from "@/components/install-guide";
import { savedToken } from "@/lib/api";
import { EVENT, EVENT_LINE } from "@/lib/event";

// v4.1c (D18, per Tanvir): the landing is long again, like the hackathon page, with its extra
// lines brought back and rewritten to match what v4 actually does. Every line here is true today.
const STEPS: { title: string; body: string }[] = [
  {
    title: "Make a card",
    body: "Three things: your name, the ways to reach you (WhatsApp, Discord, Instagram or email; star the one you like best), and one question: What's something you're into right now? That's it.",
  },
  {
    title: "Show it to someone you just met",
    body: "They scan your QR code or open your link and tap Yes, we met. You can add someone you talked to the same way.",
  },
  {
    title: "Both say yes",
    body: "Your contact details only show once you both confirm. If one of you doesn't, nothing happens and nobody is told.",
  },
  {
    title: "Say hi later, on the app you already use",
    body: "Open them in Your people to see what you both said, then Say hi with a ready message you can change. If you both use an app, that comes first. WhatsApp opens with the message filled in, email opens a draft, Instagram opens their profile, Discord copies their username.",
  },
  {
    title: "Keep them by event",
    body: "The Events tab groups people by where you met. Tap I'm at an event now and the people you add are filed there. Your events are private: filing someone changes nothing for them.",
  },
  {
    title: "One gentle reminder",
    body: "About three days later, at most one nudge per person, in the app or as one event in your own calendar. Turn it off any time on My card. Nothing is counted.",
  },
];

const QUIET = [
  "Your answer shows on your card link. Your contact only shows once you both say yes.",
  "Your private notes are just for you. The shared note is visible to both of you.",
  "Mute, Remove and Block are quiet: the other person is never told.",
  "No chat, no feed, no profiles to browse, no scores, no follower counts.",
  "Your card stays until you delete it. Delete my card really deletes your card, links and connections.",
];

export default function HomePage() {
  const [resume, setResume] = useState<string | null>(null);

  useEffect(() => {
    const token = savedToken();
    if (token) setResume(`/m/${token}`);
  }, []);

  const cta = (
    <div className="flex flex-wrap items-center gap-2.5">
      <Link href={resume ?? "/survey"} className="btn btn-lg btn-ink px-7">
        {resume ? "Your people" : "Make your card"}
      </Link>
      {resume ? (
        <Link href={`${resume}/card`} className="btn btn-lg btn-fill px-6">
          My card
        </Link>
      ) : null}
    </div>
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pt-[calc(env(safe-area-inset-top)+40px)] pb-8">
      <div className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="pill">{EVENT_LINE}</span>
          <h1 className="round mt-4 text-[clamp(3rem,12vw,5.5rem)] leading-[0.95] font-black tracking-[-0.03em]">Afterflow</h1>
          <p className="mt-4 max-w-md text-[clamp(1.15rem,2.4vw,1.5rem)] leading-snug">Keep the people you meet in your life.</p>
          <p className="mt-3 max-w-md text-[17px] leading-6">
            You already met. Afterflow gets the two of you talking again after the event.
          </p>
          <p className="mt-3 max-w-md text-[15px] leading-[22px] text-muted">
            Make a quick card, show it to someone you just met, and both say yes. Later, say hi on WhatsApp, Discord, Instagram or email.
          </p>
          <div className="mt-7">{cta}</div>
          <p className="mt-5 max-w-md text-[14px] leading-5 text-muted">
            Make a card, then add someone you talked to. Your contact stays hidden until you both say yes.
          </p>
        </div>
        <div className="panel mx-auto w-full max-w-[22rem] p-5 text-center">
          <p className="round text-[16px] font-extrabold">Scan to open Afterflow</p>
          <div className="mt-3">
            <EventQr />
          </div>
        </div>
      </div>

      <section className="mt-14 max-w-2xl" aria-labelledby="why-title">
        <h2 id="why-title" className="round text-[26px] leading-8 font-black tracking-[-0.01em]">
          Talking is easy at an event. Afterwards, it stops.
        </h2>
        <p className="mt-3 text-[16px] leading-6">
          Swapping contacts doesn&apos;t make a friendship, and messaging someone you barely know gets more awkward every day you wait.
          Afterflow is for people who already met in real life and want to keep casually talking, so strangers can become familiar,
          and maybe friends.
        </p>
        <p className="mt-3 text-[16px] leading-6 text-muted">
          It doesn&apos;t match you with strangers, score anyone, or replace the apps you already use. It started at the {EVENT.name}{" "}
          ({EVENT_DAY_LONG}).
        </p>
        <p className="round mt-5 text-[19px] leading-7 font-extrabold">Afterflow is the connector, not the connection. You do the connecting.</p>
      </section>

      <section className="mt-12" aria-labelledby="how-title">
        <h2 id="how-title" className="round text-[26px] leading-8 font-black tracking-[-0.01em]">
          How it works
        </h2>
        <ol className="mt-4 grid gap-2.5 md:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step.title} className="panel flex gap-3.5 p-4">
              <span className="round flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-[15px] font-black" aria-hidden>
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="round block text-[17px] leading-[22px] font-extrabold">{step.title}</span>
                <span className="mt-1 block text-[15px] leading-[22px] text-muted">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 max-w-2xl" aria-labelledby="quiet-title">
        <h2 id="quiet-title" className="round text-[26px] leading-8 font-black tracking-[-0.01em]">
          Private and quiet
        </h2>
        <ul className="panel mt-4 px-4 py-1">
          {QUIET.map((line) => (
            <li key={line} className="border-b-[0.5px] border-line py-3 text-[15px] leading-[22px] last:border-b-0">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <InstallGuideSection />

      <section className="mt-12 max-w-2xl" aria-labelledby="start-title">
        <h2 id="start-title" className="round text-[22px] leading-7 font-black">
          Met someone? Make your card and show it to them.
        </h2>
        <p className="mt-2 text-[15px] leading-[22px] text-muted">Three fields, no account, no password. Your private link is saved on this phone.</p>
        <div className="mt-5">{cta}</div>
      </section>

      <footer className="flex flex-wrap gap-x-5 gap-y-2 pt-14 text-[13px] text-muted">
        <span>Your card stays until you delete it.</span>
        <Link href="/how-we-built" className="underline underline-offset-2">
          How we built this
        </Link>
        <Link href="/organiser" className="underline underline-offset-2">
          Organiser
        </Link>
        <InstallGuideLink className="underline underline-offset-2" />
      </footer>
    </main>
  );
}

const EVENT_DAY_LONG = new Date(`${EVENT.date}T12:00:00Z`).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});
