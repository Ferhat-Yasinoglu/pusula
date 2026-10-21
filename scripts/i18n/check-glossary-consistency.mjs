#!/usr/bin/env node
/**
 * Pusula — terminology glossary / protected-term consistency gate.
 *
 * Complements the existing parity (check-ui-keys-coverage.mjs) and ICU
 * (validate_translation.py) checks with a native-quality layer:
 *   - glossary-synonym: a value uses a non-canonical synonym for a concept
 *     that has an actively-normalized canonical rendering
 *     (scripts/i18n/glossary/<locale>.json).
 *   - protected-term-altered: a value renders a protected product/provider/
 *     protocol/CLI/env identifier (scripts/i18n/glossary/protected-terms.json)
 *     using a known incorrect translation instead of leaving it verbatim.
 *     Known incorrect renderings come from the legacy KNOWN_MISTRANSLATIONS
 *     map below (zh-CN) merged with the optional per-locale
 *     `protectedTermMistranslations` object in the locale's glossary file (ko).
 *
 * Usage:
 *   node scripts/i18n/check-glossary-consistency.mjs                 # every locale in config/i18n.json, exit 1 on drift
 *   node scripts/i18n/check-glossary-consistency.mjs --locale=tr
 *   node scripts/i18n/check-glossary-consistency.mjs --json
 *   node scripts/i18n/check-glossary-consistency.mjs --report        # print, always exit 0
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hasUnblockedOccurrence } from "./glossary-normalize.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const MESSAGES_DIR = path.join(ROOT, "src", "i18n", "messages");
const GLOSSARY_DIR = path.join(SCRIPT_DIR, "glossary");
const LOG_PREFIX = "[i18n-glossary]";

// Legacy zh-CN map of known incorrect renderings for protected terms — newer
// locales (ko) keep theirs in `protectedTermMistranslations` inside their
// scripts/i18n/glossary/<locale>.json instead of growing this constant.
// Small, maintained map of known incorrect renderings for protected terms —
// identifiers that must survive translation verbatim. NOT exhaustive by
// design (a full back-translation model is out of scope for a static gate),
// and deliberately conservative: an entry is only added once we've verified
// it doesn't collide with a legitimate, unrelated use of the same Chinese
// phrase elsewhere in the real catalog (e.g. a generic word for
// "authorization" is NOT a safe proxy for "OAuth was translated instead of
// left verbatim" — it fires on every unrelated auth string). Extend as new,
// non-colliding mistranslations are discovered in native review.
const KNOWN_MISTRANSLATIONS = {
  DATA_DIR: ["数据目录"],
};

function logInfo(...parts) {
  console.log(LOG_PREFIX, ...parts);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function collectLeaves(obj, prefix = []) {
  const leaves = [];
  for (const [key, value] of Object.entries(obj)) {
    const next = [...prefix, key];
    if (isPlainObject(value)) {
      leaves.push(...collectLeaves(value, next));
    } else if (typeof value === "string") {
      leaves.push({ path: next.join("."), value });
    }
  }
  return leaves;
}

/**
 * Pure consistency check — no I/O. Mirrors evaluateFileSizes' split in
 * check-file-size.mjs (pure fn + separate CLI wrapper).
 *
 * @param {object} localeMessages - parsed src/i18n/messages/<locale>.json
 * @param {object} glossary - parsed scripts/i18n/glossary/<locale>.json
 * @param {string[]} protectedTerms - flat list from protected-terms.json
 * @returns {{violations: Array<object>}}
 */
export function checkGlossaryConsistency(localeMessages, glossary, protectedTerms) {
  const violations = [];
  const leaves = collectLeaves(localeMessages || {});

  const terms = glossary && glossary.terms ? glossary.terms : {};
  for (const [concept, def] of Object.entries(terms)) {
    const synonyms = Array.isArray(def.synonyms) ? def.synonyms : [];
    const blockedPrefixes = Array.isArray(def.blockedPrefixes) ? def.blockedPrefixes : [];
    for (const synonym of synonyms) {
      if (!synonym) continue;
      for (const leaf of leaves) {
        if (hasUnblockedOccurrence(leaf.value, synonym, blockedPrefixes)) {
          violations.push({
            type: "glossary-synonym",
            concept,
            path: leaf.path,
            found: synonym,
            canonical: def.canonical,
          });
        }
      }
    }
  }

  const localeMistranslations = isPlainObject(glossary?.protectedTermMistranslations)
    ? glossary.protectedTermMistranslations
    : {};
  const protectedList = Array.isArray(protectedTerms) ? protectedTerms : [];
  for (const term of protectedList) {
    const fromGlossary = Array.isArray(localeMistranslations[term])
      ? localeMistranslations[term]
      : [];
    const badRenderings = [...(KNOWN_MISTRANSLATIONS[term] || []), ...fromGlossary];
    if (badRenderings.length === 0) continue;
    for (const bad of badRenderings) {
      for (const leaf of leaves) {
        if (leaf.value.includes(bad)) {
          violations.push({
            type: "protected-term-altered",
            term,
            path: leaf.path,
            found: bad,
          });
        }
      }
    }
  }

  return { violations };
}

function parseArgs(argv) {
  const opts = { locale: null, json: false, report: false };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--locale=")) {
      opts.locale = arg.slice(9);
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--report") {
      opts.report = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: node scripts/i18n/check-glossary-consistency.mjs [options]",
          "",
          "  --locale=<code>   Locale to check (default: every locale in config/i18n.json except the source)",
          "  --json            Emit JSON report to stdout",
          "  --report          Print violations, exit 0 regardless",
        ].join("\n")
      );
      process.exit(0);
    }
  }
  return opts;
}

async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function configuredLocales() {
  const config = await loadJson(path.join(ROOT, "config", "i18n.json"));
  const source = config.default || "en";
  return (config.locales || []).map((l) => l.code).filter((code) => code && code !== source);
}

// A locale without scripts/i18n/glossary/<locale>.json has no canonical-term layer yet; the
// gate then reduces to the protected-term check, which applies to every locale.
async function loadGlossary(locale) {
  const glossaryPath = path.join(GLOSSARY_DIR, `${locale}.json`);
  try {
    return await loadJson(glossaryPath);
  } catch (err) {
    if (err?.code === "ENOENT") return { version: 1, locale, terms: {} };
    throw err;
  }
}

async function checkLocale(locale, protectedTerms) {
  const messages = await loadJson(path.join(MESSAGES_DIR, `${locale}.json`));
  const glossary = await loadGlossary(locale);
  return checkGlossaryConsistency(messages, glossary, protectedTerms).violations;
}

async function main() {
  const opts = parseArgs(process.argv);
  const locales = opts.locale ? [opts.locale] : await configuredLocales();

  const protectedData = await loadJson(path.join(GLOSSARY_DIR, "protected-terms.json"));
  const protectedTerms = Array.isArray(protectedData.terms) ? protectedData.terms : [];

  const reports = [];
  for (const locale of locales) {
    reports.push({ locale, violations: await checkLocale(locale, protectedTerms) });
  }
  const failed = reports.filter((r) => r.violations.length > 0);

  if (opts.json) {
    const payload = reports.map((r) => ({
      locale: r.locale,
      ok: r.violations.length === 0,
      violations: r.violations,
    }));
    process.stdout.write(
      JSON.stringify(payload.length === 1 ? payload[0] : payload, null, 2) + "\n"
    );
    if (failed.length && !opts.report) process.exit(1);
    return;
  }

  for (const { locale, violations } of reports) {
    if (violations.length === 0) {
      logInfo(`PASS — ${locale} has no glossary/protected-term drift.`);
      continue;
    }
    logInfo(`FAIL — ${violations.length} violation(s) in ${locale}.`);
    for (const v of violations.slice(0, 50)) {
      if (v.type === "glossary-synonym") {
        console.log(
          `  - [${v.concept}] ${v.path}: found "${v.found}", canonical is "${v.canonical}"`
        );
      } else {
        console.log(`  - [protected-term] ${v.path}: "${v.term}" rendered as "${v.found}"`);
      }
    }
    if (violations.length > 50) {
      console.log(`  ... and ${violations.length - 50} more`);
    }
  }
  if (failed.length && !opts.report) process.exit(1);
}

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((err) => {
    console.error(LOG_PREFIX, "ERROR", err?.stack || err?.message || String(err));
    process.exit(1);
  });
}
