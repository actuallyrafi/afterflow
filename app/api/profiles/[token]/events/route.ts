import { editEvents, listEvents } from "@/lib/connections";
import { getStore } from "@/lib/get-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

type Ctx = { params: Promise<{ token: string }> };

/** My events. Private to me: nobody else sees them or how I filed anyone. */
export async function GET(_request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const view = await listEvents(getStore(), token);
  if (!view) return Response.json({ error: "This card isn't available." }, { status: 404, headers: NO_STORE });
  return Response.json(view, { headers: NO_STORE });
}

/** `{ action: "create" | "rename" | "delete" | "start" | "end" | "file", … }` */
export async function POST(request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400, headers: NO_STORE });
  }
  const result = await editEvents(getStore(), token, body);
  return Response.json(result.body, { status: result.status, headers: NO_STORE });
}
