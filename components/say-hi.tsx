"use client";

import { useEffect, useRef, useState } from "react";
import { defaultOpener, firstOf, planHandoff, type Handoff } from "@/lib/handoff";
import { CHANNEL_LABEL, parseContact, type Channel } from "@/lib/survey";
import { Icon, type IconName } from "./ui/icons";
import { Mark } from "./ui/mark";

const CHANNEL_ICON: Record<Channel, IconName> = { whatsapp: "whatsapp", discord: "discord", instagram: "camera", email: "mail" };

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** The quiet line under each way: what tapping will do. */
function subline(option: Handoff): React.ReactNode {
  if (option.channel === "whatsapp") return option.display;
  if (option.channel === "email") return "Opens your mail app with the message";
  if (option.channel === "discord" && !option.href) {
    return (
      <>
        Paste it in a DM to <span className="mono text-ink">{option.display}</span>
      </>
    );
  }
  return `${option.display} · copies your message first`;
}

/**
 * Say hi (spec v4.1 §3.4): an editable opener and a way out to an app you already use.
 * A shared app comes first (the first one in *their* order), then their starred one, then the rest
 * in their order. Afterflow never records whether you sent anything.
 */
export function SayHi({
  connectionId,
  theirName,
  theirSeed,
  contacts,
  myContacts,
  myName,
  onToast,
}: {
  connectionId: string;
  theirName: string;
  theirSeed: string;
  contacts: string[];
  myContacts: string[];
  myName: string;
  onToast: (text: string) => void;
}) {
  const storageKey = `afterflow.opener.${connectionId}`;
  const [message, setMessage] = useState(() => defaultOpener(theirName, myName));
  const area = useRef<HTMLTextAreaElement>(null);
  const first = firstOf(theirName);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setMessage(saved);
    } catch {
      // Private mode: the default opener is fine.
    }
  }, [storageKey]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [message]);

  const plan = planHandoff(contacts, myContacts, theirName, message, undefined, myName);
  const preferred = contacts[0] ? parseContact(contacts[0]).channel : null;
  const hand = plan.options[0];

  function edit(value: string) {
    setMessage(value);
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // Not saved between visits; still works now.
    }
  }

  async function copy(text: string, done: string) {
    onToast((await copyText(text)) ? done : "Couldn't copy. Select the text and copy it.");
  }

  /** Instagram / Discord-on: copy the hi first, then open. */
  function beforeOpen(option: Handoff) {
    if (!option.copyFirst) return;
    void copyText(message).then((ok) => onToast(ok ? "Message copied. Paste it in your DM." : "Couldn't copy the message. It's still here to copy."));
  }

  if (!hand) return null;

  const messageBox = (
    <>
      <label className="sr-only" htmlFor="opener">
        Message to {first}
      </label>
      <textarea
        id="opener"
        ref={area}
        value={message}
        onChange={(event) => edit(event.target.value)}
        rows={3}
        maxLength={600}
        className="mt-3 block w-full resize-none rounded-[18px] bg-bg px-4 py-3 text-[17px] leading-[24px] outline-none focus:shadow-[0_0_0_2px_var(--ink)]"
      />
      <p className="mx-0.5 mt-2 text-[13px] text-muted">Change anything. It&apos;s just a starting point.</p>
    </>
  );

  if (plan.shared) {
    const others = plan.options.slice(1);
    return (
      <section className="panel mt-2.5 p-4" aria-labelledby="say-hi-title">
        <div className="flex items-center gap-3">
          <span className="app-tile live-tile">
            <Icon name={CHANNEL_ICON[hand.channel]} />
          </span>
          <h2 id="say-hi-title" className="round flex-1 text-[19px] leading-6 font-black">
            You both use {CHANNEL_LABEL[plan.shared]}. Say hi there.
          </h2>
        </div>
        {messageBox}
        <div className="mt-3">
          <Actions option={hand} primary message={message} onCopy={copy} beforeOpen={beforeOpen} iconCopy />
        </div>
        {others.length ? (
          <div className="mt-4 border-t-[0.5px] border-line pt-3">
            <h3 className="mb-1 text-[14px] font-semibold text-muted">Other ways to reach {first}</h3>
            <ul>
              {others.map((option) => (
                <WayRow key={option.channel} option={option} starred={option.channel === preferred} message={message} onCopy={copy} beforeOpen={beforeOpen} />
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="panel mt-2.5 p-4" aria-labelledby="say-hi-title">
      <div className="flex items-center gap-2.5">
        <Mark name={theirName} seed={theirSeed} size={30} />
        <h2 id="say-hi-title" className="round flex-1 text-[19px] font-black">
          Say hi
        </h2>
      </div>
      {messageBox}
      <h3 className="mt-3.5 mb-1 text-[14px] font-semibold text-muted">
        {plan.options.length > 1 ? `In the order ${first} prefers` : `${first}'s ${CHANNEL_LABEL[hand.channel]}`}
      </h3>
      <ul>
        {plan.options.map((option, index) => (
          <WayRow
            key={option.channel}
            option={option}
            starred={plan.options.length > 1 && option.channel === preferred}
            primary={index === 0}
            message={message}
            onCopy={copy}
            beforeOpen={beforeOpen}
          />
        ))}
      </ul>
    </section>
  );
}

type CopyFn = (text: string, done: string) => Promise<void>;

function Actions({
  option,
  primary = false,
  message,
  onCopy,
  beforeOpen,
  iconCopy = false,
  compact = false,
}: {
  option: Handoff;
  primary?: boolean;
  message: string;
  onCopy: CopyFn;
  beforeOpen: (option: Handoff) => void;
  iconCopy?: boolean;
  compact?: boolean;
}) {
  const tone = primary ? "btn-ink" : "btn-fill";
  if (!option.href) {
    // Discord while its deep link is off: copy, then paste it in a DM.
    return (
      <div className="flex gap-2">
        <button
          type="button"
          className={`btn ${compact ? "btn-sm !gap-1.5 !px-3" : ""} ${tone} min-w-0 flex-1`}
          onClick={() => void onCopy(message, "Message copied. Paste it in your DM.")}
        >
          <Icon name="copy" size={17} />
          Copy message
        </button>
        <button
          type="button"
          className={`btn ${compact ? "btn-sm !px-3" : ""} btn-fill min-w-0 flex-1`}
          onClick={() => void onCopy(option.display, "Username copied.")}
          aria-label={`Copy username ${option.display}`}
        >
          Copy username
        </button>
      </div>
    );
  }
  const external = option.channel !== "email";
  if (compact) {
    return (
      <a
        href={option.href}
        target={external ? "_blank" : undefined}
        rel="noopener noreferrer"
        className={`btn btn-sm ${tone}`}
        aria-label={option.label ?? undefined}
        onClick={() => beforeOpen(option)}
      >
        {option.channel === "email" ? "Email" : option.channel === "whatsapp" ? "Message" : "Open"}
      </a>
    );
  }
  return (
    <div className="flex gap-2">
      <a
        href={option.href}
        target={external ? "_blank" : undefined}
        rel="noopener noreferrer"
        className={`btn btn-lg ${tone} min-w-0 flex-1`}
        onClick={() => beforeOpen(option)}
      >
        <Icon name={CHANNEL_ICON[option.channel]} />
        <span className="truncate">{option.label}</span>
      </a>
      {iconCopy ? (
        <button type="button" className="btn btn-lg btn-fill btn-icon !w-[52px]" aria-label="Copy message" onClick={() => void onCopy(message, "Message copied.")}>
          <Icon name="copy" />
        </button>
      ) : null}
    </div>
  );
}

function WayRow({
  option,
  starred,
  primary = false,
  message,
  onCopy,
  beforeOpen,
}: {
  option: Handoff;
  starred: boolean;
  primary?: boolean;
  message: string;
  onCopy: CopyFn;
  beforeOpen: (option: Handoff) => void;
}) {
  const stacked = !option.href;
  return (
    <li className="border-b-[0.5px] border-line py-3 last:border-b-0 last:pb-1">
      <div className="flex items-center gap-3">
        <span className="app-tile">
          <Icon name={CHANNEL_ICON[option.channel]} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[17px] leading-[22px] font-semibold">
            {CHANNEL_LABEL[option.channel]}
            {starred ? (
              <span className="text-star" aria-label="Preferred">
                <Icon name="star" size={14} className="[&_path]:fill-current" />
              </span>
            ) : null}
          </span>
          <span className="block text-[14px] leading-5 break-words text-muted">{subline(option)}</span>
        </span>
        {stacked ? null : <Actions option={option} primary={primary} message={message} onCopy={onCopy} beforeOpen={beforeOpen} compact />}
      </div>
      {stacked ? (
        <div className="mt-2.5">
          <Actions option={option} primary={primary} message={message} onCopy={onCopy} beforeOpen={beforeOpen} compact />
        </div>
      ) : null}
    </li>
  );
}
