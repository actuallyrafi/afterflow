import { getStore } from "@/lib/get-store";
import { joinEvent, readEvent } from "@/lib/organiser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "no-store" };
type Ctx = { params: Promise<{ eventId: string }> };

/** Public: just the event's name and day, for the join page. */
export async function GET(_request: Request, ctx: Ctx) {
  const { eventId } = await ctx.params;
  const event = await readEvent(getStore(), eventId);
  if (!event) return Response.json({ error: "This event link doesn't work." }, { status: 404, headers });
  return Response.json({ event: { id: event.id, name: event.name, date: event.date } }, { headers });
}

/** Someone who already has a card joins the event with their own private token. */
export async function POST(request: Request, ctx: Ctx) {
  const { eventId } = await ctx.params;
  let token: unknown;
  try {
    token = ((await request.json()) as { token?: unknown }).token;
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400, headers });
  }
  const store = getStore();
  const me = typeof token === "string" && token ? await store.getProfileByToken(token) : null;
  if (!me) return Response.json({ error: "This card isn't available." }, { status: 404, headers });
  const joined = await joinEvent(store, eventId, me.id);
  if (!joined) return Response.json({ error: "This event link doesn't work." }, { status: 404, headers });
  return Response.json({ joined: true, event: { id: joined.id, name: joined.name, date: joined.date } }, { headers });
}
