import { deleteCard, listHome, updateCard } from "@/lib/connections";
import { getStore } from "@/lib/get-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

type Ctx = { params: Promise<{ token: string }> };

async function json(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET(_request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const result = await listHome(getStore(), token);
  if (!result) return Response.json({ error: "This card isn't available." }, { status: 404, headers: NO_STORE });
  return Response.json(result, { headers: NO_STORE });
}

/** Edit my card, or turn the one gentle reminder on or off. */
export async function PATCH(request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const body = await json(request);
  if (!body) return Response.json({ error: "Send JSON." }, { status: 400 });
  const result = await updateCard(getStore(), token, body);
  return Response.json(result.body, { status: result.status, headers: NO_STORE });
}

/** Delete my card. The body must carry the person's name, typed to confirm. */
export async function DELETE(request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const body = (await json(request)) as { name?: unknown } | null;
  const result = await deleteCard(getStore(), token, body?.name);
  return Response.json(result.body, { status: result.status, headers: NO_STORE });
}
