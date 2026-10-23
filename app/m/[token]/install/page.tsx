import { redirect } from "next/navigation";

/** v4.1d's inline install step was replaced by the D28 pop-up; old links land on Your people. */
export default async function InstallStep({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/m/${encodeURIComponent(token)}`);
}
