import test from "node:test";
import assert from "node:assert/strict";

const opencodeConfig = await import("../../src/shared/services/opencodeConfig.ts");

test("buildOpenCodeConfigDocument includes both V1 (provider) and V2 (providers) definitions", () => {
  const doc = opencodeConfig.buildOpenCodeConfigDocument({
    baseUrl: "http://localhost:20128/v1",
    apiKey: "{env:PUSULA_API_KEY}",
    models: ["auto/best-coding"],
  });

  assert.ok(doc.provider?.pusula, "V1 provider.pusula must be present");
  assert.equal(doc.provider.pusula.npm, "@ai-sdk/openai-compatible");
  assert.equal(doc.provider.pusula.options.baseURL, "http://localhost:20128/v1");

  assert.ok(doc.providers?.pusula, "V2 providers.pusula must be present");
  assert.equal(doc.providers.pusula.package, "@opencode-ai/ai/providers/openai-compatible");
  assert.equal(doc.providers.pusula.settings.baseURL, "http://localhost:20128/v1");
  assert.equal(doc.providers.pusula.settings.apiKey, "{env:PUSULA_API_KEY}");
  assert.ok(
    doc.providers.pusula.models["auto/best-coding"].limit,
    "V2 model limit must be present"
  );
});

test("mergeOpenCodeConfig preserves existing properties and updates both provider and providers", () => {
  const existing = {
    $schema: "https://opencode.ai/config.json",
    customField: "keep-me",
  };

  const merged = opencodeConfig.mergeOpenCodeConfig(existing, {
    baseUrl: "http://localhost:20128/v1",
    apiKey: "sk_test_key",
    models: ["auto/best-coding"],
  });

  assert.equal(merged.customField, "keep-me");
  assert.ok(merged.provider?.pusula);
  assert.ok(merged.providers?.pusula);
  assert.equal(merged.providers.pusula.settings.apiKey, "sk_test_key");
});
