import { getStore } from "@/lib/get-store";
import { createEvent, listEvents, summary } from "@/lib/organiser";
import { masterAccess, reply } from "@/lib/organiser-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Master code only: the list of events (no totals here; totals are per event). */
export async function GET(request: Request) {
  const denied = masterAccess(request);
  if (denied) return denied;
  const events = await listEvents(getStore());
  return reply({ events: events.map(summary) });
}

/**
 * Master code only: make an event. The answer carries the organiser key once; only its hash is stored.
 * The old global "delete-all" is gone for good (410), whoever asks.
 */
export async function POST(request: Request) {
  let body: { action?: unknown; name?: unknown; date?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return reply({ error: "Send JSON." }, 400);
  }
  if (body.action === "delete-all") {
    return reply({ error: "Deleting everything is no longer possible. Delete one event's data from its organiser page." }, 410);
  }
  const denied = masterAccess(request);
  if (denied) return denied;
  if (body.action !== "create") return reply({ error: "Unknown action." }, 400);
  const made = await createEvent(getStore(), { name: body.name, date: body.date });
  if (!made.ok) return reply({ error: made.error }, made.status);
  return reply({ event: summary(made.event), key: made.key });
}
