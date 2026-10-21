import test from "node:test";
import assert from "node:assert/strict";

const { trackPendingRequest, getPendingById, clearPendingRequests } =
  await import("../../src/lib/usage/usageHistory.ts");

test("pending request ids stay unique when their random parts share a prefix in the same millisecond", () => {
  clearPendingRequests();
  const realNow = Date.now;
  const realRandomUUID = globalThis.crypto.randomUUID;

  // Both UUIDs share their first six hex characters. The id scheme must keep
  // the whole random part, otherwise two concurrent requests overwrite each other.
  const uuids = ["abcdef01-0000-4000-8000-000000000001", "abcdef02-0000-4000-8000-000000000002"];
  let next = 0;
  Date.now = () => 1_700_000_000_000;
  globalThis.crypto.randomUUID = () => uuids[next++];

  try {
    const firstId = trackPendingRequest("m", "p", "c-a", true);
    const secondId = trackPendingRequest("m", "p", "c-b", true);

    assert.ok(firstId && secondId, "both started requests should produce ids");
    assert.notEqual(firstId, secondId, "the two requests must not share an id");
    assert.equal(getPendingById().size, 2, "both pending requests must stay tracked");
  } finally {
    Date.now = realNow;
    globalThis.crypto.randomUUID = realRandomUUID;
    clearPendingRequests();
  }
});
