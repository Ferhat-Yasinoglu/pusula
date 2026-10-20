import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";

import en from "../../src/i18n/messages/en.json" with { type: "json" };
import tr from "../../src/i18n/messages/tr.json" with { type: "json" };
import de from "../../src/i18n/messages/de.json" with { type: "json" };
import fa from "../../src/i18n/messages/fa.json" with { type: "json" };

type MessageEntry = {
  key: string;
  value: string;
};

function flattenMessages(value: unknown, segments: Array<string | number> = []): MessageEntry[] {
  if (typeof value === "string") {
    return [{ key: segments.map(String).join("."), value }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => flattenMessages(child, [...segments, index]));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      flattenMessages(child, [...segments, key])
    );
  }
  return [];
}

// Interpolation argument names of a message, read from the ICU AST so that plural/select case
// bodies (`{count, plural, one {Endpunkt} other {Endpunkte}}`) are never mistaken for
// placeholders. Rich-text tags (`<em>…</em>`) are a translation choice, not data, so only the
// arguments nested inside them count. Returns null when the message does not parse (covered
// by the parse-regression test below).
function placeholderNames(value: string): string[] | null {
  let elements: MessageFormatElement[];
  try {
    elements = parse(value, { captureLocation: false, shouldParseSkeletons: true });
  } catch {
    return null;
  }
  const names = new Set<string>();
  const walk = (nodes: MessageFormatElement[]): void => {
    for (const node of nodes) {
      switch (node.type) {
        case TYPE.argument:
        case TYPE.number:
        case TYPE.date:
        case TYPE.time:
          names.add(node.value);
          break;
        case TYPE.select:
        case TYPE.plural:
          names.add(node.value);
          for (const option of Object.values(node.options)) walk(option.value);
          break;
        case TYPE.tag:
          walk(node.children);
          break;
        default:
          break;
      }
    }
  };
  walk(elements);
  return [...names].sort();
}

const englishMessages = flattenMessages(en);

// Every translated UI locale (config/i18n.json minus the English source) must be complete:
// full key parity, no placeholders, identical ICU placeholder names and no ICU parse regressions.
const TRANSLATED_LOCALES: Array<[string, unknown]> = [
  ["tr", tr],
  ["de", de],
  ["fa", fa],
];

for (const [locale, catalog] of TRANSLATED_LOCALES) {
  const translatedMessages = flattenMessages(catalog);
  const translatedByKey = new Map(translatedMessages.map((entry) => [entry.key, entry.value]));

  test(`${locale} locale has complete key parity with English`, () => {
    assert.deepEqual(
      translatedMessages.map((entry) => entry.key).sort(),
      englishMessages.map((entry) => entry.key).sort()
    );
  });

  test(`${locale} locale has no internal missing markers or empty fallbacks`, () => {
    const invalid = translatedMessages.filter(
      ({ value }) => !value.trim() || /__(?:MISSING|TODO)__:?/i.test(value)
    );
    assert.deepEqual(invalid, []);
  });

  test(`${locale} locale preserves every ICU placeholder name`, () => {
    const mismatches = englishMessages.flatMap(({ key, value }) => {
      const translated = translatedByKey.get(key);
      if (translated === undefined) return [{ key, reason: "missing" }];
      const sourceNames = placeholderNames(value);
      const targetNames = placeholderNames(translated);
      if (sourceNames === null || targetNames === null) return [];
      return JSON.stringify(sourceNames) === JSON.stringify(targetNames)
        ? []
        : [{ key, sourceNames, targetNames }];
    });
    assert.deepEqual(mismatches, []);
  });

  test(`${locale} locale introduces no ICU parse regression`, () => {
    const regressions = englishMessages.flatMap(({ key, value }) => {
      try {
        parse(value, { captureLocation: false, shouldParseSkeletons: true });
      } catch {
        return [];
      }

      const translated = translatedByKey.get(key);
      if (translated === undefined) return [{ key, reason: "missing" }];
      try {
        parse(translated, { captureLocation: false, shouldParseSkeletons: true });
        return [];
      } catch (error) {
        return [{ key, reason: error instanceof Error ? error.message : String(error) }];
      }
    });
    assert.deepEqual(regressions, []);
  });
}

test("no-auth provider controls keep locale translators unambiguous", () => {
  const source = readFileSync(
    new URL(
      "../../src/app/(dashboard)/dashboard/providers/[id]/components/NoAuthProviderControls.tsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.equal(source.match(/import \{ useTranslations \} from "next-intl";/g)?.length, 1);
  assert.match(source, /const noAuthT = useTranslations\("noAuthProvider"\);/);
  assert.match(source, /const t = useTranslations\("providers"\);/);
});
