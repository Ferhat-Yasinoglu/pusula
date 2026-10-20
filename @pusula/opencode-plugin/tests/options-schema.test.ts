/**
 * T-08 options-schema tests.
 *
 * Covers `parsePusulaPluginOptions(opts)` — the strict Zod gate that
 * validates the second-arg `PluginOptions` bag from opencode.json before
 * any hook is wired. Anti-pattern checklist mirrored here:
 *
 *  - `null` / `undefined` must collapse to `{}` (defaults apply downstream).
 *  - Unknown keys must THROW (`.strict()` catches opencode.json typos).
 *  - Validation runs at parse time, not import time (module loads cleanly).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { parsePusulaPluginOptions } from "../src/index.js";

test("parsePusulaPluginOptions: undefined → {}", () => {
  assert.deepEqual(parsePusulaPluginOptions(undefined), {});
});

test("parsePusulaPluginOptions: null → {}", () => {
  assert.deepEqual(parsePusulaPluginOptions(null), {});
});

test("parsePusulaPluginOptions: empty object → {}", () => {
  assert.deepEqual(parsePusulaPluginOptions({}), {});
});

test("parsePusulaPluginOptions: valid providerId → returns it", () => {
  const r = parsePusulaPluginOptions({ providerId: "pusula-preprod" });
  assert.equal(r.providerId, "pusula-preprod");
});

test("parsePusulaPluginOptions: invalid providerId (special chars) → throws", () => {
  assert.throws(
    () => parsePusulaPluginOptions({ providerId: "pusula prod!" }),
    /providerId.*slug/i
  );
});

test("parsePusulaPluginOptions: empty providerId → throws", () => {
  assert.throws(() => parsePusulaPluginOptions({ providerId: "" }), /providerId/i);
});

test("parsePusulaPluginOptions: valid modelCacheTtl → returns it", () => {
  const r = parsePusulaPluginOptions({ modelCacheTtl: 60_000 });
  assert.equal(r.modelCacheTtl, 60_000);
});

test("parsePusulaPluginOptions: negative modelCacheTtl → throws", () => {
  assert.throws(() => parsePusulaPluginOptions({ modelCacheTtl: -1 }), /modelCacheTtl/i);
});

test("parsePusulaPluginOptions: zero modelCacheTtl → throws (positive required)", () => {
  assert.throws(() => parsePusulaPluginOptions({ modelCacheTtl: 0 }), /modelCacheTtl/i);
});

test("parsePusulaPluginOptions: invalid baseURL (not a URL) → throws", () => {
  assert.throws(() => parsePusulaPluginOptions({ baseURL: "not-a-url" }), /baseURL/i);
});

test("parsePusulaPluginOptions: baseURL without an http(s) scheme → throws", () => {
  // `new URL()` reads "localhost:20128" as the scheme "localhost:" followed by
  // a path, so the address parses and the models are published with an api url
  // no client can call.
  for (const baseURL of ["localhost:20128", "localhost:20128/v1", "ftp://or.example.com", "or.example.com"]) {
    assert.throws(
      () => parsePusulaPluginOptions({ baseURL }),
      /baseURL must be an http\(s\) URL/,
      `expected ${baseURL} to be rejected`
    );
  }
});

test("parsePusulaPluginOptions: http and https baseURLs are accepted, padding trimmed", () => {
  for (const baseURL of ["http://localhost:20128", "https://or.example.com/v1"]) {
    assert.equal(parsePusulaPluginOptions({ baseURL }).baseURL, baseURL);
    assert.equal(parsePusulaPluginOptions({ baseURL: `  ${baseURL}  ` }).baseURL, baseURL);
  }
});

test("parsePusulaPluginOptions: unknown key → throws (strict mode catches typos)", () => {
  assert.throws(
    () =>
      parsePusulaPluginOptions({
        providerId: "pusula",
        provider_id: "typo-here",
      }),
    /provider_id|unrecognized/i
  );
});

test("parsePusulaPluginOptions: all four fields populated correctly → returns them", () => {
  const opts = {
    providerId: "pusula-prod",
    displayName: "Pusula Production",
    modelCacheTtl: 120_000,
    baseURL: "https://or.example.com/v1",
  };
  const r = parsePusulaPluginOptions(opts);
  assert.deepEqual(r, opts);
});

test("parsePusulaPluginOptions: error message lists every issue path", () => {
  // Two bad fields at once → error string should mention BOTH.
  try {
    parsePusulaPluginOptions({
      providerId: "",
      baseURL: "garbage",
    });
    assert.fail("expected throw");
  } catch (err) {
    const msg = (err as Error).message;
    assert.match(msg, /providerId/);
    assert.match(msg, /baseURL/);
  }
});

test("parsePusulaPluginOptions: module import alone does NOT throw", async () => {
  // Re-importing the entry must not trigger validation; validation only fires
  // on explicit parsePusulaPluginOptions / PusulaPlugin invocation.
  const mod = await import("../src/index.js");
  assert.equal(typeof mod.parsePusulaPluginOptions, "function");
});
