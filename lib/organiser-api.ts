import { getStore } from "./get-store";
import {
  clientAddress,
  keyMatches,
  noteFailure,
  NOT_ALLOWED,
  ORGANISER_HEADERS,
  organiserAuthorised,
  readEvent,
  throttled,
  type OrganiserEvent,
} from "./organiser";
import type { Store } from "./store";

export function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: ORGANISER_HEADERS });
}

/** One answer for a wrong key, a wrong code, a missing header and an unknown event: no oracle. */
export function refused(address: string) {
  noteFailure(address);
  return reply({ error: NOT_ALLOWED }, 401);
}

export function slowDown() {
  return reply({ error: "Too many tries. Wait a few minutes and try again." }, 429);
}

export type Access = { event: OrganiserEvent; master: boolean; store: Store };

/** The master code opens any event; an event's own key opens only that event. */
export async function eventAccess(request: Request, eventId: string): Promise<Access | Response> {
  const address = clientAddress(request);
  if (throttled(address)) return slowDown();
  const store = getStore();
  const master = organiserAuthorised(request.headers.get("x-organiser-passcode"));
  const event = await readEvent(store, eventId);
  const keyed = keyMatches(event, request.headers.get("x-organiser-key"));
  if (!event || (!master && !keyed)) return refused(address);
  return { event, master, store };
}

export function masterAccess(request: Request): Response | null {
  const address = clientAddress(request);
  if (throttled(address)) return slowDown();
  return organiserAuthorised(request.headers.get("x-organiser-passcode")) ? null : refused(address);
}
