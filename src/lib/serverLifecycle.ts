export type ServerLifecyclePhase = "starting" | "ready" | "stopping";

declare global {
  var __pusulaServerLifecycle: ServerLifecyclePhase | undefined;
}

export function getServerLifecyclePhase(): ServerLifecyclePhase {
  return globalThis.__pusulaServerLifecycle ?? "starting";
}

export function markServerStarting(): void {
  globalThis.__pusulaServerLifecycle = "starting";
}

export function markServerReady(): void {
  if (getServerLifecyclePhase() !== "stopping") {
    globalThis.__pusulaServerLifecycle = "ready";
  }
}

export function markServerStopping(): void {
  globalThis.__pusulaServerLifecycle = "stopping";
}
