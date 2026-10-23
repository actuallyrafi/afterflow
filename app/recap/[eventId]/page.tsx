import type { Metadata } from "next";
import { RecapLink } from "./recap-link";

export const metadata: Metadata = { title: "Afterflow", robots: { index: false, follow: false } };

/**
 * Token-free landing for recap reminders (D23). The calendar only ever holds /recap/{eventId}.
 * It opens the recap only on the device whose saved session owns the event; anywhere else it shows
 * the same neutral page as /c/{id}, with no event name, people or count.
 */
export default async function RecapLinkPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <RecapLink eventId={eventId} />;
}
