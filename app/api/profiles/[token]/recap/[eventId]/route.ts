import { getRecap } from "@/lib/connections";
import { getStore } from "@/lib/get-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

/** v4.1d: one of my events' recap. Someone else's or an unknown event: 404 with nothing in it. */
export async function GET(_request: Request, ctx: { params: Promise<{ token: string; eventId: string }> }) {
  const { token, eventId } = await ctx.params;
  const result = await getRecap(getStore(), token, eventId);
  if (!result) return Response.json({ error: "This page isn't available." }, { status: 404, headers: NO_STORE });
  return Response.json(result, { headers: NO_STORE });
}
