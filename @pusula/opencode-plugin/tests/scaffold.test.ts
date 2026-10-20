import test from "node:test";
import assert from "node:assert/strict";
import {
  PusulaPlugin,
  PUSULA_PROVIDER_KEY,
  DEFAULT_MODEL_CACHE_TTL_MS,
  resolvePusulaPluginOptions,
} from "../src/index.js";

test("scaffold: exports public surface", () => {
  assert.equal(
    typeof PusulaPlugin,
    "function",
    "PusulaPlugin must be a function (Plugin factory)"
  );
  assert.equal(PUSULA_PROVIDER_KEY, "pusula");
  assert.equal(DEFAULT_MODEL_CACHE_TTL_MS, 300_000);
});

test("scaffold: default export is v1 plugin shape { id, server: PusulaPlugin }", async () => {
  const mod = await import("../src/index.js");
  assert.equal(typeof mod.default, "object");
  assert.equal(mod.default.id, "@pusula/opencode-plugin");
  assert.equal(mod.default.server, mod.PusulaPlugin);
});

test("resolvePusulaPluginOptions: defaults", () => {
  const r = resolvePusulaPluginOptions();
  assert.equal(r.providerId, "opencode-pusula");
  assert.equal(r.displayName, "Pusula");
  assert.equal(r.modelCacheTtl, 300_000);
  assert.equal(r.baseURL, undefined);
});

test("resolvePusulaPluginOptions: custom providerId derives displayName", () => {
  const r = resolvePusulaPluginOptions({ providerId: "pusula-preprod" });
  assert.equal(r.providerId, "opencode-pusula-preprod");
  assert.equal(r.displayName, "Pusula (opencode-pusula-preprod)");
});

test("resolvePusulaPluginOptions: explicit displayName wins", () => {
  const r = resolvePusulaPluginOptions({
    providerId: "pusula-x",
    displayName: "Custom Label",
  });
  assert.equal(r.displayName, "Custom Label");
});

test("resolvePusulaPluginOptions: invalid TTL falls back to default", () => {
  assert.equal(resolvePusulaPluginOptions({ modelCacheTtl: 0 }).modelCacheTtl, 300_000);
  assert.equal(resolvePusulaPluginOptions({ modelCacheTtl: -1 }).modelCacheTtl, 300_000);
});

test("resolvePusulaPluginOptions: positive TTL respected", () => {
  assert.equal(resolvePusulaPluginOptions({ modelCacheTtl: 60_000 }).modelCacheTtl, 60_000);
});

test("PusulaPlugin: returns an empty hooks object (scaffold)", async () => {
  const fakeCtx = {} as Parameters<typeof PusulaPlugin>[0];
  const hooks = await PusulaPlugin(fakeCtx);
  assert.equal(typeof hooks, "object");
  assert.notEqual(hooks, null);
});

test("scaffold: built ESM default export resolves with the v1 plugin shape", async () => {
  // The plugin is ESM-only now — the CJS bundle was dropped to fix the OpenCode
  // loader (#3883), so there is no more ../dist/index.cjs. Validate that the built
  // distributable's default export still carries the OpenCode v1 { id, server } shape.
  const mod = await import("../dist/index.js");
  assert.strictEqual(typeof mod.default, "object");
  assert.strictEqual(mod.default.id, "@pusula/opencode-plugin");
  assert.strictEqual(typeof mod.default.server, "function");
});
