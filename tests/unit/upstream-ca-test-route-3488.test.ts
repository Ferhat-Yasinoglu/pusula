import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Point the data dir at a throwaway location BEFORE importing the route so we can assert
// the validate-only route never writes the persisted CA-path file. resolveMitmDataDir()
// reads DATA_DIR at call time, so this also governs the route under test.
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "pusula-ca-datadir-"));
process.env.DATA_DIR = DATA_DIR;
// The persisted path used by the real (persisting) POST /upstream-ca route.
const PERSISTED_CA_PATH_FILE = path.join(DATA_DIR, "mitm", "upstream-ca.path");

const { POST } = await import("../../src/app/api/tools/agent-bridge/upstream-ca/test/route.ts");

// #3488 — UpstreamCaField's "Test" button POSTed to /api/tools/agent-bridge/upstream-ca/test,
// which did not exist (404). The new validate-only route checks the CA file exists and is a
// parseable PEM certificate WITHOUT persisting/activating it.

// A throwaway self-signed cert (CN=Pusula Test CA), valid to 2036.
const TEST_CA_PEM = `-----BEGIN CERTIFICATE-----
MIIDEzCCAfugAwIBAgIUbeZ2xZ3Cp8+wWr6yM5eYamCm/c8wDQYJKoZIhvcNAQEL
BQAwGTEXMBUGA1UEAwwOUHVzdWxhIFRlc3QgQ0EwHhcNMjYxMDIwMTYyMjQxWhcN
MzYxMDE3MTYyMjQxWjAZMRcwFQYDVQQDDA5QdXN1bGEgVGVzdCBDQTCCASIwDQYJ
KoZIhvcNAQEBBQADggEPADCCAQoCggEBAOpgUfvQ4o3OlMFtk7HahMkCxoEurEbt
P+oxE42VQDMOfbbjwc7Qe1AMJiNcrAWhsd2WgpsVekzgaTCE4yFJFZygHxPR0MM/
a3tLoDSVHzhj8YWIUTACZJ9IV/dV3trtUbNEvQwE02saMKGD7CY4h5xYN5E8TUc9
6pN0p++awl1oL19mtxVuhXUIvpkB6W/sB0LsG9K507ABxVmrvlu1YeEgSrafQ6jA
w5Pgf2DQ8+zxtGjmseWwk/zg0dfjyejFSqkF5zxyUOfh19VBmtXJ4Kb6K3vkf7oa
Aj213OeEa5NuYlopAhsOi+6y3eEsoIHMmzsC0uf+HmSS0+JumTrO580CAwEAAaNT
MFEwHQYDVR0OBBYEFBh6cWynwRhboLgeGF4Luja8FyIvMB8GA1UdIwQYMBaAFBh6
cWynwRhboLgeGF4Luja8FyIvMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQEL
BQADggEBANhB8shdUbueSCJ1DrUergegTBF+lb2dkb7cnbdGpCSklFFXZ1XFVw6E
zpWUWGqE8J1xT//dxIxoCzuJyd2iq4ZY6iMNHKZc1MDNrZ/Y1aP5SBk5iNPxm/gT
PC8cZ9xL2zw1uWxYY4zClgJzr6xGSSt0gTXOEjXKu1p1+G08GhKHnWTehTAqf7Tu
+HOdVd0RAa4QM7OWJoQxNbJNd/9V/kmkefR8H6cyE7z87NFZ75dNOxGeOKqXZMXp
I/vNzzi7ZS47j+BawLy9WYCk2EUReLkVOpXEH708zkgCnbTOuuN7tjTCfpSE169R
9ldC1FQeicxTtSTOEcGnhwJBFGE6scU=
-----END CERTIFICATE-----
`;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pusula-ca-test-"));
const validCaPath = path.join(dir, "valid-ca.pem");
const nonPemPath = path.join(dir, "not-a-cert.txt");
fs.writeFileSync(validCaPath, TEST_CA_PEM);
fs.writeFileSync(nonPemPath, "this is not a certificate");

test.after(() => {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  fs.rmSync(DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function postJson(body: unknown): Request {
  return new Request("http://localhost/api/tools/agent-bridge/upstream-ca/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("#3488 valid PEM cert → 200 ok with subject", async () => {
  const res = await POST(postJson({ path: validCaPath }));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
  assert.match(json.subject, /Pusula Test CA/);
});

test("#3488 does NOT persist the CA path (validate-only)", async () => {
  // Real side-effect guard (#3821-review LEDGER-11): the persisting POST /upstream-ca
  // route writes <dataDir>/mitm/upstream-ca.path. After a successful /test call that file
  // must NOT exist — proving the dry-run never persisted/activated the CA.
  assert.ok(
    !fs.existsSync(PERSISTED_CA_PATH_FILE),
    "precondition: persisted CA-path file should not exist before the test"
  );

  const res = await POST(postJson({ path: validCaPath }));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);

  assert.ok(
    !fs.existsSync(PERSISTED_CA_PATH_FILE),
    "validate-only /test route must not write the persisted upstream-ca.path file"
  );
  // And it must not advertise activation/persistence in its response shape.
  assert.equal(json.persisted, undefined);
  assert.equal(json.activated, undefined);
});

test("#3488 non-existent path → 400", async () => {
  const res = await POST(postJson({ path: path.join(dir, "nope.pem") }));
  assert.equal(res.status, 400);
});

test("#3488 file that is not a PEM cert → 400", async () => {
  const res = await POST(postJson({ path: nonPemPath }));
  assert.equal(res.status, 400);
});

test("#3488 invalid body (missing path) → 400", async () => {
  const res = await POST(postJson({}));
  assert.equal(res.status, 400);
});

test("#3488 invalid JSON body → 400", async () => {
  const req = new Request("http://localhost/api/tools/agent-bridge/upstream-ca/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not json",
  });
  const res = await POST(req);
  assert.equal(res.status, 400);
});
