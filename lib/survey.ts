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
  discord: "sam.rivera",
  instagram: "@sam.cooks",
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
  /** The preferred way to reach you, stored as `channel:value`, e.g. `whatsapp:+447700900123`. */
  contact: string;
  /** Every way to reach you, preferred first, one per app. Older cards only have `contact`. */
  contacts?: string[];
  answer: string;
};

export const CONTACTS_LABEL = "Ways to reach me";
export const CONTACTS_HELP = "The starred one is shown first. Only people you both said you met can see these.";
export const CONTACTS_LAST_ONE = "You need at least one way to be reached.";
export const ADD_ANOTHER = "Add another way";
export const FIELD_LABEL: Record<Channel, string> = {
  whatsapp: "WhatsApp number",
  discord: "Discord username",
  instagram: "Instagram handle",
  email: "Email",
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
/** Stricter check for new input (spec v4.1): a TLD of 2+ characters. Stored values still read with EMAIL. */
const NEW_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
      return { ok: false, error: "Add your country code, like +44 7700 900123." };
    }
    return { ok: true, value: `whatsapp:${digits}` };
  }
  if (channel === "discord") {
    const name = text.replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_.]{2,32}$/.test(name) || name.includes("..")) {
      return { ok: false, error: "Discord usernames are lowercase, like sam.rivera." };
    }
    return { ok: true, value: `discord:${name}` };
  }
  if (channel === "instagram") {
    const handle = text
      .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
      .replace(/[/?#].*$/, "")
      .replace(/^@/, "")
      .toLowerCase();
    if (!/^[a-z0-9_.]{1,30}$/.test(handle) || handle.endsWith(".")) return { ok: false, error: "That doesn't look like an Instagram handle." };
    return { ok: true, value: `instagram:${handle}` };
  }
  const email = text.toLowerCase();
  if (!NEW_EMAIL.test(email)) return { ok: false, error: "Check the email address." };
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

/**
 * One stored contact per app, preferred first. `preferred` (the `contact` field) always wins the
 * first slot, so a record written by an older build that only knew `contact` still reads right.
 */
export function orderContacts(preferred: unknown, list: unknown): string[] {
  const raw: unknown[] = Array.isArray(list) ? list : [];
  const out: string[] = [];
  const seen = new Set<Channel>();
  const push = (value: unknown) => {
    if (typeof value !== "string" || !value.trim()) return;
    const parsed = parseContact(value);
    if (!parsed.value || seen.has(parsed.channel)) return;
    seen.add(parsed.channel);
    out.push(`${parsed.channel}:${parsed.value}`);
  };
  if (typeof preferred === "string" && preferred.trim()) {
    const first = parseContact(preferred);
    if (first.value) {
      seen.add(first.channel);
      // Keep the stored string as-is (older bare values included) so nothing is rewritten.
      out.push(preferred.trim());
    }
  }
  for (const value of raw) push(value);
  return out;
}

/** Reads `contacts` from a stored row: an array, a JSON string (SQL), or nothing (older cards). */
export function readContacts(preferred: unknown, stored: unknown): string[] {
  let list: unknown = stored;
  if (typeof stored === "string") {
    try {
      list = stored ? JSON.parse(stored) : [];
    } catch {
      list = [];
    }
  }
  return orderContacts(preferred, list);
}

function validateContacts(raw: Record<string, unknown>): { ok: true; value: string[] } | { ok: false; error: string } | null {
  if (!Array.isArray(raw.contacts)) return null;
  const values: string[] = [];
  const seen = new Set<Channel>();
  for (const item of raw.contacts as unknown[]) {
    let channel: unknown;
    let value: unknown;
    if (typeof item === "string") {
      const prefixed = item.match(/^(whatsapp|discord|instagram|email):(.*)$/);
      if (!prefixed) continue;
      channel = prefixed[1];
      value = prefixed[2];
    } else if (item && typeof item === "object") {
      channel = (item as Record<string, unknown>).channel;
      value = (item as Record<string, unknown>).value;
    }
    if (typeof value !== "string" || !value.trim()) continue;
    const checked = normalizeContact(channel, value);
    if (!checked.ok) return checked;
    const parsed = parseContact(checked.value);
    if (seen.has(parsed.channel)) continue;
    seen.add(parsed.channel);
    values.push(checked.value);
  }
  if (!values.length) return { ok: false, error: CONTACTS_LAST_ONE };
  const preferred = isChannel(raw.preferred) ? raw.preferred : null;
  const index = preferred ? values.findIndex((value) => value.startsWith(`${preferred}:`)) : -1;
  if (index > 0) values.unshift(...values.splice(index, 1));
  return { ok: true, value: values };
}

/** Accepts `{ contacts: [{ channel, value }], preferred }` from the form, the older single `{ channel, contact }`, or a stored-style `contact: "channel:value"`. */
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

  const many = validateContacts(raw);
  if (many && !many.ok) return many;

  let channel = raw.channel;
  let value = raw.contact;
  if (!isChannel(channel) && typeof value === "string") {
    const prefixed = value.match(/^(whatsapp|discord|instagram|email):(.*)$/);
    if (prefixed) {
      channel = prefixed[1];
      value = prefixed[2];
    }
  }
  const contact = many ? ({ ok: true, value: many.value[0] } as const) : normalizeContact(channel, value);
  if (!contact.ok) return contact;
  const contacts = many ? many.value : [contact.value];

  const answer = clean(raw.answer, 1000);
  if (answer.length < ANSWER_MIN) return { ok: false, error: "A few words is plenty." };
  if (answer.length > ANSWER_MAX) return { ok: false, error: `Keep it under ${ANSWER_MAX} characters.` };

  return { ok: true, value: { name, contact: contact.value, contacts, answer } };
}

/**
 * v4.1d (D25): "Best way to reach you" keeps one value per app tab. Switching tabs never clears
 * anything; on save every non-empty value becomes a contact (one per app).
 */
export type TabValues = Partial<Record<Channel, string>>;
export const TABS_HELP = "Fill in any you use. We'll save them all.";
export const TABS_EMPTY = "Add at least one way to reach you.";

/** Keeps the order you filled the tabs in: a tab joins when it gets a value and leaves when emptied. */
export function fillOrder(order: Channel[], channel: Channel, value: string): Channel[] {
  const without = order.filter((item) => item !== channel);
  return value.trim() ? (order.includes(channel) ? order : [...without, channel]) : without;
}

/**
 * What a save sends. The starred (preferred) contact is the first tab you filled in; the rest follow
 * in the order you filled them. Each value is checked on its own; the first bad one (in tab order)
 * is returned so the form can switch to that tab and show the error there.
 */
export function collectTabs(
  values: TabValues,
  order: Channel[] = [],
): { contacts: { channel: Channel; value: string }[]; preferred: Channel | null; invalid: { channel: Channel; error: string } | null } {
  const filled = CHANNELS.filter((channel) => (values[channel] ?? "").trim());
  const ordered = [...order.filter((channel) => filled.includes(channel)), ...filled.filter((channel) => !order.includes(channel))];
  for (const channel of filled) {
    const result = normalizeContact(channel, values[channel]);
    if (!result.ok) return { contacts: [], preferred: null, invalid: { channel, error: result.error } };
  }
  if (!ordered.length) return { contacts: [], preferred: null, invalid: { channel: order[0] ?? "whatsapp", error: TABS_EMPTY } };
  return {
    contacts: ordered.map((channel) => ({ channel, value: (values[channel] ?? "").trim() })),
    preferred: ordered[0],
    invalid: null,
  };
}
