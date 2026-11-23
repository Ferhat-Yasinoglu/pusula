import { NextResponse } from "next/server";
import {
  attachApiKey,
  decideAccessRequest,
  getAccessRequest,
  reopenAccessRequest,
} from "@/lib/db/accessRequests";
import { createApiKey, updateApiKeyPermissions } from "@/lib/db/apiKeys";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { createErrorResponse } from "@/lib/api/errorResponse";
import { accessRequestDecisionSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { logAuditEvent } from "@/lib/compliance/index";
import * as log from "@/sse/utils/logger";

/**
 * The operator approves or rejects one request. Approving issues a normal API key with daily and
 * weekly spending limits and returns its secret in this response only, for the operator to pass on.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse({ status: 400, message: "Invalid JSON body" });
  }
  const validation = validateBody(accessRequestDecisionSchema, body);
  if (isValidationFailure(validation)) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const decision = validation.data;

  const existing = getAccessRequest(id);
  if (!existing) {
    return createErrorResponse({ status: 404, message: "Access request not found" });
  }

  // Claim the request first: a second click or tab finds it decided and gets 409, so one
  // request can never issue two keys.
  const decided = decideAccessRequest(id, decision.action === "approve" ? "approved" : "rejected");
  if (!decided) {
    return createErrorResponse({ status: 409, message: "Access request was already decided" });
  }

  if (decision.action === "reject") {
    logAuditEvent({ action: "accessRequest.reject", target: id });
    return NextResponse.json({ request: decided });
  }

  try {
    const machineId = await getConsistentMachineId();
    const apiKey = await createApiKey(`${existing.name} <${existing.email}>`, machineId);
    await updateApiKeyPermissions(apiKey.id, {
      usageLimitEnabled: true,
      dailyUsageLimitUsd: decision.dailyUsageLimitUsd,
      weeklyUsageLimitUsd: decision.weeklyUsageLimitUsd,
    });
    attachApiKey(id, apiKey.id);
    logAuditEvent({
      action: "accessRequest.approve",
      target: id,
      details: { apiKeyId: apiKey.id },
    });
    return NextResponse.json({
      request: getAccessRequest(id),
      apiKeyId: apiKey.id,
      key: apiKey.key,
    });
  } catch (error) {
    reopenAccessRequest(id);
    log.error("access-requests", "Failed to issue a key for an access request", error);
    return createErrorResponse({ status: 500, message: "Failed to issue the API key" });
  }
}
