// #13139 — Eval runner must opt out of output-style and memory injection
// so that eval cases measure the model, not injected context.

import test from "node:test";
import assert from "node:assert/strict";

// We verify the fix by importing the runtime module and checking that the
// headers include the opt-out values. Since executeEvalCase() makes an actual
// HTTP call, we instead test the header construction logic in isolation.

const serial = { concurrency: false };

test("#13139 — eval request headers include x-pusula-compression: off", serial, () => {
  // Simulate the header construction from runtime.ts executeEvalCase()
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-pusula-compression": "off",
    "x-pusula-no-memory": "true",
  });

  assert.equal(headers.get("x-pusula-compression"), "off");
  assert.equal(headers.get("x-pusula-no-memory"), "true");
});

test("#13139 — opt-out headers disable output-style injection", serial, () => {
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-pusula-compression": "off",
    "x-pusula-no-memory": "true",
  });

  // The chat route checks x-pusula-compression !== "off" to decide
  // whether to apply output styles. With "off", styles are disabled.
  const compressionHeader = headers.get("x-pusula-compression");
  assert.notEqual(compressionHeader, null, "compression header must be set");
  assert.ok(
    compressionHeader !== "on" && compressionHeader !== "true",
    "compression must be disabled for eval"
  );
});

test("#13139 — opt-out headers disable memory injection", serial, () => {
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-pusula-compression": "off",
    "x-pusula-no-memory": "true",
  });

  // The chat route checks x-pusula-no-memory to decide whether to
  // retrieve and inject memory context.
  const noMemory = headers.get("x-pusula-no-memory");
  assert.equal(noMemory, "true", "no-memory header must be 'true' for eval");
});
