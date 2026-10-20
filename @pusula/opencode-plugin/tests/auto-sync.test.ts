/**
 * Auto-discovery + force-sync (OpenCode parity with Pi `/omni sync`).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeAutoSyncIntervalMs,
  DEFAULT_AUTO_SYNC_INTERVAL_MS,
  MIN_AUTO_SYNC_INTERVAL_MS,
  parsePusulaPluginOptions,
  resolvePusulaPluginOptions,
  invalidatePusulaFetchCache,
  forceSyncPusulaModels,
  type PusulaFetchCache,
} from "../src/index.js";
import { getLogLevel, setLogLevel } from "../src/logger.js";

async function captureConsole(run: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  console.warn = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  try {
    await run();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
  return lines;
}

test("sanitizeAutoSyncIntervalMs: unset → default 300000", () => {
  assert.equal(sanitizeAutoSyncIntervalMs(undefined), DEFAULT_AUTO_SYNC_INTERVAL_MS);
  assert.equal(sanitizeAutoSyncIntervalMs(null), DEFAULT_AUTO_SYNC_INTERVAL_MS);
});

test("sanitizeAutoSyncIntervalMs: 0 disables", () => {
  assert.equal(sanitizeAutoSyncIntervalMs(0), 0);
});

test("sanitizeAutoSyncIntervalMs: clamps below min to 60000", () => {
  assert.equal(sanitizeAutoSyncIntervalMs(1), MIN_AUTO_SYNC_INTERVAL_MS);
  assert.equal(sanitizeAutoSyncIntervalMs(59_999), MIN_AUTO_SYNC_INTERVAL_MS);
});

test("sanitizeAutoSyncIntervalMs: keeps valid values", () => {
  assert.equal(sanitizeAutoSyncIntervalMs(60_000), 60_000);
  assert.equal(sanitizeAutoSyncIntervalMs(300_000), 300_000);
});

test("parsePusulaPluginOptions accepts autoSyncIntervalMs including 0", () => {
  assert.equal(parsePusulaPluginOptions({ autoSyncIntervalMs: 0 }).autoSyncIntervalMs, 0);
  assert.equal(
    parsePusulaPluginOptions({ autoSyncIntervalMs: 120_000 }).autoSyncIntervalMs,
    120_000
  );
});

test("resolvePusulaPluginOptions defaults autoSyncIntervalMs to 300000", () => {
  const r = resolvePusulaPluginOptions({});
  assert.equal(r.autoSyncIntervalMs, DEFAULT_AUTO_SYNC_INTERVAL_MS);
});

test("resolvePusulaPluginOptions clamps low positive autoSyncIntervalMs", () => {
  const r = resolvePusulaPluginOptions({ autoSyncIntervalMs: 5000 });
  assert.equal(r.autoSyncIntervalMs, MIN_AUTO_SYNC_INTERVAL_MS);
});

test("invalidatePusulaFetchCache clears by baseURL prefix", () => {
  const cache: PusulaFetchCache = new Map();
  cache.set("https://a.example/v1::abc", {
    rawModels: [],
    rawCombos: [],
    rawAutoCombos: [],
    rawEnrichment: new Map(),
    rawCompressionCombos: [],
    rawConnections: [],
    expiresAt: Date.now() + 1000,
  });
  cache.set("https://b.example/v1::def", {
    rawModels: [],
    rawCombos: [],
    rawAutoCombos: [],
    rawEnrichment: new Map(),
    rawCompressionCombos: [],
    rawConnections: [],
    expiresAt: Date.now() + 1000,
  });
  const removed = invalidatePusulaFetchCache(cache, "https://a.example/v1");
  assert.equal(removed, 1);
  assert.equal(cache.size, 1);
  assert.equal(cache.has("https://b.example/v1::def"), true);
});

test("forceSyncPusulaModels: fetches, populates cache, returns count", async () => {
  const cache: PusulaFetchCache = new Map();
  const resolved = resolvePusulaPluginOptions({
    providerId: "pusula",
    baseURL: "https://pusula.example/v1",
    autoSyncIntervalMs: 0,
    features: {
      combos: false,
      autoCombos: false,
      enrichment: false,
      compressionMetadata: false,
      usableOnly: false,
      diskCache: false,
    },
  });

  const result = await forceSyncPusulaModels({
    resolved,
    cache,
    readAuthJson: async () => ({
      pusula: { type: "api", key: "test-key" },
    }),
    fetcher: async () => [
      { id: "model-a", object: "model" },
      { id: "model-b", object: "model" },
    ],
    now: () => 1_000_000,
  });

  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
  assert.equal(result.provider, "pusula");
  assert.equal(cache.size, 1);
  const entry = [...cache.values()][0];
  assert.equal(entry.rawModels.length, 2);
  assert.equal(entry.expiresAt, 1_000_000 + resolved.modelCacheTtl);
});

test("forceSyncPusulaModels suppresses successful lifecycle output at error level", async () => {
  const previousLevel = getLogLevel();
  const cache: PusulaFetchCache = new Map();
  const resolved = resolvePusulaPluginOptions({
    providerId: "pusula",
    baseURL: "https://pusula.example/v1",
    features: {
      autoCombos: false,
      combos: false,
      compressionMetadata: false,
      diskCache: false,
      enrichment: false,
      logLevel: "error",
      usableOnly: false,
    },
  });

  try {
    setLogLevel("error");
    const lines = await captureConsole(async () => {
      const result = await forceSyncPusulaModels({
        resolved,
        cache,
        readAuthJson: async () => ({ pusula: { type: "api", key: "test-key" } }),
        fetcher: async () => [{ id: "model-a", object: "model" }],
      });
      assert.equal(result.ok, true);
    });

    assert.deepEqual(lines, []);
  } finally {
    setLogLevel(previousLevel);
  }
});

test("forceSyncPusulaModels preserves successful lifecycle output at info level", async () => {
  const previousLevel = getLogLevel();
  const cache: PusulaFetchCache = new Map();
  const resolved = resolvePusulaPluginOptions({
    providerId: "pusula",
    baseURL: "https://pusula.example/v1",
    features: {
      autoCombos: false,
      combos: false,
      compressionMetadata: false,
      diskCache: false,
      enrichment: false,
      logLevel: "info",
      usableOnly: false,
    },
  });

  try {
    setLogLevel("info");
    const lines = await captureConsole(async () => {
      const result = await forceSyncPusulaModels({
        resolved,
        cache,
        readAuthJson: async () => ({ pusula: { type: "api", key: "test-key" } }),
        fetcher: async () => [{ id: "model-a", object: "model" }],
      });
      assert.equal(result.ok, true);
    });

    assert.equal(lines.filter((line) => line.includes("force sync ok")).length, 1);
  } finally {
    setLogLevel(previousLevel);
  }
});

test("forceSyncPusulaModels: missing auth returns error", async () => {
  const cache: PusulaFetchCache = new Map();
  const resolved = resolvePusulaPluginOptions({
    providerId: "pusula",
    baseURL: "https://pusula.example/v1",
    autoSyncIntervalMs: 0,
    features: { diskCache: false },
  });
  const result = await forceSyncPusulaModels({
    resolved,
    cache,
    readAuthJson: async () => ({}),
  });
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /credentials|baseURL|connect/i);
});
