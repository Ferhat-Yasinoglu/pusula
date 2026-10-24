/**
 * Types and documented constants shared by the landing page's client
 * components. This module must stay free of gateway imports: anything the
 * client bundle pulls from here is shipped to the browser, and the figures
 * themselves are computed server-side in `landingStats.ts`.
 */

/** Documented in `open-sse/mcp-server/README.md` ("110 tools"). */
export const MCP_TOOL_COUNT = 110;
/** Documented in `docs/frameworks/MCP-SERVER.md` (33 scopes, 3 transports). */
export const MCP_SCOPE_COUNT = 33;
export const MCP_TRANSPORT_COUNT = 3;

/**
 * Provider circuit-breaker defaults per connection profile. Mirrors
 * `PROVIDER_PROFILES` in `open-sse/config/constants.ts` (`circuitBreakerThreshold`,
 * `circuitBreakerReset`), which is not imported here because that module loads
 * provider credentials on import. `tests/unit/landing-stats.test.ts` pins these
 * to the source values.
 */
export const BREAKER_PROFILES = [
  { id: "oauth", opensAfter: 8, resetSeconds: 60 },
  { id: "apikey", opensAfter: 12, resetSeconds: 30 },
  { id: "local", opensAfter: 2, resetSeconds: 15 },
] as const;

export type CatalogKind =
  "llm" | "webSearch" | "imageToText" | "webFetch" | "embedding" | "video" | "other";

export type CatalogEntry = {
  id: string;
  name: string;
  kind: CatalogKind;
  /** Has a free tier or needs no key at all. */
  free: boolean;
  /** Runs on the operator's machine (Ollama, llama.cpp, LM Studio, …). */
  local: boolean;
};

export type ScoringFactor = {
  id: string;
  weight: number;
};

export type LandingStats = {
  version: string;
  providers: number;
  freeProviders: number;
  localProviders: number;
  strategies: readonly string[];
  scoringFactors: readonly ScoringFactor[];
  compressionEngines: number;
  cliTools: readonly { id: string; name: string }[];
  mcpTools: number;
  mcpScopes: number;
  mcpTransports: number;
  catalog: readonly CatalogEntry[];
  kindCounts: Readonly<Record<CatalogKind, number>>;
};
