import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  patchBasePathLiterals,
  patchJsonManifestFile,
  patchStandaloneBasePath,
  patchProcessEnvShim,
  patchBakedAssetUrls,
  patchChunkLoaderBase,
  patchCssAssetUrls,
} from "../../scripts/docker/patch-standalone-base-path.mjs";

test("patchBasePathLiterals rewrites empty basePath literals", () => {
  const input = 'const cfg={basePath:"",assetPrefix:void 0};"basePath":""';
  const output = patchBasePathLiterals(input, "/pusula");
  assert.match(output, /basePath:"\/pusula"/);
  assert.match(output, /"basePath":"\/pusula"/);
});

test("patchJsonManifestFile updates nested basePath fields", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pusula-basepath-"));
  const filePath = path.join(dir, "routes-manifest.json");
  fs.writeFileSync(filePath, JSON.stringify({ basePath: "", nested: { basePath: "" } }, null, 2));
  assert.equal(patchJsonManifestFile(filePath, "/pusula"), true);
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.equal(parsed.basePath, "/pusula");
  assert.equal(parsed.nested.basePath, "/pusula");
});

test("patchStandaloneBasePath rewrites a root-path standalone tree", () => {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pusula-standalone-"));
  const distRoot = path.join(appRoot, ".build", "next");
  fs.mkdirSync(path.join(distRoot, "server"), { recursive: true });
  fs.writeFileSync(path.join(distRoot, "routes-manifest.json"), JSON.stringify({ basePath: "" }));
  fs.writeFileSync(path.join(distRoot, "server", "chunk.js"), 'export const config={basePath:""};');
  fs.writeFileSync(path.join(appRoot, "BUILD_PUSULA_BASE_PATH"), "\n");

  const result = patchStandaloneBasePath({
    appRoot,
    fromBasePath: "",
    toBasePath: "/pusula",
  });

  assert.equal(result.changed, true);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(distRoot, "routes-manifest.json"), "utf8")).basePath,
    "/pusula"
  );
  assert.match(fs.readFileSync(path.join(distRoot, "server", "chunk.js"), "utf8"), /\/pusula/);
});

test("patchStandaloneBasePath rejects mismatched non-root builds", () => {
  assert.throws(
    () =>
      patchStandaloneBasePath({
        appRoot: process.cwd(),
        fromBasePath: "/custom",
        toBasePath: "/pusula",
      }),
    /does not match the image build/
  );
});

test("patchBasePathLiterals rewrites assetPrefix literals (Next 16 SSR asset URLs)", () => {
  // Next 16 app-router renders SSR asset URLs from assetPrefix ALONE.
  assert.equal(patchBasePathLiterals('{"assetPrefix":""}', "/pusula"), '{"assetPrefix":"/pusula"}');
  assert.equal(patchBasePathLiterals('assetPrefix:""', "/pusula"), 'assetPrefix:"/pusula"');
  assert.equal(patchBasePathLiterals("assetPrefix:void 0", "/pusula"), 'assetPrefix:"/pusula"');
  // Asset prefix must mirror the basePath so both routing and assets align.
  const mixed = patchBasePathLiterals('{"basePath":"","assetPrefix":""}', "/pusula");
  assert.match(mixed, /"basePath":"\/pusula"/);
  assert.match(mixed, /"assetPrefix":"\/pusula"/);
});

test("patchBasePathLiterals rewrites the NEXT_PUBLIC env mirror", () => {
  assert.equal(
    patchBasePathLiterals('{"env":{"NEXT_PUBLIC_PUSULA_BASE_PATH":""}}', "/pusula"),
    '{"env":{"NEXT_PUBLIC_PUSULA_BASE_PATH":"/pusula"}}'
  );
  assert.equal(
    patchBasePathLiterals('NEXT_PUBLIC_PUSULA_BASE_PATH:""', "/pusula"),
    'NEXT_PUBLIC_PUSULA_BASE_PATH:"/pusula"'
  );
});

test("patchProcessEnvShim populates the Turbopack client process env", () => {
  assert.equal(
    patchProcessEnvShim("o.env={},o.argv=[]", "/pusula"),
    'o.env={PUSULA_BASE_PATH:"/pusula",NEXT_PUBLIC_PUSULA_BASE_PATH:"/pusula"},o.argv=[]'
  );
  // Non-empty env objects are left untouched (never clobber baked values).
  assert.equal(patchProcessEnvShim("o.env={A:1}", "/pusula"), "o.env={A:1}");
});

test("patchBakedAssetUrls prefixes absolute _next/static URLs", () => {
  assert.equal(
    patchBakedAssetUrls('"/_next/static/chunks/a.js"', "/pusula"),
    '"/pusula/_next/static/chunks/a.js"'
  );
  assert.equal(
    patchBakedAssetUrls("'/_next/static/media/m.png'", "/pusula"),
    "'/pusula/_next/static/media/m.png'"
  );
  // Already-prefixed URLs are stable.
  assert.equal(
    patchBakedAssetUrls('"/pusula/_next/static/a.js"', "/pusula"),
    '"/pusula/_next/static/a.js"'
  );
});

// #9124: the published (webpack) image patched to a runtime subpath served
// prefixed <script> tags but the webpack runtime still loaded every lazy chunk
// from `/_next/` (publicPath `i.p="/_next/"`), so behind a non-stripping proxy
// the dashboard never hydrated. Turbopack has the same fallback literal in its
// runtime chunk (`TURBOPACK_CHUNK_BASE_PATH:"/_next/"`).
test("patchChunkLoaderBase prefixes the webpack publicPath and Turbopack chunk base", () => {
  assert.equal(
    patchChunkLoaderBase('i.tu=e=>e,i.p="/_next/",d={78068:0}', "/pusula"),
    'i.tu=e=>e,i.p="/pusula/_next/",d={78068:0}'
  );
  assert.equal(
    patchChunkLoaderBase(
      'P="string"==typeof TURBOPACK_CHUNK_BASE_PATH?TURBOPACK_CHUNK_BASE_PATH:"/_next/",_=new Map',
      "/pusula"
    ),
    'P="string"==typeof TURBOPACK_CHUNK_BASE_PATH?TURBOPACK_CHUNK_BASE_PATH:"/pusula/_next/",_=new Map'
  );
  // getAssetPrefix() derives the prefix by searching the script src for
  // "/_next/" — that literal must stay untouched or the derived prefix breaks.
  const probe = 'let{pathname:t}=new URL(e.src),r=t.indexOf("/_next/");';
  assert.equal(patchChunkLoaderBase(probe, "/pusula"), probe);
  // assetPrefix-relative joins are already correct once assetPrefix is patched.
  const join = 'r[t].map(t=>e+"/_next/"+(0,l.encodeURIPath)(t))';
  assert.equal(patchChunkLoaderBase(join, "/pusula"), join);
  // webpack client-reference manifests: SSR renders the client-chunk <script>
  // tags from moduleLoading.prefix, not from assetPrefix.
  assert.equal(
    patchChunkLoaderBase('m["/page"]={"moduleLoading":{"prefix":"/_next/"},"x":1}', "/pusula"),
    'm["/page"]={"moduleLoading":{"prefix":"/pusula/_next/"},"x":1}'
  );
  // Turbopack manifests carry an empty prefix (paths already hold /_next/static).
  assert.equal(
    patchChunkLoaderBase('{"moduleLoading":{"prefix":""}}', "/pusula"),
    '{"moduleLoading":{"prefix":""}}'
  );
  // Idempotent.
  assert.equal(patchChunkLoaderBase('i.p="/pusula/_next/"', "/pusula"), 'i.p="/pusula/_next/"');
});

test("patchCssAssetUrls prefixes unquoted and quoted CSS url() asset references", () => {
  assert.equal(
    patchCssAssetUrls('src:url(/_next/static/media/icons.b8b9.woff2) format("woff2")', "/pusula"),
    'src:url(/pusula/_next/static/media/icons.b8b9.woff2) format("woff2")'
  );
  assert.equal(
    patchCssAssetUrls("url('/_next/static/media/a.png')", "/pusula"),
    "url('/pusula/_next/static/media/a.png')"
  );
  assert.equal(
    patchCssAssetUrls("url(/pusula/_next/static/media/a.png)", "/pusula"),
    "url(/pusula/_next/static/media/a.png)"
  );
});

test("patchStandaloneBasePath rewrites the chunk loader and static CSS (#9124)", () => {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pusula-standalone-9124-"));
  const distRoot = path.join(appRoot, ".build", "next");
  fs.mkdirSync(path.join(distRoot, "static", "chunks"), { recursive: true });
  fs.mkdirSync(path.join(distRoot, "static", "css"), { recursive: true });
  fs.writeFileSync(path.join(distRoot, "routes-manifest.json"), JSON.stringify({ basePath: "" }));
  const runtime = path.join(distRoot, "static", "chunks", "webpack-abc.js");
  fs.writeFileSync(runtime, 'i.p="/_next/",d={1:0}');
  const css = path.join(distRoot, "static", "css", "app.css");
  fs.writeFileSync(css, "@font-face{src:url(/_next/static/media/f.woff2)}");

  patchStandaloneBasePath({ appRoot, fromBasePath: "", toBasePath: "/pusula" });

  assert.equal(fs.readFileSync(runtime, "utf8"), 'i.p="/pusula/_next/",d={1:0}');
  assert.equal(
    fs.readFileSync(css, "utf8"),
    "@font-face{src:url(/pusula/_next/static/media/f.woff2)}"
  );
});
