import { ensureBackupPair } from "@/lib/demo-backup";
import { getStore } from "@/lib/get-store";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DemoBackupPage() {
  const backup = await ensureBackupPair(getStore());
  redirect(`/m/${backup.token}/c/${backup.connectionId}`);
}
