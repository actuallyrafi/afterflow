"use client";

import { useEffect, useRef, useState } from "react";
import { defaultOpener, firstOf, planHandoff, type Handoff } from "@/lib/handoff";
import { CHANNEL_LABEL } from "@/lib/survey";
import { Icon, type IconName } from "./ui/icons";
import { Mark } from "./ui/mark";

const CHANNEL_ICON: Record<string, IconName> = { whatsapp: "chat", discord: "chat", instagram: "camera", email: "mail" };
const CHANNEL_HUE: Record<string, number> = { whatsapp: 3, discord: 4, instagram: 5, email: 2 };

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

/**
 * Say hi: an editable, prefilled opener and a way out to an app you already use.
 * An app you both use goes first; otherwise theirs, in the order they chose.
 */
export function SayHi({
  connectionId,
  theirName,
  theirSeed,
  contacts,
  myContacts,
  myName,
}: {
  connectionId: string;
  theirName: string;
  theirSeed: string;
  contacts: string[];
  myContacts: string[];
  myName: string;
}) {
  const storageKey = `afterflow.opener.${connectionId}`;
  const [message, setMessage] = useState(() => defaultOpener(theirName, myName));
  const [copied, setCopied] = useState<string | null>(null);
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

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const plan = planHandoff(contacts, myContacts, theirName, message);
  const hand = plan.options[0];
  const others = plan.options.slice(1);

  function edit(value: string) {
    setMessage(value);
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // Not saved between visits; still works now.
    }
  }

  async function copy(kind: string, text: string) {
    if (await copyText(text)) setCopied(kind);
  }

  if (!hand) return null;

  return (
    <section className="panel mt-2.5 p-4" aria-labelledby="say-hi-title">
      <div className="flex items-center gap-2.5">
        <Mark name={theirName} seed={theirSeed} size={30} />
        <h2 id="say-hi-title" className="round flex-1 text-[18px] font-extrabold">
          Say hi
        </h2>
        <span className={`pill channel hue-${CHANNEL_HUE[hand.channel]}`}>{CHANNEL_LABEL[hand.channel]}</span>
      </div>
      {plan.shared ? (
        <p className="mt-2 text-[15px] leading-[21px]">
          You both use {CHANNEL_LABEL[plan.shared]}. Say hi there.
        </p>
      ) : others.length ? (
        <p className="mt-2 text-[15px] leading-[21px]">
          {first} likes {CHANNEL_LABEL[hand.channel]} best.
        </p>
      ) : null}
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
        className="mt-3 block w-full resize-none rounded-[18px] bg-bg px-3.5 py-3 text-[16px] leading-[22px] outline-none focus:shadow-[0_0_0_2px_var(--ink)]"
      />
      <p className="mx-0.5 mt-2 mb-3 text-[12px] text-muted">Change anything. It&apos;s just a starting point.</p>

      {hand.channel !== "whatsapp" ? (
        <div className="mb-3 flex items-center gap-2 rounded-[16px] bg-bg py-1.5 pr-1.5 pl-3.5">
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold text-muted">{first}&apos;s {CHANNEL_LABEL[hand.channel]}</span>
            <span className="block truncate text-[15px] font-medium">{hand.display}</span>
          </span>
          <button type="button" className="btn btn-sm btn-fill bg-panel" onClick={() => void copy("handle", hand.display)}>
            {copied === "handle" ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}

      <div className="flex gap-2">
        {hand.href && hand.label ? (
          <a
            href={hand.href}
            target={hand.channel === "email" ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="btn btn-ink min-w-0 flex-1"
            onClick={() => {
              if (hand.copyFirst) void copyText(message).then((ok) => ok && setCopied("message"));
            }}
          >
            <Icon name={CHANNEL_ICON[hand.channel]} />
            <span className="truncate">{hand.label}</span>
          </a>
        ) : (
          <button type="button" className="btn btn-ink min-w-0 flex-1" onClick={() => void copy("message", message)}>
            <Icon name={copied === "message" ? "check" : "copy"} />
            {copied === "message" ? "Copied" : "Copy message"}
          </button>
        )}
        {hand.href ? (
          <button
            type="button"
            className="btn btn-fill btn-icon"
            aria-label={copied === "message" ? "Copied" : "Copy message"}
            onClick={() => void copy("message", message)}
          >
            <Icon name={copied === "message" ? "check" : "copy"} />
          </button>
        ) : null}
      </div>
      {hand.copyFirst && hand.href ? (
        <p className="mt-2 text-[12px] text-muted">We copy your message first, so you can paste it in.</p>
      ) : null}
      {others.length ? (
        <div className="mt-4">
          <h3 className="mx-0.5 mb-1.5 text-[13px] font-semibold text-muted">Or reach {first} on</h3>
          <ul className="overflow-hidden rounded-[18px] bg-bg">
            {others.map((option) => (
              <li key={option.channel}>
                <OtherWay option={option} copied={copied === option.channel} onCopy={() => void copy(option.channel, option.display)} onOpen={() => {
                  if (option.copyFirst) void copyText(message).then((ok) => ok && setCopied("message"));
                }} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {copied === "message" ? "Message copied" : copied ? "Copied" : ""}
      </p>
    </section>
  );
}

function OtherWay({ option, copied, onCopy, onOpen }: { option: Handoff; copied: boolean; onCopy: () => void; onOpen: () => void }) {
  return (
    <div className="contact-row !min-h-[58px] !py-2 !pr-2 !pl-3">
      <span className={`app-chip hue-${CHANNEL_HUE[option.channel]}`}>
        <Icon name={CHANNEL_ICON[option.channel]} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold text-muted">{CHANNEL_LABEL[option.channel]}</span>
        <span className="block truncate text-[15px] font-medium">{option.display}</span>
      </span>
      {option.href && option.label ? (
        <a
          href={option.href}
          target={option.channel === "email" ? undefined : "_blank"}
          rel="noopener noreferrer"
          className="btn btn-sm btn-fill bg-panel"
          aria-label={option.label}
          onClick={onOpen}
        >
          {option.channel === "email" ? "Email" : "Open"}
        </a>
      ) : (
        <button type="button" className="btn btn-sm btn-fill bg-panel" onClick={onCopy} aria-label={`Copy ${CHANNEL_LABEL[option.channel]} username`}>
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}
