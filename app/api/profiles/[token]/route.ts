import { listHome } from "@/lib/connections";
import { getStore } from "@/lib/get-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const result = await listHome(getStore(), token);
  if (!result) {
    return Response.json({ error: "This link does not match a card." }, { status: 404 });
  }
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
