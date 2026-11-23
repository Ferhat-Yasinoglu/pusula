import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "pusula-db-access-requests-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const accessRequests = await import("../../src/lib/db/accessRequests.ts");

test.beforeEach(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
});

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

test("createAccessRequest stores a pending request and lists it newest first", () => {
  const first = accessRequests.createAccessRequest({
    name: "Ada",
    email: "ada@example.com",
    reason: "Trying it out",
  });
  const second = accessRequests.createAccessRequest({ name: "Bob", email: "bob@example.com" });

  assert.equal(first.created, true);
  assert.equal(second.created, true);

  const pending = accessRequests.listAccessRequests({ status: "pending" });
  assert.equal(pending.length, 2);
  assert.deepEqual(
    pending.map((r) => r.email),
    ["bob@example.com", "ada@example.com"]
  );
  assert.equal(pending[1].reason, "Trying it out");
  assert.equal(pending[0].reason, null);
  assert.equal(pending[0].status, "pending");
  assert.equal(pending[0].apiKeyId, null);
  assert.equal(accessRequests.countPendingAccessRequests(), 2);
});

test("a second pending request from the same email (any case) is not duplicated", () => {
  const first = accessRequests.createAccessRequest({ name: "Ada", email: "Ada@Example.com" });
  const again = accessRequests.createAccessRequest({ name: "Ada L.", email: "ada@example.com" });

  assert.equal(again.created, false);
  assert.equal(again.id, first.id);
  assert.equal(accessRequests.countPendingAccessRequests(), 1);
  assert.equal(accessRequests.getAccessRequest(first.id)?.email, "ada@example.com");
});

test("decideAccessRequest moves a pending request once and refuses a second decision", () => {
  const { id } = accessRequests.createAccessRequest({ name: "Ada", email: "ada@example.com" });

  const approved = accessRequests.decideAccessRequest(id, "approved");
  assert.equal(approved?.status, "approved");
  assert.ok(approved?.decidedAt);

  assert.equal(accessRequests.decideAccessRequest(id, "rejected"), null);
  assert.equal(accessRequests.getAccessRequest(id)?.status, "approved");
  assert.equal(accessRequests.countPendingAccessRequests(), 0);
});

test("attachApiKey records the issued key and reopenAccessRequest undoes a failed approval", () => {
  const { id } = accessRequests.createAccessRequest({ name: "Ada", email: "ada@example.com" });
  accessRequests.decideAccessRequest(id, "approved");
  accessRequests.attachApiKey(id, "key-123");
  assert.equal(accessRequests.getAccessRequest(id)?.apiKeyId, "key-123");

  const { id: other } = accessRequests.createAccessRequest({ name: "Bob", email: "bob@x.io" });
  accessRequests.decideAccessRequest(other, "approved");
  accessRequests.reopenAccessRequest(other);
  const reopened = accessRequests.getAccessRequest(other);
  assert.equal(reopened?.status, "pending");
  assert.equal(reopened?.decidedAt, null);
});

test("after a decision the same email can ask again", () => {
  const { id } = accessRequests.createAccessRequest({ name: "Ada", email: "ada@example.com" });
  accessRequests.decideAccessRequest(id, "rejected");

  const again = accessRequests.createAccessRequest({ name: "Ada", email: "ada@example.com" });
  assert.equal(again.created, true);
  assert.notEqual(again.id, id);
  assert.equal(accessRequests.listAccessRequests().length, 2);
});

test("getAccessRequest returns null for an unknown id", () => {
  assert.equal(accessRequests.getAccessRequest("missing"), null);
  assert.equal(accessRequests.decideAccessRequest("missing", "approved"), null);
});
