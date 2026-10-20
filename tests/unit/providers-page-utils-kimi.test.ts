// Kimi/Moonshot providers on /dashboard/providers — ordinary-provider guards.
//
// The retired sponsor program pinned the Kimi family (and Cheaper Inference)
// first within every category grid. That treatment is gone: category grids are
// sorted purely by `sortProviderEntriesByName` and no provider id is ranked.
// These tests prove the ordering is alphabetical against both synthetic entries
// and the REAL catalog, and keep the unrelated hiddenFromDashboard invariant
// (kimi-coding-apikey / kimi never render their own card).
import test from "node:test";
import assert from "node:assert/strict";

const providerPageUtils =
  await import("../../src/app/(dashboard)/dashboard/providers/providerPageUtils.ts");

const entry = (providerId: string, name: string) => ({
  providerId,
  provider: { id: providerId, name },
  stats: { total: 0 },
  displayAuthType: "apikey" as const,
  toggleAuthType: "apikey" as const,
});

test("filterConfiguredProviderEntries sorts former sponsor providers alphabetically — no pin", () => {
  // Seeded so a pin would be visible: "Acme" and "Anthropic Clone" sort before
  // "Cheaper Inference" and "Kimi"; a pinned grid would move the latter up.
  const entries = [
    entry("zulu-provider", "Zulu Provider"),
    entry("moonshot", "Kimi"),
    entry("cheaperinference", "Cheaper Inference"),
    entry("acme", "Acme"),
    entry("kimi-web", "Kimi Web"),
    entry("anthropic-clone", "Anthropic Clone"),
    entry("kimi-coding", "Kimi Code CLI"),
  ];

  // No filters applied (showConfiguredOnly=false) — pure ordering behavior.
  const visible = providerPageUtils.filterConfiguredProviderEntries(entries, false);
  assert.deepEqual(
    visible.map((e) => e.providerId),
    [
      "acme",
      "anthropic-clone",
      "cheaperinference",
      "moonshot",
      "kimi-coding",
      "kimi-web",
      "zulu-provider",
    ],
    "every provider sorts by display name — nobody is pinned above the alphabet"
  );
  assert.deepEqual(
    visible.map((e) => e.providerId),
    providerPageUtils.sortProviderEntriesByName(entries).map((e) => e.providerId)
  );
});

test("filterConfiguredProviderEntries keeps a mixed oauth-shaped category alphabetical", () => {
  const entries = [
    { providerId: "claude", provider: { name: "Claude" }, stats: { total: 1 }, displayAuthType: "oauth", toggleAuthType: "oauth" },
    { providerId: "kimi-coding", provider: { name: "Kimi Code CLI" }, stats: { total: 0 }, displayAuthType: "oauth", toggleAuthType: "oauth" },
    { providerId: "amazon-q", provider: { name: "Amazon Q" }, stats: { total: 0 }, displayAuthType: "oauth", toggleAuthType: "oauth" },
  ];

  const visible = providerPageUtils.filterConfiguredProviderEntries(entries, false);
  assert.deepEqual(visible.map((e) => e.providerId), ["amazon-q", "claude", "kimi-coding"]);
});

// ── Section-scoped proof against the REAL catalog (not synthetic mocks) ───────
// page.tsx builds each dashboard section as
// buildStaticProviderEntries(category) -> filterConfiguredProviderEntries(...).
// Replicate that exact call chain for the three sections that render a
// Kimi-family card (OAuth: kimi-coding, Web Cookie: kimi-web, API Key: moonshot)
// and prove each grid is exactly the alphabetical order — no sponsor rail.

test("real OAuth / Web Cookie / API Key grids are purely alphabetical (no pinned providers)", () => {
  const getProviderStats = () => ({ total: 0 });
  for (const category of ["oauth", "web-cookie", "apikey"] as const) {
    const all = providerPageUtils.buildStaticProviderEntries(category, getProviderStats);
    const visible = providerPageUtils.filterConfiguredProviderEntries(all, false);

    assert.ok(visible.length > 5, `sanity: the real ${category} section has many providers`);
    assert.deepEqual(
      visible.map((e) => e.providerId),
      providerPageUtils.sortProviderEntriesByName(all).map((e) => e.providerId),
      `${category} grid must equal sortProviderEntriesByName — no provider is pinned`
    );
  }
});

test("kimi-coding-apikey and kimi never render as their own dashboard card in ANY section (hiddenFromDashboard)", () => {
  const getProviderStats = () => ({ total: 0 });
  const categories = [
    "no-auth",
    "oauth",
    "web-cookie",
    "local",
    "search",
    "audio",
    "upstream-proxy",
    "apikey",
    "cloud-agent",
  ] as const;

  for (const category of categories) {
    const entries = providerPageUtils.buildStaticProviderEntries(category, getProviderStats);
    assert.equal(
      entries.some((e) => e.providerId === "kimi-coding-apikey"),
      false,
      `kimi-coding-apikey must not appear as its own card in the "${category}" category`
    );
    assert.equal(
      entries.some((e) => e.providerId === "kimi"),
      false,
      `kimi (legacy alias) must not appear as its own card in the "${category}" category`
    );
  }
});
