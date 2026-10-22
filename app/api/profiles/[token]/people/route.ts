import { searchPeople } from "@/lib/connections";
import { getStore } from "@/lib/get-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const people = await searchPeople(getStore(), token, query);
  if (!people) {
    return Response.json({ error: "This link does not match a card." }, { status: 404 });
  }
  return Response.json({ people }, { headers: { "Cache-Control": "no-store" } });
}
