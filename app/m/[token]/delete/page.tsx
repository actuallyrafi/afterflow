import { redirect } from "next/navigation";

/** Delete now lives in the Danger zone at the bottom of My card (v4.1b, per Tanvir). Old links land there. */
export default async function DeleteMoved({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/m/${token}/card#danger-zone`);
}
