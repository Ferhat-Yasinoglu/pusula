import { sanitizeErrorMessage } from "@pusula/open-sse/utils/error.ts";

export function formatTelegramGatewayError(error: unknown): string {
  return `⚠️ Gateway error: ${sanitizeErrorMessage(error)}`;
}
