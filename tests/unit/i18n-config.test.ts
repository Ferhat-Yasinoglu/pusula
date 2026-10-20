import test from "node:test";
import assert from "node:assert/strict";

import i18nConfig from "../../config/i18n.json" with { type: "json" };
import {
  DEFAULT_LOCALE,
  LANGUAGES,
  LOCALES,
  LOCALE_ALIASES,
  LOCALE_COOKIE,
  RTL_LOCALES,
} from "../../src/i18n/config.ts";

test("i18n config adapter reflects the JSON source of truth", () => {
  assert.deepEqual(
    LOCALES,
    i18nConfig.locales.map((locale) => locale.code)
  );
  assert.equal(DEFAULT_LOCALE, i18nConfig.default);
  assert.deepEqual(RTL_LOCALES, i18nConfig.rtl);
  assert.equal(LOCALE_COOKIE, "NEXT_LOCALE");
});

test("i18n language metadata preserves native and English names", () => {
  assert.equal(LANGUAGES.length, i18nConfig.locales.length);

  const english = LANGUAGES.find((language) => language.code === "en");
  const englishConfig = i18nConfig.locales.find((language) => language.code === "en");
  assert.deepEqual(english, {
    code: "en",
    label: englishConfig?.label,
    name: englishConfig?.name,
    native: englishConfig?.native,
    english: englishConfig?.english,
    flag: englishConfig?.flag,
  });
});

test("locale aliases are lower-case, unique and never collide with a locale code", () => {
  const codes = new Set(LOCALES.map((code) => code.toLowerCase()));
  const seen = new Set<string>();
  for (const [code, aliases] of Object.entries(LOCALE_ALIASES)) {
    assert.ok(codes.has(code.toLowerCase()), `${code} is not a configured locale`);
    for (const alias of aliases) {
      assert.equal(alias, alias.toLowerCase(), `${alias} must be lower-case`);
      assert.ok(!codes.has(alias), `${alias} collides with a locale code`);
      assert.ok(!seen.has(alias), `${alias} is declared for two locales`);
      seen.add(alias);
    }
  }
});

test("LOCALE_ALIASES mirrors exactly the aliases declared in config/i18n.json", () => {
  // Only locales that declare `aliases` appear; with none declared the map is empty, and any
  // alias added to the config (e.g. a legacy or script-tagged browser tag) must surface here.
  const expected = Object.fromEntries(
    (i18nConfig.locales as Array<{ code: string; aliases?: string[] }>)
      .filter((locale) => Array.isArray(locale.aliases) && locale.aliases.length > 0)
      .map((locale) => [locale.code, locale.aliases])
  );
  assert.deepEqual(LOCALE_ALIASES, expected);
  for (const code of Object.keys(LOCALE_ALIASES)) {
    assert.ok(LOCALES.includes(code), `${code} must be a configured locale`);
  }
});
