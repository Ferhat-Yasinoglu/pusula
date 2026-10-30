/**
 * Landing-page figures, computed from the same constants the gateway runs on.
 *
 * The public page never carries a hand-typed number: provider, free-tier,
 * strategy, scoring-factor, compression-engine and CLI-tool counts are read
 * from source at request time (server component), so the page cannot drift
 * from the code. The only documented constants are the MCP figures, which
 * would require loading the whole MCP server to measure (see `landingTypes.ts`).
 *
 * Server-side only: the modules below reach into the gateway (and through it
 * into the database and the browser pool). Client components import their
 * types and constants from `landingTypes.ts` instead.
 */
import { AI_PROVIDERS } from "@/shared/constants/providers";
import { ROUTING_STRATEGY_VALUES } from "@/shared/constants/routingStrategies";
import { listCliTools } from "@/shared/constants/cliTools";
import { APP_CONFIG } from "@/shared/constants/appConfig";
import { DEFAULT_WEIGHTS } from "@pusula/open-sse/services/autoCombo/scoring";
import { ENGINE_CATALOG, ENGINE_IDS } from "@pusula/open-sse/services/compression/engineCatalog";
import {
  MCP_SCOPE_COUNT,
  MCP_TOOL_COUNT,
  MCP_TRANSPORT_COUNT,
  type CatalogEntry,
  type CatalogKind,
  type CompressionEngine,
  type LandingStats,
  type ScoringFactor,
} from "./landingTypes";

export { BREAKER_PROFILES, MCP_TOOL_COUNT } from "./landingTypes";
export type {
  CatalogEntry,
  CatalogKind,
  CompressionEngine,
  LandingStats,
  ScoringFactor,
} from "./landingTypes";

const KNOWN_KINDS: readonly CatalogKind[] = [
  "llm",
  "webSearch",
  "imageToText",
  "webFetch",
  "embedding",
  "video",
];

type ProviderLike = {
  name?: unknown;
  hasFree?: unknown;
  noAuth?: unknown;
  isLocalCli?: unknown;
  serviceKinds?: unknown;
};

function primaryKind(provider: ProviderLike): CatalogKind {
  const kinds = Array.isArray(provider.serviceKinds) ? provider.serviceKinds : [];
  // A provider that speaks chat is listed as chat even when it also searches.
  if (kinds.includes("llm")) return "llm";
  for (const kind of KNOWN_KINDS) {
    if (kinds.includes(kind)) return kind;
  }
  return "other";
}

/**
 * Build the catalog from a providers map. Exported with the map as an argument
 * so unit tests can feed a small fixture instead of the real 350+ registry.
 */
export function buildCatalog(providers: Record<string, ProviderLike>): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const [id, provider] of Object.entries(providers)) {
    if (!provider || typeof provider !== "object") continue;
    const name = typeof provider.name === "string" && provider.name.trim() ? provider.name : id;
    entries.push({
      id,
      name,
      kind: primaryKind(provider),
      free: provider.hasFree === true || provider.noAuth === true,
      local: provider.isLocalCli === true,
    });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

export function countKinds(catalog: readonly CatalogEntry[]): Record<CatalogKind, number> {
  const counts: Record<CatalogKind, number> = {
    llm: 0,
    webSearch: 0,
    imageToText: 0,
    webFetch: 0,
    embedding: 0,
    video: 0,
    other: 0,
  };
  for (const entry of catalog) counts[entry.kind] += 1;
  return counts;
}

export function buildScoringFactors(weights: Record<string, number>): ScoringFactor[] {
  return Object.entries(weights)
    .filter(([, weight]) => Number.isFinite(weight))
    .map(([id, weight]) => ({ id, weight }))
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
}

/**
 * The compression engines in stack order, with the catalog's own label and
 * lossy flag. The page names engines and marks them lossless or lossy; it
 * never shows a per-engine saving, because the catalog does not measure one.
 */
export function buildCompressionEngineList(): CompressionEngine[] {
  return ENGINE_IDS.map((id) => ({
    id,
    label: ENGINE_CATALOG[id].label,
    lossy: ENGINE_CATALOG[id].guidance.lossy,
  }));
}

export function getLandingStats(): LandingStats {
  const catalog = buildCatalog(AI_PROVIDERS as Record<string, ProviderLike>);
  return {
    version: APP_CONFIG.version,
    providers: catalog.length,
    freeProviders: catalog.filter((entry) => entry.free).length,
    localProviders: catalog.filter((entry) => entry.local).length,
    strategies: ROUTING_STRATEGY_VALUES,
    scoringFactors: buildScoringFactors(DEFAULT_WEIGHTS as unknown as Record<string, number>),
    compressionEngines: ENGINE_IDS.length,
    compressionEngineList: buildCompressionEngineList(),
    cliTools: listCliTools().map((tool) => ({ id: tool.id, name: tool.name })),
    mcpTools: MCP_TOOL_COUNT,
    mcpScopes: MCP_SCOPE_COUNT,
    mcpTransports: MCP_TRANSPORT_COUNT,
    catalog,
    kindCounts: countKinds(catalog),
  };
}
