/**
 * Unit tests for i18n key additions in the translator namespace (F1).
 *
 * Verifies that all ~51 new keys added by F1 are present in both en.json
 * and tr.json, and that Turkish translations are not identical to English
 * for the keys that should obviously differ.
 *
 * Also includes a non-regression check that old keys still exist.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Load message files ───────────────────────────────────────────────────────

const ROOT = resolve(process.cwd());

const en = JSON.parse(
  readFileSync(resolve(ROOT, "src/i18n/messages/en.json"), "utf-8")
) as Record<string, unknown>;

const tr = JSON.parse(
  readFileSync(resolve(ROOT, "src/i18n/messages/tr.json"), "utf-8")
) as Record<string, unknown>;

const enTranslator = (en["translator"] ?? {}) as Record<string, unknown>;
const trTranslator = (tr["translator"] ?? {}) as Record<string, unknown>;

// ─── New keys added by F1 ─────────────────────────────────────────────────────

const NEW_KEYS = [
  // Card conceito + tabs
  "friendlyTitle",
  "friendlySubtitle",
  "conceptHeadline",
  "conceptDiagramAppLabel",
  "conceptDiagramSourceLabel",
  "conceptDiagramHubLabel",
  "conceptDiagramTargetLabel",
  "conceptDiagramExampleApp",
  "conceptDiagramExampleSource",
  "conceptDiagramExampleTarget",
  "conceptHowItWorksToggle",
  "conceptHowItWorksBody",
  "tabTranslate",
  "tabMonitor",
  "tabTranslateAriaLabel",
  "tabMonitorAriaLabel",
  // SimpleControls + ResultNarrated
  "simpleAppUsesLabel",
  "simpleAppUsesHint",
  "simpleSendToLabel",
  "simpleSendToHint",
  "simpleStartWithLabel",
  "simpleStartWithExamplePlaceholder",
  "simpleStartWithCustomOption",
  "simpleModeLabel",
  "simpleModePreview",
  "simpleModeSend",
  "simpleAdvancedToggle",
  "simpleInputPanelTitle",
  "simpleInputPanelHint",
  "simpleResultPanelTitle",
  "narratedDetected",
  "narratedTranslating",
  "narratedSending",
  "narratedSuccess",
  "narratedError",
  "narratedSeeTranslatedJson",
  "narratedSeePipeline",
  // Advanced accordions + Monitor hint
  "advancedSectionTitle",
  "advancedSectionSubtitle",
  "advancedRawJsonTitle",
  "advancedRawJsonSubtitle",
  "advancedPipelineTitle",
  "advancedPipelineSubtitle",
  "advancedStreamTransformTitle",
  "advancedStreamTransformSubtitle",
  "advancedTestBenchTitle",
  "advancedTestBenchSubtitle",
  "advancedCompressionTitle",
  "advancedCompressionSubtitle",
  "monitorOriginHint",
  "monitorEmptyCta",
  "monitorOpenTranslateButton",
  // Pipeline step keys (GAP-NOVO-1)
  "pipelineStepClientRequest",
  "pipelineStepClientRequestDesc",
  "pipelineStepFormatDetected",
  "pipelineStepFormatDetectedDesc",
  "pipelineStepOpenAIIntermediate",
  "pipelineStepOpenAIIntermediateDesc",
  "pipelineStepProviderFormat",
  "pipelineStepProviderFormatDesc",
  "pipelineStepProviderResponse",
  "pipelineStepProviderResponseDesc",
  // Concept diagram keys (GAP-NOVO-1)
  "conceptDiagramArrow1",
  "conceptDiagramArrow2",
  "conceptDiagramArrow3",
  "conceptDiagramExampleHub",
  "conceptDiagramHubTooltip",
  "conceptDiagramSourceTooltip",
  "conceptDiagramTargetTooltip",
] as const;

// ─── Keys that should obviously differ from English (spot check) ──────────────

const OBVIOUSLY_TRANSLATED_IN_TR = [
  "simpleAppUsesLabel", // "My app uses"
  "simpleSendToLabel", // "Send to"
  "simpleModePreview", // "Preview translation only"
  "simpleModeSend", // "Send and see response"
  "conceptDiagramAppLabel", // "Your app"
  "conceptHowItWorksToggle", // "How it works"
  "monitorOpenTranslateButton", // "Go to Translate"
  "simpleStartWithExamplePlaceholder", // "Select a ready-made example"
];

// ─── Old keys that must still exist (non-regression) ─────────────────────────

const OLD_KEYS_MUST_SURVIVE = [
  "playgroundTitle",
  "playground",
  "chatTester",
  "testBench",
  "liveMonitor",
  "modeDescriptionPlayground",
  "autoFeaturesTitle",
  "autoFeaturesCount",
  "translateAction",
  "inputPlaceholder",
  "runAllTests",
  "streamTransformerTitle",
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("F1 new keys — present in en.json", () => {
  for (const key of NEW_KEYS) {
    it(`en.translator.${key} exists`, () => {
      assert.ok(
        key in enTranslator,
        `Missing key "translator.${key}" in en.json`
      );
      const val = enTranslator[key];
      assert.ok(typeof val === "string" && val.length > 0, `Key "translator.${key}" is empty`);
    });
  }
});

describe("F1 new keys — present in tr.json", () => {
  for (const key of NEW_KEYS) {
    it(`tr.translator.${key} exists`, () => {
      assert.ok(
        key in trTranslator,
        `Missing key "translator.${key}" in tr.json`
      );
      const val = trTranslator[key];
      assert.ok(typeof val === "string" && val.length > 0, `Key "translator.${key}" is empty in tr`);
    });
  }
});

describe("Turkish translations differ from English for obviously translated keys", () => {
  for (const key of OBVIOUSLY_TRANSLATED_IN_TR) {
    it(`translator.${key} is different between en and tr`, () => {
      const enVal = enTranslator[key];
      const trVal = trTranslator[key];
      assert.notEqual(
        enVal,
        trVal,
        `Key "translator.${key}" has identical en and tr values: "${enVal}"`
      );
    });
  }
});

describe("Non-regression — old keys still exist in en.json", () => {
  for (const key of OLD_KEYS_MUST_SURVIVE) {
    it(`en.translator.${key} still exists`, () => {
      assert.ok(
        key in enTranslator,
        `Old key "translator.${key}" was removed from en.json (regression!)`
      );
    });
  }
});

describe("Non-regression — old keys still exist in tr.json", () => {
  for (const key of OLD_KEYS_MUST_SURVIVE) {
    it(`tr.translator.${key} still exists`, () => {
      assert.ok(
        key in trTranslator,
        `Old key "translator.${key}" was removed from tr.json (regression!)`
      );
    });
  }
});

describe("F1 total new keys count", () => {
  it(`at least ${NEW_KEYS.length} new keys exist in en.json`, () => {
    const missingKeys = NEW_KEYS.filter((k) => !(k in enTranslator));
    assert.equal(
      missingKeys.length,
      0,
      `Missing ${missingKeys.length} keys in en.json: ${missingKeys.join(", ")}`
    );
  });

  it(`all ${NEW_KEYS.length} new keys exist in tr.json`, () => {
    const missingKeys = NEW_KEYS.filter((k) => !(k in trTranslator));
    assert.equal(
      missingKeys.length,
      0,
      `Missing ${missingKeys.length} keys in tr.json: ${missingKeys.join(", ")}`
    );
  });
});
