"use client";

import { useId, useState } from "react";
import { CHANNEL_LABEL, CHANNEL_PLACEHOLDER, CHANNELS, FIELD_LABEL, normalizeContact, type Channel } from "@/lib/survey";
import { Icon, type IconName } from "./ui/icons";

export const CHANNEL_ICON: Record<Channel, IconName> = { whatsapp: "whatsapp", discord: "discord", instagram: "camera", email: "mail" };
const INPUT_TYPE: Record<Channel, "tel" | "text" | "email"> = { whatsapp: "tel", discord: "text", instagram: "text", email: "email" };
const AUTOCOMPLETE: Record<Channel, string> = { whatsapp: "tel", discord: "off", instagram: "off", email: "email" };

/** The error for a value, or "" when it's fine (or still empty). */
export function contactError(channel: Channel, value: string): string {
  if (!value.trim()) return "";
  const result = normalizeContact(channel, value);
  return result.ok ? "" : result.error;
}

/**
 * One way to reach you: a segmented app picker and one field. Apps already used elsewhere are
 * dimmed and aria-disabled. Errors show on blur: a red ring plus an icon and text, never colour alone.
 */
export function ContactWay({
  id,
  channel,
  value,
  taken = [],
  onChannel,
  onValue,
  showError,
  autoFocus = false,
}: {
  id: string;
  channel: Channel;
  value: string;
  taken?: Channel[];
  onChannel: (channel: Channel) => void;
  onValue: (value: string) => void;
  /** Show the error even before blur (on submit). */
  showError?: boolean;
  autoFocus?: boolean;
}) {
  const [touched, setTouched] = useState(false);
  const errorId = useId();
  const error = touched || showError ? contactError(channel, value) : "";
  return (
    <div>
      <div role="radiogroup" aria-label="App" className="seg !mt-2">
        {CHANNELS.map((option) => {
          const used = taken.includes(option);
          return (
            <button
              key={option}
              type="button"
              role="radio"
              name={`${id}-app`}
              data-channel={option}
              aria-checked={channel === option}
              aria-disabled={used || undefined}
              className={used ? "opacity-40" : undefined}
              onClick={() => {
                if (used) return;
                onChannel(option);
                setTouched(false);
              }}
            >
              {CHANNEL_LABEL[option]}
            </button>
          );
        })}
      </div>
      <label className="sr-only" htmlFor={id}>
        {FIELD_LABEL[channel]}
      </label>
      <input
        id={id}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onValue(event.target.value)}
        onBlur={() => setTouched(true)}
        type={INPUT_TYPE[channel]}
        inputMode={INPUT_TYPE[channel] === "text" ? "text" : INPUT_TYPE[channel]}
        autoComplete={AUTOCOMPLETE[channel]}
        autoCapitalize="off"
        spellCheck={false}
        placeholder={CHANNEL_PLACEHOLDER[channel]}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`mt-2 block h-11 w-full rounded-[12px] bg-transparent px-1 text-[17px] outline-none ${error ? "shadow-[0_0_0_2px_var(--hot)]" : ""}`}
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[14px] leading-5 text-hot">
          <Icon name="alert" size={16} className="mt-0.5 flex-none" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
