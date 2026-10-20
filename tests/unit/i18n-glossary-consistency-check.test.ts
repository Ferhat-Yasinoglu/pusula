import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkGlossaryConsistency } from "../../scripts/i18n/check-glossary-consistency.mjs";
import {
  hasUnblockedOccurrence,
  normalizeLocaleText,
} from "../../scripts/i18n/glossary-normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const glossary = {
  version: 1,
  locale: "zh-CN",
  terms: {
    provider: { canonical: "提供者", synonyms: ["提供商"] },
  },
};

const protectedTerms = ["DATA_DIR"];

test("catalog mixing canonical and synonym for a concept is flagged", () => {
  const messages = {
    common: {
      provider: "提供者",
      unknownProvider: "未知提供商",
    },
  };
  const { violations } = checkGlossaryConsistency(messages, glossary, protectedTerms);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].type, "glossary-synonym");
  assert.equal(violations[0].concept, "provider");
  assert.equal(violations[0].found, "提供商");
  assert.equal(violations[0].canonical, "提供者");
});

test("clean catalog using only the canonical rendering has no violations", () => {
  const messages = {
    common: {
      provider: "提供者",
      providerHealth: "提供者健康状态",
    },
  };
  const { violations } = checkGlossaryConsistency(messages, glossary, protectedTerms);
  assert.deepEqual(violations, []);
});

test("protected term altered inside a value is flagged", () => {
  const messages = {
    settings: {
      dataDirHint: "存储在 数据目录 中",
    },
  };
  const { violations } = checkGlossaryConsistency(messages, glossary, protectedTerms);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].type, "protected-term-altered");
  assert.equal(violations[0].term, "DATA_DIR");
  assert.equal(violations[0].found, "数据目录");
});

test("protected term left verbatim is not flagged", () => {
  const messages = {
    settings: {
      dataDirHint: "存储在 DATA_DIR 中",
    },
  };
  const { violations } = checkGlossaryConsistency(messages, glossary, protectedTerms);
  assert.deepEqual(violations, []);
});

test("empty synonyms list for a concept never produces violations", () => {
  const permissiveGlossary = {
    version: 1,
    locale: "zh-CN",
    terms: {
      cache: { canonical: "缓存", synonyms: [] },
    },
  };
  const messages = { common: { cache: "高速缓存" } };
  const { violations } = checkGlossaryConsistency(messages, permissiveGlossary, protectedTerms);
  assert.deepEqual(violations, []);
});

test("glossary-file protectedTermMistranslations are merged into the protected-term check", () => {
  const koGlossary = {
    version: 1,
    locale: "ko",
    terms: {},
    protectedTermMistranslations: {
      ngrok: ["응록"],
    },
  };
  const messages = { endpoint: { ngrokTitle: "응록 터널" } };
  const { violations } = checkGlossaryConsistency(messages, koGlossary, ["ngrok"]);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].type, "protected-term-altered");
  assert.equal(violations[0].term, "ngrok");
  assert.equal(violations[0].found, "응록");
});

test("protectedTermMistranslations for a term absent from protected-terms.json are inert", () => {
  const koGlossary = {
    version: 1,
    locale: "ko",
    terms: {},
    protectedTermMistranslations: {
      ngrok: ["응록"],
    },
  };
  const messages = { endpoint: { ngrokTitle: "응록 터널" } };
  // "ngrok" not in the protected list → the glossary entry alone must not fire.
  const { violations } = checkGlossaryConsistency(messages, koGlossary, ["DATA_DIR"]);
  assert.deepEqual(violations, []);
});

test("legacy KNOWN_MISTRANSLATIONS still fire when the glossary has no mistranslation map", () => {
  const messages = { settings: { dataDirHint: "存储在 数据目录 中" } };
  const { violations } = checkGlossaryConsistency(messages, glossary, ["DATA_DIR"]);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].term, "DATA_DIR");
});

// ---------------------------------------------------------------------------
// zh-TW terminology normalization
// ---------------------------------------------------------------------------

const zhTwGlossary = {
  version: 1,
  locale: "zh-TW",
  terms: {
    type: { canonical: "類型", synonyms: ["型別"], blockedPrefixes: ["模", "本"] },
    upstream: { canonical: "上游", synonyms: ["上遊"] },
  },
};

test("blockedPrefixes suppresses a synonym match inside an unrelated compound", () => {
  // 模型別名 ("model alias") contains 型別 across the character boundary, and
  // 基本型別 is the correct rendering of a programming data type.
  const messages = { common: { alias: "模型別名", primitive: "基本型別值" } };
  const { violations } = checkGlossaryConsistency(messages, zhTwGlossary, []);
  assert.deepEqual(violations, []);
});

test("blockedPrefixes still flags the synonym in a genuine UI label", () => {
  const messages = { common: { eventType: "事件型別" } };
  const { violations } = checkGlossaryConsistency(messages, zhTwGlossary, []);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].concept, "type");
  assert.equal(violations[0].canonical, "類型");
});

test("a value mixing a blocked and an unblocked occurrence is still flagged", () => {
  const messages = { common: { mixed: "模型別名與事件型別" } };
  const { violations } = checkGlossaryConsistency(messages, zhTwGlossary, []);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].found, "型別");
});

test("hasUnblockedOccurrence handles a synonym at index 0", () => {
  assert.equal(hasUnblockedOccurrence("型別標籤", "型別", ["模", "本"]), true);
  assert.equal(hasUnblockedOccurrence("模型別名", "型別", ["模", "本"]), false);
  assert.equal(hasUnblockedOccurrence("沒有相關詞", "型別", []), false);
});

test("normalizeLocaleText leaves locales without a glossary untouched", () => {
  assert.equal(normalizeLocaleText("默認", "de"), "默認");
  assert.equal(normalizeLocaleText("默認", ""), "默認");
});

// ---------------------------------------------------------------------------
// Real catalogs: no locale ships a terminology glossary any more, so the gate
// reduces to the protected-term check — every configured translation must keep
// the protected product/config terms verbatim.
// ---------------------------------------------------------------------------

for (const locale of ["tr", "de", "fa"]) {
  test(`real ${locale}.json + real protected terms pass the gate`, () => {
    const realMessages = JSON.parse(
      readFileSync(path.join(ROOT, `src/i18n/messages/${locale}.json`), "utf8")
    );
    const realProtected = JSON.parse(
      readFileSync(path.join(ROOT, "scripts/i18n/glossary/protected-terms.json"), "utf8")
    );
    const emptyGlossary = { version: 1, locale, terms: {} };
    const { violations } = checkGlossaryConsistency(
      realMessages,
      emptyGlossary,
      realProtected.terms
    );
    assert.deepEqual(violations, []);
  });
}
