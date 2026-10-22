import type { Store } from "./store";

export const BACKUP_PUBLIC_IDS = {
  ada: "demo-backup-a",
  jonah: "demo-backup-b",
} as const;

const ADA = {
  name: "Ada Quinn",
  contact: "discord:ada.backup.demo",
  answer: "Finally trying the bouldering wall in Bermondsey",
  publicId: BACKUP_PUBLIC_IDS.ada,
  secretToken: "demo-backup-ada",
  isDemo: true,
};

const JONAH = {
  name: "Jonah Blake",
  contact: "whatsapp:+447700900123",
  answer: "Running a supper club for the first time",
  publicId: BACKUP_PUBLIC_IDS.jonah,
  secretToken: "demo-backup-jonah",
  isDemo: true,
};

const ADA_NOTE = "the bouldering chat by the snacks";
const JONAH_NOTE = "supper club menu ideas";
const SHARED = "Bouldering, then dumplings on Tooley St?";

/** A confirmed demo pair for /demo. Nothing is scored; it's just two cards that both said yes. */
export async function ensureBackupPair(store: Store): Promise<{ token: string; connectionId: string }> {
  let ada = await store.getProfileByPublicId(ADA.publicId);
  if (!ada) ada = await store.createProfile(ADA);
  let jonah = await store.getProfileByPublicId(JONAH.publicId);
  if (!jonah) jonah = await store.createProfile(JONAH);

  let match = (await store.listMatchesFor(ada.id)).find((row) => row.aId === jonah.id || row.bId === jonah.id) ?? null;
  if (match && (match.removedAt || match.blockedBy || match.shadow)) {
    await store.deleteMatch(match.id);
    match = null;
  }
  if (!match) {
    match = await store.createMatch({
      aId: ada.id,
      bId: jonah.id,
      met: true,
      aStatus: "accepted",
      bStatus: "accepted",
      aNote: ADA_NOTE,
      bNote: JONAH_NOTE,
    });
  }
  for (const block of await store.listBlocksFor(ada.id)) {
    if (block.blockerId === jonah.id || block.blockedId === jonah.id) await store.removeBlock(block.blockerId, block.blockedId);
  }
  const adaIsA = match.aId === ada.id;
  match =
    (await store.patchMatch(match.id, {
      aStatus: "accepted",
      bStatus: "accepted",
      met: true,
      aNote: adaIsA ? ADA_NOTE : JONAH_NOTE,
      bNote: adaIsA ? JONAH_NOTE : ADA_NOTE,
      sharedNote: match.sharedNote || SHARED,
    })) ?? match;

  return { token: ada.secretToken, connectionId: match.id };
}
