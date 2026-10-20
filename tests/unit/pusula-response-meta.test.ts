import test from "node:test";
import assert from "node:assert/strict";

import {
  attachPusulaMetaHeaders,
  buildPusulaResponseMetaHeaders,
  buildPusulaSseMetadataComment,
  formatPusulaCost,
  getPusulaTokenCounts,
} from "../../src/domain/pusulaResponseMeta.ts";
import { APP_CONFIG } from "../../src/shared/constants/appConfig.ts";
import { PUSULA_RESPONSE_HEADERS } from "../../src/shared/constants/headers.ts";

test("getPusulaTokenCounts normalizes common usage shapes", () => {
  assert.deepEqual(
    getPusulaTokenCounts({
      prompt_tokens: 12,
      completion_tokens: 5,
    }),
    { input: 12, output: 5 }
  );
  assert.deepEqual(
    getPusulaTokenCounts({
      input_tokens: "9",
      output_tokens: "4",
    }),
    { input: 9, output: 4 }
  );
});

test("buildPusulaResponseMetaHeaders formats provider alias, tokens, latency, and cost", () => {
  const headers = buildPusulaResponseMetaHeaders({
    provider: "claude",
    model: "claude-sonnet-4-6",
    cacheHit: true,
    latencyMs: 1234.6,
    usage: {
      prompt_tokens: 11,
      completion_tokens: 7,
    },
    costUsd: 0.00123456789,
  });

  assert.equal(headers["X-Pusula-Provider"], "cc");
  assert.equal(headers["X-Pusula-Model"], "claude-sonnet-4-6");
  assert.equal(headers["X-Pusula-Cache-Hit"], "true");
  assert.equal(headers["X-Pusula-Latency-Ms"], "1235");
  assert.equal(headers["X-Pusula-Tokens-In"], "11");
  assert.equal(headers["X-Pusula-Tokens-Out"], "7");
  assert.equal(headers["X-Pusula-Response-Cost"], "0.0012345679");
});

test("buildPusulaResponseMetaHeaders keeps ASCII model header values unchanged", () => {
  const headers = buildPusulaResponseMetaHeaders({
    provider: "openai",
    model: "gpt-4o-mini",
  });

  assert.equal(headers[PUSULA_RESPONSE_HEADERS.model], "gpt-4o-mini");
});

test("buildPusulaResponseMetaHeaders percent-encodes non-ASCII model header values", () => {
  const model = "free-mix/[假流式]gemini-3.7-flash";
  const headers = buildPusulaResponseMetaHeaders({
    provider: "openai",
    model,
  });

  assert.equal(headers[PUSULA_RESPONSE_HEADERS.model], encodeURIComponent(model));
  assert.doesNotThrow(() => new Headers(headers));
});

test("buildPusulaResponseMetaHeaders strips control characters from string header values", () => {
  const headers = buildPusulaResponseMetaHeaders({
    provider: "openai",
    model: "free\r\nX-Injected: yes\u0000-model",
    requestId: "req-1\nreq-2\rreq-3\u0007",
  });

  assert.doesNotMatch(headers[PUSULA_RESPONSE_HEADERS.model], /[\r\n\u0000-\u001f\u007f]/);
  assert.doesNotMatch(headers[PUSULA_RESPONSE_HEADERS.requestId], /[\r\n\u0000-\u001f\u007f]/);
  assert.equal(headers[PUSULA_RESPONSE_HEADERS.model], "freeX-Injected: yes-model");
  assert.equal(headers[PUSULA_RESPONSE_HEADERS.requestId], "req-1req-2req-3");
  assert.doesNotThrow(() => new Headers(headers));
});

test("buildPusulaResponseMetaHeaders always emits X-Pusula-Version", () => {
  const headers = buildPusulaResponseMetaHeaders({ provider: "openai", model: "gpt" });
  assert.equal(headers[PUSULA_RESPONSE_HEADERS.version], APP_CONFIG.version);

  // Even with no provider/model at all, the version is still attached.
  const bare = buildPusulaResponseMetaHeaders({});
  assert.equal(bare[PUSULA_RESPONSE_HEADERS.version], APP_CONFIG.version);
});

test("buildPusulaResponseMetaHeaders emits X-Pusula-Request-Id only when provided", () => {
  const withId = buildPusulaResponseMetaHeaders({ model: "gpt", requestId: "req-123" });
  assert.equal(withId[PUSULA_RESPONSE_HEADERS.requestId], "req-123");

  const noId = buildPusulaResponseMetaHeaders({ model: "gpt" });
  assert.equal(noId[PUSULA_RESPONSE_HEADERS.requestId], undefined);

  const nullId = buildPusulaResponseMetaHeaders({ model: "gpt", requestId: null });
  assert.equal(nullId[PUSULA_RESPONSE_HEADERS.requestId], undefined);

  const blankId = buildPusulaResponseMetaHeaders({ model: "gpt", requestId: "   " });
  assert.equal(blankId[PUSULA_RESPONSE_HEADERS.requestId], undefined);
});

test("attachPusulaMetaHeaders mutates a Headers instance in place, preserving existing entries", () => {
  const headers = new Headers({ "Content-Type": "application/json" });
  attachPusulaMetaHeaders(headers, {
    provider: "openai",
    model: "gpt",
    requestId: "req-abc",
  });

  assert.equal(headers.get("Content-Type"), "application/json");
  assert.equal(headers.get(PUSULA_RESPONSE_HEADERS.version), APP_CONFIG.version);
  assert.equal(headers.get(PUSULA_RESPONSE_HEADERS.requestId), "req-abc");
  assert.equal(headers.get(PUSULA_RESPONSE_HEADERS.model), "gpt");
});

test("attachPusulaMetaHeaders mutates a plain record in place, preserving existing entries", () => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  attachPusulaMetaHeaders(headers, {
    provider: "openai",
    model: "gpt",
  });

  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(headers[PUSULA_RESPONSE_HEADERS.version], APP_CONFIG.version);
  assert.equal(headers[PUSULA_RESPONSE_HEADERS.model], "gpt");
  // No requestId provided → header omitted.
  assert.equal(headers[PUSULA_RESPONSE_HEADERS.requestId], undefined);
});

test("buildPusulaSseMetadataComment emits comment lines compatible with SSE", () => {
  const comment = buildPusulaSseMetadataComment({
    provider: "openai",
    model: "gpt-4o-mini",
    usage: {
      prompt_tokens: 4,
      completion_tokens: 2,
    },
    latencyMs: 50,
    costUsd: formatPusulaCost(0),
  });

  assert.match(comment, /^: x-pusula-cache-hit=false/m);
  assert.match(comment, /^: x-pusula-provider=openai/m);
  assert.match(comment, /^: x-pusula-model=gpt-4o-mini/m);
  assert.match(comment, /^: x-pusula-tokens-in=4/m);
  assert.match(comment, /^: x-pusula-tokens-out=2/m);
  assert.match(comment, /^: x-pusula-response-cost=0\.0000000000/m);
});

test("buildPusulaResponseMetaHeaders emits X-Pusula-Cost-Saved only when costSavedUsd is provided", () => {
  // Cache HIT: the incremental cost of serving the hit is 0, but the cache saved the
  // original (would-have-been) cost — surfaced via the Cost-Saved header for analytics.
  const hit = buildPusulaResponseMetaHeaders({
    provider: "openai",
    model: "gpt-4o",
    cacheHit: true,
    costUsd: 0,
    costSavedUsd: 0.0125,
  });
  assert.equal(hit[PUSULA_RESPONSE_HEADERS.responseCost], "0.0000000000");
  assert.equal(hit[PUSULA_RESPONSE_HEADERS.costSaved], "0.0125000000");

  // A normal response (no costSavedUsd) omits the Cost-Saved header entirely.
  const miss = buildPusulaResponseMetaHeaders({
    provider: "openai",
    model: "gpt-4o",
    costUsd: 0.0125,
  });
  assert.equal(miss[PUSULA_RESPONSE_HEADERS.costSaved], undefined);

  // A free-model HIT still emits Cost-Saved (= 0) — it explicitly passed costSavedUsd.
  const freeHit = buildPusulaResponseMetaHeaders({
    cacheHit: true,
    costUsd: 0,
    costSavedUsd: 0,
  });
  assert.equal(freeHit[PUSULA_RESPONSE_HEADERS.costSaved], "0.0000000000");
});

test("attachPusulaMetaHeaders forwards costSavedUsd onto a Headers bag", () => {
  const headers = new Headers({ "Content-Type": "application/json" });
  attachPusulaMetaHeaders(headers, {
    provider: "openai",
    model: "gpt-4o",
    cacheHit: true,
    costUsd: 0,
    costSavedUsd: 0.0125,
  });
  assert.equal(headers.get(PUSULA_RESPONSE_HEADERS.responseCost), "0.0000000000");
  assert.equal(headers.get(PUSULA_RESPONSE_HEADERS.costSaved), "0.0125000000");
});
