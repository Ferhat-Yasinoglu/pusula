import test from "node:test";
import assert from "node:assert/strict";
import { PUSULA_RESPONSE_HEADERS } from "../../src/shared/constants/headers.ts";
import { buildPusulaResponseMetaHeaders } from "../../src/domain/pusulaResponseMeta.ts";

test("headers constant exposes the fallback-attempts key", () => {
  assert.equal(
    PUSULA_RESPONSE_HEADERS.fallbackAttempts,
    "X-Pusula-Fallback-Attempts"
  );
});

test("buildPusulaResponseMetaHeaders emits the fallback-attempts count when > 0", () => {
  const h = buildPusulaResponseMetaHeaders({ model: "gpt", provider: "openai", fallbackAttempts: 2 });
  assert.equal(h["X-Pusula-Fallback-Attempts"], "2");
});

test("buildPusulaResponseMetaHeaders omits the header when 0 / absent", () => {
  const none = buildPusulaResponseMetaHeaders({ model: "gpt" });
  assert.equal(none["X-Pusula-Fallback-Attempts"], undefined);
  const zero = buildPusulaResponseMetaHeaders({ model: "gpt", fallbackAttempts: 0 });
  assert.equal(zero["X-Pusula-Fallback-Attempts"], undefined);
});
