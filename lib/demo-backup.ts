import { mutualReason } from "./evidence";
import { scoreMatch } from "./matching";
import { pickNextStep, type EventContext } from "./next-step";
import type { Store } from "./store";
import eventContextJson from "../event-context.json";

const eventContext = eventContextJson as EventContext;

export const BACKUP_PUBLIC_IDS = {
  ada: "demo-backup-a",
  jonah: "demo-backup-b",
} as const;

const ADA = {
  name: "Ada Quinn",
  contact: "ada.backup.demo",
  linkedin: "https://www.linkedin.com/in/ada-quinn-demo",
  role: "Full-stack engineer",
  offers: ["Coding"],
  topOffer: "Coding",
  needs: ["Design"],
  topNeed: "Design",
  availability: "Right now at the event",
  tryingTo: "Shipping an AI study app but I can't design the onboarding",
  publicId: BACKUP_PUBLIC_IDS.ada,
  secretToken: "demo-backup-ada",
  isDemo: true,
};

const JONAH = {
  name: "Jonah Blake",
  contact: "jonah.backup.demo",
  linkedin: "https://www.linkedin.com/in/jonah-blake-demo",
  role: "Product designer",
  offers: ["Design"],
  topOffer: "Design",
  needs: ["Coding"],
  topNeed: "Coding",
  availability: "Right now at the event",
  tryingTo: "I can design onboarding flows and want a real AI product to put in my portfolio.",
  publicId: BACKUP_PUBLIC_IDS.jonah,
  secretToken: "demo-backup-jonah",
  isDemo: true,
};

export async function ensureBackupPair(store: Store): Promise<{ token: string; connectionId: string }> {
  let ada = await store.getProfileByPublicId(ADA.publicId);
  if (!ada) ada = await store.createProfile(ADA);
  let jonah = await store.getProfileByPublicId(JONAH.publicId);
  if (!jonah) jonah = await store.createProfile(JONAH);

  const existing = (await store.listMatchesFor(ada.id)).find((match) => match.aId === jonah.id || match.bId === jonah.id);
  const reason = mutualReason(ada, jonah);
  const step = pickNextStep(ada, jonah, eventContext);
  const scored = scoreMatch(
    {
      offers: ada.offers,
      topOffer: ada.topOffer,
      needs: ada.needs,
      topNeed: ada.topNeed,
      availability: ada.availability,
      tryingTo: ada.tryingTo,
      role: ada.role,
    },
    {
      offers: jonah.offers,
      topOffer: jonah.topOffer,
      needs: jonah.needs,
      topNeed: jonah.topNeed,
      availability: jonah.availability,
      tryingTo: jonah.tryingTo,
      role: jonah.role,
    },
  );

  let match = existing;
  if (!match) {
    match = await store.createMatch({
      aId: ada.id,
      bId: jonah.id,
      score: scored.score,
      explanation: reason,
      firstAction: step,
      met: true,
      aStatus: "accepted",
      bStatus: "accepted",
      aNote: "the onboarding screens for the study app",
      bNote: "how the study app should feel on a phone",
    });
  }
  if (match.aStatus !== "accepted") match = (await store.setStatus(match.id, "a", "accepted")) ?? match;
  if (match.bStatus !== "accepted") match = (await store.setStatus(match.id, "b", "accepted")) ?? match;
  if (!match.met) match = (await store.setMet(match.id)) ?? match;
  const adaNote = match.aId === ada.id ? "a_note" : "b_note";
  const jonahNote = adaNote === "a_note" ? "b_note" : "a_note";
  match = (await store.setText(match.id, adaNote, "the onboarding screens for the study app")) ?? match;
  match = (await store.setText(match.id, jonahNote, "how the study app should feel on a phone")) ?? match;

  return { token: ada.secretToken, connectionId: match.id };
}
