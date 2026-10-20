/**
 * #10353 — warn when PUSULA_MEMORY_MB disagrees with NODE_OPTIONS heap.
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
  parseNodeOptionsHeapMb,
  envHasExplicitPusulaMemoryMb,
  warnConflictingHeapLimits,
  buildStandaloneNodeOptions,
} = await import("../../scripts/build/runtime-env.mjs");

test("parseNodeOptionsHeapMb reads the last heap flag", () => {
  assert.equal(parseNodeOptionsHeapMb(""), null);
  assert.equal(parseNodeOptionsHeapMb("--enable-source-maps"), null);
  assert.equal(parseNodeOptionsHeapMb("--max-old-space-size=512"), 512);
  assert.equal(
    parseNodeOptionsHeapMb("--max-old-space-size=512 --max-old-space-size=2048"),
    2048
  );
});

test("envHasExplicitPusulaMemoryMb requires an in-range integer", () => {
  assert.equal(envHasExplicitPusulaMemoryMb({}), false);
  assert.equal(envHasExplicitPusulaMemoryMb({ PUSULA_MEMORY_MB: "" }), false);
  assert.equal(envHasExplicitPusulaMemoryMb({ PUSULA_MEMORY_MB: "abc" }), false);
  assert.equal(envHasExplicitPusulaMemoryMb({ PUSULA_MEMORY_MB: "32" }), false);
  assert.equal(envHasExplicitPusulaMemoryMb({ PUSULA_MEMORY_MB: "2048" }), true);
});

test("#10353 dual-set disagree → warn + PUSULA_MEMORY_MB wins", () => {
  const messages: string[] = [];
  const env = {
    NODE_OPTIONS: "--max-old-space-size=512",
    PUSULA_MEMORY_MB: "2048",
  };
  assert.equal(warnConflictingHeapLimits(env, 2048, (m: string) => messages.push(m)), true);
  assert.match(messages[0], /PUSULA_MEMORY_MB=2048/);
  assert.match(messages[0], /--max-old-space-size=512/);
  assert.match(messages[0], /effective V8 heap is 2048 MB/);
  assert.equal(
    buildStandaloneNodeOptions(env, 2048),
    "--max-old-space-size=512 --max-old-space-size=2048"
  );
});

test("#10353 only one knob set → no conflict warn", () => {
  const messages: string[] = [];
  const log = (m: string) => messages.push(m);
  assert.equal(
    warnConflictingHeapLimits({ NODE_OPTIONS: "--max-old-space-size=512" }, 512, log),
    false
  );
  assert.equal(
    warnConflictingHeapLimits({ PUSULA_MEMORY_MB: "2048" }, 2048, log),
    false
  );
  assert.equal(
    warnConflictingHeapLimits(
      { NODE_OPTIONS: "--max-old-space-size=1024", PUSULA_MEMORY_MB: "1024" },
      1024,
      log
    ),
    false
  );
  assert.equal(messages.length, 0);
});

test("#10353 unset PUSULA_MEMORY_MB keeps NODE_OPTIONS heap", () => {
  const env = { NODE_OPTIONS: "--max-old-space-size=8192" };
  assert.equal(buildStandaloneNodeOptions(env, 512), "--max-old-space-size=8192");
});
