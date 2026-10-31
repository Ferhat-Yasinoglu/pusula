import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

test("both observers retain incremental command logs even on failure", () => {
  const workflow = parse(
    readFileSync(
      new URL("../../../.github/workflows/nightly-release-green.yml", import.meta.url),
      "utf8"
    )
  );
  for (const id of ["release-green", "main-green"]) {
    const upload = workflow.jobs[id].steps.find(
      (step: { name?: string }) => step.name === "Upload report artifact"
    );
    // Pusula is main-only: with no release/v* branch the resolver sets skip=true and there is
    // nothing to upload, so `if-no-files-found: error` must not run on that skip.
    assert.match(upload.if, /^always\(\)( && steps\.branch\.outputs\.skip != 'true')?$/);
    assert.match(upload.with.path, /_artifacts\/release-green\//);
    assert.equal(upload.with["if-no-files-found"], "error");
    assert.equal(upload.with["retention-days"], 14);
  }
});
