import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tr = require("../../src/i18n/messages/tr.json");
const en = require("../../src/i18n/messages/en.json");

// ─── TR namespace presence ────────────────────────────────────────────────────

test("tr has cliCommon namespace", () => {
  assert.ok(tr.cliCommon, "expected tr.json to have 'cliCommon' namespace");
});

test("tr has cliCode namespace", () => {
  assert.ok(tr.cliCode, "expected tr.json to have 'cliCode' namespace");
});

test("tr has cliAgents namespace", () => {
  assert.ok(tr.cliAgents, "expected tr.json to have 'cliAgents' namespace");
});

test("tr has acpAgents namespace", () => {
  assert.ok(tr.acpAgents, "expected tr.json to have 'acpAgents' namespace");
});

// ─── TR page titles ───────────────────────────────────────────────────────────
// PR-4 retranslated the verbatim-English page titles; tr now carries real Turkish.

test("tr cliCode.pageTitle is 'CLI Kodları'", () => {
  assert.equal(tr.cliCode.pageTitle, "CLI Kodları");
});

test("tr cliAgents.pageTitle is 'CLI Ajanları'", () => {
  assert.equal(tr.cliAgents.pageTitle, "CLI Ajanları");
});

test("tr acpAgents.pageTitle is 'ACP Ajanları'", () => {
  assert.equal(tr.acpAgents.pageTitle, "ACP Ajanları");
});

// ─── TR cliCommon content ─────────────────────────────────────────────────────

test("tr cliCommon.concept.code.phrase contains 'kod'", () => {
  assert.ok(
    typeof tr.cliCommon.concept?.code?.phrase === "string" &&
      tr.cliCommon.concept.code.phrase.includes("kod"),
    `expected cliCommon.concept.code.phrase to contain 'kod', got: ${tr.cliCommon.concept?.code?.phrase}`
  );
});

test("tr cliCommon.comparison.title is non-empty string", () => {
  assert.ok(
    typeof tr.cliCommon.comparison?.title === "string" && tr.cliCommon.comparison.title.length > 0
  );
});

// ─── TR sidebar keys ──────────────────────────────────────────────────────────

test("tr sidebar has cliCode key", () => {
  assert.ok(tr.sidebar?.cliCode, "expected tr sidebar to have 'cliCode' key");
});

test("tr sidebar has cliAgents key", () => {
  assert.ok(tr.sidebar?.cliAgents, "expected tr sidebar to have 'cliAgents' key");
});

test("tr sidebar has acpAgents key", () => {
  assert.ok(tr.sidebar?.acpAgents, "expected tr sidebar to have 'acpAgents' key");
});

// ─── EN namespace presence ────────────────────────────────────────────────────

test("en has cliCommon namespace", () => {
  assert.ok(en.cliCommon, "expected en.json to have 'cliCommon' namespace");
});

test("en has cliCode namespace", () => {
  assert.ok(en.cliCode, "expected en.json to have 'cliCode' namespace");
});

test("en has cliAgents namespace", () => {
  assert.ok(en.cliAgents, "expected en.json to have 'cliAgents' namespace");
});

test("en has acpAgents namespace", () => {
  assert.ok(en.acpAgents, "expected en.json to have 'acpAgents' namespace");
});

// ─── EN page titles ───────────────────────────────────────────────────────────

test("en cliCode.pageTitle is 'CLI Code's'", () => {
  assert.equal(en.cliCode.pageTitle, "CLI Code's");
});

test("en cliAgents.pageTitle is 'CLI Agents'", () => {
  assert.equal(en.cliAgents.pageTitle, "CLI Agents");
});

test("en cliAgents.pageTitle is 'ACP Agents'", () => {
  assert.equal(en.acpAgents.pageTitle, "ACP Agents");
});

// ─── EN cliCommon content ─────────────────────────────────────────────────────

test("en cliCommon.concept.code.phrase is a non-empty string", () => {
  assert.ok(
    typeof en.cliCommon.concept?.code?.phrase === "string" &&
      en.cliCommon.concept.code.phrase.length > 0
  );
});

// ─── EN sidebar keys ──────────────────────────────────────────────────────────

test("en sidebar has cliCode key", () => {
  assert.ok(en.sidebar?.cliCode, "expected en sidebar to have 'cliCode' key");
});

test("en sidebar has cliAgents key", () => {
  assert.ok(en.sidebar?.cliAgents, "expected en sidebar to have 'cliAgents' key");
});

test("en sidebar has acpAgents key", () => {
  assert.ok(en.sidebar?.acpAgents, "expected en sidebar to have 'acpAgents' key");
});
