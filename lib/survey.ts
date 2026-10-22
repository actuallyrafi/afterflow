export const OFFERS = [
  "Coding",
  "Design",
  "Product",
  "AI/ML",
  "Data",
  "Marketing/Growth",
  "Community",
  "Introductions",
  "Domain expertise",
  "Other",
] as const;

export const NEEDS = [
  ...OFFERS,
  "Teammate",
  "Feedback",
  "Mentor",
  "Collaborator",
] as const;

export const AVAILABILITIES = [
  "Right now at the event",
  "Later tonight",
  "This week",
] as const;

export const FREE_TEXT_LABEL =
  "What's one thing you're trying to make happen in the next month, and what's stopping you?";

export const FREE_TEXT_HELP =
  "Name the thing, who you need, and by when. One or two sentences is plenty.";

export const FREE_TEXT_NUDGE = "Add who you need, or by when";

export const FREE_TEXT_EXAMPLES = [
  "Shipping a Discord bot for my 400-person community, but I need someone who knows Supabase auth by next week.",
  "Running my first London meetup in November and need a venue partner and a co-host.",
  "I can design onboarding flows and want a real AI product to put in my portfolio.",
] as const;

export const CONSENT_TEXT =
  "Your answers are only used to recap and reconnect you with people you add or who add you. Your contact is shown only after you both confirm. All data is deleted after the event.";

export const NO_STRONG_MATCH_MESSAGE =
  "No strong match yet, we'll keep looking";

export type Submission = {
  name: string;
  contact: string;
  linkedin?: string;
  role: string;
  offers: string[];
  topOffer: string;
  needs: string[];
  topNeed: string;
  availability: string;
  tryingTo: string;
};

export function normalizeLinkedIn(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string" || value.trim() === "") return { ok: true, value: "" };
  const text = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!text) return { ok: true, value: "" };
  if (text.length > 200 || /\s/.test(text)) return { ok: false, error: "Use a linkedin.com URL, or leave it blank." };
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, error: "Use a linkedin.com URL, or leave it blank." };
    }
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) {
      return { ok: false, error: "Use a linkedin.com URL, or leave it blank." };
    }
    url.hash = "";
    url.protocol = "https:";
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false, error: "Use a linkedin.com URL, or leave it blank." };
  }
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function uniqueAllowed(value: unknown, allowed: readonly string[]): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !allowed.includes(item) || out.includes(item)) {
      return null;
    }
    out.push(item);
  }
  return out;
}

export function validateSubmission(
  body: unknown,
): { ok: true; value: Submission } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Missing survey." };
  }
  const raw = body as Record<string, unknown>;
  if (raw.consent !== true) {
    return { ok: false, error: "Consent is required." };
  }

  const name = clean(raw.name, 80);
  const contact = clean(raw.contact, 120);
  const linkedin = normalizeLinkedIn(raw.linkedin);
  const role = clean(raw.role, 140);
  const tryingTo = clean(raw.tryingTo, 400);
  const availability = clean(raw.availability, 80);
  const offers = uniqueAllowed(raw.offers, OFFERS);
  const needs = uniqueAllowed(raw.needs, NEEDS);
  const topOffer = clean(raw.topOffer, 80);
  const topNeed = clean(raw.topNeed, 80);

  if (name.length < 1) return { ok: false, error: "Add your name." };
  if (contact.length < 2) return { ok: false, error: "Add an email or Discord handle." };
  if (!linkedin.ok) return { ok: false, error: linkedin.error };
  if (role.length < 1) return { ok: false, error: "Add a one-line role." };
  if (!offers || offers.length < 1) return { ok: false, error: "Pick at least one offer." };
  if (!offers.includes(topOffer)) return { ok: false, error: "Mark a top offer." };
  if (!needs || needs.length < 1) return { ok: false, error: "Pick at least one thing you're looking for." };
  if (!needs.includes(topNeed)) return { ok: false, error: "Mark a top need." };
  if (!AVAILABILITIES.includes(availability as (typeof AVAILABILITIES)[number])) {
    return { ok: false, error: "Pick when you're free." };
  }
  if (tryingTo.length < 1) return { ok: false, error: "Tell us what you're trying to make happen." };

  return {
    ok: true,
    value: { name, contact, linkedin: linkedin.value, role, offers, topOffer, needs, topNeed, availability, tryingTo },
  };
}
