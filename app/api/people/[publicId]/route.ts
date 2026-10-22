import { publicCard } from "@/lib/connections";
import { getStore } from "@/lib/get-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await ctx.params;
  const person = await publicCard(getStore(), publicId);
  if (!person) {
    return Response.json({ error: "This card isn't available." }, { status: 404 });
  }
  return Response.json({ person }, { headers: { "Cache-Control": "no-store" } });
}
