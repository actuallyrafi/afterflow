import { actOnConnection } from "@/lib/connections";
import { getStore } from "@/lib/get-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await ctx.params;
  let body: { action?: unknown; link?: unknown; time?: unknown } = {};
  try {
    body = (await request.json()) as { action?: unknown; link?: unknown; time?: unknown };
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  const result = await actOnConnection(getStore(), token, id, body);
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
