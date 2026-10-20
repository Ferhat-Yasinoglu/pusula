import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { load } from "js-yaml";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const COMPOSE_PATH = path.join(REPO_ROOT, "contrib/vps/compose.yaml");
const ENV_EXAMPLE_PATH = path.join(REPO_ROOT, "contrib/vps/.env.example");

type ComposeService = {
  image?: string;
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
};

type ComposeDocument = {
  services?: Record<string, ComposeService>;
};

function readCompose(): { raw: string; parsed: ComposeDocument } {
  const raw = fs.readFileSync(COMPOSE_PATH, "utf8");
  return { raw, parsed: load(raw) as ComposeDocument };
}

test("VPS compose publishes only the Pusula dashboard on loopback by default", () => {
  const { parsed } = readCompose();
  const services = parsed.services ?? {};

  assert.deepEqual(services.redis?.ports, undefined, "Redis must not publish a host port");
  assert.deepEqual(services.pusula?.ports, [
    "${PUSULA_BIND_HOST:-127.0.0.1}:${PUSULA_PORT:-20128}:20128",
  ]);
});

test("VPS compose requires an explicitly pinned image and production secrets", () => {
  const { raw, parsed } = readCompose();
  const pusula = parsed.services?.pusula;

  assert.equal(
    pusula?.image,
    "${PUSULA_IMAGE:?Set PUSULA_IMAGE to a versioned tag or digest}"
  );
  assert.equal(pusula?.environment?.REQUIRE_API_KEY, "${REQUIRE_API_KEY:-true}");
  assert.match(raw, /JWT_SECRET: \$\{JWT_SECRET:\?Set JWT_SECRET in \.env\}/);
  assert.match(raw, /API_KEY_SECRET: \$\{API_KEY_SECRET:\?Set API_KEY_SECRET in \.env\}/);
  assert.match(raw, /INITIAL_PASSWORD: \$\{INITIAL_PASSWORD:\?Set INITIAL_PASSWORD in \.env\}/);
  assert.match(
    raw,
    /PUSULA_WS_BRIDGE_SECRET: \$\{PUSULA_WS_BRIDGE_SECRET:\?Set PUSULA_WS_BRIDGE_SECRET in \.env\}/
  );
});

test("VPS environment example uses a versioned image rather than a floating channel", () => {
  const env = fs.readFileSync(ENV_EXAMPLE_PATH, "utf8");

  assert.match(env, /^PUSULA_IMAGE=[^\s:]+:\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/m);
  assert.doesNotMatch(env, /^PUSULA_IMAGE=.*:(?:latest|next)$/m);
  assert.match(env, /^REQUIRE_API_KEY=true$/m);
});
