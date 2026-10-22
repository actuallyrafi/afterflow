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

/** Aggregate totals for the organiser only. Never shown to attendees, never per person. */
export async function organiserStats(store: Store) {
  const profiles = await store.listProfiles();
  const connections = (await store.listMatches()).filter(
    (match) => match.met && !match.shadow && !match.removedAt && !match.blockedBy,
  );
  let mutualConfirms = 0;
  let followedUp = 0;
  for (const match of connections) {
    if (match.aStatus === "accepted" && match.bStatus === "accepted") mutualConfirms += 1;
    if (match.aFollowUp === "yes" || match.bFollowUp === "yes") followedUp += 1;
  }
  return {
    signups: profiles.length,
    connectionsMade: connections.length,
    mutualConfirms,
    followedUp,
  };
}
