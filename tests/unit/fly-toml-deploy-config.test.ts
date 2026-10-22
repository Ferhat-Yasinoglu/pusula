/**
 * The shipped `fly.toml` must boot the image it builds: the process command has
 * to point at a file the standalone build actually ships, the build target has
 * to be a real Dockerfile stage, and DATA_DIR has to live on the Fly Volume.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

function read(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), "utf-8");
}

const flyToml = read("fly.toml");

test("fly.toml process command points at the run-standalone script the image ships", () => {
  const match = flyToml.match(/^\s*app\s*=\s*'node ([^']+)'\s*$/m);
  assert.ok(match, "fly.toml [processes] must define an `app = 'node <script>'` command");
  // assembleStandalone copies scripts/dev/run-standalone.mjs to <standalone>/dev/.
  assert.equal(match[1], "dev/run-standalone.mjs");
  assert.ok(existsSync(path.join(ROOT, "scripts", match[1])));
  assert.match(read("Dockerfile"), /^CMD \["node", "dev\/run-standalone\.mjs"\]$/m);
});

test("fly.toml build-target is an existing Dockerfile stage", () => {
  const match = flyToml.match(/^\s*build-target\s*=\s*'([^']+)'\s*$/m);
  assert.ok(match, "fly.toml [build] must pin a build-target");
  assert.match(read("Dockerfile"), new RegExp(`^FROM \\S+ AS ${match[1]}$`, "m"));
});

test("fly.toml DATA_DIR matches the persistent volume mount", () => {
  const mount = flyToml.match(/^\s*destination\s*=\s*'([^']+)'\s*$/m);
  assert.ok(mount, "fly.toml must mount a volume");
  assert.match(flyToml, new RegExp(`^\\s*DATA_DIR\\s*=\\s*"${mount[1]}"\\s*$`, "m"));
});
