import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildCatalog,
  buildCompressionEngineList,
  buildScoringFactors,
  countKinds,
  getLandingStats,
  BREAKER_PROFILES,
  MCP_TOOL_COUNT,
} from "../../src/app/landing/landingStats.ts";
import {
  A2A_ENDPOINTS,
  A2A_METHODS,
  A2A_SKILLS,
  DEFAULT_PORT,
  HEADER,
  INSTALL_COMMAND,
  MCP_ENDPOINTS,
  MCP_TRANSPORT_COUNT,
  MCP_TRANSPORTS,
  SAMPLE_CANDIDATES,
} from "../../src/app/landing/landingTypes.ts";
import { AI_PROVIDERS, getProviderAlias } from "../../src/shared/constants/providers.ts";
import { PUSULA_RESPONSE_HEADERS } from "../../src/shared/constants/headers.ts";
import { ENGINE_CATALOG, ENGINE_IDS } from "../../open-sse/services/compression/engineCatalog.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");

test("landing catalog: classifies providers by primary service kind and free/local flags", () => {
  const catalog = buildCatalog({
    zeta: { name: "Zeta Chat", serviceKinds: ["llm", "webSearch"], hasFree: true },
    alpha: { name: "Alpha Search", serviceKinds: ["webSearch"] },
    local: { name: "Local Box", serviceKinds: ["llm"], isLocalCli: true, noAuth: true },
    blank: { serviceKinds: [] },
    // A corrupt registry entry: skipped, not thrown on.
    broken: null as never,
  });

  // Sorted by display name, case-insensitive; a missing name falls back to the id.
  assert.deepEqual(
    catalog.map((entry) => entry.id),
    ["alpha", "blank", "local", "zeta"]
  );
  assert.equal(catalog.find((entry) => entry.id === "zeta")?.kind, "llm");
  assert.equal(catalog.find((entry) => entry.id === "alpha")?.kind, "webSearch");
  assert.equal(catalog.find((entry) => entry.id === "blank")?.kind, "other");
  assert.equal(catalog.find((entry) => entry.id === "blank")?.name, "blank");
  assert.equal(catalog.find((entry) => entry.id === "zeta")?.free, true);
  assert.equal(catalog.find((entry) => entry.id === "local")?.free, true);
  assert.equal(catalog.find((entry) => entry.id === "local")?.local, true);
  assert.equal(catalog.find((entry) => entry.id === "alpha")?.free, false);

  const counts = countKinds(catalog);
  assert.equal(counts.llm, 2);
  assert.equal(counts.webSearch, 1);
  assert.equal(counts.other, 1);
  assert.equal(counts.video, 0);
});

test("landing scoring factors: sorted by weight, zero-weight factors kept (they still gate)", () => {
  const factors = buildScoringFactors({ b: 0.2, a: 0.2, silent: 0, top: 0.5, bad: Number.NaN });
  assert.deepEqual(
    factors.map((factor) => factor.id),
    ["top", "a", "b", "silent"]
  );
});

test("landing stats: every figure is read from the real registries", () => {
  const stats = getLandingStats();
  assert.equal(stats.providers, stats.catalog.length);
  assert.ok(stats.providers > 300, `expected the full registry, got ${stats.providers}`);
  assert.ok(stats.freeProviders > 0 && stats.freeProviders < stats.providers);
  assert.ok(stats.strategies.includes("auto"));
  assert.ok(stats.scoringFactors.length >= 16);
  assert.ok(Math.abs(stats.scoringFactors.reduce((sum, f) => sum + f.weight, 0) - 1) < 1e-6);
  assert.ok(stats.compressionEngines > 0);
  assert.ok(stats.cliTools.some((tool) => tool.id === "claude"));
  assert.equal(stats.mcpTools, MCP_TOOL_COUNT);
  assert.match(stats.version, /^\d+\.\d+\.\d+/);
  assert.equal(
    Object.values(stats.kindCounts).reduce((sum, n) => sum + n, 0),
    stats.providers
  );
});

test("landing stats: documented constants match their sources", () => {
  // MCP tool count — documented in the MCP server README.
  const mcpReadme = fs.readFileSync(path.join(ROOT, "open-sse/mcp-server/README.md"), "utf8");
  assert.ok(
    mcpReadme.includes(`**${MCP_TOOL_COUNT} tools**`),
    `open-sse/mcp-server/README.md no longer says ${MCP_TOOL_COUNT} tools — update MCP_TOOL_COUNT`
  );

  // Circuit-breaker defaults — PROVIDER_PROFILES in open-sse/config/constants.ts.
  const constants = fs.readFileSync(path.join(ROOT, "open-sse/config/constants.ts"), "utf8");
  const expectEnv = (name: string, value: number) => {
    const re = new RegExp(`envInt\\("${name}",\\s*(\\d+)\\)`);
    const match = constants.match(re);
    assert.ok(match, `${name} not found in constants.ts`);
    assert.equal(Number(match[1]), value, `${name} drifted from BREAKER_PROFILES`);
  };
  for (const profile of BREAKER_PROFILES) {
    const prefix =
      profile.id === "oauth"
        ? "PUSULA_CIRCUIT_BREAKER_OAUTH"
        : profile.id === "apikey"
          ? "PUSULA_CIRCUIT_BREAKER_API_KEY"
          : "PUSULA_CIRCUIT_BREAKER_LOCAL";
    expectEnv(`${prefix}_THRESHOLD`, profile.opensAfter);
    expectEnv(`${prefix}_RESET_MS`, profile.resetSeconds * 1000);
  }
});

test("landing i18n: every locale carries the full landing key set", () => {
  const dir = path.join(ROOT, "src/i18n/messages");
  const en = JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8")).landing;
  for (const locale of ["tr", "de", "fa"]) {
    const messages = JSON.parse(fs.readFileSync(path.join(dir, `${locale}.json`), "utf8")).landing;
    const missing = Object.keys(en).filter((key) => !(key in messages));
    assert.deepEqual(missing, [], `${locale}.json is missing landing keys`);
  }
  // Strategy and factor descriptions exist for everything the page will render.
  const stats = getLandingStats();
  for (const id of stats.strategies) {
    assert.ok(en[`strategy_${id.replace(/-/g, "_")}`], `no landing.strategy_* text for ${id}`);
  }
  for (const factor of stats.scoringFactors) {
    assert.ok(en[`factor_${factor.id}`], `no landing.factor_* text for ${factor.id}`);
  }
});

/**
 * The body of one `PROVIDER_PROFILES` entry, read as text: importing
 * `open-sse/config/constants.ts` would apply `PUSULA_*` env overrides, and the
 * page quotes the shipped defaults.
 */
function providerProfileBlock(constants: string, id: string): string {
  const start = constants.indexOf("export const PROVIDER_PROFILES");
  assert.ok(start >= 0, "PROVIDER_PROFILES not found in constants.ts");
  const match = constants.slice(start).match(new RegExp(`^  ${id}: \\{([\\s\\S]*?)^  \\},`, "m"));
  assert.ok(match, `PROVIDER_PROFILES.${id} not found in constants.ts`);
  return match[1];
}

test("landing stats: breaker degradation and key cooldown match PROVIDER_PROFILES", () => {
  const constants = fs.readFileSync(path.join(ROOT, "open-sse/config/constants.ts"), "utf8");
  const envPrefix = { oauth: "OAUTH", apikey: "API_KEY", local: "LOCAL" } as const;

  for (const profile of BREAKER_PROFILES) {
    const block = providerProfileBlock(constants, profile.id);

    // The base of one key's exponential cooldown: `transientCooldown` feeds
    // `connectionCooldown.*.baseCooldownMs` in src/lib/resilience/settings.ts.
    const cooldown = block.match(/transientCooldown:\s*(\d+)/);
    assert.ok(cooldown, `PROVIDER_PROFILES.${profile.id}.transientCooldown not found`);
    assert.equal(
      Number(cooldown[1]),
      profile.cooldownBaseMs,
      `${profile.id} cooldownBaseMs drifted from transientCooldown`
    );

    const degradation = block.match(
      /degradationThreshold:\s*envInt\(\s*"(PUSULA_PROVIDER_BREAKER_[A-Z_]+_DEGRADATION_THRESHOLD)",\s*(\d+)\s*\)/
    );
    if (profile.degradesAfter === null) {
      // No configured band: the breaker derives one that coincides with opening.
      assert.equal(degradation, null, `${profile.id} now sets degradationThreshold`);
      assert.equal(
        Math.ceil((profile.opensAfter * 60) / 100),
        profile.opensAfter,
        `${profile.id}: the derived degradation threshold no longer equals opensAfter`
      );
    } else {
      assert.ok(degradation, `PROVIDER_PROFILES.${profile.id}.degradationThreshold not found`);
      assert.equal(
        degradation[1],
        `PUSULA_PROVIDER_BREAKER_${envPrefix[profile.id]}_DEGRADATION_THRESHOLD`
      );
      assert.equal(
        Number(degradation[2]),
        profile.degradesAfter,
        `${profile.id} degradesAfter drifted from degradationThreshold`
      );
      assert.ok(profile.degradesAfter < profile.opensAfter, "DEGRADED must come before OPEN");
    }
  }

  // The derivation the local profile relies on (60% of the opening threshold).
  const breaker = fs.readFileSync(path.join(ROOT, "src/shared/utils/circuitBreaker.ts"), "utf8");
  assert.match(
    breaker,
    /options\.degradationThreshold \?\? Math\.ceil\(\(this\.failureThreshold \* 60\) \/ 100\)/,
    "circuitBreaker.ts changed how it derives degradationThreshold"
  );
});

test("landing constants: A2A skills, methods and endpoints match the server", async () => {
  const { A2A_SKILL_HANDLERS } = await import("../../src/lib/a2a/taskExecution.ts");
  assert.deepEqual([...A2A_SKILLS], Object.keys(A2A_SKILL_HANDLERS));

  const route = fs.readFileSync(path.join(ROOT, "src/app/a2a/route.ts"), "utf8");
  const dispatched = [...route.matchAll(/^\s*case "([a-z]+\/[a-z]+)":/gm)].map((m) => m[1]);
  assert.deepEqual([...dispatched].sort(), [...A2A_METHODS].sort());

  assert.ok(fs.existsSync(path.join(ROOT, "src/app", A2A_ENDPOINTS.rpc, "route.ts")));
  assert.ok(fs.existsSync(path.join(ROOT, "src/app", A2A_ENDPOINTS.card, "route.ts")));
});

test("landing constants: MCP endpoints and transports exist", () => {
  for (const endpoint of Object.values(MCP_ENDPOINTS)) {
    assert.ok(
      fs.existsSync(path.join(ROOT, "src/app", endpoint, "route.ts")),
      `no route handler for ${endpoint}`
    );
  }
  assert.equal(MCP_TRANSPORTS.length, MCP_TRANSPORT_COUNT);
});

test("landing constants: quoted response headers are real Pusula headers", () => {
  const real = new Set<string>(Object.values(PUSULA_RESPONSE_HEADERS));
  for (const [key, value] of Object.entries(HEADER)) {
    assert.ok(real.has(value), `${value} is not in PUSULA_RESPONSE_HEADERS`);
    assert.equal(PUSULA_RESPONSE_HEADERS[key as keyof typeof PUSULA_RESPONSE_HEADERS], value);
  }
});

test("landing constants: sample candidates are real catalog providers", () => {
  const providers = AI_PROVIDERS as Record<string, unknown>;
  const catalogIds = new Set(getLandingStats().catalog.map((entry) => entry.id));
  const profiles = new Set<string>(BREAKER_PROFILES.map((profile) => profile.id));
  const ids = new Set<string>();
  for (const candidate of SAMPLE_CANDIDATES) {
    assert.ok(candidate.catalogId in providers, `${candidate.catalogId} is not in AI_PROVIDERS`);
    assert.ok(catalogIds.has(candidate.catalogId), `${candidate.catalogId} is not in the catalog`);
    assert.ok(profiles.has(candidate.profile), `unknown breaker profile ${candidate.profile}`);
    assert.equal(
      candidate.alias,
      getProviderAlias(candidate.catalogId),
      `${candidate.catalogId}: X-Pusula-Provider carries the provider's alias`
    );
    assert.ok(!ids.has(candidate.id), `duplicate candidate ${candidate.id}`);
    ids.add(candidate.id);
  }
  assert.equal(ids.size, 6);
});

test("landing stats: compression engines in stack order with their lossy flag", () => {
  const list = buildCompressionEngineList();
  assert.deepEqual(
    list.map((engine) => engine.id),
    ENGINE_IDS
  );
  for (const engine of list) assert.equal(engine.label, ENGINE_CATALOG[engine.id].label);
  assert.deepEqual(
    list
      .filter((engine) => !engine.lossy)
      .map((engine) => engine.id)
      .sort(),
    ["ccr", "headroom", "lite", "session-dedup"]
  );
  const stats = getLandingStats();
  assert.deepEqual(stats.compressionEngineList, list);
  assert.equal(stats.compressionEngines, list.length);
});

test("landing constants: port and install command match the package", () => {
  const env = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
  assert.equal(Number(env.match(/^PORT=(\d+)$/m)?.[1]), DEFAULT_PORT);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(INSTALL_COMMAND, `npx ${pkg.name}`);
  assert.ok(pkg.bin && pkg.name in pkg.bin, "the package no longer ships a bin named after itself");
});

/** ICU argument names in a message: `{name}` and `{name, select, …}`, not select branches. */
function icuArguments(message: string): string[] {
  return [...message.matchAll(/\{\s*([A-Za-z_]\w*)\s*[,}]/g)].map((m) => m[1]).sort();
}

test("landing i18n: every locale uses the same ICU arguments as English", () => {
  const dir = path.join(ROOT, "src/i18n/messages");
  const en = JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8")).landing;
  for (const locale of ["tr", "de", "fa"]) {
    const messages = JSON.parse(fs.readFileSync(path.join(dir, `${locale}.json`), "utf8")).landing;
    for (const [key, value] of Object.entries(en)) {
      if (typeof value !== "string" || typeof messages[key] !== "string") continue;
      assert.deepEqual(
        icuArguments(messages[key]),
        icuArguments(value),
        `${locale}.json landing.${key} has different placeholders`
      );
    }
    // The fail/restore label is one ICU select on the boolean `down`.
    assert.match(messages.heroToggleAria, /^\{down, select, true \{.*\} other \{.*\}\}$/);
  }
  // Callers pass these arguments; keep the contract visible here.
  assert.deepEqual(icuArguments(en.heroLead), ["free", "providers"]);
  assert.deepEqual(icuArguments(en.catalogLead), ["free", "kinds", "local"]);
  assert.deepEqual(icuArguments(en.heroToggleAria), ["down", "provider", "provider"]);
});
