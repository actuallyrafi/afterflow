"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CalendarReminder } from "@/components/calendar-reminder";
import { RecapDone, RecapEmpty, RecapRow } from "@/components/recap";
import { CircleButton, Sheet, Toast, TopBar, useToast } from "@/components/ui/chrome";
import { Icon } from "@/components/ui/icons";
import { api } from "@/lib/api";
import type { ConnectionCard, RecapResult } from "@/lib/connections";
import { firstOf } from "@/lib/handoff";
import { datePill, HELLO_LABEL, RECAP_COPY, rowDone } from "@/lib/recap";
import type { HelloVia } from "@/lib/store";

export default function RecapPage() {
  const { token, eventId } = useParams<{ token: string; eventId: string }>();
  const [data, setData] = useState<RecapResult | null>(null);
  const [missing, setMissing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [said, setSaid] = useState("");
  const { toast, show, hide } = useToast();
  const home = `/m/${token}`;

  const load = useCallback(async () => {
    const result = await api<RecapResult>(`/api/profiles/${token}/recap/${encodeURIComponent(eventId)}`);
    if (result.ok) setData(result.data);
    else if (result.status === 404) setMissing(true);
  }, [token, eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (data) document.title = `${data.event.name} · Afterflow`;
  }, [data]);

  function patch(id: string, change: Partial<ConnectionCard>) {
    setData((current) =>
      current ? { ...current, people: current.people.map((person) => (person.id === id ? { ...person, ...change } : person)) } : current,
    );
  }

  async function post(id: string, body: Record<string, unknown>) {
    const result = await api<{ connection?: ConnectionCard }>(`/api/profiles/${token}/connections/${encodeURIComponent(id)}`, {
      method: "POST",
      body,
    });
    if (result.ok && result.data.connection) patch(id, result.data.connection);
    else if (!result.ok) show("Couldn't save that. Try again.");
  }

  function hello(person: ConnectionCard, via: HelloVia) {
    patch(person.id, { hello: { via, at: new Date().toISOString() } });
    setSaid(`${HELLO_LABEL[via]} for ${firstOf(person.other.name)}.`);
    void post(person.id, { action: "hello_opened", via });
  }

  function talked(person: ConnectionCard, on: boolean) {
    patch(person.id, { talkedAgain: on });
    setSaid(on ? `Marked as talked with ${firstOf(person.other.name)}.` : `Unmarked ${firstOf(person.other.name)}.`);
    void post(person.id, { action: on ? "talked_again" : "talked_again_undo" });
  }

  async function setHidden(hidden: boolean) {
    const result = await api(`/api/profiles/${token}/events`, {
      method: "POST",
      body: { action: hidden ? "recap_hide" : "recap_show", eventId },
    });
    if (!result.ok) {
      show("Couldn't save that. Try again.");
      return;
    }
    setData((current) => (current ? { ...current, hidden } : current));
    if (hidden) show(RECAP_COPY.hiddenToast, { undo: () => setHidden(false) });
  }

  const top = (
    <TopBar
      left={
        <Link href={home} aria-label="Back to Your people" className="circle glass">
          <Icon name="back" />
        </Link>
      }
      right={data && data.people.length ? <CircleButton icon="more" label="More for this recap" onClick={() => setMenu(true)} /> : null}
    />
  );

  if (missing) {
    return (
      <main className="shell page-top flex flex-col items-center justify-center pb-24 text-center">
        {top}
        <h1 className="t-title mt-24">This recap isn&apos;t here anymore.</h1>
        <p className="mt-2 text-[15px] text-muted">The event may have been deleted. Nothing else changed.</p>
        <Link href={home} className="btn btn-lg btn-ink mt-6 w-[220px]">
          Back to Your people
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="shell page-top" aria-busy="true">
        {top}
        <div className="skeleton mt-6 h-10 w-64" />
        <div className="skeleton mt-3 h-7 w-28" />
        <div className="skeleton mt-6 h-72 w-full" />
      </main>
    );
  }

  const { event, people, me } = data;
  const allDone = people.length > 0 && people.every(rowDone);
  const lastMutual = Math.max(...people.map((person) => Date.parse(person.mutualAt ?? person.metAt)), 0);

  return (
    <main className="shell page-top pb-16">
      {top}
      <h1 className="round mt-3 text-[32px] leading-9 font-black text-balance">{event.name}</h1>
      <span className="pill mt-2.5 !h-[34px] !px-3.5 !text-[15px]">{datePill(event.date)}</span>
      {!people.length ? (
        <RecapEmpty token={token} eventName={event.name} />
      ) : (
        <>
          {allDone ? (
            <div className="mt-4">
              <RecapDone people={people} />
            </div>
          ) : (
            <p className="mt-3 mb-4 text-[16px] leading-[22px] text-muted">{RECAP_COPY.sub}</p>
          )}
          <ul className="recap-list" aria-label={`People from ${event.name}`}>
            {people.map((person) => (
              <RecapRow
                key={person.id}
                token={token}
                person={person}
                myName={me.name}
                myContacts={me.contacts}
                onHello={(via) => hello(person, via)}
                onTalked={(on) => talked(person, on)}
                onToast={(text) => show(text)}
              />
            ))}
          </ul>
          <div className="mt-1">
            <CalendarReminder
              connectionId=""
              theirName=""
              metAt={people[0].metAt}
              onAdded={() => undefined}
              onToast={(text) => show(text)}
              recap={{ eventId: event.id, eventName: event.name, lastMutual }}
            />
          </div>
        </>
      )}
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
      <Sheet open={menu} onClose={() => setMenu(false)} label={`${event.name} recap`}>
        <div className="group">
          {data.hidden ? (
            <button type="button" className="item w-full text-left" onClick={() => { setMenu(false); void setHidden(false); }}>
              <span className="t flex-1">Show this recap on Your people</span>
            </button>
          ) : (
            <button type="button" className="item w-full text-left" onClick={() => { setMenu(false); void setHidden(true); }}>
              <span className="t flex-1">{RECAP_COPY.hideLabel}</span>
            </button>
          )}
          <button
            type="button"
            className="item w-full text-left"
            onClick={() => {
              setMenu(false);
              window.setTimeout(() => document.getElementById("recap-cal")?.click(), 260);
            }}
          >
            <span className="t flex-1">{RECAP_COPY.calRow}</span>
          </button>
        </div>
        <button type="button" className="btn btn-lg btn-fill mt-3 w-full" onClick={() => setMenu(false)}>
          Cancel
        </button>
      </Sheet>
      <Toast toast={toast} onDone={hide} />
    </main>
  );
}
