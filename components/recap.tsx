"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ConnectionCard } from "@/lib/connections";
import { defaultOpener, firstOf, planHandoff, type Handoff } from "@/lib/handoff";
import { HELLO_LABEL, RECAP_COPY, rowDone, type RecapCard } from "@/lib/recap";
import type { HelloVia } from "@/lib/store";
import { CHANNEL_LABEL } from "@/lib/survey";
import { CHANNEL_ICON, copyText } from "./say-hi";
import { Icon } from "./ui/icons";
import { Mark } from "./ui/mark";

/** The recap card at the top of Your people (spec §3.1). Never announces itself; no number, no "+N". */
export function RecapCardView({ token, card, onHide }: { token: string; card: RecapCard; onHide: () => void }) {
  return (
    <section className="recap-card mb-3" aria-labelledby="recap-card-title" id="recap-card">
      <p className="over">
        {card.eventName} · {card.when}
      </p>
      <h2 id="recap-card-title" className="title">
        {RECAP_COPY.cardTitle}
      </h2>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <span className="mark-stack" aria-hidden="true">
          {card.people.slice(0, 3).map((person) => (
            <Mark key={person.id} name={person.other.name} seed={person.other.publicId} size={30} letters={1} />
          ))}
        </span>
        <Link href={`/m/${token}/recap/${encodeURIComponent(card.eventId)}`} className="btn btn-ink !min-h-[38px] !px-5 text-[16px]">
          Open
        </Link>
      </div>
      <button type="button" className="hide" aria-label={RECAP_COPY.hideLabel} onClick={onHide}>
        <Icon name="close" size={16} />
      </button>
    </section>
  );
}

/** The message their hello opens with: your edited draft from their page, or the default opener. */
function messageFor(person: ConnectionCard, myName: string): string {
  try {
    const saved = localStorage.getItem(`afterflow.opener.${person.id}`);
    if (saved) return saved;
  } catch {
    // Private mode: the default is fine.
  }
  return defaultOpener(person.other.name, myName);
}

function viaOf(option: Handoff): HelloVia {
  return option.channel === "discord" && !option.href ? "discord_copy" : option.channel;
}

/** One person in the recap (spec §3.2). Mark as talked is on every row, any time (D23). */
export function RecapRow({
  token,
  person,
  myName,
  myContacts,
  onHello,
  onTalked,
  onToast,
}: {
  token: string;
  person: ConnectionCard;
  myName: string;
  myContacts: string[];
  onHello: (via: HelloVia) => void;
  onTalked: (on: boolean) => void;
  onToast: (text: string) => void;
}) {
  const [message, setMessage] = useState(() => defaultOpener(person.other.name, myName));
  useEffect(() => setMessage(messageFor(person, myName)), [person, myName]);
  const first = firstOf(person.other.name);
  const contacts = person.other.contacts?.length ? person.other.contacts : person.other.contact ? [person.other.contact] : [];
  const target = planHandoff(contacts, myContacts, person.other.name, message, undefined, myName).options[0];
  const done = rowDone(person);
  const talkSwitch = (small: boolean) => (
    <button
      type="button"
      role="switch"
      aria-checked={person.talkedAgain}
      className={`talk ${small ? "sm" : ""}`}
      onClick={() => onTalked(!person.talkedAgain)}
      aria-label={person.talkedAgain ? `Talked with ${first}. Only you see this.` : `Mark as talked with ${first}`}
    >
      {person.talkedAgain ? (
        <>
          <Icon name="check" />
          Talked
        </>
      ) : (
        "Mark as talked"
      )}
    </button>
  );

  let action: React.ReactNode = null;
  if (done) action = talkSwitch(false);
  else if (target) {
    const app = CHANNEL_LABEL[target.channel];
    if (!target.href) {
      action = (
        <button
          type="button"
          className="hi"
          aria-label={`Copy a hi for ${first} on ${app}`}
          onClick={async () => {
            const ok = await copyText(message);
            onToast(ok ? `Copied. Paste it in a DM to ${target.display}.` : "Couldn't copy. Open their page to copy it.");
            if (ok) onHello("discord_copy");
          }}
        >
          <Icon name={CHANNEL_ICON[target.channel]} />
          Copy hi
        </button>
      );
    } else {
      action = (
        <a
          className="hi"
          href={target.href}
          target={target.channel === "email" ? undefined : "_blank"}
          rel="noopener noreferrer"
          aria-label={`Say hi to ${first} on ${app}`}
          onClick={() => {
            if (target.copyFirst) void copyText(message).then((ok) => ok && onToast("Message copied. Paste it in your DM."));
            onHello(viaOf(target));
          }}
        >
          <Icon name={CHANNEL_ICON[target.channel]} />
          Say hi
        </a>
      );
    }
  }

  return (
    <li className="recap-row">
      <Link href={`/m/${token}/c/${encodeURIComponent(person.id)}`} className="body" aria-label={`${person.other.name}: open their page`}>
        <Mark name={person.other.name} seed={person.other.publicId} size={48} />
        <span className="min-w-0 flex-1">
          <span className="round block truncate text-[17px] leading-[22px] font-bold">{person.other.name}</span>
          {person.hello ? (
            <span className="mt-0.5 flex items-center gap-1 text-[13px] leading-[18px] text-muted">
              <Icon name="check" size={14} />
              {HELLO_LABEL[person.hello.via]}
            </span>
          ) : person.other.answer ? (
            <span className="quote mt-0.5 block">“{person.other.answer}”</span>
          ) : null}
        </span>
      </Link>
      <span className="flex flex-none flex-col items-end">
        {action}
        {!done ? talkSwitch(true) : null}
      </span>
    </li>
  );
}

export function RecapDone({ people }: { people: ConnectionCard[] }) {
  return (
    <section role="status" className="recap-done panel mb-3 rounded-[24px] px-5 py-6 text-center">
      <span className="mark-stack justify-center" aria-hidden="true">
        {people.slice(0, 5).map((person, index) => (
          <span key={person.id} style={{ animationDelay: `${index * 40}ms` }} className="contents">
            <Mark name={person.other.name} seed={person.other.publicId} size={40} letters={1} />
          </span>
        ))}
      </span>
      <h2 className="round mt-3.5 text-[22px] leading-7 font-black text-balance">{people.every((person) => person.hello) ? RECAP_COPY.doneTitle : RECAP_COPY.doneTitleTalked}
      </h2>
      <p className="mx-auto mt-1.5 max-w-[310px] text-[15px] leading-[21px] text-muted">{RECAP_COPY.doneBody}</p>
    </section>
  );
}

export function RecapEmpty({ token, eventName }: { token: string; eventName: string }) {
  return (
    <section className="flex flex-col items-center pt-20 text-center" aria-labelledby="recap-empty-title">
      <span className="grid size-[76px] place-items-center rounded-[26px] bg-fill">
        <Icon name="people" size={28} />
      </span>
      <h2 id="recap-empty-title" className="round mt-5 text-[24px] leading-7 font-black">
        {RECAP_COPY.emptyTitle}
      </h2>
      <p className="mx-auto mt-2 max-w-[310px] text-[16px] leading-[22px] text-muted">{RECAP_COPY.emptyBody(eventName)}</p>
      <Link href={`/m/${token}`} className="btn btn-lg btn-fill mt-6 px-6">
        Back to Your people
      </Link>
    </section>
  );
}
