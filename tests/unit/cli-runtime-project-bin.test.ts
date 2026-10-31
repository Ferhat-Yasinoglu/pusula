/**
 * Project-local `node_modules/.bin` must not leak into CLI detection.
 *
 * `npm run dev` puts `<repo>/node_modules/.bin` on PATH, and the login-shell PATH
 * enrichment inherits it. fumadocs-ui depends on the `cn` class-name helper, which
 * ships a `cn` bin there, so Continue (`cn`) was reported as installed on every
 * npm-started dev server.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { getCliRuntimeStatus, getLookupEnv } =
  await import("../../src/shared/services/cliRuntime.ts");
const { getCachedLoginShellPath, __setLoginShellPathCacheForTests } =
  await import("../../src/shared/services/loginShellPath.ts");

const projectBin = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "pusula-cn-bin-")),
  "node_modules",
  ".bin"
);
fs.mkdirSync(projectBin, { recursive: true });
// Same shape as the fumadocs helper: an executable `cn` that is not Continue.
fs.writeFileSync(path.join(projectBin, "cn"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });

const PATH_SEP = path.delimiter;

describe("project node_modules/.bin on the CLI lookup PATH", () => {
  it("does not report Continue installed when only the project helper `cn` is on PATH", async () => {
    const previousPath = process.env.PATH;
    const previousOverride = process.env.CLI_CONTINUE_BIN;
    const previousLoginShellPath = getCachedLoginShellPath();
    // What `npm run dev` leaves behind: project bin first, then the system dirs.
    const npmRunPath = [projectBin, "/usr/bin", "/bin"].join(PATH_SEP);
    process.env.PATH = npmRunPath;
    delete process.env.CLI_CONTINUE_BIN;
    __setLoginShellPathCacheForTests(npmRunPath);

    try {
      const result = await getCliRuntimeStatus("continue");
      assert.equal(result.installed, false);
      assert.equal(result.reason, "not_found");
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      if (previousOverride === undefined) delete process.env.CLI_CONTINUE_BIN;
      else process.env.CLI_CONTINUE_BIN = previousOverride;
      __setLoginShellPathCacheForTests(previousLoginShellPath);
    }
  });

  it("drops only the project bin from the lookup PATH and keeps the rest", () => {
    const previousPath = process.env.PATH;
    const previousLoginShellPath = getCachedLoginShellPath();
    const npmRunPath = [projectBin, "/usr/bin", "/bin"].join(PATH_SEP);
    process.env.PATH = npmRunPath;
    __setLoginShellPathCacheForTests(npmRunPath);

    try {
      const entries = (getLookupEnv().PATH || "").split(PATH_SEP);
      assert.equal(entries.includes(projectBin), false);
      assert.ok(entries.includes("/usr/bin"));
      assert.ok(entries.includes("/bin"));
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      __setLoginShellPathCacheForTests(previousLoginShellPath);
    }
  });
});
