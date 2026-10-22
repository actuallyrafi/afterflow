import { ensureBackupPair } from "../lib/demo-backup";
import { getStore } from "../lib/get-store";

async function main() {
  const store = getStore();
  const backup = await ensureBackupPair(store);
  console.log(`Demo backup ready at /demo (card ${backup.token}, connection ${backup.connectionId}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
