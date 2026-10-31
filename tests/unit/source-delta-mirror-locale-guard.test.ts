import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertMirrorRepairRejectsUnsafeLocale } from "../_helpers/mirrorRepairLocaleGuard.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("source-delta mirror repair rejects a locale traversal before opening any target", async () => {
  const relativeSource = "docs/reference/ENVIRONMENT.md";
  const current = fs.readFileSync(path.join(root, relativeSource), "utf8");
  const names = [
    "PUSULA_NO_UPDATE_NOTIFIER",
    "PUSULA_DOCTOR_LIVENESS_URL",
    "PUSULA_PROVIDER_CATALOG_PATH",
    "PUSULA_PROVIDER_TEST_MODEL",
  ];
  const previous = current
    .split("\n")
    .filter((line) => !names.some((name) => line.startsWith("| `" + name + "`")))
    .map((line) => (line === "lastUpdated: 2026-10-11" ? "lastUpdated: 2026-10-05" : line))
    .join("\n");
  await assertMirrorRepairRejectsUnsafeLocale({
    script: path.join(root, "scripts/ad-hoc/relay-source-delta-mirrors-20261013.mjs"),
    relativeSource,
    previous,
    current,
  });
});
