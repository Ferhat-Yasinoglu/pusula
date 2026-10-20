import test from "node:test";
import assert from "node:assert/strict";
import { PUSULA_RESPONSE_HEADERS } from "../../src/shared/constants/headers.ts";
import {
  buildPusulaDecisionHeaderValue,
  buildPusulaResponseMetaHeaders,
} from "../../src/domain/pusulaResponseMeta.ts";
import { assembleStreamingResponseHeaders } from "../../open-sse/handlers/chatCore/streamingResponseHeaders.ts";
import { buildNonStreamingResponseHeaders } from "../../open-sse/handlers/chatCore/nonStreamingResponseHeaders.ts";

test("headers constant exposes the decision key", () => {
  assert.equal(PUSULA_RESPONSE_HEADERS.decision, "X-Pusula-Decision");
});

test("buildPusulaResponseMetaHeaders emits X-Pusula-Decision for a combo strategy", () => {
  const headers = buildPusulaResponseMetaHeaders({
    strategy: "priority",
    provider: "openai",
    model: "gpt-4o",
    latencyMs: 42,
  });
  assert.equal(headers["X-Pusula-Decision"], "strategy=priority; provider=openai; latency_ms=42");
});

test("strategy: single (non-combo request) still emits the header", () => {
  const headers = buildPusulaResponseMetaHeaders({
    strategy: "single",
    provider: "anthropic",
    latencyMs: 10,
  });
  assert.equal(headers["X-Pusula-Decision"], "strategy=single; provider=anthropic; latency_ms=10");
});

test("omitted strategy AND provider -> header absent entirely", () => {
  const headers = buildPusulaResponseMetaHeaders({ model: "gpt-4o" });
  assert.equal("X-Pusula-Decision" in headers, false);
});

test("control characters in strategy are stripped, no header-injection / leak surface", () => {
  const value = buildPusulaDecisionHeaderValue({
    strategy: "prio\r\nrity",
    provider: "openai",
    latencyMs: 5,
  });
  assert.ok(value !== null);
  assert.equal(/[\r\n]/.test(value as string), false);
  assert.equal((value as string).includes("Error:"), false);
  assert.equal((value as string).includes(" at /"), false);
});

test("assembleStreamingResponseHeaders includes X-Pusula-Decision with strategy=fusion", () => {
  const providerHeaders = new Headers();
  const headers = assembleStreamingResponseHeaders({
    providerHeaders,
    provider: "openai",
    model: "gpt-4o",
    pendingRequestId: "req-1",
    comboStrategy: "fusion",
  });
  assert.equal(headers["X-Pusula-Decision"], "strategy=fusion; provider=openai; latency_ms=0");
});

test("buildNonStreamingResponseHeaders falls back to strategy=single when comboStrategy is null", () => {
  const headers = buildNonStreamingResponseHeaders({
    provider: "openai",
    model: "gpt-4o",
    startTime: Date.now(),
    responseUsage: null,
    estimatedCost: 0,
    requestId: "req-2",
    comboStrategy: null,
  });
  assert.match(headers["X-Pusula-Decision"], /^strategy=single; provider=openai; latency_ms=\d+$/);
});

test("assembleStreamingResponseHeaders emits X-Pusula-Fallback-Attempts when count > 0", () => {
  const headers = assembleStreamingResponseHeaders({
    providerHeaders: new Headers(),
    provider: "openai",
    model: "gpt-4o",
    pendingRequestId: "req-3",
    comboStrategy: "priority",
    fallbackAttempts: 2,
  });
  assert.equal(headers["X-Pusula-Fallback-Attempts"], "2");
});

test("buildNonStreamingResponseHeaders emits X-Pusula-Fallback-Attempts when count > 0", () => {
  const headers = buildNonStreamingResponseHeaders({
    provider: "openai",
    model: "gpt-4o",
    startTime: Date.now(),
    responseUsage: null,
    estimatedCost: 0,
    requestId: "req-4",
    comboStrategy: "priority",
    fallbackAttempts: 1,
  });
  assert.equal(headers["X-Pusula-Fallback-Attempts"], "1");
});

test("builders omit X-Pusula-Fallback-Attempts when count is 0", () => {
  const streaming = assembleStreamingResponseHeaders({
    providerHeaders: new Headers(),
    provider: "openai",
    model: "gpt-4o",
    pendingRequestId: "req-5",
    fallbackAttempts: 0,
  });
  const nonStreaming = buildNonStreamingResponseHeaders({
    provider: "openai",
    model: "gpt-4o",
    startTime: Date.now(),
    responseUsage: null,
    estimatedCost: 0,
    requestId: "req-6",
    fallbackAttempts: 0,
  });
  assert.equal(streaming["X-Pusula-Fallback-Attempts"], undefined);
  assert.equal(nonStreaming["X-Pusula-Fallback-Attempts"], undefined);
});
