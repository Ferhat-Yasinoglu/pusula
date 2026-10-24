import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildCatalog,
  buildScoringFactors,
  countKinds,
  getLandingStats,
  BREAKER_PROFILES,
  MCP_TOOL_COUNT,
} from "../../src/app/landing/landingStats.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");

test("landing catalog: classifies providers by primary service kind and free/local flags", () => {
  const catalog = buildCatalog({
    zeta: { name: "Zeta Chat", serviceKinds: ["llm", "webSearch"], hasFree: true },
    alpha: { name: "Alpha Search", serviceKinds: ["webSearch"] },
    local: { name: "Local Box", serviceKinds: ["llm"], isLocalCli: true, noAuth: true },
    blank: { serviceKinds: [] },
    broken: null,
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
