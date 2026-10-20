import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);

test("news.json ships an empty v2 feed: no upstream announcements, no outbound links, no commercial details", async () => {
  const source = await readFile(new URL("news.json", root), "utf8");
  const payload = JSON.parse(source);

  // Shape the dashboard parser expects (`parseNewsPayload()` closed v2 schema).
  assert.deepEqual(Object.keys(payload).sort(), ["items", "schemaVersion"]);
  assert.equal(payload.schemaVersion, 2);
  assert.deepEqual(payload.items, []);

  // The previous maintainer's Radar/launch announcements are gone for good:
  // nothing in the shipped file points anywhere or sells anything.
  assert.doesNotMatch(source, /https?:\/\//);
  assert.doesNotMatch(source, /radar|planos|plans/i);
  assert.doesNotMatch(source, /R\$|US\$|coupon|cupom|discount|desconto/i);

  // And the shipped file is accepted by the real parser as "nothing to show".
  const releaseNotes = await import("../../src/shared/utils/releaseNotes.ts");
  assert.deepEqual(releaseNotes.parseNewsPayload(payload), []);
  assert.deepEqual(releaseNotes.listActiveNews(payload, "en", new Date()), []);
});

test("a self-hosted Radar announcement still fits the v2 contract (operators may add their own)", async () => {
  const releaseNotes = await import("../../src/shared/utils/releaseNotes.ts");
  const item = {
    id: "radar-self-hosted-2026-10",
    active: false,
    publishedAt: "2026-10-01T00:00:00.000Z",
    text: {
      en: {
        title: "Radar",
        message: "An opt-in, GET-only free-model catalog overlay with no telemetry.",
        linkLabel: "Learn about Radar",
      },
    },
    link: "https://radar.example.com/docs",
    icon: "radar",
  };
  assert.deepEqual(releaseNotes.parseNewsPayload({ schemaVersion: 2, items: [item] }), [item]);
  assert.match(item.text.en.message, /opt-in/i);
  assert.match(item.text.en.message, /GET-only/i);
  assert.match(item.text.en.message, /no telemetry/i);
});

test("the generic banner is ID-dismissable and independent from the Radar feature flag", async () => {
  const source = await readFile(
    new URL("src/app/(dashboard)/dashboard/NewsBanner.tsx", root),
    "utf8"
  );

  assert.match(source, /selectActiveNews/);
  assert.match(source, /parseDismissedNewsIds/);
  assert.match(source, /localStorage/);
  assert.match(source, /announcement\.id/);
  assert.doesNotMatch(source, /RADAR_ENABLED/);
  assert.doesNotMatch(source, /method:\s*["']POST["']/);
});
