// The card: a name, the best way to reach you, and one question. Nothing is scored.

export const CHANNELS = ["whatsapp", "discord", "instagram", "email"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  discord: "Discord",
  instagram: "Instagram",
  email: "Email",
};

export const CHANNEL_PLACEHOLDER: Record<Channel, string> = {
  whatsapp: "+44 7700 900123",
  discord: "username",
  instagram: "@handle",
  email: "you@example.com",
};

export const NAME_LABEL = "What should people call you?";
export const CONTACT_LABEL = "Best way to reach you";
export const CONTACT_HELP = "Only shared with people you both say you met. Change it anytime.";
export const QUESTION = "What's something you're into right now?";
export const QUESTION_HELP = "A project, a hobby, a place — anything.";
export const QUESTION_PLACEHOLDER = "Finally trying the bouldering wall in Bermondsey";

export const CONSENT_TEXT =
  "Save my card so people I confirm can find me again. It stays until I delete it, and I can remove anyone anytime.";

export const NAME_MAX = 40;
export const ANSWER_MIN = 3;
export const ANSWER_MAX = 200;

export type Submission = {
  name: string;
  /** Stored as `channel:value`, e.g. `whatsapp:+447700900123`. */
  contact: string;
  answer: string;
};

export type ParsedContact = { channel: Channel; value: string };

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function isChannel(value: unknown): value is Channel {
  return typeof value === "string" && (CHANNELS as readonly string[]).includes(value);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeContact(
  channel: unknown,
  raw: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  if (!isChannel(channel)) return { ok: false, error: "Pick how people can reach you." };
  const text = clean(raw, 120);
  if (!text) return { ok: false, error: "Add how people can reach you." };
  if (channel === "whatsapp") {
    let digits = text.replace(/[\s().-]/g, "");
    if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
    if (/^07\d{9}$/.test(digits)) digits = `+44${digits.slice(1)}`;
    if (!digits.startsWith("+")) digits = `+${digits}`;
    if (!/^\+\d{8,15}$/.test(digits)) {
      return { ok: false, error: "That number doesn't look right. Include the country code, like +44." };
    }
    return { ok: true, value: `whatsapp:${digits}` };
  }
  if (channel === "discord") {
    const name = text.replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_.]{2,32}$/.test(name)) {
      return { ok: false, error: "Discord usernames are 2–32 letters, numbers, dots or underscores." };
    }
    return { ok: true, value: `discord:${name}` };
  }
  if (channel === "instagram") {
    const handle = text.replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_.]{1,30}$/.test(handle)) return { ok: false, error: "That Instagram handle doesn't look right." };
    return { ok: true, value: `instagram:${handle}` };
  }
  const email = text.toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, error: "That email doesn't look right." };
  return { ok: true, value: `email:${email}` };
}

/**
 * Reads a stored contact. Cards made before v4 hold a bare "email or Discord" string,
 * so those are read as email when they look like one, otherwise as a Discord name.
 */
export function parseContact(stored: unknown): ParsedContact {
  const text = typeof stored === "string" ? stored.trim() : "";
  const match = text.match(/^(whatsapp|discord|instagram|email):(.*)$/);
  if (match && isChannel(match[1])) return { channel: match[1], value: match[2] };
  if (EMAIL.test(text)) return { channel: "email", value: text };
  return { channel: "discord", value: text.replace(/^@/, "") };
}

/** Accepts `{ channel, contact }` from the form, or a stored-style `contact: "channel:value"`. */
export function validateSubmission(
  body: unknown,
  options: { requireConsent?: boolean } = {},
): { ok: true; value: Submission } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Missing card." };
  const raw = body as Record<string, unknown>;
  if ((options.requireConsent ?? true) && raw.consent !== true) {
    return { ok: false, error: "Tick the box so we can save your card." };
  }
  const name = clean(raw.name, 200);
  if (name.length < 1) return { ok: false, error: "Add a name. Just a first name is fine." };
  if (name.length > NAME_MAX) return { ok: false, error: `Keep your name under ${NAME_MAX} characters.` };

  let channel = raw.channel;
  let value = raw.contact;
  if (!isChannel(channel) && typeof value === "string") {
    const prefixed = value.match(/^(whatsapp|discord|instagram|email):(.*)$/);
    if (prefixed) {
      channel = prefixed[1];
      value = prefixed[2];
    }
  }
  const contact = normalizeContact(channel, value);
  if (!contact.ok) return contact;

  const answer = clean(raw.answer, 1000);
  if (answer.length < ANSWER_MIN) return { ok: false, error: "A few words is plenty." };
  if (answer.length > ANSWER_MAX) return { ok: false, error: `Keep it under ${ANSWER_MAX} characters.` };

  return { ok: true, value: { name, contact: contact.value, answer } };
}
