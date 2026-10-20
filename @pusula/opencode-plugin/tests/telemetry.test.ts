import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPusulaInferenceTelemetry,
  attachPusulaTelemetryToPayload,
  attachPusulaTelemetryToSseLine,
  parsePusulaInferenceTelemetry,
} from "../src/telemetry.js";

test("parsePusulaInferenceTelemetry: copies cost, tokens, tok/s, winning model", () => {
  const headers = new Headers({
    "X-Pusula-Response-Cost": "0.0123",
    "X-Pusula-Tokens-In": "10",
    "X-Pusula-Tokens-Out": "200",
    "X-Pusula-Tokens-Per-Second": "100.5",
    "X-Pusula-Ttft-Ms": "300",
    "X-Pusula-Latency-Ms": "2300",
    "X-Pusula-Model": "winner-model",
    "X-Pusula-Provider": "openai",
  });
  const got = parsePusulaInferenceTelemetry(headers);
  assert.equal(got.costUsd, 0.0123);
  assert.equal(got.tokensIn, 10);
  assert.equal(got.tokensOut, 200);
  assert.equal(got.tokensPerSecond, 100.5);
  assert.equal(got.ttftMs, 300);
  assert.equal(got.model, "winner-model");
  assert.equal(got.provider, "openai");
});

test("parsePusulaInferenceTelemetry: omits tok/s when header missing (do not invent from latency)", () => {
  const headers = new Headers({
    "X-Pusula-Tokens-Out": "200",
    "X-Pusula-Latency-Ms": "2000",
  });
  const got = parsePusulaInferenceTelemetry(headers);
  assert.equal(got.tokensPerSecond, undefined);
  assert.equal(got.tokensOut, 200);
  const payload = attachPusulaTelemetryToPayload(
    { object: "chat.completion", usage: { prompt_tokens: 10, completion_tokens: 200 } },
    got,
  ) as { usage: { tokens_per_second?: number } };
  assert.equal(payload.usage.tokens_per_second, undefined);
});

test("attachPusulaTelemetryToPayload: writes usage.tokens_per_second and winning model", () => {
  const got = attachPusulaTelemetryToPayload(
    {
      object: "chat.completion",
      model: "combo/auto",
      usage: { prompt_tokens: 10, completion_tokens: 200 },
    },
    { tokensPerSecond: 80, ttftMs: 250, costUsd: 0, model: "gpt-winner" },
  ) as {
    model: string;
    usage: { tokens_per_second: number; ttft_ms: number; cost: number };
  };
  assert.equal(got.model, "gpt-winner");
  assert.equal(got.usage.tokens_per_second, 80);
  assert.equal(got.usage.ttft_ms, 250);
  assert.equal(got.usage.cost, 0);
});

test("attachPusulaTelemetryToPayload: does not mutate /v1/models catalog JSON", () => {
  const catalog = { object: "list", data: [{ id: "m1" }] };
  const got = attachPusulaTelemetryToPayload(catalog, {
    tokensPerSecond: 99,
    model: "should-not-apply",
  });
  assert.deepEqual(got, catalog);
});

test("attachPusulaTelemetryToSseLine: patches terminal usage data line", () => {
  const line =
    'data: {"object":"chat.completion.chunk","usage":{"completion_tokens":200}}';
  const got = attachPusulaTelemetryToSseLine(line, { tokensPerSecond: 50 });
  assert.match(got, /"tokens_per_second":50/);
  assert.match(got, /^data: /);
});

test("applyPusulaInferenceTelemetry: JSON response gets header tok/s", async () => {
  const response = new Response(
    JSON.stringify({
      object: "chat.completion",
      model: "combo/auto",
      usage: { prompt_tokens: 1, completion_tokens: 20 },
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "X-Pusula-Tokens-Per-Second": "40",
        "X-Pusula-Model": "winner",
      },
    },
  );
  const next = await applyPusulaInferenceTelemetry(response);
  const body = JSON.parse(await next.text()) as {
    model: string;
    usage: { tokens_per_second: number };
  };
  assert.equal(body.model, "winner");
  assert.equal(body.usage.tokens_per_second, 40);
});
