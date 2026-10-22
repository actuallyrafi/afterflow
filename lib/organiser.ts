import { timingSafeEqual } from "node:crypto";
import type { Store } from "./store";

export function organiserAuthorised(header: string | null): boolean {
  const expected = process.env.ORGANISER_PASSCODE || "afterflow";
  const given = Buffer.from(header ?? "");
  const want = Buffer.from(expected);
  if (given.length !== want.length) {
    timingSafeEqual(want, want);
    return false;
  }
  return timingSafeEqual(given, want);
}

export type OrganiserStats = {
  /** Headline: private "Talked again" marks across everyone, as one total. */
  talkedAgainMarks: number;
  /** Connections where at least one person marked "Talked again". */
  pairsTalkedAgain: number;
  /** Headline: connections both people confirmed. */
  mutualConfirms: number;
  /** Context only. */
  connectionsRequested: number;
  signups: number;
};

/**
 * Aggregate totals for the organiser only. Never shown to attendees, never per person,
 * never ranked. Removed, blocked and one-sided "shadow" rows don't count.
 */
export async function organiserStats(store: Store): Promise<OrganiserStats> {
  const profiles = await store.listProfiles();
  const connections = (await store.listMatches()).filter(
    (match) => match.met && !match.shadow && !match.removedAt && !match.blockedBy,
  );
  let mutualConfirms = 0;
  let talkedAgainMarks = 0;
  let pairsTalkedAgain = 0;
  for (const match of connections) {
    if (match.aStatus === "accepted" && match.bStatus === "accepted") mutualConfirms += 1;
    const marks = (match.aFollowUp === "yes" ? 1 : 0) + (match.bFollowUp === "yes" ? 1 : 0);
    talkedAgainMarks += marks;
    if (marks > 0) pairsTalkedAgain += 1;
  }
  return {
    talkedAgainMarks,
    pairsTalkedAgain,
    mutualConfirms,
    connectionsRequested: connections.length,
    signups: profiles.length,
  };
}
