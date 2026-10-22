import { ensureBackupPair } from "../lib/demo-backup";
import { DEMO_PROFILES } from "../lib/demo-profiles";
import { getStore } from "../lib/get-store";

async function main() {
  const store = getStore();
  await store.deleteDemos();
  for (const demo of DEMO_PROFILES) {
    await store.createProfile({ ...demo, isDemo: true });
  }
  const backup = await ensureBackupPair(store);
  const profiles = await store.listProfiles();
  console.log(
    `Seeded ${DEMO_PROFILES.length} demo profiles plus the confirmed backup pair. ${profiles.length} profiles stored (${store.kind}). Open /demo (${backup.connectionId}).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
