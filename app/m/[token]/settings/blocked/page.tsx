"use client";

import { DemoTag } from "@/components/ui/demo-tag";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CircleLink, Sheet, Toast, TopBar, useToast } from "@/components/ui/chrome";
import { Mark } from "@/components/ui/mark";
import { api, shortDate } from "@/lib/api";
import type { BlockedPerson } from "@/lib/connections";
import { firstOf } from "@/lib/handoff";

export default function BlockedList() {
  const { token } = useParams<{ token: string }>();
  const [people, setPeople] = useState<BlockedPerson[] | null>(null);
  const [asking, setAsking] = useState<BlockedPerson | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show, hide } = useToast();

  const load = useCallback(async () => {
    const result = await api<{ people: BlockedPerson[] }>(`/api/profiles/${token}/blocks`);
    setPeople(result.ok ? result.data.people : []);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function unblock(person: BlockedPerson) {
    setBusy(true);
    const result = await api(`/api/profiles/${token}/blocks`, { method: "POST", body: { action: "unblock", publicId: person.publicId } });
    setBusy(false);
    setAsking(null);
    if (!result.ok) {
      show("Couldn't unblock. Try again.");
      return;
    }
    show(`${firstOf(person.name)} is unblocked`);
    await load();
  }

  return (
    <main className="shell page-top pb-16">
      <TopBar left={<CircleLink href={`/m/${token}`} icon="back" label="Back to Your people" />} center={<span className="bar-title">Your people</span>} />
      <h1 className="t-title">Blocked</h1>
      <p className="mt-1 mb-4 text-[15px] leading-[21px] text-muted">Only you see this list. Unblocking doesn&apos;t reconnect you or tell them.</p>
      {people === null ? <div className="skeleton h-[76px] w-full rounded-[28px]" aria-busy="true" /> : null}
      {people && people.length ? (
        <ul className="panel">
          {people.map((person) => (
            <li key={person.publicId} className="row">
              <Mark name={person.name} seed={person.publicId} size={48} state="muted" />
              <span className="row-main">
                <span className="t-name block truncate">{person.name}{person.isDemo ? <DemoTag /> : null}</span>
                <span className="row-line block">Blocked {shortDate(person.blockedAt)}</span>
              </span>
              <button type="button" className="btn btn-sm btn-fill" onClick={() => setAsking(person)}>
                Unblock
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {people && !people.length ? (
        <div className="panel px-5 py-6 text-center text-[15px] text-muted">No one is blocked.</div>
      ) : null}

      <Sheet open={Boolean(asking)} onClose={() => setAsking(null)} role="alertdialog" labelledBy="unblock-title" describedBy="unblock-desc">
        {asking ? (
          <div>
            <h2 id="unblock-title" className="round text-center text-[22px] leading-7 font-black">
              Unblock {firstOf(asking.name)}?
            </h2>
            <p id="unblock-desc" className="mx-auto mt-2 max-w-[300px] text-center text-[15px] leading-[21px] text-muted">
              They won&apos;t be told. You&apos;d need to say yes to each other again to reconnect.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" className="btn btn-lg btn-ink w-full" disabled={busy} aria-busy={busy} onClick={() => void unblock(asking)}>
                Unblock
              </button>
              <button type="button" className="btn btn-lg btn-fill w-full" onClick={() => setAsking(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </Sheet>
      <Toast toast={toast} onDone={hide} />
    </main>
  );
}
