import type { Metadata } from "next";
import { CalendarLink } from "./calendar-link";

export const metadata: Metadata = { title: "Afterflow", robots: { index: false, follow: false } };

/**
 * Token-free landing for calendar reminders. The calendar only ever holds /c/{id}; the private
 * /m/{token} link never leaves the device. This page reveals no name or contact by itself.
 */
export default async function CalendarLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CalendarLink id={id} />;
}
