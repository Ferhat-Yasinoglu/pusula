import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Record<string, unknown>, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

describe("i18n tr integrity", () => {
  it("should be a valid JSON file", () => {
    const trPath = path.resolve("src/i18n/messages/tr.json");
    const content = fs.readFileSync(trPath, "utf8");
    const json = JSON.parse(content);
    assert.strictEqual(typeof json, "object");
    assert.ok(json.common);
    assert.ok(json.settings);
  });

  it("should contain critical keys for the dashboard", () => {
    const trPath = path.resolve("src/i18n/messages/tr.json");
    const json = JSON.parse(fs.readFileSync(trPath, "utf8"));

    // Critical keys we refactored
    assert.ok(json.settings.routingAntigravitySignatureDesc);
    assert.ok(json.agents.howToUseStep1);
    assert.ok(json.cache.loadingCacheAria);
    assert.ok(json.analytics.usageAnalyticsTitle);
  });

  // Regression guard for #6695: en.json gained 194 keys that were never
  // mirrored into the primary translated catalog (i18n:sync-ui was not re-run),
  // and the i18n-ui-coverage CI gate is a percentage threshold (80%) so it
  // stayed green at 93.8% coverage despite the gap. This asserts full key parity
  // so a future drift fails loudly instead of silently degrading coverage.
  it("should contain every key present in en.json (no drift, #6695)", () => {
    const enPath = path.resolve("src/i18n/messages/en.json");
    const trPath = path.resolve("src/i18n/messages/tr.json");
    const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
    const tr = JSON.parse(fs.readFileSync(trPath, "utf8"));

    const enFlat = flatten(en);
    const trFlat = flatten(tr);

    const missing = Object.keys(enFlat).filter((k) => !(k in trFlat));

    assert.strictEqual(
      missing.length,
      0,
      `tr.json is missing ${missing.length} keys present in en.json. Sample: ${missing
        .slice(0, 10)
        .join(", ")}`
    );
  });
});
