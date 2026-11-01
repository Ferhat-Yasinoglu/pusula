import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  VISITOR_LOCALES,
  VISITOR_STEPS,
  formatCount,
  stepLabel,
  visitorStats,
} from "../../src/app/landing/visitor/visitorModel.ts";
import { getLandingStats } from "../../src/app/landing/landingStats.ts";

function visitorMessages(locale: string): Record<string, string> {
  const file = join(process.cwd(), "src", "i18n", "messages", `${locale}.json`);
  return JSON.parse(readFileSync(file, "utf8")).visitor;
}

const SOURCE = readFileSync(
  join(process.cwd(), "src", "app", "landing", "visitor", "VisitorLanding.tsx"),
  "utf8"
);

test("visitor locales match the app's configured locales", () => {
  const config = JSON.parse(readFileSync(join(process.cwd(), "config", "i18n.json"), "utf8"));
  const codes = config.locales.map((l: { code: string }) => l.code).sort();
  assert.deepEqual([...VISITOR_LOCALES].sort(), codes);
});

test("every visitor key the page uses exists in all four locales", () => {
  const used = new Set<string>();
  for (const m of SOURCE.matchAll(/\bt\("([A-Za-z0-9]+)"/g)) used.add(m[1]);
  for (const n of VISITOR_STEPS) {
    used.add(`step${n}Title`);
    used.add(`step${n}Desc`);
  }
  for (const stat of visitorStats(1, "en")) used.add(stat.labelKey);
  assert.ok(used.size > 10, `expected many keys, found ${used.size}`);

  const en = visitorMessages("en");
  for (const locale of VISITOR_LOCALES) {
    const messages = visitorMessages(locale);
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(en).sort(), `${locale}: key set`);
    for (const key of used) {
      assert.equal(typeof messages[key], "string", `${locale}.visitor.${key} missing`);
      assert.ok(messages[key].trim().length > 0, `${locale}.visitor.${key} empty`);
    }
  }
});

test("the provider headline carries the {count} placeholder in every locale", () => {
  for (const locale of VISITOR_LOCALES) {
    assert.match(visitorMessages(locale).titleProviders, /\{count\}/, locale);
  }
});

test("non-English copy is translated, not left in English", () => {
  const en = visitorMessages("en");
  // Words that are the same in every language (product names, "Routing" in German).
  const sameEverywhere = new Set(["ctaDocs", "navDocs"]);
  for (const locale of ["tr", "fa"]) {
    const messages = visitorMessages(locale);
    for (const key of Object.keys(en)) {
      if (sameEverywhere.has(key)) continue;
      assert.notEqual(messages[key], en[key], `${locale}.visitor.${key} is still English`);
    }
  }
});

test("figures come from the gateway catalog, not a hard-coded number", () => {
  const { providers } = getLandingStats();
  assert.ok(providers > 0);
  const [first] = visitorStats(providers, "en");
  assert.equal(first.value, new Intl.NumberFormat("en").format(providers));
  assert.ok(!/\b358\b/.test(SOURCE), "the provider count must not be hard-coded");
});

test("Persian figures use Persian digits; the others use Latin digits", () => {
  assert.equal(formatCount(358, "fa"), "۳۵۸");
  assert.equal(formatCount(358, "tr"), "358");
  assert.equal(formatCount(358, "de"), "358");
  assert.equal(stepLabel(1, "en"), "01");
  assert.equal(stepLabel(3, "fa"), "۰۳");
});

test("visitorStats lists provider count, one endpoint, MIT and the three steps", () => {
  const stats = visitorStats(42, "en");
  assert.deepEqual(
    stats.map((s) => s.value),
    ["42", "1", "MIT", String(VISITOR_STEPS.length)]
  );
});

test("the panel and docs calls to action point at real routes", () => {
  assert.ok(SOURCE.includes('href="/dashboard"'));
  assert.ok(SOURCE.includes('href="/docs"'));
  assert.ok(!SOURCE.includes('href="#"'), "no dead # links");
});
