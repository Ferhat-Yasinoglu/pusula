import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_WEIGHTS } from "../../open-sse/services/autoCombo/scoring.ts";
import { HEADER, SAMPLE_CANDIDATES } from "../../src/app/landing/landingTypes.ts";
import {
  CANDIDATE_IDS,
  LATENCY_MS,
  act,
  advanceUntil,
  candidate,
  createWorld,
  nextTake,
  rank,
  type Featured,
  type World,
} from "../../src/app/landing/sim/landingSim.ts";
import {
  AUTO_LITERAL,
  SNIPPET_LANGS,
  commentLine,
  commentPrefix,
  isSnippetLang,
  snippet,
  snippetLines,
  tokenizeLine,
  type SnippetLang,
} from "../../src/app/landing/components/tools/toolsSnippets.ts";
import {
  FUNNEL_LINES,
  HEADER_CPS,
  LUT_POINTS,
  LUT_STRIDE,
  PACKET_MS,
  PHONE_VISIBLE_TOOLS,
  REPLY_WORD_MS,
  RUN_SAMPLE,
  SKIP_REASON,
  SPIN_MS,
  STOP_MS,
  bayColumns,
  buildRun,
  cablePath,
  cornerSeg,
  candidateBearing,
  catalogIdOf,
  headerProviderOf,
  createRunFrame,
  dropCable,
  easeInOutCubic,
  fillCableLut,
  fillPathLut,
  lineSeg,
  lutAt,
  nearestLine,
  pathData,
  rovingTarget,
  runFrameAt,
  runHeaders,
  runPlan,
  sagCable,
  seededUuid,
  skippedOpen,
  spanCable,
  spreadAnchors,
  trayCables,
  wordEnds,
  type Cubic,
  type TrayJack,
} from "../../src/app/landing/components/tools/toolsRig.ts";

const BASE = "http://localhost:20128";
const LANGS: readonly SnippetLang[] = ["curl", "javascript", "python"];

/** The factor list the page passes in: `LandingStats.scoringFactors`, weight-descending. */
const FACTORS = Object.entries(DEFAULT_WEIGHTS as unknown as Record<string, number>)
  .map(([id, weight]) => ({ id, weight }))
  .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));

function world(): World {
  return createWorld({
    factorIds: FACTORS.map((f) => f.id),
    defaults: FACTORS.map((f) => f.weight),
  });
}

/* ------------------------------------------------------------------------ */
/* Snippets (moved unchanged from the old components/Tools.tsx)             */
/* ------------------------------------------------------------------------ */

test("snippet: the old Tools.tsx builder, Python now importing os", () => {
  assert.equal(
    snippet("curl", BASE),
    [
      `curl ${BASE}/v1/chat/completions \\`,
      `  -H "Authorization: Bearer $PUSULA_API_KEY" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'`,
    ].join("\n")
  );
  assert.equal(
    snippet("javascript", BASE),
    [
      `import OpenAI from "openai";`,
      ``,
      `const client = new OpenAI({`,
      `  baseURL: "${BASE}/v1",`,
      `  apiKey: process.env.PUSULA_API_KEY,`,
      `});`,
      ``,
      `const reply = await client.chat.completions.create({`,
      `  model: "auto",`,
      `  messages: [{ role: "user", content: "Hello" }],`,
      `});`,
    ].join("\n")
  );
  assert.equal(
    snippet("python", BASE),
    [
      `import os`,
      `from openai import OpenAI`,
      ``,
      `client = OpenAI(base_url="${BASE}/v1", api_key=os.environ["PUSULA_API_KEY"])`,
      ``,
      `reply = client.chat.completions.create(`,
      `    model="auto",`,
      `    messages=[{"role": "user", "content": "Hello"}],`,
      `)`,
    ].join("\n")
  );
});

test("snippet langs: three tabs in the old order, ids recognised", () => {
  assert.deepEqual(
    SNIPPET_LANGS.map((l) => l.id),
    LANGS
  );
  for (const lang of LANGS) assert.ok(isSnippetLang(lang));
  assert.equal(isSnippetLang("ruby"), false);
});

test("tokens: every line joins back to the snippet exactly", () => {
  for (const base of [BASE, "https://pusula.example.com/sub"]) {
    for (const lang of LANGS) {
      const lines = snippetLines(lang, base);
      assert.equal(lines.map((l) => l.text).join("\n"), snippet(lang, base));
      for (const line of lines) {
        assert.equal(line.tokens.map((tok) => tok.t).join(""), line.text, `${lang}: ${line.text}`);
        for (const tok of line.tokens) assert.ok(tok.t.length > 0, "no empty tokens");
      }
    }
  }
});

test('tokens: "auto" is the one ember token, the base URL the one gold-hi token', () => {
  for (const lang of LANGS) {
    const tokens = snippetLines(lang, BASE).flatMap((l) => l.tokens);
    const accents = tokens.filter((tok) => tok.c === "accent");
    assert.deepEqual(
      accents.map((tok) => tok.t),
      [AUTO_LITERAL],
      lang
    );
    const urls = tokens.filter((tok) => tok.c === "num");
    assert.deepEqual(
      urls.map((tok) => tok.t),
      [`${BASE}/v1`],
      lang
    );
  }
});

test("tokens: keywords, flags and strings are coloured; plain words are not", () => {
  const curl = tokenizeLine(`  -H "Content-Type: application/json" \\`, `${BASE}/v1`);
  assert.deepEqual(curl, [
    { t: "  " },
    { t: "-H", c: "kw" },
    { t: " " },
    { t: '"Content-Type: application/json"', c: "str" },
    { t: " \\" },
  ]);
  const js = tokenizeLine(`import OpenAI from "openai";`, `${BASE}/v1`);
  assert.deepEqual(js, [
    { t: "import", c: "kw" },
    { t: " OpenAI " },
    { t: "from", c: "kw" },
    { t: " " },
    { t: '"openai"', c: "str" },
    { t: ";" },
  ]);
});

test("comment line: valid comment syntax per language; RTL text isolated", () => {
  assert.equal(commentPrefix("curl"), "# ");
  assert.equal(commentPrefix("python"), "# ");
  assert.equal(commentPrefix("javascript"), "// ");
  const en = commentLine("javascript", "Cursor: point its base URL here, model auto", false);
  assert.equal(en.text, "// Cursor: point its base URL here, model auto");
  assert.equal(en.tokens.map((t) => t.t).join(""), en.text);
  const fa = commentLine("curl", "Cursor: آدرس پایه‌اش را به اینجا بده، مدل auto", true);
  assert.ok(fa.text.startsWith("# ⁧"));
  assert.ok(fa.text.endsWith("⁩"));
  assert.equal(fa.tokens.map((t) => t.t).join(""), fa.text);
});

/* ------------------------------------------------------------------------ */
/* Bay and cables                                                           */
/* ------------------------------------------------------------------------ */

test("bay: ceil(√n) columns (36 tools → 6×6); phone shows 11 first", () => {
  assert.equal(bayColumns(36), 6);
  assert.equal(bayColumns(37), 7);
  assert.equal(bayColumns(1), 1);
  assert.equal(bayColumns(0), 1);
  assert.equal(PHONE_VISIBLE_TOOLS, 11);
  assert.equal(FUNNEL_LINES, 7);
});

test("roving focus: arrows step (mirrored in RTL), rows jump by cols, ends clamp", () => {
  assert.equal(rovingTarget("ArrowRight", 0, 36, 6, false), 1);
  assert.equal(rovingTarget("ArrowRight", 0, 36, 6, true), 0, "RTL: right is backwards");
  assert.equal(rovingTarget("ArrowLeft", 5, 36, 6, true), 6);
  assert.equal(rovingTarget("ArrowDown", 2, 36, 6, false), 8);
  assert.equal(rovingTarget("ArrowDown", 33, 36, 6, false), 35, "clamped to the last jack");
  assert.equal(rovingTarget("ArrowUp", 2, 36, 6, false), 0);
  assert.equal(rovingTarget("ArrowDown", 3, 12, 1, false), 4, "a chip cloud steps by one");
  assert.equal(rovingTarget("Home", 20, 36, 6, false), 0);
  assert.equal(rovingTarget("End", 0, 12, 1, false), 11);
  assert.equal(rovingTarget("Enter", 0, 36, 6, false), null);
  assert.equal(rovingTarget("ArrowRight", 0, 0, 6, false), null);
});

test("cables: end points are exact, the sag hangs below the chord, RTL mirrors", () => {
  const c = sagCable(0, 100, 400, 100);
  assert.deepEqual([c[0], c[1], c[6], c[7]], [0, 100, 400, 100]);
  assert.ok(c[3] > 100 && c[5] > 100, "both control points hang below a level chord");
  const mirrored = sagCable(400, 100, 0, 100);
  assert.equal(mirrored[2], 400 - c[2]);
  assert.equal(mirrored[3], c[3]);
  const drop = dropCable(10, 0, 50, 100);
  assert.deepEqual([drop[0], drop[1], drop[6], drop[7]], [10, 0, 50, 100]);
  assert.equal(drop[2], 10);
  assert.equal(drop[4], 50);
  const span = spanCable(0, 0, 100, 20);
  assert.deepEqual([span[6], span[7]], [100, 20]);
  assert.equal(cablePath([0, 0, 1.234, 2.25, 3, 4, 5.05, 6]), "M0 0C1.2 2.3 3 4 5.1 6");
});

test("cable LUT: 32 points, both ends exact, evenly spaced by arc length", () => {
  const c = sagCable(0, 0, 300, 40);
  const lut = new Float32Array(LUT_STRIDE * 2);
  fillCableLut(c, lut, LUT_STRIDE);
  assert.equal(LUT_POINTS, 32);
  assert.ok(Math.abs(lut[LUT_STRIDE] - 0) < 1e-3 && Math.abs(lut[LUT_STRIDE + 1] - 0) < 1e-3);
  assert.ok(Math.abs(lut[LUT_STRIDE * 2 - 2] - 300) < 1e-2);
  assert.ok(Math.abs(lut[LUT_STRIDE * 2 - 1] - 40) < 1e-2);
  const steps: number[] = [];
  for (let k = 1; k < LUT_POINTS; k++) {
    const i = LUT_STRIDE + k * 2;
    steps.push(Math.hypot(lut[i] - lut[i - 2], lut[i + 1] - lut[i - 1]));
  }
  const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
  for (const s of steps) assert.ok(Math.abs(s - mean) / mean < 0.03, `step ${s} vs ${mean}`);

  const out = new Float32Array(2);
  lutAt(lut, LUT_STRIDE, 0, out);
  assert.ok(Math.abs(out[0]) < 1e-3);
  lutAt(lut, LUT_STRIDE, 1, out);
  assert.ok(Math.abs(out[0] - 300) < 1e-2);
  lutAt(lut, LUT_STRIDE, 2, out); // clamped
  assert.ok(Math.abs(out[0] - 300) < 1e-2);
  lutAt(lut, LUT_STRIDE, 0.5, out);
  assert.ok(out[0] > 100 && out[0] < 200);
});

test("funnel: anchors spread evenly; a chip rides the nearest line", () => {
  const anchors = spreadAnchors(0, 120, 4, 0);
  assert.deepEqual(anchors, [0, 40, 80, 120]);
  assert.deepEqual(spreadAnchors(0, 100, 1), [50]);
  assert.equal(nearestLine(anchors, 55), 1);
  assert.equal(nearestLine(anchors, 61), 2);
  assert.equal(nearestLine([], 10), -1);
});

/** Every segment starts where the previous one ended. */
function assertContinuous(path: readonly Cubic[], label: string): void {
  for (let i = 1; i < path.length; i++) {
    assert.ok(
      Math.abs(path[i][0] - path[i - 1][6]) < 1e-9 && Math.abs(path[i][1] - path[i - 1][7]) < 1e-9,
      `${label}: segment ${i} is joined`
    );
  }
}

/** Points along a path (dense), for crossing checks. */
function sample(path: readonly Cubic[], per = 24): [number, number][] {
  const out: [number, number][] = [];
  for (const c of path) {
    for (let s = 0; s <= per; s++) {
      const t = s / per;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const d = 3 * u * t * t;
      const e = t * t * t;
      out.push([
        a * c[0] + b * c[2] + d * c[4] + e * c[6],
        a * c[1] + b * c[3] + d * c[5] + e * c[7],
      ]);
    }
  }
  return out;
}

/** True when two polylines cross (proper segment intersections only). */
function crosses(p: [number, number][], q: [number, number][]): boolean {
  const orient = (a: [number, number], b: [number, number], c: [number, number]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 1; i < p.length; i++) {
    for (let j = 1; j < q.length; j++) {
      const d1 = orient(q[j - 1], q[j], p[i - 1]);
      const d2 = orient(q[j - 1], q[j], p[i]);
      const d3 = orient(p[i - 1], p[i], q[j - 1]);
      const d4 = orient(p[i - 1], p[i], q[j]);
      if (d1 * d2 < -1e-6 && d3 * d4 < -1e-6) return true;
    }
  }
  return false;
}

/** A 6×6 bay of 70px plates with 16px trays, its hub 60px to the right (or left). */
function bayFixture(side: 1 | -1) {
  const cols = 6;
  const plate = 70;
  const gap = 6;
  const tray = 16;
  const rowPitch = 78 + tray;
  const left = 12;
  const gridW = cols * plate + (cols - 1) * gap;
  const jacks: TrayJack[] = [];
  const trayY: number[] = [];
  for (let r = 0; r < cols; r++) {
    const top = 40 + tray + r * rowPitch;
    trayY.push(top - tray / 2);
    for (let c = 0; c < cols; c++) {
      const x0 = left + c * (plate + gap) + plate / 2;
      jacks.push({ x: side === 1 ? x0 : left + gridW - (x0 - left), y: top + 18, row: r });
    }
  }
  const gridEdge = side === 1 ? left + gridW : left;
  const bayEdge = side === 1 ? gridEdge + 13 : gridEdge - 13;
  const hub = { x: side === 1 ? bayEdge + 32 + 88 : bayEdge - 32 - 88, y: 330, r: 73 };
  return { side, jacks, trayY, gridEdge, bayEdge, hub, cols };
}

test("pathData and lineSeg / cornerSeg: joined segments, straight lines, round bends", () => {
  const line = lineSeg(0, 0, 30, 0);
  assert.deepEqual(line, [0, 0, 10, 0, 20, 0, 30, 0]);
  const bend = cornerSeg(0, 10, 10, 0, true);
  assert.deepEqual([bend[0], bend[1], bend[6], bend[7]], [0, 10, 10, 0]);
  assert.equal(bend[2], 0, "leaves vertically");
  assert.equal(bend[5], 0, "arrives level");
  assert.equal(pathData([line, lineSeg(30, 0, 30, 9)]), "M0 0C10 0 20 0 30 0C30 3 30 6 30 9");
  assert.equal(pathData([]), "");
  const lut = new Float32Array(LUT_STRIDE);
  const len = fillPathLut([line, lineSeg(30, 0, 30, 40)], lut, 0);
  assert.ok(Math.abs(len - 70) < 1e-6, "length sums the segments");
  assert.ok(Math.abs(lut[LUT_STRIDE - 2] - 30) < 1e-3 && Math.abs(lut[LUT_STRIDE - 1] - 40) < 1e-3);
});

test("trays: each cable runs plug → tray → bus → rim, joined, ending under the hub", () => {
  for (const side of [1, -1] as const) {
    const f = bayFixture(side);
    const paths = trayCables(f);
    assert.equal(paths.length, f.jacks.length);
    paths.forEach((path, i) => {
      assert.ok(path.length >= 3, "riser, tray and bus");
      assertContinuous(path, `side ${side} jack ${i}`);
      assert.equal(path[0][0], f.jacks[i].x);
      assert.equal(path[0][1], f.jacks[i].y, "starts at the plug");
      const end = path[path.length - 1];
      const d = Math.hypot(end[6] - f.hub.x, end[7] - f.hub.y);
      assert.ok(d < f.hub.r, "ends inside the rim (tucked under the dial face)");
      assert.ok(Math.abs(end[7] - f.hub.y) < 20, "enters near the hub's middle");
      // Never doubles back towards the far end of the bay after leaving the plug.
      const pts = sample(path.slice(1));
      for (let k = 1; k < pts.length; k++) {
        assert.ok(
          side * (pts[k][0] - pts[k - 1][0]) > -1e-6,
          `side ${side} jack ${i} heads to the hub`
        );
      }
    });
  }
});

test("trays: in a row the farthest jack rides the top strand; no two cables cross", () => {
  const f = bayFixture(1);
  const paths = trayCables(f);
  // Row 2: strand heights where each cable runs along the tray.
  const row = f.jacks.map((j, i) => ({ j, i })).filter(({ j }) => j.row === 2);
  const strandY = row.map(({ i }) => paths[i][2][1]);
  for (let k = 1; k < strandY.length; k++) assert.ok(strandY[k] > strandY[k - 1]);
  // Cables of different rows never cross (strands of one row merge into its bus by design).
  const pts = paths.map((p) => sample(p, 12));
  const lead = [0, 6, 12, 18, 24, 30].map((r) => r + 5); // the hub-end jack of each row
  const far = [0, 6, 12, 18, 24, 30]; // the far-end jack of each row
  for (const a of [...lead, ...far]) {
    for (const b of [...lead, ...far]) {
      if (f.jacks[a].row === f.jacks[b].row) continue;
      assert.equal(crosses(pts[a], pts[b]), false, `jack ${a} vs ${b}`);
    }
  }
  // A row whose tray is level with its inlet runs straight in.
  const level = trayCables({ ...f, trayY: [f.hub.y], jacks: [{ x: 40, y: f.hub.y + 30, row: 0 }] });
  assert.equal(level[0][level[0].length - 1][7], f.hub.y);
  // A hidden jack gets no cable.
  assert.deepEqual(trayCables({ ...f, jacks: [{ x: 0, y: 0, row: -1 }] }), [[]]);
});

/* ------------------------------------------------------------------------ */
/* The simulated run                                                        */
/* ------------------------------------------------------------------------ */

test("hub dial: six candidates, 60° apart clockwise from north; catalog ids", () => {
  assert.deepEqual(
    CANDIDATE_IDS.map((id) => candidateBearing(id)),
    [0, 60, 120, 180, 240, 300]
  );
  for (const c of SAMPLE_CANDIDATES) {
    assert.equal(catalogIdOf(c.id), c.catalogId);
    assert.equal(headerProviderOf(c.id), c.alias);
  }
});

test("seeded ids: UUID v4 layout, deterministic per seed", () => {
  const a = seededUuid(42);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(a, seededUuid(42));
  assert.notEqual(a, seededUuid(43));
});

test("run: the tick-0 take is claude, served, no fallback (what SSR shows)", () => {
  const w = world();
  const run = buildRun(w.featured, []);
  assert.equal(run.winner, "claude");
  assert.equal(run.provider, "cc", "X-Pusula-Provider carries the alias (getProviderAlias)");
  assert.equal(run.fallbackAttempts, 0);
  assert.deepEqual(run.stops, [{ id: "claude", kind: "win", code: null }]);
  assert.ok(run.latencyMs >= LATENCY_MS[0] && run.latencyMs <= LATENCY_MS[1]);
  assert.deepEqual(buildRun(w.featured, []), run, "deterministic");
  const rows = runHeaders(run, HEADER);
  assert.deepEqual(
    rows.map((r) => r.name),
    [HEADER.provider, HEADER.latencyMs, HEADER.requestId],
    "no fallback, no X-Pusula-Fallback-Attempts (the gateway omits a zero)"
  );
});

test("run: a failing winner shows the hub retrying the next target (503, attempts 1)", () => {
  const w = world();
  act.setUpstreamDown("claude", true)(w);
  const skipped = skippedOpen(w, RUN_SAMPLE);
  assert.deepEqual(skipped, [], "closed breaker: claude is attempted, not skipped");
  nextTake(w, RUN_SAMPLE);
  const run = buildRun(w.featured, skipped);
  assert.equal(run.stops[0].id, "claude");
  assert.equal(run.stops[0].kind, "fail");
  assert.equal(run.stops[0].code, 503);
  assert.equal(run.stops.at(-1)?.kind, "win");
  assert.notEqual(run.winner, "claude");
  assert.equal(run.fallbackAttempts, 1);
  assert.equal(run.provider, headerProviderOf(run.winner ?? "claude"));
  const rows = runHeaders(run, HEADER);
  assert.deepEqual(rows.map((r) => [r.name, r.value]).slice(0, 2), [
    [HEADER.provider, run.provider],
    [HEADER.fallbackAttempts, "1"],
  ]);
});

test("run: an OPEN breaker the ranking would have chosen is shown as skipped", () => {
  const w = world();
  act.setUpstreamDown("claude", true)(w);
  assert.ok(advanceUntil(w, () => candidate(w, "claude").breaker.state === "open", 120_000));
  assert.ok(!rank(w, RUN_SAMPLE).some((e) => e.id === "claude"), "open is excluded from rank");
  const skipped = skippedOpen(w, RUN_SAMPLE);
  assert.deepEqual(skipped, ["claude"]);
  nextTake(w, RUN_SAMPLE);
  const run = buildRun(w.featured, skipped);
  assert.deepEqual(run.stops[0], { id: "claude", kind: "skip", code: null });
  assert.equal(run.stops.at(-1)?.kind, "win");
  // The gateway counts a circuit-open skip as a fallback (bumpFallback on
  // circuit_open; the serving target reports its index): openai after a
  // skipped claude answers with X-Pusula-Fallback-Attempts: 1.
  assert.equal(run.fallbackAttempts, 1, "a skipped open breaker counts as a fallback");
  assert.equal(runHeaders(run, HEADER).find((r) => r.name === HEADER.fallbackAttempts)?.value, "1");
  assert.equal(SKIP_REASON, "circuit_open");
});

test("run: nothing could serve → 503, no provider header, attempts counted", () => {
  const featured: Featured = {
    take: 7,
    sample: RUN_SAMPLE,
    ranking: [],
    attempts: ["claude", "gpt"],
    winner: "claude",
    fallbackAttempts: 2,
    codes: [503, 429],
    served: false,
  };
  const run = buildRun(featured, ["gemini"]);
  assert.equal(run.served, false);
  assert.equal(run.fallbackAttempts, 3, "two failed targets and one skipped breaker");
  assert.equal(run.winner, null);
  assert.equal(run.provider, null);
  assert.deepEqual(
    run.stops.map((s) => [s.id, s.kind, s.code]),
    [
      ["gemini", "skip", null],
      ["claude", "fail", 503],
      ["gpt", "fail", 429],
    ]
  );
  assert.deepEqual(
    runHeaders(run, HEADER),
    [],
    "the combo's error response carries no provider, attempts, latency or request id"
  );
});

/* ------------------------------------------------------------------------ */
/* The run timeline                                                         */
/* ------------------------------------------------------------------------ */

test("timeline: lines → packet → spin → stops → reply → headers, then done", () => {
  const plan = runPlan(5, 2, 7, 120);
  const f = createRunFrame();
  runFrameAt(plan, 0, f);
  assert.equal(f.hl, 0);
  assert.equal(f.packet, -1);
  runFrameAt(plan, plan.packetStart + PACKET_MS / 2, f);
  assert.equal(f.hl, -1);
  assert.ok(Math.abs(f.packet - 0.5) < 1e-9);
  runFrameAt(plan, plan.spinStart + SPIN_MS / 2, f);
  assert.ok(Math.abs(f.spin - 0.5) < 1e-9);
  assert.equal(f.reached, 0);
  runFrameAt(plan, plan.spinStart + SPIN_MS, f);
  assert.equal(f.spin, -1);
  assert.equal(f.reached, 1, "the spin lands on the first stop");
  runFrameAt(plan, plan.spinStart + SPIN_MS + STOP_MS, f);
  assert.equal(f.reached, 2, "then the hub retries the next target");
  assert.equal(f.words, 0);
  runFrameAt(plan, plan.replyStart, f);
  assert.equal(f.words, 1);
  runFrameAt(plan, plan.replyStart + REPLY_WORD_MS * 3.5, f);
  assert.equal(f.words, 4);
  assert.equal(f.chars, 0);
  runFrameAt(plan, plan.headersStart + 500, f);
  assert.equal(f.chars, Math.floor((500 * HEADER_CPS) / 1000));
  assert.equal(f.done, false);
  runFrameAt(plan, plan.end, f);
  assert.equal(f.done, true);
  assert.deepEqual([f.hl, f.packet, f.spin, f.reached, f.words, f.chars], [-1, -1, -1, 2, 7, 120]);
});

test("timeline: the line scan is capped; long snippets scan faster", () => {
  assert.ok(runPlan(20, 1, 1, 1).packetStart <= 720 + 1e-9);
  assert.equal(runPlan(0, 1, 0, 0).packetStart, 0);
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
});

test("reply streaming: word ends cover the text, Persian included", () => {
  const en = "Hello! How can I help you today?";
  const ends = wordEnds(en);
  assert.equal(ends.length, 7);
  assert.equal(en.slice(0, ends[0]), "Hello!");
  assert.equal(ends.at(-1), en.length);
  const fa = "سلام! امروز چطور می‌توانم کمکت کنم؟";
  const faEnds = wordEnds(fa);
  assert.equal(faEnds.length, 6, "ZWNJ keeps می‌توانم one word");
  assert.equal(faEnds.at(-1), fa.length);
});
