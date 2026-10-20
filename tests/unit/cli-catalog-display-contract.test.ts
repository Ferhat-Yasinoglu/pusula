import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import en from "../../src/i18n/messages/en.json" with { type: "json" };
import tr from "../../src/i18n/messages/tr.json" with { type: "json" };
import de from "../../src/i18n/messages/de.json" with { type: "json" };
import fa from "../../src/i18n/messages/fa.json" with { type: "json" };
import { CLI_TOOLS } from "../../src/shared/constants/cliTools";

test("every CLI catalog image points to a bundled public asset", () => {
  const missing = Object.values(CLI_TOOLS).flatMap((tool) =>
    [tool.image, tool.imageLight, tool.imageDark]
      .filter((asset): asset is string => Boolean(asset))
      .filter((asset) => !existsSync(`public${asset}`))
      .map((asset) => `${tool.id}: ${asset}`)
  );

  assert.deepEqual(missing, []);
});

test("every visible CLI catalog entry has English and translated descriptions", () => {
  const visibleToolIds = Object.values(CLI_TOOLS)
    .filter((tool) => tool.baseUrlSupport !== "none")
    .map((tool) => tool.id);
  const englishDescriptions = en.cliTools.toolDescriptions as Record<string, string>;

  assert.deepEqual(
    visibleToolIds.filter((id) => !englishDescriptions[id]?.trim()),
    []
  );
  for (const [locale, catalog] of [
    ["tr", tr],
    ["de", de],
    ["fa", fa],
  ] as const) {
    const translatedDescriptions = catalog.cliTools.toolDescriptions as Record<string, string>;
    assert.deepEqual(
      visibleToolIds.filter((id) => !translatedDescriptions[id]?.trim()),
      [],
      `${locale} is missing CLI tool descriptions`
    );
  }
});
