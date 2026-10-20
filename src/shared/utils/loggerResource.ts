import type { Logger } from "pino";

export interface SharedLoggerResource {
  logger: Logger;
  close: () => Promise<void>;
}

declare global {
  var __pusulaLoggerResource: SharedLoggerResource | undefined;
}

/**
 * Return the process-wide logger resource, creating it only once.
 *
 * Next.js development HMR can evaluate logger.ts in more than one server chunk.
 * Keeping the resource on globalThis prevents each evaluation from spawning a
 * new pino worker transport.
 */
export function getOrCreateSharedLoggerResource(
  create: () => SharedLoggerResource
): SharedLoggerResource {
  return (globalThis.__pusulaLoggerResource ??= create());
}

/** Close and forget the shared transport. Idempotent across HMR module copies. */
export async function closeSharedLoggerResource(): Promise<void> {
  const resource = globalThis.__pusulaLoggerResource;
  if (!resource) return;

  delete globalThis.__pusulaLoggerResource;
  await resource.close();
}
