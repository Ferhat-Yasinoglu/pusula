/**
 * MCP Authorization Scopes — Defines permission scopes for each MCP tool.
 *
 * Each tool requires specific scopes to execute. API keys can be configured
 * with a subset of scopes to limit tool access (least-privilege).
 */

// ============ Scope Definitions ============

/** All available MCP scopes */
export const MCP_SCOPE_LIST = [
  "read:health",
  "read:combos",
  "write:combos",
  "read:quota",
  "read:usage",
  "read:models",
  "read:radar",
  "execute:completions",
  "execute:search",
  "write:budget",
  "write:resilience",
  "pricing:write",
  "read:cache",
  "write:cache",
  "read:compression",
  "write:compression",
  "read:proxies",
] as const;

export type McpScope = (typeof MCP_SCOPE_LIST)[number];

// ============ Tool → Scope Mapping ============

/** Maps each MCP tool to its required scopes */
export const MCP_TOOL_SCOPES: Record<string, readonly McpScope[]> = {
  // Phase 1: Essential Tools
  pusula_get_health: ["read:health"],
  pusula_list_combos: ["read:combos"],
  pusula_get_combo_metrics: ["read:combos"],
  pusula_switch_combo: ["write:combos"],
  pusula_check_quota: ["read:quota"],
  pusula_route_request: ["execute:completions"],
  pusula_web_search: ["execute:search"],
  pusula_x_search: ["execute:search"],
  pusula_web_fetch: ["execute:search"],
  pusula_cost_report: ["read:usage"],
  pusula_list_models_catalog: ["read:models"],
  pusula_radar_catalog: ["read:radar"],

  // Phase 2: Advanced Tools
  pusula_simulate_route: ["read:health", "read:combos"],
  pusula_set_budget_guard: ["write:budget"],
  pusula_set_resilience_profile: ["write:resilience"],
  pusula_test_combo: ["execute:completions", "read:combos"],
  pusula_get_provider_metrics: ["read:health"],
  pusula_best_combo_for_task: ["read:combos", "read:health"],
  pusula_explain_route: ["read:health", "read:usage"],
  pusula_get_session_snapshot: ["read:usage"],
  pusula_db_health_check: ["read:health", "write:resilience"],
  pusula_sync_pricing: ["pricing:write"],
  pusula_cache_stats: ["read:cache"],
  pusula_cache_flush: ["write:cache"],
  pusula_compression_status: ["read:compression"],
  pusula_compression_configure: ["write:compression"],
  pusula_set_compression_engine: ["write:compression"],
  pusula_list_compression_combos: ["read:compression"],
  pusula_compression_combo_stats: ["read:compression"],
  pusula_ccr_store: ["write:compression"],
  pusula_ccr_retrieve: ["read:compression"],
  pusula_ccr_inspect: ["read:compression"],
  pusula_ccr_list: ["read:compression"],
  pusula_ccr_delete: ["write:compression"],
  pusula_ccr_stats: ["read:compression"],
  pusula_oneproxy_fetch: ["read:proxies"],
  pusula_oneproxy_rotate: ["read:proxies"],
  pusula_oneproxy_stats: ["read:proxies"],

  // Web-session pool observability (read) + lifecycle (write)
  pusula_pool_status: ["read:health"],
  pusula_pool_sessions: ["read:health"],
  pusula_pool_health: ["read:health"],
  pusula_pool_reset: ["write:resilience"],
  pusula_pool_warm: ["write:resilience"],
  // Stealth browser pool observability (#3368 PR7)
  pusula_browser_pool_status: ["read:health"],
} as const;
