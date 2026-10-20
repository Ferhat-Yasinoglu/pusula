import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveTargetModel,
  MODEL_ROUTING_MAP,
  shouldInterceptToPusula,
  extractModel,
  PUSULA_BUILTIN_GROUPS,
} from "../../bin/antigravity-bridge.mjs";

test("MODEL_ROUTING_MAP contains mappings for core auto groups", () => {
  assert.ok(MODEL_ROUTING_MAP["auto/best-fast"]);
  assert.ok(MODEL_ROUTING_MAP["auto/best-coding"]);
});

test("shouldInterceptToPusula preserves native Gemini models for zero Google quota leakage", () => {
  const streamingUrl =
    "https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse";

  // Native Google Gemini models must NEVER be intercepted
  assert.equal(shouldInterceptToPusula("gemini-3.8-pro", streamingUrl), false);
  assert.equal(shouldInterceptToPusula("gemini-3.8-flash", streamingUrl), false);
  assert.equal(shouldInterceptToPusula("gemini-3.5-flash-lite", streamingUrl), false);
  assert.equal(shouldInterceptToPusula("models/gemini-2.5-pro", streamingUrl), false);

  // Native hosted models must never be intercepted
  assert.equal(shouldInterceptToPusula("claude-sonnet-4-6", streamingUrl), false);
  assert.equal(shouldInterceptToPusula("claude-opus-4-6", streamingUrl), false);
  assert.equal(shouldInterceptToPusula("gpt-oss-120b-medium", streamingUrl), false);
});

test("shouldInterceptToPusula ignores non-streaming RPCs", () => {
  assert.equal(
    shouldInterceptToPusula(
      "auto/best-fast",
      "https://cloudcode-pa.googleapis.com/v1internal:fetchUserInfo"
    ),
    false
  );
  assert.equal(
    shouldInterceptToPusula(
      "auto/best-fast",
      "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist"
    ),
    false
  );
});

test("shouldInterceptToPusula intercepts all Pusula auto groups and display names", () => {
  const streamingUrl =
    "https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse";

  assert.equal(shouldInterceptToPusula("auto/best-fast", streamingUrl), true);
  assert.equal(shouldInterceptToPusula("auto/best-coding", streamingUrl), true);
  assert.equal(shouldInterceptToPusula("auto/best-reasoning", streamingUrl), true);
  assert.equal(shouldInterceptToPusula("auto/best-free", streamingUrl), true);
  assert.equal(shouldInterceptToPusula("Auto: Best Fast (Pusula)", streamingUrl), true);
  assert.equal(shouldInterceptToPusula("Auto: Best Coding (Pusula)", streamingUrl), true);
  assert.equal(shouldInterceptToPusula("groq/openai/gpt-oss-120b", streamingUrl), true);
  assert.equal(shouldInterceptToPusula("mistral/codestral-latest", streamingUrl), true);
});

test("resolveTargetModel correctly maps Pusula auto groups to active providers", () => {
  assert.equal(resolveTargetModel("auto/best-fast"), "groq/openai/gpt-oss-120b");
  assert.equal(resolveTargetModel("Auto: Best Fast (Pusula)"), "groq/openai/gpt-oss-120b");
  assert.equal(resolveTargetModel("auto/best-coding"), "mistral/codestral-latest");
  assert.equal(resolveTargetModel("Auto: Best Coding (Pusula)"), "mistral/codestral-latest");
  assert.equal(
    resolveTargetModel("auto/best-reasoning"),
    "nvidia/nvidia/nemotron-3-super-120b-a12b"
  );
  assert.equal(resolveTargetModel("auto/best-free"), "groq/qwen/qwen3.8-27b");
});

test("resolveTargetModel self-heals retired models and prevents upstream 410 crashes", () => {
  // Deprecated/retired on NVIDIA NIM
  assert.equal(
    resolveTargetModel("nvidia/deepseek-ai/deepseek-v4-pro-0813"),
    "groq/openai/gpt-oss-120b"
  );
  assert.equal(resolveTargetModel("deepseek-ai/deepseek-v4-pro-0813"), "groq/openai/gpt-oss-120b");
  assert.equal(resolveTargetModel("NVIDIA: DeepSeek V4 Pro"), "groq/openai/gpt-oss-120b");
  assert.equal(resolveTargetModel("nvidia/openai/gpt-oss-120b"), "groq/openai/gpt-oss-120b");
});

test("extractModel resolves models from envelope body and query parameters", () => {
  assert.equal(extractModel({ model: "auto/best-fast" }, ""), "auto/best-fast");
  assert.equal(
    extractModel({ request: { model: "Auto: Best Coding (Pusula)" } }, ""),
    "Auto: Best Coding (Pusula)"
  );
  assert.equal(
    extractModel(
      null,
      "https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?model=auto/best-reasoning"
    ),
    "auto/best-reasoning"
  );
});

test("PUSULA_BUILTIN_GROUPS provides unique IDs and valid display names", () => {
  const ids = new Set(PUSULA_BUILTIN_GROUPS.map((g) => g.id));
  assert.equal(ids.size, PUSULA_BUILTIN_GROUPS.length);
  assert.ok(ids.has("auto/best-fast"));
  assert.ok(ids.has("auto/best-coding"));
  assert.ok(ids.has("auto/best-reasoning"));
  assert.ok(ids.has("auto/best-free"));

  for (const group of PUSULA_BUILTIN_GROUPS) {
    assert.ok(group.displayName.length > 0);
    assert.ok(group.descriptionText.length > 0);
  }
});
