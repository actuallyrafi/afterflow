import eventContextJson from "../event-context.json";

export type EventContext = {
  name: string;
  shortName?: string;
  date: string;
  venue: { name: string; address: string };
};

export const EVENT = eventContextJson as EventContext;

/** "Grok Bot London" — Luma context only, never a ranking or a count. */
export const EVENT_SHORT = EVENT.shortName || "Grok Bot London";

/** "22 Oct" */
export const EVENT_DAY = new Date(`${EVENT.date}T12:00:00Z`).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/London",
});

export const EVENT_LINE = `${EVENT_SHORT} · ${EVENT_DAY}`;

/** About three days after the event, the one optional reminder may appear. */
export const REMINDER_DELAY_MS = 3 * 24 * 60 * 60 * 1000;
