/**
 * Types and documented constants shared by the landing page's client
 * components. This module must stay free of gateway imports: anything the
 * client bundle pulls from here is shipped to the browser, and the figures
 * themselves are computed server-side in `landingStats.ts`.
 *
 * Every constant below restates a value that lives in gateway code the client
 * cannot import. `tests/unit/landing-stats.test.ts` pins each one to its
 * source, so the page fails CI instead of drifting.
 */

/** Documented in `open-sse/mcp-server/README.md` ("110 tools"). */
export const MCP_TOOL_COUNT = 110;
/** Documented in `docs/frameworks/MCP-SERVER.md` (33 scopes, 3 transports). */
export const MCP_SCOPE_COUNT = 33;
export const MCP_TRANSPORT_COUNT = 3;

/**
 * Provider circuit-breaker and connection-cooldown defaults per connection
 * profile. Mirrors `PROVIDER_PROFILES` in `open-sse/config/constants.ts`
 * (`circuitBreakerThreshold`, `circuitBreakerReset`, `degradationThreshold`,
 * `transientCooldown`), which is not imported here because that module loads
 * provider credentials on import.
 *
 * - `opensAfter`: failures that open the breaker.
 * - `resetSeconds`: how long it stays open before the half-open probe.
 * - `degradesAfter`: failures that enter the DEGRADED early-warning band.
 *   `null` for local: the profile sets no `degradationThreshold`, so the
 *   breaker derives `ceil(opensAfter · 60%)` = 2 = `opensAfter`, and the
 *   band never shows on its own.
 * - `cooldownBaseMs`: base of one key's exponential cooldown
 *   (`baseCooldownMs · 2^level`, `src/lib/resilience/settings.ts`).
 */
export const BREAKER_PROFILES = [
  { id: "oauth", opensAfter: 8, resetSeconds: 60, degradesAfter: 5, cooldownBaseMs: 5000 },
  { id: "apikey", opensAfter: 12, resetSeconds: 30, degradesAfter: 7, cooldownBaseMs: 3000 },
  { id: "local", opensAfter: 2, resetSeconds: 15, degradesAfter: null, cooldownBaseMs: 2000 },
] as const;

/** A2A skills, in registration order: the keys of `A2A_SKILL_HANDLERS` (`src/lib/a2a/taskExecution.ts`). */
export const A2A_SKILLS = [
  "smart-routing",
  "quota-management",
  "provider-discovery",
  "cost-analysis",
  "health-report",
  "list-capabilities",
] as const;

/** JSON-RPC methods dispatched by `src/app/a2a/route.ts` (A2A 1.0 names are aliases of these). */
export const A2A_METHODS = ["message/send", "message/stream", "tasks/get", "tasks/cancel"] as const;

/** MCP transports, display names. Their count is `MCP_TRANSPORT_COUNT`. */
export const MCP_TRANSPORTS = ["stdio", "SSE", "Streamable HTTP"] as const;

/** Route handlers under `src/app/api/mcp/{stream,sse}/route.ts`. */
export const MCP_ENDPOINTS = { stream: "/api/mcp/stream", sse: "/api/mcp/sse" } as const;

/** JSON-RPC endpoint (`src/app/a2a/route.ts`) and Agent Card (`src/app/.well-known/agent.json/route.ts`). */
export const A2A_ENDPOINTS = { rpc: "/a2a", card: "/.well-known/agent.json" } as const;

/** API and dashboard share one port (`AGENTS.md` → Environment). */
export const DEFAULT_PORT = 20128;
export const INSTALL_COMMAND = "npx pusula";

/**
 * Response headers the page quotes in its illustrations. Every value is one of
 * `PUSULA_RESPONSE_HEADERS` (`src/shared/constants/headers.ts`); the example
 * values next to them are always produced by the illustration itself.
 */
export const HEADER = {
  provider: "X-Pusula-Provider",
  fallbackAttempts: "X-Pusula-Fallback-Attempts",
  latencyMs: "X-Pusula-Latency-Ms",
  requestId: "X-Pusula-Request-Id",
  cache: "X-Pusula-Cache",
  cacheSimilarity: "X-Pusula-Cache-Similarity",
  compression: "X-Pusula-Compression",
  savingsTokens: "X-Pusula-Savings-Tokens",
} as const;

/**
 * The six providers the simulated deck routes between. `id` is the deck's
 * short name, `catalogId` the real `AI_PROVIDERS` id (shown in headers and on
 * the map), `profile` the breaker profile the gateway would apply to it.
 */
export const SAMPLE_CANDIDATES = [
  { id: "claude", catalogId: "claude", profile: "oauth" },
  { id: "gpt", catalogId: "openai", profile: "apikey" },
  { id: "gemini", catalogId: "gemini", profile: "apikey" },
  { id: "glm", catalogId: "glm", profile: "apikey" },
  { id: "cerebras", catalogId: "cerebras", profile: "apikey" },
  { id: "ollama", catalogId: "ollama-local", profile: "local" },
] as const;

export type BreakerProfileId = (typeof BREAKER_PROFILES)[number]["id"];
export type SampleCandidate = (typeof SAMPLE_CANDIDATES)[number];

export type CatalogKind =
  "llm" | "webSearch" | "imageToText" | "webFetch" | "embedding" | "video" | "other";

export type CatalogEntry = {
  id: string;
  name: string;
  kind: CatalogKind;
  /** Has a free tier or needs no key at all. */
  free: boolean;
  /** Local CLI bridge (`isLocalCli`): Augment, Devin CLI bridge, Codex App-Server, ZCode. Not Ollama. */
  local: boolean;
};

export type ScoringFactor = {
  id: string;
  weight: number;
};

/** One compression engine, in stack order (`ENGINE_IDS`). */
export type CompressionEngine = {
  id: string;
  label: string;
  /** `guidance.lossy` in `ENGINE_CATALOG`: can drop content a later turn might need. */
  lossy: boolean;
};

export type LandingStats = {
  version: string;
  providers: number;
  freeProviders: number;
  localProviders: number;
  strategies: readonly string[];
  scoringFactors: readonly ScoringFactor[];
  compressionEngines: number;
  compressionEngineList: readonly CompressionEngine[];
  cliTools: readonly { id: string; name: string }[];
  mcpTools: number;
  mcpScopes: number;
  mcpTransports: number;
  catalog: readonly CatalogEntry[];
  kindCounts: Readonly<Record<CatalogKind, number>>;
};
