import { actOnConnection, getConnection, type ActionBody } from "@/lib/connections";
import { getStore } from "@/lib/get-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string; id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { token, id } = await ctx.params;
  const result = await getConnection(getStore(), token, id);
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, ctx: Ctx) {
  const { token, id } = await ctx.params;
  let body: ActionBody = {};
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  const result = await actOnConnection(getStore(), token, id, body);
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
