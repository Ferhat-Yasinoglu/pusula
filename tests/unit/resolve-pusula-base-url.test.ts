import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PUSULA_BASE_URL,
  resolvePusulaBaseUrl,
} from "../../src/shared/utils/resolvePusulaBaseUrl.ts";

test("resolvePusulaBaseUrl prefers PUSULA_BASE_URL", () => {
  assert.equal(
    resolvePusulaBaseUrl({
      PUSULA_BASE_URL: "https://internal.example.com/",
      BASE_URL: "https://base.example.com",
      NEXT_PUBLIC_BASE_URL: "https://public.example.com",
    }),
    "https://internal.example.com"
  );
});

test("resolvePusulaBaseUrl falls back to BASE_URL", () => {
  assert.equal(
    resolvePusulaBaseUrl({
      BASE_URL: "https://base.example.com/",
      NEXT_PUBLIC_BASE_URL: "https://public.example.com",
    }),
    "https://base.example.com"
  );
});

test("resolvePusulaBaseUrl falls back to NEXT_PUBLIC_BASE_URL", () => {
  assert.equal(
    resolvePusulaBaseUrl({
      NEXT_PUBLIC_BASE_URL: "https://public.example.com/",
    }),
    "https://public.example.com"
  );
});

test("resolvePusulaBaseUrl ignores blank values", () => {
  assert.equal(
    resolvePusulaBaseUrl({
      PUSULA_BASE_URL: "   ",
      BASE_URL: "",
      NEXT_PUBLIC_BASE_URL: " https://public.example.com/ ",
    }),
    "https://public.example.com"
  );
});

test("resolvePusulaBaseUrl uses the default localhost fallback", () => {
  assert.equal(resolvePusulaBaseUrl({}), DEFAULT_PUSULA_BASE_URL);
});

test("resolvePusulaBaseUrl uses custom port when PORT env is set", () => {
  assert.equal(resolvePusulaBaseUrl({ PORT: 37128 }), "http://localhost:37128");
});
