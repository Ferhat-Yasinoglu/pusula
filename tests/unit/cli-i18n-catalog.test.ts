import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const require = createRequire(import.meta.url);
const en = require("../../bin/cli/locales/en.json");
const tr = require("../../bin/cli/locales/tr.json");
const de = require("../../bin/cli/locales/de.json");
const fa = require("../../bin/cli/locales/fa.json");

function flattenKeys(obj: Record<string, unknown>, prefix = ""): Set<string> {
  const keys = new Set<string>();
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      for (const sub of flattenKeys(v as Record<string, unknown>, full)) keys.add(sub);
    } else {
      keys.add(full);
    }
  }
  return keys;
}

function walkMjs(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkMjs(full));
    } else if (entry.endsWith(".mjs") || entry.endsWith(".js")) {
      results.push(full);
    }
  }
  return results;
}

const IMPORT_PATH_RE = /^(\.\.?\/|node:|\/)/;
const IGNORE_AS_KEY = new Set([".", ".."]);

function collectTKeys(files: string[]): Set<string> {
  const used = new Set<string>();
  const re = /\bt\(\s*["']([^"']+)["']/g;
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const key = m[1];
      if (IGNORE_AS_KEY.has(key) || IMPORT_PATH_RE.test(key)) continue;
      used.add(key);
    }
  }
  return used;
}

const commandFiles = walkMjs(join(ROOT, "bin", "cli", "commands"));
const usedKeys = collectTKeys(commandFiles);
const enKeys = flattenKeys(en as Record<string, unknown>);

test("en.json contém todas as chaves usadas via t() nos comandos", () => {
  const missing = [...usedKeys].filter((k) => !enKeys.has(k));
  assert.deepEqual(missing, [], `Chaves faltando em en.json: ${missing.join(", ")}`);
});

test("tr.json tem todas as seções top-level de en.json", () => {
  const enTop = Object.keys(en as object);
  const trTop = new Set(Object.keys(tr as object));
  const missing = enTop.filter((k) => !trTop.has(k));
  assert.deepEqual(missing, [], `Seções top-level faltando em tr.json: ${missing.join(", ")}`);
});

for (const [name, cat] of [
  ["tr", tr],
  ["de", de],
  ["fa", fa],
] as const) {
  test(name + ".json tem paridade total de chaves com en.json", () => {
    const catKeys = flattenKeys(cat as Record<string, unknown>);
    const missing = [...enKeys].filter((k) => !catKeys.has(k));
    assert.deepEqual(missing, [], name + ".json chaves faltando: " + missing.join(", "));
  });
}

test("i18n.mjs detecta locale por PUSULA_LANG", async () => {
  const { resetForTests, detectLocale } = await import("../../bin/cli/i18n.mjs");
  const orig = process.env.PUSULA_LANG;
  process.env.PUSULA_LANG = "tr";
  resetForTests();
  const locale = detectLocale();
  assert.equal(locale, "tr");
  if (orig === undefined) delete process.env.PUSULA_LANG;
  else process.env.PUSULA_LANG = orig;
  resetForTests();
});

test("i18n.mjs usa fallback en quando locale não existe", async () => {
  const { resetForTests, detectLocale } = await import("../../bin/cli/i18n.mjs");
  const orig = process.env.PUSULA_LANG;
  process.env.PUSULA_LANG = "xx-FAKE";
  resetForTests();
  const locale = detectLocale();
  assert.equal(locale, "en");
  if (orig === undefined) delete process.env.PUSULA_LANG;
  else process.env.PUSULA_LANG = orig;
  resetForTests();
});

test("i18n.mjs canonicaliza tags POSIX/regionais e maiúsculas para o catálogo base: tr_TR.UTF-8 → tr, de-AT → de, fa_IR → fa, TR → tr", async () => {
  const { resetForTests, detectLocale } = await import("../../bin/cli/i18n.mjs");
  const orig = process.env.PUSULA_LANG;
  const cases: Array<[string, string]> = [
    ["tr_TR.UTF-8", "tr"], // POSIX form: charset stripped, _ → -, then base language catalog
    ["de-AT", "de"], // regional tag with no dedicated catalog → base language catalog
    ["fa_IR", "fa"], // underscore form of a regional tag
    ["TR", "tr"], // upper-case input canonicalized through the config code map
    ["De", "de"], // mixed-case input canonicalized through the config code map
  ];
  for (const [input, expected] of cases) {
    process.env.PUSULA_LANG = input;
    resetForTests();
    assert.equal(detectLocale(), expected, `PUSULA_LANG=${input}`);
  }
  if (orig === undefined) delete process.env.PUSULA_LANG;
  else process.env.PUSULA_LANG = orig;
  resetForTests();
});

test("t() interpola variáveis {var}", async () => {
  const { resetForTests, t, setLocale } = await import("../../bin/cli/i18n.mjs");
  resetForTests();
  setLocale("en");
  const result = t("health.status", { status: "OK" });
  assert.equal(result, "Status: OK");
  resetForTests();
});

test("t() retorna a chave quando não existe no catálogo", async () => {
  const { resetForTests, t, setLocale } = await import("../../bin/cli/i18n.mjs");
  resetForTests();
  setLocale("en");
  const result = t("does.not.exist.at.all");
  assert.equal(result, "does.not.exist.at.all");
  resetForTests();
});

test("t() usa tr quando disponível", async () => {
  const { resetForTests, t, setLocale } = await import("../../bin/cli/i18n.mjs");
  resetForTests();
  setLocale("tr");
  const result = t("health.noServer");
  assert.ok(result.includes("pusula serve"), `Esperava mensagem tr, obteve: ${result}`);
  assert.notEqual(result, en.health.noServer, "a mensagem tr deve diferir da inglesa");
  resetForTests();
});
