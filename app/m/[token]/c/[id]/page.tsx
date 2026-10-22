"use client";

import { DemoTag } from "@/components/ui/demo-tag";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NoteCard } from "@/components/note-card";
import { PersonSheet } from "@/components/person-sheet";
import { SayHi } from "@/components/say-hi";
import { stashToast, Toast, TopBar, useToast } from "@/components/ui/chrome";
import { Icon } from "@/components/ui/icons";
import { hueOf, Mark } from "@/components/ui/mark";
import { api, shortDate } from "@/lib/api";
import type { ConnectionCard } from "@/lib/connections";
import { EVENT_LINE, EVENT_SHORT } from "@/lib/event";
import { firstOf } from "@/lib/handoff";

type Loaded = { connection: ConnectionCard; me: { name: string; isDemo: boolean } };

export default function ConnectionPage() {
  const { token, id } = useParams<{ token: string; id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const { toast, show, hide } = useToast();
  const home = `/m/${token}`;

  const load = useCallback(async () => {
    const result = await api<Loaded>(`/api/profiles/${token}/connections/${id}`);
    if (result.ok && result.data.connection) {
      setData(result.data);
      setMissing(false);
    } else if (result.status === 404) {
      setMissing(true);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  // While someone hasn't said yes yet, check back now and then. Once connected, nothing polls.
  const waiting = data && !data.connection.mutual;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 6000);
    return () => window.clearInterval(timer);
  }, [waiting, load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    const result = await api<Partial<Loaded> & { declined?: boolean; removed?: boolean; blocked?: boolean }>(
      `/api/profiles/${token}/connections/${id}`,
      { method: "POST", body: { action, ...extra } },
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.data.error || "Couldn't save that. Try again.");
      return null;
    }
    if (result.data.connection) setData((current) => (current ? { ...current, connection: result.data.connection! } : current));
    return result.data;
  }

  if (missing) {
    return (
      <main className="shell page-top flex flex-col items-center justify-center pb-24 text-center">
        <TopBar left={<BackLink href={home} />} />
        <h1 className="t-title mt-24">This connection isn&apos;t here anymore.</h1>
        <p className="mt-2 text-[15px] text-muted">It may have been removed. Nothing else changed.</p>
        <Link href={home} className="btn btn-lg btn-ink mt-6 w-[220px]">
          Back to Your people
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="shell page-top" aria-busy="true">
        <TopBar left={<BackLink href={home} />} alwaysGlass />
        <div className="skeleton mx-auto mt-6 h-4 w-48" />
        <div className="skeleton mt-6 h-12 w-64" />
        <div className="skeleton mt-3 ml-auto h-12 w-56" />
        <div className="skeleton mt-8 h-40 w-full" />
      </main>
    );
  }

  const { connection, me } = data;
  const other = connection.other;
  const first = firstOf(other.name);
  const contact = other.contact ?? "";

  return (
    <main className="shell page-top pb-16">
      <TopBar
        alwaysGlass
        left={<BackLink href={home} plain />}
        center={
          <button type="button" className="namepill glass" onClick={() => setSheet(true)} aria-haspopup="dialog">
            <Mark name={other.name} seed={other.publicId} size={30} state={connection.muted ? "muted" : undefined} />
            <span>{other.name}</span>
            {other.isDemo ? <DemoTag /> : null}
          </button>
        }
        right={
          <button
            type="button"
            className="circle"
            aria-label={`More options for ${first}`}
            aria-haspopup="dialog"
            onClick={() => setSheet(true)}
          >
            <Icon name="more" />
          </button>
        }
      />

      <div className="rise">
        <p className="event-line mt-1.5">Met at {EVENT_LINE}</p>
        {other.isDemo || me.isDemo ? (
          <p className="-mt-1.5 mb-3 text-center text-[12px] text-muted">
            <DemoTag className="!ml-0 mr-1.5" />
            {other.isDemo && me.isDemo ? "Both cards are demo cards" : other.isDemo ? `${first} is a demo card` : "You're viewing a demo card"}
          </p>
        ) : null}
      </div>

      {other.answer ? (
        <div className="rise" style={{ animationDelay: "40ms" }}>
          <p className="speaker">{first}</p>
          <div className={`them hue-${hueOf(other.publicId)}`}>
            <Mark name={other.name} seed={other.publicId} size={30} />
            <p className="bubble">{other.answer}</p>
          </div>
        </div>
      ) : (
        <p className="event-line">
          {first} didn&apos;t add anything yet. You met at {EVENT_SHORT} — that&apos;s plenty to start with.
        </p>
      )}
      {connection.myAnswer ? (
        <div className="me rise mt-2.5" style={{ animationDelay: "80ms" }}>
          <p className="bubble">{connection.myAnswer}</p>
        </div>
      ) : null}

      {connection.status === "connected" ? (
        <>
          <p className="event-line rise" style={{ animationDelay: "120ms" }}>
            You both said yes
          </p>
          <div className="rise flex flex-col gap-2" style={{ animationDelay: "160ms" }}>
            <NoteCard
              kind="shared"
              value={connection.sharedNote}
              placeholder={`Something you and ${first} want to remember`}
              max={280}
              onSave={async (text) => Boolean(await act("shared_note", { text }))}
            />
            <NoteCard
              kind="private"
              value={connection.myNote}
              placeholder="Add a private note"
              max={180}
              onSave={async (text) => Boolean(await act("my_note", { text }))}
            />
          </div>
          <div className="rise" style={{ animationDelay: "200ms" }}>
            <SayHi connectionId={connection.id} theirName={other.name} theirSeed={other.publicId} contact={contact} myName={me.name} />
          </div>
          <div className="flex items-center justify-between gap-3 px-1.5 pt-4">
            {connection.talkedAgain ? (
              <span className="flex items-center gap-1.5 text-[15px]">
                <Icon name="check" size={18} className="text-[color:var(--h3-deep)]" />
                Talked again{connection.talkedAgainAt ? ` · ${shortDate(connection.talkedAgainAt)}` : ""}
                <button
                  type="button"
                  className="ml-1 text-[14px] text-muted underline underline-offset-[3px]"
                  disabled={busy}
                  onClick={() => void act("talked_again_undo")}
                >
                  Unmark
                </button>
              </span>
            ) : (
              <span className="text-[15px]">
                Talked again?{" "}
                <button
                  type="button"
                  className="font-semibold underline underline-offset-[3px]"
                  disabled={busy}
                  onClick={() => void act("talked_again")}
                >
                  Mark it
                </button>
              </span>
            )}
            <span className="text-[12px] text-faint">Only you see this</span>
          </div>
        </>
      ) : null}

      {connection.status === "waiting_for_them" ? (
        <>
          <p className="event-line">Waiting for {first} to say yes. No rush — their details appear here when they do.</p>
          <NoteCard
            kind="private"
            value={connection.myNote}
            placeholder="Add a private note"
            max={180}
            onSave={async (text) => Boolean(await act("my_note", { text }))}
          />
          {other.isDemo ? (
            <button
              type="button"
              className="btn btn-fill mt-4 w-full"
              disabled={busy}
              onClick={() => void act("simulate_demo_confirm")}
            >
              Demo only: pretend {first} said yes
            </button>
          ) : null}
        </>
      ) : null}

      {connection.status === "waiting_for_you" ? (
        <section className="panel mt-5 p-4" aria-labelledby="did-you-meet">
          <h2 id="did-you-meet" className="round text-[22px] leading-7 font-black">
            Did you meet {first}?
          </h2>
          <p className="mt-1 text-[14px] text-muted">Say yes when you&apos;re ready. Contact details appear once you both do.</p>
          <label className="field mt-3 bg-bg" htmlFor="confirm-note">
            <span className="field-label flex items-center gap-1.5">
              <Icon name="lock" size={14} />
              Private note · only you see this
            </span>
            <input
              id="confirm-note"
              value={note}
              maxLength={180}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What you talked about"
            />
          </label>
          <button
            type="button"
            className="btn btn-lg btn-ink mt-4 w-full"
            disabled={busy}
            aria-busy={busy}
            onClick={async () => {
              const done = await act("confirm");
              if (done && note.trim()) await act("my_note", { text: note.trim() });
            }}
          >
            Yes, we met
          </button>
          <button
            type="button"
            className="btn btn-plain mt-1 w-full"
            disabled={busy}
            onClick={async () => {
              const done = await act("decline");
              if (done) router.push(home);
            }}
          >
            We didn&apos;t meet
          </button>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-center text-[14px] text-hot">
          {error}
        </p>
      ) : null}

      <PersonSheet
        open={sheet}
        onClose={() => setSheet(false)}
        name={other.name}
        seed={other.publicId}
        muted={connection.muted}
        isDemo={other.isDemo}
        busy={busy}
        onMute={async () => {
          const wasMuted = connection.muted;
          const done = await act(wasMuted ? "unmute" : "mute");
          setSheet(false);
          if (!done) return;
          show(wasMuted ? `${first} is unmuted` : `${first} is muted`, {
            ms: 6000,
            undo: async () => {
              await act(wasMuted ? "mute" : "unmute");
            },
          });
        }}
        onRemove={async () => {
          const done = await act("remove");
          if (!done) return;
          stashToast({ text: `Removed ${first}`, action: "undo_remove", connectionId: connection.id }, 8000);
          router.push(home);
        }}
        onBlock={async () => {
          const done = await act("block");
          if (!done) return;
          stashToast({ text: `${first} is blocked`, action: "undo_block", connectionId: connection.id }, 8000);
          router.push(home);
        }}
      />
      <Toast toast={toast} onDone={hide} />
    </main>
  );
}

function BackLink({ href, plain = false }: { href: string; plain?: boolean }) {
  return (
    <Link href={href} aria-label="Back to Your people" className={`circle ${plain ? "" : "glass"}`}>
      <Icon name="back" />
    </Link>
  );
}
