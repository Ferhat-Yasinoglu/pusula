import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");
const sourcePath = "docs/guides/REMOTE-MODE.md";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
// Pusula ships only the doc mirrors present under docs/i18n/ (de, fa, tr — not upstream's 66).
// Derive the expected locale set from the mirror directories on disk so a missing or extra
// state entry still fails, without pinning upstream's mirror count.
const mirrorLocales = readdirSync(resolve(root, "docs/i18n"), { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name)
  .sort();
const sourceHash = hash(readFileSync(resolve(root, sourcePath), "utf8"));
const state = JSON.parse(readFileSync(resolve(root, ".i18n-state.json"), "utf8")) as {
  sources: Record<
    string,
    {
      source_hash: string;
      locales: Record<string, { source_hash: string; target_hash: string }>;
    }
  >;
};
const entry = state.sources[sourcePath];

test("remote token privilege guidance is translated, not only marked current", () => {
  assert.ok(mirrorLocales.length > 0, "expected at least one docs/i18n mirror directory");
  assert.deepEqual(Object.keys(entry.locales).sort(), mirrorLocales);
  assert.equal(entry.source_hash, sourceHash);
  for (const [locale, info] of Object.entries(entry.locales)) {
    const text = readFileSync(resolve(root, "docs/i18n", locale, sourcePath), "utf8");
    const start = text.indexOf("pusula tokens scopes");
    const end = text.indexOf("\n---\n", start);
    assert(start > 0 && end > start, `token management boundary: ${locale}`);
    const section = text.slice(start, end);
    for (const literal of [
      "pusula connect",
      "manage",
      "admin",
      "write",
      "read",
      "--scope admin",
      "403",
    ]) {
      assert(section.includes("`" + literal + "`"), `missing ${literal}: ${locale}`);
    }
    assert(!section.includes("A token can never be minted"), `English fallback: ${locale}`);
    assert.equal(info.source_hash, sourceHash, `stale source hash: ${locale}`);
    assert.equal(info.target_hash, hash(text), `stale target hash: ${locale}`);
  }
});
