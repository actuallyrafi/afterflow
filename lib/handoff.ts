// "Say hi": hand the conversation to an app people already use. Nothing here is generated
// from their answers; the opener is a fixed, editable starting point.
import { parseContact, type Channel } from "./survey";

/** Flags. `handoff_discord` stays off until the Discord deep link is checked on iOS, Android and desktop. */
export const FLAGS = {
  handoff_discord: process.env.NEXT_PUBLIC_HANDOFF_DISCORD === "1",
} as const;

export function firstOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

export function defaultOpener(theirName: string, myName: string): string {
  return `Hey ${firstOf(theirName)}, it's ${firstOf(myName)} from the Grok Bot hackathon. Really good meeting you!`;
}

export type Handoff = {
  channel: Channel;
  /** What to show for copying: the number, username, handle or address. */
  display: string;
  /** Main button label, or null when the main button is "Copy message". */
  label: string | null;
  /** Where the main button goes, with the message filled in when the app allows it. */
  href: string | null;
  /** Copy the message before opening (Instagram, Discord). */
  copyFirst: boolean;
};

export function handoffFor(contact: string, theirName: string, message: string, flags = FLAGS): Handoff {
  const { channel, value } = parseContact(contact);
  const first = firstOf(theirName);
  if (channel === "whatsapp") {
    const digits = value.replace(/\D/g, "");
    return {
      channel,
      display: value,
      label: "Message on WhatsApp",
      href: `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
      copyFirst: false,
    };
  }
  if (channel === "discord") {
    return flags.handoff_discord
      ? { channel, display: value, label: "Open in Discord", href: "https://discord.com/channels/@me", copyFirst: true }
      : { channel, display: value, label: null, href: null, copyFirst: false };
  }
  if (channel === "instagram") {
    return {
      channel,
      display: `@${value}`,
      label: "Open Instagram",
      href: `https://ig.me/m/${encodeURIComponent(value)}`,
      copyFirst: true,
    };
  }
  return {
    channel,
    display: value,
    label: `Email ${first}`,
    href: `mailto:${value}?subject=${encodeURIComponent("Hi from the Grok Bot hackathon")}&body=${encodeURIComponent(message)}`,
    copyFirst: false,
  };
}
