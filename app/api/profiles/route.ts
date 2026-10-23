import { validateSubmission } from "@/lib/survey";
import { getStore } from "@/lib/get-store";
import { isEventId, joinEvent } from "@/lib/organiser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  const parsed = validateSubmission(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const profile = await getStore().createProfile(parsed.value);
  // v4.1h: a card made from an event's join link joins that event (unknown ids are ignored).
  const joinEventId = (body as { joinEventId?: unknown } | null)?.joinEventId;
  if (isEventId(joinEventId)) await joinEvent(getStore(), joinEventId, profile.id).catch(() => null);
  return Response.json(
    { id: profile.id, token: profile.secretToken, name: profile.name, createdAt: profile.createdAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
