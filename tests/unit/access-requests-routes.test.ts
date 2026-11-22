// "Request access" flow: the public form endpoint (POST /api/access-request) and the
// operator endpoints (GET /api/access-requests, POST /api/access-requests/[id]).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeManagementSessionRequest } from "../helpers/managementSession.ts";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "pusula-access-requests-routes-"));
const ORIGINAL_ENV = {
  DATA_DIR: process.env.DATA_DIR,
  API_KEY_SECRET: process.env.API_KEY_SECRET,
  JWT_SECRET: process.env.JWT_SECRET,
  INITIAL_PASSWORD: process.env.INITIAL_PASSWORD,
};
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.API_KEY_SECRET = "access-requests-api-key-secret";
process.env.JWT_SECRET = "access-requests-jwt-secret";
process.env.INITIAL_PASSWORD = "access-requests-password";

const core = await import("../../src/lib/db/core.ts");
const apiKeysDb = await import("../../src/lib/db/apiKeys.ts");
const accessRequestsDb = await import("../../src/lib/db/accessRequests.ts");
const { updateSettings } = await import("../../src/lib/db/settings.ts");
const { setRateLimiterTestMode } = await import("../../src/shared/utils/rateLimiter.ts");
const { AUTHZ_HEADER_TRUSTED_CLIENT_IP } = await import("../../src/server/authz/headers.ts");
const submitRoute = await import("../../src/app/api/access-request/route.ts");
const listRoute = await import("../../src/app/api/access-requests/route.ts");
const itemRoute = await import("../../src/app/api/access-requests/[id]/route.ts");

const SUBMIT_URL = "http://localhost:20128/api/access-request";
const LIST_URL = "http://localhost:20128/api/access-requests";

function submit(body: unknown, ip = "203.0.113.7") {
  return submitRoute.POST(
    new Request(SUBMIT_URL, {
      method: "POST",
      headers: { "content-type": "application/json", [AUTHZ_HEADER_TRUSTED_CLIENT_IP]: ip },
      body: JSON.stringify(body),
    })
  );
}

async function decide(id: string, body: unknown, withSession = true) {
  const url = `${LIST_URL}/${id}`;
  const request = withSession
    ? await makeManagementSessionRequest(url, { method: "POST", body: body as never })
    : new Request(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
  return itemRoute.POST(request, { params: Promise.resolve({ id }) });
}

test.beforeEach(async () => {
  apiKeysDb.resetApiKeyState();
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  setRateLimiterTestMode(true);
  await updateSettings({ requireLogin: true });
});

test.after(() => {
  setRateLimiterTestMode(false);
  apiKeysDb.resetApiKeyState();
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("a visitor can submit a request without any credential", async () => {
  const res = await submit({ name: "Ada", email: "ada@example.com", reason: "Side project" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });

  const [stored] = accessRequestsDb.listAccessRequests();
  assert.equal(stored.email, "ada@example.com");
  assert.equal(stored.reason, "Side project");
});

test("an invalid email is rejected and nothing is stored", async () => {
  const res = await submit({ name: "Ada", email: "not-an-email" });
  assert.equal(res.status, 400);
  assert.equal(accessRequestsDb.listAccessRequests().length, 0);
});

test("a filled honeypot looks accepted but stores nothing", async () => {
  const res = await submit({ name: "Bot", email: "bot@example.com", website: "http://spam" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(accessRequestsDb.listAccessRequests().length, 0);
});

test("one address is limited to a few submissions per hour", async () => {
  for (let i = 0; i < submitRoute.SUBMISSIONS_PER_HOUR; i++) {
    const res = await submit({ name: `User ${i}`, email: `user${i}@example.com` });
    assert.equal(res.status, 200);
  }
  const blocked = await submit({ name: "One more", email: "more@example.com" });
  assert.equal(blocked.status, 429);
  assert.equal(accessRequestsDb.listAccessRequests().length, submitRoute.SUBMISSIONS_PER_HOUR);

  const otherAddress = await submit(
    { name: "Elsewhere", email: "else@example.com" },
    "198.51.100.9"
  );
  assert.equal(otherAddress.status, 200);
});

test("new requests are refused once the pending queue is full", async () => {
  for (let i = 0; i < submitRoute.MAX_PENDING_REQUESTS; i++) {
    accessRequestsDb.createAccessRequest({ name: `Q${i}`, email: `q${i}@example.com` });
  }
  const res = await submit({ name: "Late", email: "late@example.com" });
  assert.equal(res.status, 503);
  assert.equal(accessRequestsDb.countPendingAccessRequests(), submitRoute.MAX_PENDING_REQUESTS);
});

test("listing requests needs the operator's session", async () => {
  await submit({ name: "Ada", email: "ada@example.com" });

  const anonymous = await listRoute.GET(new Request(LIST_URL));
  assert.equal(anonymous.status, 401);

  const res = await listRoute.GET(await makeManagementSessionRequest(LIST_URL));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.pendingCount, 1);
  assert.equal(body.requests[0].email, "ada@example.com");
});

test("approving issues a limited API key once and records it on the request", async () => {
  await submit({ name: "Ada", email: "ada@example.com" });
  const [{ id }] = accessRequestsDb.listAccessRequests();

  const res = await decide(id, {
    action: "approve",
    dailyUsageLimitUsd: 2,
    weeklyUsageLimitUsd: 8,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.key, /\S{20,}/);
  assert.equal(body.request.status, "approved");

  const stored = accessRequestsDb.getAccessRequest(id);
  assert.equal(stored?.apiKeyId, body.apiKeyId);
  const key = await apiKeysDb.getApiKeyById(body.apiKeyId);
  assert.equal(key?.name, "Ada <ada@example.com>");
  assert.equal(key?.usageLimitEnabled, true);
  assert.equal(key?.dailyUsageLimitUsd, 2);
  assert.equal(key?.weeklyUsageLimitUsd, 8);

  const again = await decide(id, { action: "approve" });
  assert.equal(again.status, 409);
  assert.equal((await apiKeysDb.getApiKeys()).length, 1);
});

test("rejecting issues no key", async () => {
  await submit({ name: "Ada", email: "ada@example.com" });
  const [{ id }] = accessRequestsDb.listAccessRequests();

  const res = await decide(id, { action: "reject" });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).request.status, "rejected");
  assert.equal((await apiKeysDb.getApiKeys()).length, 0);
});

test("decisions need the operator's session, a known id and a valid body", async () => {
  await submit({ name: "Ada", email: "ada@example.com" });
  const [{ id }] = accessRequestsDb.listAccessRequests();

  assert.equal((await decide(id, { action: "approve" }, false)).status, 401);
  assert.equal((await decide(id, { action: "maybe" })).status, 400);
  assert.equal((await decide("missing", { action: "reject" })).status, 404);
  assert.equal(accessRequestsDb.getAccessRequest(id)?.status, "pending");
});
