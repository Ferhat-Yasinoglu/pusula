import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveRootDestination,
  LANDING_PATH,
  DASHBOARD_PATH,
  CALLBACK_PATH,
} from "../../src/shared/utils/rootDestination.ts";

test("root: Zed native-app sign-in is forwarded to /callback with its query intact", () => {
  const query = "user_id=u1&access_token=t1";
  assert.equal(
    resolveRootDestination({
      hasZedCallback: true,
      authenticated: false,
      requireLogin: true,
      query,
    }),
    `${CALLBACK_PATH}?${query}`
  );
  // The relay wins even for a signed-in operator: the modal is waiting for it.
  assert.equal(
    resolveRootDestination({
      hasZedCallback: true,
      authenticated: true,
      requireLogin: true,
      query,
    }),
    `${CALLBACK_PATH}?${query}`
  );
});

test("root: a visitor to an instance that requires login sees the landing page", () => {
  assert.equal(
    resolveRootDestination({ hasZedCallback: false, authenticated: false, requireLogin: true }),
    LANDING_PATH
  );
});

test("root: a signed-in operator goes straight to the dashboard", () => {
  assert.equal(
    resolveRootDestination({ hasZedCallback: false, authenticated: true, requireLogin: true }),
    DASHBOARD_PATH
  );
});

test("root: an instance without login (local/personal) skips the landing page", () => {
  assert.equal(
    resolveRootDestination({ hasZedCallback: false, authenticated: false, requireLogin: false }),
    DASHBOARD_PATH
  );
});

test("root: callback without a query still lands on the relay", () => {
  assert.equal(
    resolveRootDestination({ hasZedCallback: true, authenticated: false, requireLogin: true }),
    CALLBACK_PATH
  );
});
