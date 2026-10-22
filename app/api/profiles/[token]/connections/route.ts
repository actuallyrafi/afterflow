import { addMet } from "@/lib/connections";
import { getStore } from "@/lib/get-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  let publicId: unknown = "";
  let note: unknown = "";
  try {
    const body = (await request.json()) as { publicId?: unknown; note?: unknown };
    publicId = body.publicId;
    note = body.note;
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  const result = await addMet(getStore(), token, publicId, note);
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
