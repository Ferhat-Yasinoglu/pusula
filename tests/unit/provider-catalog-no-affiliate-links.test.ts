// The retired sponsor program wired affiliate/UTM-tagged URLs into a few static
// catalog `website` fields (Kimi family `?aff=`, Cheaper Inference
// `?utm_source=`). Those providers stay in the catalog as ordinary providers;
// this guard keeps every static catalog URL untagged so the treatment cannot
// creep back in. Radar referral links (D28) are resolved at runtime from
// /api/radar/referrals and never live in the static catalog.
import test from "node:test";
import assert from "node:assert/strict";

const providers = await import("../../src/shared/constants/providers.ts");

const TRACKING_PARAM = /[?&](aff|ref|utm_[a-z]+)=/i;

type CatalogEntry = {
  id?: string;
  website?: string;
  apiHint?: string;
  authHint?: string;
  notice?: { apiKeyUrl?: string; signupUrl?: string };
};

function allCatalogEntries(): CatalogEntry[] {
  return [
    ...Object.values(providers.APIKEY_PROVIDERS),
    ...Object.values(providers.OAUTH_PROVIDERS),
    ...Object.values(providers.WEB_COOKIE_PROVIDERS),
  ] as CatalogEntry[];
}

test("no static catalog website/hint/notice URL carries an affiliate or UTM tracking parameter", () => {
  const entries = allCatalogEntries();
  assert.ok(entries.length > 50, "sanity: the catalogs loaded");
  for (const provider of entries) {
    const fields: Array<[string, string | undefined]> = [
      ["website", provider.website],
      ["apiHint", provider.apiHint],
      ["authHint", provider.authHint],
      ["notice.apiKeyUrl", provider.notice?.apiKeyUrl],
      ["notice.signupUrl", provider.notice?.signupUrl],
    ];
    for (const [field, value] of fields) {
      if (typeof value !== "string") continue;
      assert.doesNotMatch(
        value,
        TRACKING_PARAM,
        `${provider.id}.${field} must not carry an affiliate/UTM tracking parameter`
      );
    }
  }
});

test("former sponsor providers remain in the catalog and link to their plain product pages", () => {
  assert.equal(providers.APIKEY_PROVIDERS.moonshot.website, "https://platform.kimi.ai");
  assert.equal(providers.APIKEY_PROVIDERS.kimi.website, "https://platform.kimi.ai");
  assert.equal(
    providers.APIKEY_PROVIDERS["kimi-coding-apikey"].website,
    "https://www.kimi.ai/code"
  );
  assert.equal(providers.OAUTH_PROVIDERS["kimi-coding"].website, "https://www.kimi.ai/code");
  assert.equal(providers.WEB_COOKIE_PROVIDERS["kimi-web"].website, "https://www.kimi.ai");
  assert.equal(providers.APIKEY_PROVIDERS.cheaperinference.website, "https://cheaperinference.com");
});
