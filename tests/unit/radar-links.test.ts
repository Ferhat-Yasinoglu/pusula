/**
 * tests/unit/radar-links.test.ts
 *
 * TDD guard for src/lib/radar/links.ts — the two OPTIONAL outbound "get a
 * supporter key" links (F4/T7): contributor-claim and supporter-plans, both
 * living on the operator's own self-hosted Radar feed server.
 *
 * Radar is self-hosted only, so the module is env-only with NO default:
 * unset => null (the dashboard hides the button), set => the operator's URL.
 * Pure, DB-free module.
 *
 * No price/monetary value assertion lives here on purpose — this module
 * never resolves one (D14: pricing never lives in this repo).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const links = await import("../../src/lib/radar/links.ts");

function clearEnv(): void {
  delete process.env.RADAR_CONTRIBUTOR_CLAIM_URL;
  delete process.env.RADAR_SUPPORTER_PLANS_URL;
}

test.beforeEach(clearEnv);
test.after(clearEnv);

test("getContributorClaimUrl / getSupporterPlansUrl: no default — unset env => null (buttons hidden)", () => {
  assert.equal(links.getContributorClaimUrl(), null);
  assert.equal(links.getSupporterPlansUrl(), null);
});

test("getContributorClaimUrl: honors RADAR_CONTRIBUTOR_CLAIM_URL (operator's self-hosted server)", () => {
  process.env.RADAR_CONTRIBUTOR_CLAIM_URL = "https://radar.example.com/auth/github";
  assert.equal(links.getContributorClaimUrl(), "https://radar.example.com/auth/github");
  assert.equal(links.getSupporterPlansUrl(), null, "the other link stays hidden independently");
});

test("getSupporterPlansUrl: honors RADAR_SUPPORTER_PLANS_URL (operator's self-hosted server)", () => {
  process.env.RADAR_SUPPORTER_PLANS_URL = "https://radar.example.com/plans";
  assert.equal(links.getSupporterPlansUrl(), "https://radar.example.com/plans");
  assert.equal(links.getContributorClaimUrl(), null, "the other link stays hidden independently");
});

test("getContributorClaimUrl / getSupporterPlansUrl: empty or whitespace-only env => null, never a blank link", () => {
  process.env.RADAR_CONTRIBUTOR_CLAIM_URL = "";
  process.env.RADAR_SUPPORTER_PLANS_URL = "   ";
  assert.equal(links.getContributorClaimUrl(), null);
  assert.equal(links.getSupporterPlansUrl(), null);
});

test("getContributorClaimUrl / getSupporterPlansUrl: surrounding whitespace is trimmed", () => {
  process.env.RADAR_CONTRIBUTOR_CLAIM_URL = "  https://radar.example.com/auth/github  ";
  process.env.RADAR_SUPPORTER_PLANS_URL = " http://radar.internal.example.com:8080/plans ";
  assert.equal(links.getContributorClaimUrl(), "https://radar.example.com/auth/github");
  assert.equal(links.getSupporterPlansUrl(), "http://radar.internal.example.com:8080/plans");
});

test("getContributorClaimUrl / getSupporterPlansUrl: relative or non-http(s) values => null (never rendered as an href)", () => {
  for (const value of [
    "/auth/github",
    "radar.example.com/plans",
    "javascript:alert(1)",
    "ftp://radar.example.com",
  ]) {
    process.env.RADAR_CONTRIBUTOR_CLAIM_URL = value;
    process.env.RADAR_SUPPORTER_PLANS_URL = value;
    assert.equal(links.getContributorClaimUrl(), null, `claim: ${value}`);
    assert.equal(links.getSupporterPlansUrl(), null, `plans: ${value}`);
  }
});

test("getRadarAdminUrl: still default-free and independent of the two supporter links", () => {
  process.env.RADAR_CONTRIBUTOR_CLAIM_URL = "https://radar.example.com/auth/github";
  process.env.RADAR_SUPPORTER_PLANS_URL = "https://radar.example.com/plans";
  const saved = process.env.RADAR_ADMIN_URL;
  delete process.env.RADAR_ADMIN_URL;
  try {
    assert.equal(links.getRadarAdminUrl(), null);
  } finally {
    if (saved !== undefined) process.env.RADAR_ADMIN_URL = saved;
  }
});

test("links.ts embeds no URL literal — there is no upstream host to fall back to", async () => {
  const source = await readFile(new URL("../../src/lib/radar/links.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/i);
  assert.doesNotMatch(source, /DEFAULT_(CONTRIBUTOR_CLAIM|SUPPORTER_PLANS)_URL/);
});
