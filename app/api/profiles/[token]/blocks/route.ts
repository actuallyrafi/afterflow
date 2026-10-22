import { listBlocked, unblock } from "@/lib/connections";
import { getStore } from "@/lib/get-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

/** Only the blocker ever sees this list. */
export async function GET(_request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const people = await listBlocked(getStore(), token);
  if (!people) return Response.json({ error: "This card isn't available." }, { status: 404 });
  return Response.json({ people }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  let body: { action?: unknown; publicId?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  if (body.action !== "unblock") return Response.json({ error: "Unknown action." }, { status: 400 });
  const result = await unblock(getStore(), token, body.publicId);
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
