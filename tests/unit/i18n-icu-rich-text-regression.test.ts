import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { IntlMessageFormat } from "intl-messageformat";

// Upstream pinned these keys in its "bs" and "yo" catalogs; Pusula ships only en/tr/de/fa, so
// the same keys (which carry the same <strong>/<code> markup) are pinned in tr and in the RTL
// fa catalog.
const cases = [
  ["tr", "combos.playgroundEmptyHint", "strong"],
  ["tr", "oauthModal.gheDescription", "code"],
  ["tr", "pricingModal.ratesDescription", "strong"],
  ["tr", "traeAuthModal.authorizeImportant", "strong"],
  ["fa", "oauthModal.googleLoopbackWhatHappens", "code"],
];

for (const [locale, key, expectedTag] of cases) {
  test(`${locale}:${key} renders through rich-text handlers instead of raw markup`, () => {
    const catalog: Record<string, Record<string, string>> = JSON.parse(
      readFileSync(new URL(`../../src/i18n/messages/${locale}.json`, import.meta.url), "utf8")
    );
    const [namespace, leaf] = key.split(".");
    const called = new Set<string>();
    const handler = (tag: string) => (chunks: unknown[]) => {
      called.add(tag);
      return chunks.join("");
    };
    const formatted = new IntlMessageFormat(catalog[namespace][leaf], locale).format({
      strong: handler("strong"),
      code: handler("code"),
      em: handler("em"),
      redirectUri: "http://localhost:20128/oauth/callback",
    });

    assert.equal(typeof formatted, "string");
    assert.ok(called.has(expectedTag), `the ${expectedTag} handler must render the translation`);
    assert.doesNotMatch(String(formatted), /<\/?(?:strong|code|em)\b/);
    if (key === "oauthModal.googleLoopbackWhatHappens") {
      assert.ok(String(formatted).includes("http://localhost:20128/oauth/callback"));
    }
  });
}
