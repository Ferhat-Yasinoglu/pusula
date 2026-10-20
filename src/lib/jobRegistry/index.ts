/** JobRegistry singleton - survives Next.js HMR via globalThis. */

import { JobRegistry } from "./registry";
import type { JobDefinition } from "./core";

declare global {
  var __pusulaJobRegistry: JobRegistry | undefined;
}

export function getJobRegistry(): JobRegistry {
  if (!globalThis.__pusulaJobRegistry) {
    globalThis.__pusulaJobRegistry = new JobRegistry();
  }
  return globalThis.__pusulaJobRegistry;
}

/** Test-only: drop the singleton so each test starts fresh. */
export function __resetJobRegistry(): void {
  globalThis.__pusulaJobRegistry = undefined;
}

export type { JobDefinition, JobRecord, HandlerResult, JobRun } from "./core";
