import { getStore } from "@/lib/get-store";
import { organiserAuthorised, organiserStats } from "@/lib/organiser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function denied() {
  return Response.json({ error: "Wrong passcode." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (!organiserAuthorised(request.headers.get("x-organiser-passcode"))) return denied();
  const stats = await organiserStats(getStore());
  return Response.json(stats, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!organiserAuthorised(request.headers.get("x-organiser-passcode"))) return denied();
  let action = "";
  try {
    const body = (await request.json()) as { action?: unknown };
    action = typeof body.action === "string" ? body.action : "";
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  if (action !== "delete-all") {
    return Response.json({ error: "Unknown action." }, { status: 400 });
  }
  await getStore().deleteAll();
  const stats = await organiserStats(getStore());
  return Response.json(
    { ...stats, message: "All data deleted" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
