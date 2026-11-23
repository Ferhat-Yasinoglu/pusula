import { NextResponse } from "next/server";
import { countPendingAccessRequests, listAccessRequests } from "@/lib/db/accessRequests";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { createErrorResponse } from "@/lib/api/errorResponse";
import * as log from "@/sse/utils/logger";

/** Every access request, newest first, plus the number still waiting for a decision. */
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    return NextResponse.json({
      requests: listAccessRequests(),
      pendingCount: countPendingAccessRequests(),
    });
  } catch (error) {
    log.error("access-requests", "Failed to list access requests", error);
    return createErrorResponse({ status: 500, message: "Failed to list access requests" });
  }
}
