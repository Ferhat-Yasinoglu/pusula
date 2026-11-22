import { NextResponse } from "next/server";
import { createAccessRequest, countPendingAccessRequests } from "@/lib/db/accessRequests";
import { accessRequestSubmitSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { checkRateLimit } from "@/shared/utils/rateLimiter";
import { createErrorResponse } from "@/lib/api/errorResponse";
import {
  AUTHZ_HEADER_TRUSTED_CLIENT_IP,
  AUTHZ_HEADER_TRUSTED_PEER_IP,
} from "@/server/authz/headers";
import * as log from "@/sse/utils/logger";

/** Submissions one client address may send per hour. */
export const SUBMISSIONS_PER_HOUR = 3;
/** Above this many undecided requests the form stops accepting new ones. */
export const MAX_PENDING_REQUESTS = 200;

/**
 * Throttle key for the caller: the address the authz pipeline vouched for. Without that stamp
 * (no proxy in front, direct handler call) every caller shares one bucket rather than trusting
 * a forwarding header the caller controls.
 */
function getThrottleKey(request: Request): string {
  return (
    request.headers.get(AUTHZ_HEADER_TRUSTED_CLIENT_IP) ||
    request.headers.get(AUTHZ_HEADER_TRUSTED_PEER_IP) ||
    "untrusted"
  );
}

/**
 * Public "request access" form on the landing page. Anyone may call it (it is in
 * PUBLIC_API_ROUTES_EXACT), so it stores no more than a name, an email and a short reason,
 * and caps both the rate per address and the size of the pending queue.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse({ status: 400, message: "Invalid JSON body" });
  }

  const validation = validateBody(accessRequestSubmitSchema, body);
  if (isValidationFailure(validation)) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { name, email, reason, website } = validation.data;

  // Honeypot: answer like a success so the bot learns nothing, and store nothing.
  if (website) return NextResponse.json({ ok: true });

  const rate = await checkRateLimit(`access-request:${getThrottleKey(request)}`, [
    { limit: SUBMISSIONS_PER_HOUR, window: 3600 },
  ]);
  if (!rate.allowed) {
    return createErrorResponse({ status: 429, message: "Too many requests, try again later" });
  }

  try {
    if (countPendingAccessRequests() >= MAX_PENDING_REQUESTS) {
      return createErrorResponse({
        status: 503,
        message: "Not accepting new requests right now",
      });
    }
    // A repeat from an email that is already waiting gets the same answer as a new one.
    createAccessRequest({ name, email, reason });
    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error("access-request", "Failed to store access request", error);
    return createErrorResponse({ status: 500, message: "Failed to submit request" });
  }
}
