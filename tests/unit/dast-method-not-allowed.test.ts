import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import * as yaml from "js-yaml";

const require = createRequire(import.meta.url);
const { maybeHandleDisallowedMethod } = require("../../scripts/dev/http-method-guard.cjs");

type GuardResult = {
  handled: boolean;
  statusCode: number;
  allow: string | undefined;
  body: string;
};

function runGuard(method: string, url: string): GuardResult {
  let body = "";
  const headers = new Map<string, string>();
  const response = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    end(chunk?: string) {
      body += chunk ?? "";
    },
  };
  const handled = maybeHandleDisallowedMethod({ method, url }, response);
  return { handled, statusCode: response.statusCode, allow: headers.get("allow"), body };
}

// Methods Next.js App Router dispatches to a route.ts export. HEAD and OPTIONS are
// left out on purpose: the guard never lists them (OPTIONS always passes through
// for CORS preflight), matching the pre-existing /api/keys rules.
const ROUTE_HANDLER_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function exportedRouteMethods(routeFile: string): string[] {
  const source = readFileSync(routeFile, "utf8");
  const found = new Set<string>();
  const exportPattern =
    /^export\s+(?:async\s+function|function|const|let)\s+(GET|POST|PUT|PATCH|DELETE)\b/gm;
  for (const match of source.matchAll(exportPattern)) found.add(match[1]);
  return ROUTE_HANDLER_METHODS.filter((method) => found.has(method));
}

function collectRouteFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectRouteFiles(fullPath));
    else if (entry.isFile() && entry.name === "route.ts") files.push(fullPath);
  }
  return files;
}

// src/app/api/keys/groups/[id]/route.ts -> /api/keys/groups/0
function sampleUrlForRouteFile(routeFile: string): string {
  const appDir = path.join(process.cwd(), "src", "app");
  return (
    "/" +
    path
      .relative(appDir, path.dirname(routeFile))
      .split(path.sep)
      .map((segment) => (/^\[[^\]]+\]$/.test(segment) ? "0" : segment))
      .join("/")
  );
}

test("raw HTTP guard rejects high-risk unsupported methods before Next.js handles them", () => {
  const cases: Array<{
    label: string;
    method: string;
    url: string;
    allow: string;
  }> = [
    { label: "login TRACE", method: "TRACE", url: "/api/auth/login", allow: "POST" },
    { label: "login QUERY", method: "QUERY", url: "/api/auth/login", allow: "POST" },
    { label: "logout QUERY", method: "QUERY", url: "/api/auth/logout", allow: "POST" },
    { label: "keys QUERY", method: "QUERY", url: "/api/keys", allow: "GET, POST" },
    {
      // dast-smoke 2026-07-06: schemathesis's unsupported-methods check demands
      // 405 (method-first) for QUERY /api/keys/{id}/devices — the auth layer was
      // answering 401 first because the path had no HIGH_RISK rule.
      label: "key devices QUERY",
      method: "QUERY",
      url: "/api/keys/0/devices",
      allow: "GET",
    },
    {
      label: "key detail QUERY",
      method: "QUERY",
      url: "/api/keys/0",
      allow: "GET, PATCH, DELETE",
    },
    // dast-smoke (PR #33/#34, ST204): these paths had no rule, so QUERY reached
    // the authz layer and came back 401/400 instead of 405. /api/keys/groups was
    // only "covered" because the generic /api/keys/{id} rule swallowed it with
    // the wrong Allow set (see the POST regression test below).
    { label: "key groups QUERY", method: "QUERY", url: "/api/keys/groups", allow: "GET, POST" },
    {
      label: "key group detail QUERY",
      method: "QUERY",
      url: "/api/keys/groups/0",
      allow: "GET, PUT, DELETE",
    },
    {
      label: "key group members QUERY",
      method: "QUERY",
      url: "/api/keys/groups/0/keys",
      allow: "GET, POST, DELETE",
    },
    {
      label: "key group permissions QUERY",
      method: "QUERY",
      url: "/api/keys/groups/0/permissions",
      allow: "GET, POST, DELETE",
    },
    { label: "key reveal QUERY", method: "QUERY", url: "/api/keys/0/reveal", allow: "GET" },
    {
      label: "key usage limits QUERY",
      method: "QUERY",
      url: "/api/keys/0/usage-limits",
      allow: "GET",
    },
    {
      label: "key regenerate QUERY",
      method: "QUERY",
      url: "/api/keys/0/regenerate",
      allow: "POST",
    },
    { label: "csrf QUERY", method: "QUERY", url: "/api/auth/csrf", allow: "GET" },
    { label: "auth status QUERY", method: "QUERY", url: "/api/auth/status", allow: "GET" },
  ];

  for (const testCase of cases) {
    const result = runGuard(testCase.method, testCase.url);
    assert.equal(result.handled, true, testCase.label);
    assert.equal(result.statusCode, 405, testCase.label);
    assert.equal(result.allow, testCase.allow, testCase.label);
    assert.match(result.body, /METHOD_NOT_ALLOWED/, testCase.label);
  }
});

test("raw HTTP guard does not intercept POST /api/keys/groups (create key group)", () => {
  // Regression (dast-smoke ST202): the generic /api/keys/{id} rule matched the
  // literal path /api/keys/groups and answered POST with 405 + "GET, PATCH, DELETE"
  // before Next.js could reach src/app/api/keys/groups/route.ts#POST. The guard
  // ships in dist/server.js, so creating key groups over the API was broken.
  const result = runGuard("POST", "/api/keys/groups");
  assert.equal(result.handled, false, "POST /api/keys/groups must reach Next.js");
  assert.equal(result.statusCode, 200, "the guard must not touch the response");
});

test("raw HTTP guard matches /api/keys/groups/{id} before the /api/keys/{id}/* rules", () => {
  // Next.js resolves the static `groups` segment before the dynamic [id] one, so
  // /api/keys/groups/devices is the key-group route with id "devices" — not the
  // devices list of a key called "groups". PUT/DELETE must reach that handler.
  for (const method of ["GET", "PUT", "DELETE"]) {
    for (const url of ["/api/keys/groups/devices", "/api/keys/groups/reveal"]) {
      const result = runGuard(method, url);
      assert.equal(result.handled, false, `${method} ${url} must reach Next.js`);
    }
  }
});

test("raw HTTP guard method sets match the exported handlers of every guarded route", () => {
  // Drift guard: every route under src/app/api/keys plus the guarded auth routes
  // must have a rule whose method set equals the route.ts exports. A rule that
  // is too narrow 405s a real handler (the /api/keys/groups POST bug); a missing
  // rule lets undeclared methods hit the auth layer (401/400 instead of 405).
  const apiDir = path.join(process.cwd(), "src", "app", "api");
  const routeFiles = [
    ...collectRouteFiles(path.join(apiDir, "keys")),
    ...["login", "logout", "csrf", "status"].map((name) =>
      path.join(apiDir, "auth", name, "route.ts")
    ),
  ];
  assert.ok(routeFiles.length >= 14, `expected the keys/auth route tree, got ${routeFiles.length}`);

  for (const routeFile of routeFiles) {
    const url = sampleUrlForRouteFile(routeFile);
    const exported = exportedRouteMethods(routeFile);
    assert.ok(exported.length > 0, `${routeFile} exports no route handler`);

    for (const method of exported) {
      assert.equal(runGuard(method, url).handled, false, `${method} ${url} must reach Next.js`);
    }

    const rejected = runGuard("QUERY", url);
    assert.equal(rejected.handled, true, `QUERY ${url} must be answered by the guard`);
    assert.equal(rejected.statusCode, 405, `QUERY ${url} must yield 405`);
    assert.deepEqual(
      (rejected.allow ?? "").split(", ").sort(),
      [...exported].sort(),
      `Allow header for ${url} must list exactly the exported handlers of ${routeFile}`
    );
  }
});

test("raw HTTP guard allows documented methods through", () => {
  const response = {
    setHeader() {
      throw new Error("allowed methods should not write headers");
    },
    end() {
      throw new Error("allowed methods should not end the response");
    },
  };

  assert.equal(
    maybeHandleDisallowedMethod({ method: "POST", url: "/api/auth/login" }, response),
    false
  );
  assert.equal(maybeHandleDisallowedMethod({ method: "GET", url: "/api/keys" }, response), false);
  assert.equal(
    maybeHandleDisallowedMethod({ method: "OPTIONS", url: "/api/keys" }, response),
    false
  );
  assert.equal(
    maybeHandleDisallowedMethod({ method: "QUERY", url: "/api/health/ping" }, response),
    false
  );
});

test("raw HTTP guard rejects undici-unsupported methods (TRACE/TRACK/CONNECT) on ANY path", () => {
  // Regression guard (release v3.8.44 dast-smoke): TRACE reached Next's
  // middleware adapter, which throws `TypeError: 'TRACE' HTTP method is
  // unsupported.` while constructing the fetch Request — an unhandled 500 on
  // EVERY route. The guard must answer a clean 405 before Next sees it.
  for (const method of ["TRACE", "TRACK", "CONNECT"]) {
    for (const url of ["/api/keys/0/devices", "/dashboard", "/v1/chat/completions"]) {
      const headers: Record<string, string> = {};
      const response = {
        statusCode: 0,
        setHeader(name: string, value: string) {
          headers[name] = value;
        },
        body: "",
        end(payload?: string) {
          this.body = payload || "";
        },
      };
      const handled = maybeHandleDisallowedMethod({ method, url }, response);
      assert.equal(handled, true, `${method} ${url} must be handled by the guard`);
      assert.equal(response.statusCode, 405, `${method} ${url} must yield 405`);
      assert.ok(headers.Allow, `${method} ${url} must set an Allow header`);
      assert.match(response.body, /METHOD_NOT_ALLOWED/);
    }
  }
});

test("OpenAPI documents high-risk route auth and setup responses", () => {
  const spec = readFileSync("docs/openapi.yaml", "utf8");
  const apiKeyDetailStart = spec.indexOf("  /api/keys/{id}:");
  const apiKeyDetailEnd = spec.indexOf("\n  /api/combos:", apiKeyDetailStart);
  const apiKeyDetail = spec.slice(apiKeyDetailStart, apiKeyDetailEnd);

  assert.match(apiKeyDetail, /\n    get:/);
  assert.match(apiKeyDetail, /\n    patch:/);
  assert.match(apiKeyDetail, /\n    delete:/);
  assert.match(apiKeyDetail, /"401":\n\s+description: Authentication required/);
  assert.match(apiKeyDetail, /"404":\n\s+description: Key not found/);

  const loginStart = spec.indexOf("  /api/auth/login:");
  const loginEnd = spec.indexOf("\n  /api/auth/logout:", loginStart);
  const login = spec.slice(loginStart, loginEnd);
  assert.match(login, /"400":\n\s+description: Invalid login request/);
  assert.match(login, /"401":\n\s+description: Invalid password/);
  assert.match(login, /"403":\n\s+description: Password setup required/);
  assert.match(login, /"429":\n\s+description: Too many failed attempts/);
});

type OpenApiOperation = {
  parameters?: Array<{ $ref?: string; name?: string; in?: string }>;
  responses?: Record<string, { $ref?: string; description?: string }>;
};
type OpenApiPathItem = Record<string, unknown> & {
  parameters?: Array<{ $ref?: string; name?: string; in?: string }>;
};

const OPENAPI_HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

function loadOpenApiPaths(): Record<string, OpenApiPathItem> {
  const spec = yaml.load(readFileSync("docs/openapi.yaml", "utf8")) as {
    paths?: Record<string, OpenApiPathItem>;
    components?: { parameters?: Record<string, { name?: string; in?: string }> };
  };
  const componentParams = spec.components?.parameters ?? {};
  // Resolve local `#/components/parameters/X` refs so callers can compare by name/in.
  for (const item of Object.values(spec.paths ?? {})) {
    const lists = [
      item.parameters,
      ...OPENAPI_HTTP_METHODS.map((m) => (item[m] as OpenApiOperation | undefined)?.parameters),
    ];
    for (const list of lists) {
      if (!list) continue;
      for (const param of list) {
        const ref = param.$ref?.match(/^#\/components\/parameters\/(.+)$/)?.[1];
        if (ref && componentParams[ref]) Object.assign(param, componentParams[ref]);
      }
    }
  }
  return spec.paths ?? {};
}

test("OpenAPI declares every path parameter in the dast-smoke /api/(auth|keys) scope", () => {
  // Schemathesis: "Path parameter 'id' is not defined" (12 schema errors) on the
  // stub path items generated for /api/keys/{id}/* and /api/keys/groups/{id}*.
  const paths = loadOpenApiPaths();
  const scoped = Object.keys(paths).filter((p) => /^\/api\/(auth|keys)/.test(p));
  assert.ok(scoped.includes("/api/keys/groups/{id}/permissions"), "stub path must stay documented");

  for (const pathKey of scoped) {
    const templateParams = [...pathKey.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
    if (templateParams.length === 0) continue;
    const item = paths[pathKey];
    for (const method of OPENAPI_HTTP_METHODS) {
      const operation = item[method] as OpenApiOperation | undefined;
      if (!operation) continue;
      const declared = [...(item.parameters ?? []), ...(operation.parameters ?? [])]
        .filter((param) => param.in === "path")
        .map((param) => param.name);
      for (const name of templateParams) {
        assert.ok(
          declared.includes(name),
          `${method.toUpperCase()} ${pathKey} must declare its path parameter '${name}'`
        );
      }
    }
  }
});

test("OpenAPI documents the 401 that management key/auth routes return unauthenticated", () => {
  // Schemathesis ST103 (15 failures): these operations answer 401 without a
  // dashboard session but documented only "200".
  const paths = loadOpenApiPaths();
  const expected: Array<[string, string[]]> = [
    ["/api/keys/{id}/regenerate", ["post"]],
    ["/api/keys/{id}/reveal", ["get"]],
    ["/api/keys/{id}/usage-limits", ["get"]],
    ["/api/keys/groups", ["get", "post"]],
    ["/api/keys/groups/{id}", ["get", "put", "delete"]],
    ["/api/keys/groups/{id}/keys", ["get", "post", "delete"]],
    ["/api/keys/groups/{id}/permissions", ["get", "post", "delete"]],
    ["/api/auth/csrf", ["get"]],
  ];
  for (const [pathKey, methods] of expected) {
    for (const method of methods) {
      const operation = paths[pathKey]?.[method] as OpenApiOperation | undefined;
      assert.ok(operation, `${method.toUpperCase()} ${pathKey} must be documented`);
      assert.equal(
        operation.responses?.["401"]?.$ref,
        "#/components/responses/ManagementAuthenticationRequired",
        `${method.toUpperCase()} ${pathKey} must document its 401`
      );
    }
  }

  // POST /api/keys/groups answers 201 Created (src/app/api/keys/groups/route.ts),
  // never 200, and 405 is not a valid answer for it.
  const createGroup = paths["/api/keys/groups"].post as OpenApiOperation;
  assert.ok(createGroup.responses?.["201"], "POST /api/keys/groups must document 201");
  assert.equal(createGroup.responses?.["200"], undefined, "the route never returns 200");
  assert.equal(createGroup.responses?.["405"], undefined, "POST is a supported method");
});
