import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error — plain .mjs gate script, no type declarations by design
import { resolvePreviousVersion } from "../../scripts/check/check-install-upgrade.mjs";

/**
 * The upgrade phase installs the PREVIOUS published `pusula` and upgrades it in place.
 * On the very first publish there is no previous version: `npm view pusula` answers E404,
 * and the gate used to crash on it ("[install-upgrade] crashed: Command failed: npm view
 * pusula dist-tags.latest"), which blocked the first npm release of the package.
 */

function npmError(stderr: string) {
  const err = new Error("Command failed: npm view pusula dist-tags.latest") as Error & {
    stderr: string;
  };
  err.stderr = stderr;
  return err;
}

const notPublished = () => {
  throw npmError(
    "npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/pusula - Not found\n"
  );
};

test("first publish: package not on npm yet -> no previous version (phase B is skipped)", () => {
  assert.equal(resolvePreviousVersion("1.0.0", null, notPublished), null);
});

test("an explicit --from wins without asking npm", () => {
  assert.equal(resolvePreviousVersion("1.0.1", "0.9.0", notPublished), "0.9.0");
});

test("latest differs from the version under test -> latest is the previous version", () => {
  const view = (fields: string[]) => {
    assert.deepEqual(fields, ["dist-tags.latest"]);
    return "1.0.0\n";
  };
  assert.equal(resolvePreviousVersion("1.0.1", null, view), "1.0.0");
});

test("re-run of the published latest -> highest stable version below it", () => {
  const view = (fields: string[]) =>
    fields[0] === "dist-tags.latest"
      ? "1.2.0\n"
      : JSON.stringify(["1.0.0", "1.1.0-rc.1", "1.1.0", "1.2.0"]);
  assert.equal(resolvePreviousVersion("1.2.0", null, view), "1.1.0");
});

test("re-run when the only published version is the one under test -> no previous version", () => {
  // npm prints a bare JSON string, not an array, when a package has a single version.
  const view = (fields: string[]) =>
    fields[0] === "dist-tags.latest" ? "1.0.0\n" : JSON.stringify("1.0.0");
  assert.equal(resolvePreviousVersion("1.0.0", null, view), null);
});

test("any other npm failure still fails the gate", () => {
  const offline = () => {
    throw npmError("npm error code ENOTFOUND\nnpm error network request failed\n");
  };
  assert.throws(() => resolvePreviousVersion("1.0.0", null, offline), /npm view/);
});
