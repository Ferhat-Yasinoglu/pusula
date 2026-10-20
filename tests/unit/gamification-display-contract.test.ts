import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import en from "../../src/i18n/messages/en.json" with { type: "json" };
import tr from "../../src/i18n/messages/tr.json" with { type: "json" };
import de from "../../src/i18n/messages/de.json" with { type: "json" };
import fa from "../../src/i18n/messages/fa.json" with { type: "json" };
import { BUILTIN_BADGES } from "../../src/lib/gamification/badges";

const profileSource = readFileSync("src/app/(dashboard)/dashboard/profile/page.tsx", "utf8");
const tokensSource = readFileSync("src/app/(dashboard)/dashboard/tokens/page.tsx", "utf8");
const topListSource = readFileSync(
  "src/app/(dashboard)/dashboard/costs/components/TopListCard.tsx",
  "utf8"
);
const englishBadges = en.gamification.badges as Record<string, Record<string, string>>;
const translatedBadges: Array<[string, Record<string, Record<string, string>>]> = [
  ["tr", tr.gamification.badges as Record<string, Record<string, string>>],
  ["de", de.gamification.badges as Record<string, Record<string, string>>],
  ["fa", fa.gamification.badges as Record<string, Record<string, string>>],
];

test("every built-in badge has complete English and translated display copy", () => {
  for (const badge of BUILTIN_BADGES) {
    for (const field of ["name", "description", "criteria"] as const) {
      const englishValue = englishBadges[badge.id]?.[field];
      assert.ok(englishValue?.trim(), `en missing gamification.badges.${badge.id}.${field}`);
      for (const [locale, badges] of translatedBadges) {
        const translatedValue = badges[badge.id]?.[field];
        assert.ok(
          translatedValue?.trim(),
          `${locale} missing gamification.badges.${badge.id}.${field}`
        );
      }
    }
  }
});

test("profile renders mapped icons and localized badge criteria", () => {
  assert.match(profileSource, /function BadgeIcon/);
  assert.match(profileSource, /translateBadge\(selectedBadge, "criteria"\)/);
  assert.doesNotMatch(profileSource, /<p className="text-sm">\{selectedBadge\.criteria\}<\/p>/);
});

test("token page no longer contains known raw English controls", () => {
  // Anchor: the page component itself, so the raw-copy guards below cannot pass
  // against a file that was moved, renamed, or split apart.
  assert.match(tokensSource, /export default function TokensPage\(/);
  for (const rawText of [
    "Send Tokens",
    "Create Invite",
    "Connect Server",
    "No servers connected",
    "Last sync:",
    "Disconnect",
  ]) {
    assert.equal(tokensSource.includes(`>${rawText}<`), false, `raw token copy: ${rawText}`);
  }
});

test("cost list component receives its localized legacy-free label", () => {
  assert.match(topListSource, /legacyFreeLabel: string;/);
  assert.match(topListSource, /\{legacyFreeLabel\}/);
});
