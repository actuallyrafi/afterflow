import { deleteEventData, eventStats, rotateKey, summary } from "@/lib/organiser";
import { eventAccess, reply } from "@/lib/organiser-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ eventId: string }> };

/** This event's totals only. Never per person, never ranked. */
export async function GET(request: Request, ctx: Ctx) {
  const { eventId } = await ctx.params;
  const access = await eventAccess(request, eventId);
  if (access instanceof Response) return access;
  const stats = await eventStats(access.store, eventId);
  return reply({ event: summary(access.event), stats, master: access.master });
}

/** rotate: a new organiser link (the old one stops working). delete-data: this event only, typed name required. */
export async function POST(request: Request, ctx: Ctx) {
  const { eventId } = await ctx.params;
  let body: { action?: unknown; confirm?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return reply({ error: "Send JSON." }, 400);
  }
  const access = await eventAccess(request, eventId);
  if (access instanceof Response) return access;
  if (body.action === "rotate") {
    const key = await rotateKey(access.store, eventId);
    if (!key) return reply({ error: "Couldn't make a new link. Try again." }, 500);
    return reply({ key, event: summary((await access.store.readOrganiserEvent(eventId)) ?? access.event) });
  }
  if (body.action === "delete-data") {
    if (typeof body.confirm !== "string" || body.confirm !== access.event.name) {
      return reply({ error: "Type the event name exactly as it's shown." }, 400);
    }
    const deleted = await deleteEventData(access.store, eventId);
    const stats = await eventStats(access.store, eventId);
    return reply({ deleted, stats });
  }
  return reply({ error: "Unknown action." }, 400);
}
