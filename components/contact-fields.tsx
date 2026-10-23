"use client";

import { useId, useState } from "react";
import { CHANNEL_LABEL, CHANNEL_PLACEHOLDER, CHANNELS, FIELD_LABEL, normalizeContact, TABS_HELP, type Channel, type TabValues } from "@/lib/survey";
import { LiquidLabel, LiquidPill, useLiquidSelect } from "./liquid";
import { Icon, type IconName } from "./ui/icons";

export const CHANNEL_ICON: Record<Channel, IconName> = { whatsapp: "whatsapp", discord: "discord", instagram: "instagram", email: "email" };
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
  // v4.1i: taps, drags and arrow keys all pick through the controller. Commit two frames in (the pill is
  // already on the compositor): the field below must switch before someone starts typing.
  const seg = useLiquidSelect<HTMLDivElement>(
    channel,
    (index) => {
      const option = CHANNELS[index];
      if (taken.includes(option)) return;
      onChannel(option);
      setTouched(false);
    },
    { commit: "frame" },
  );
  return (
    <div>
      <div ref={seg} role="radiogroup" aria-label="App" className="seg lq !mt-2">
        <LiquidPill variant="solid" />
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
              tabIndex={channel === option ? 0 : -1}
              className={`lq-opt ${used ? "opacity-40" : ""}`}
            >
              <LiquidLabel>{CHANNEL_LABEL[option]}</LiquidLabel>
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

/**
 * D25: one segmented picker, one input, but every tab keeps its own value. A tab with a value gets
 * a small tick. `error` is the save-time error for `active` (the form switches to the bad tab).
 */
export function ContactTabs({
  id,
  values,
  active,
  onActive,
  onValue,
  error: saveError = "",
  autoFocus = false,
}: {
  id: string;
  values: TabValues;
  active: Channel;
  onActive: (channel: Channel) => void;
  onValue: (channel: Channel, value: string) => void;
  error?: string;
  autoFocus?: boolean;
}) {
  const [touched, setTouched] = useState<Channel[]>([]);
  const errorId = useId();
  const helpId = useId();
  const value = values[active] ?? "";
  const error = saveError || (touched.includes(active) ? contactError(active, value) : "");
  // v4.1i: "frame", so the field shows the tapped app's value before the next keystroke.
  const seg = useLiquidSelect<HTMLDivElement>(active, (index) => onActive(CHANNELS[index]), { commit: "frame" });
  return (
    <div>
      <div ref={seg} role="radiogroup" aria-label="App" className="seg lq !mt-2">
        <LiquidPill variant="solid" />
        {CHANNELS.map((option) => {
          const filled = Boolean((values[option] ?? "").trim());
          return (
            <button
              key={option}
              type="button"
              role="radio"
              data-channel={option}
              data-filled={filled ? "" : undefined}
              aria-checked={active === option}
              aria-label={`${CHANNEL_LABEL[option]}${filled ? ", filled in" : ""}`}
              tabIndex={active === option ? 0 : -1}
              className="lq-opt relative"
            >
              <LiquidLabel>{CHANNEL_LABEL[option]}</LiquidLabel>
              {/* v4.1d filled dot: a direct child of the option, so it sits above the pill (z-index 2). */}
              {filled ? <span className="seg-dot" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      <label className="sr-only" htmlFor={id}>
        {FIELD_LABEL[active]}
      </label>
      <input
        key={active}
        id={id}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onValue(active, event.target.value)}
        onBlur={() => setTouched((current) => (current.includes(active) ? current : [...current, active]))}
        type={INPUT_TYPE[active]}
        inputMode={INPUT_TYPE[active] === "text" ? "text" : INPUT_TYPE[active]}
        autoComplete={AUTOCOMPLETE[active]}
        autoCapitalize="off"
        spellCheck={false}
        placeholder={CHANNEL_PLACEHOLDER[active]}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${errorId} ${helpId}` : helpId}
        className={`mt-2 block h-11 w-full rounded-[12px] bg-transparent px-1 text-[17px] outline-none ${error ? "shadow-[0_0_0_2px_var(--hot)]" : ""}`}
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[14px] leading-5 text-hot">
          <Icon name="alert" size={16} className="mt-0.5 flex-none" />
          {error}
        </p>
      ) : null}
      <p id={helpId} className="mt-1.5 border-t-[0.5px] border-line px-1 pt-2.5 text-[13px] leading-[18px] text-muted">
        {TABS_HELP}
      </p>
    </div>
  );
}
