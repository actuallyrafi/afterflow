import { calendarReminder } from "@/lib/connections";
import { getStore } from "@/lib/get-store";
import { icsFilename, toIcs } from "@/lib/calendar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string; id: string }> };

/** The one gentle reminder as a calendar file (.ics) for the person's own calendar. */
export async function GET(request: Request, ctx: Ctx) {
  const { token, id } = await ctx.params;
  const origin = new URL(request.url).origin;
  const result = await calendarReminder(getStore(), token, id, origin);
  if (!("reminder" in result.body)) {
    return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(toIcs(result.body.reminder), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // inline: iPhone Safari offers "Add to Calendar"; desktop browsers save the file.
      "Content-Disposition": `inline; filename="${icsFilename(result.body.theirName)}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
