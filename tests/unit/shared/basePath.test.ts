import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDeployBasePath,
  normalizeBasePath,
  withBasePath,
} from "../../../src/shared/utils/basePath";

describe("normalizeBasePath", () => {
  it("normalizes leading/trailing slashes", () => {
    assert.equal(normalizeBasePath("pusula"), "/pusula");
    assert.equal(normalizeBasePath("/pusula/"), "/pusula");
    assert.equal(normalizeBasePath("/pusula"), "/pusula");
    assert.equal(normalizeBasePath(""), "");
    assert.equal(normalizeBasePath("/"), "");
    assert.equal(normalizeBasePath(null), "");
  });
});

describe("getDeployBasePath", () => {
  it("reads NEXT_PUBLIC_PUSULA_BASE_PATH first", () => {
    assert.equal(
      getDeployBasePath({
        NEXT_PUBLIC_PUSULA_BASE_PATH: "/pusula",
        PUSULA_BASE_PATH: "/other",
      } as NodeJS.ProcessEnv),
      "/pusula"
    );
  });

  it("falls back to PUSULA_BASE_PATH", () => {
    assert.equal(
      getDeployBasePath({
        PUSULA_BASE_PATH: "/pusula",
      } as NodeJS.ProcessEnv),
      "/pusula"
    );
  });
});

describe("withBasePath", () => {
  const base = "/pusula";

  it("is a no-op when basePath is empty", () => {
    assert.equal(withBasePath("/api/health/ping", ""), "/api/health/ping");
  });

  it("prefixes absolute app paths", () => {
    assert.equal(withBasePath("/api/health/ping", base), "/pusula/api/health/ping");
    assert.equal(withBasePath("/v1/models", base), "/pusula/v1/models");
  });

  it("does not double-prefix", () => {
    assert.equal(withBasePath("/pusula/api/health/ping", base), "/pusula/api/health/ping");
    assert.equal(withBasePath("/pusula", base), "/pusula");
  });

  it("rewrites same-origin absolute URLs", () => {
    assert.equal(
      withBasePath("https://host.example/api/x", base, "https://host.example"),
      "https://host.example/pusula/api/x"
    );
  });

  it("leaves external absolute URLs alone", () => {
    assert.equal(
      withBasePath("https://other.example/api/x", base, "https://host.example"),
      "https://other.example/api/x"
    );
  });

  it("leaves protocol-relative URLs alone", () => {
    assert.equal(withBasePath("//cdn.example/app.js", base), "//cdn.example/app.js");
  });
});
