import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  BENCH_COMPACT,
  BENCH_WIDE,
  PROMPT_COLS,
  PROMPT_ROWS,
  PROMPT_TILES,
  RATIO_MAX,
  RATIO_MIN,
  CACHE_LATENCY_VALUE,
  COMPRESSION_VALUE,
  a2aExchange,
  compressionAnnotation,
  anchorCss,
  anchorX,
  envelopeAt,
  expectedReduction,
  hitHeaders,
  laneEntryRows,
  ledCell,
  lensAnchor,
  lensRates,
  ledForPacket,
  ledGrid,
  ledPhase,
  ledWave,
  missHeaders,
  promptOutcome,
  promptTiles,
  survivalByStage,
  unitHash,
} from "../../src/app/landing/components/engine/benchModel.ts";
import {
  A2A_METHODS,
  A2A_SKILLS,
  HEADER,
  MCP_TOOL_COUNT,
  type CompressionEngine,
} from "../../src/app/landing/landingTypes.ts";
import {
  formatCompressionAnnotation,
  formatCompressionMeta,
} from "../../open-sse/services/compression/planResolution.ts";
import { buildNonStreamingResponseHeaders } from "../../open-sse/handlers/chatCore/nonStreamingResponseHeaders.ts";
import { PUSULA_RESPONSE_HEADERS } from "../../src/shared/constants/headers.ts";

/** The shipped stack (ENGINE_IDS order, `guidance.lossy`), as `buildCompressionEngineList` returns it. */
const ENGINES: CompressionEngine[] = [
  { id: "session-dedup", label: "Session Dedup", lossy: false },
  { id: "ccr", label: "CCR (Retrieval)", lossy: false },
  { id: "lite", label: "Lite", lossy: false },
  { id: "rtk", label: "RTK", lossy: true },
  { id: "codex-responses", label: "Responses Tool Output", lossy: true },
  { id: "headroom", label: "Headroom", lossy: false },
  { id: "relevance", label: "Relevance", lossy: true },
  { id: "caveman", label: "Caveman", lossy: true },
  { id: "aggressive", label: "Aggressive", lossy: true },
  { id: "llmlingua", label: "LLMLingua (SLM)", lossy: true },
  { id: "ultra", label: "Ultra", lossy: true },
  { id: "omniglyph", label: "OmniGlyph", lossy: true },
];

test("removal rates: uniform within a class, lossy lenses off under lossless-only", () => {
  const full = lensRates(ENGINES, false);
  const lossless = lensRates(ENGINES, true);
  const lossyRates = new Set<number>();
  const losslessRates = new Set<number>();
  ENGINES.forEach((engine, i) => {
    (engine.lossy ? lossyRates : losslessRates).add(full[i]);
    if (engine.lossy) assert.equal(lossless[i], 0);
    else assert.equal(lossless[i], full[i]);
  });
  assert.equal(lossyRates.size, 1, "no lossy engine reads as saving more than another");
  assert.equal(losslessRates.size, 1, "no lossless engine reads as saving more than another");
});

test("end reduction: about 60% full stack, about 20% lossless only, inside 15–95%", () => {
  const full = expectedReduction(ENGINES, false);
  const lossless = expectedReduction(ENGINES, true);
  assert.ok(Math.abs(full - 0.6) < 0.04, `full stack ${full}`);
  assert.ok(Math.abs(lossless - 0.2) < 0.04, `lossless only ${lossless}`);
  for (const r of [full, lossless]) assert.ok(r >= RATIO_MIN && r <= RATIO_MAX);
  const survival = survivalByStage(lensRates(ENGINES, false));
  assert.equal(survival[0], 1);
  for (let i = 1; i < survival.length; i++) assert.ok(survival[i] <= survival[i - 1]);
});

test("unitHash is deterministic, in [0, 1) and roughly uniform", () => {
  assert.equal(unitHash(12, 7), unitHash(12, 7));
  assert.notEqual(unitHash(12, 7), unitHash(7, 12));
  let below = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) {
    const v = unitHash(i, i % 12);
    assert.ok(v >= 0 && v < 1);
    if (v < 0.25) below++;
  }
  assert.ok(Math.abs(below / n - 0.25) < 0.02, `share below .25: ${below / n}`);
});

test("prompt tiles: 48 justified word-blocks, deterministic per seed", () => {
  const tiles = promptTiles(0);
  assert.equal(tiles.length, PROMPT_TILES);
  assert.equal(PROMPT_ROWS * PROMPT_COLS, PROMPT_TILES);
  assert.deepEqual(promptTiles(0), tiles);
  assert.notDeepEqual(promptTiles(1), tiles);
  for (let row = 0; row < PROMPT_ROWS; row++) {
    const inRow = tiles.filter((tile) => tile.row === row);
    assert.equal(inRow.length, PROMPT_COLS);
    const end = inRow[inRow.length - 1].x + inRow[inRow.length - 1].w;
    if (row < PROMPT_ROWS - 1) assert.ok(Math.abs(end - 1) < 0.002, `row ${row} ends at ${end}`);
    else assert.ok(end < 0.7, "the last row ends early");
    for (const tile of inRow) assert.ok(tile.w > 0.04 && tile.x >= 0);
  }
});

test("prompt outcome: always inside the documented band and self-consistent", () => {
  const min = Math.ceil(RATIO_MIN * PROMPT_TILES);
  const max = Math.floor(RATIO_MAX * PROMPT_TILES);
  let fullSum = 0;
  let losslessSum = 0;
  for (let seed = 0; seed < 300; seed++) {
    for (const losslessOnly of [false, true]) {
      const outcome = promptOutcome(seed, ENGINES, losslessOnly);
      const counted = outcome.removedAt.filter((k) => k >= 0).length;
      assert.equal(outcome.removed, counted);
      assert.ok(
        outcome.removed >= min && outcome.removed <= max,
        `seed ${seed}: ${outcome.removed}`
      );
      for (const k of outcome.removedAt) {
        if (k < 0) continue;
        assert.ok(k < ENGINES.length);
        if (losslessOnly) assert.equal(ENGINES[k].lossy, false, "a disabled lens removed a tile");
      }
      if (losslessOnly) losslessSum += outcome.removed;
      else fullSum += outcome.removed;
    }
  }
  assert.ok(Math.abs(fullSum / 300 / PROMPT_TILES - 0.6) < 0.05);
  assert.ok(Math.abs(losslessSum / 300 / PROMPT_TILES - 0.22) < 0.05);
  assert.deepEqual(promptOutcome(3, ENGINES, false), promptOutcome(3, ENGINES, false));
});

test("headers: a MISS shows what the gateway sends, with the illustration's token counts", () => {
  const miss = missHeaders(29);
  assert.deepEqual(
    miss.map((h) => h.name),
    [HEADER.cache, HEADER.compression]
  );
  assert.equal(miss[0].value, "MISS");
  assert.equal(miss[1].value, "stacked; source=active-profile; tokens=48->19; rules: …");
  // The value is exactly what the gateway renders for a stacked plan from the active profile…
  assert.equal(
    formatCompressionMeta({ mode: "stacked", stackedPipeline: [], source: "active-profile" }),
    COMPRESSION_VALUE
  );
  // …followed by its annotation, whose rule list the page elides.
  const real = formatCompressionAnnotation({
    originalTokens: PROMPT_TILES,
    compressedTokens: PROMPT_TILES - 29,
    rulesApplied: ["hedging", "pleasantries", "hedging"],
  } as Parameters<typeof formatCompressionAnnotation>[0]);
  const shown = compressionAnnotation(29);
  assert.ok(shown.endsWith("rules: …"));
  assert.ok(real.startsWith(shown.slice(0, -1)), `${real} does not start like ${shown}`);
  assert.equal(compressionAnnotation(0), "tokens=48->48; rules: …");

  // A cache MISS carries the cache marker and the compression header, never Savings-Tokens.
  const sent = buildNonStreamingResponseHeaders(
    {
      provider: "openai",
      model: "gpt",
      startTime: 0,
      responseUsage: null,
      estimatedCost: 0,
      requestId: "r",
      compressionResponseMeta: `${COMPRESSION_VALUE}; ${real}`,
    },
    { attachPusulaMetaHeaders: () => {}, now: () => 0 }
  );
  assert.equal(sent[PUSULA_RESPONSE_HEADERS.cache], miss[0].value);
  assert.ok(sent[PUSULA_RESPONSE_HEADERS.compression].startsWith(miss[1].value.slice(0, -1)));
  assert.equal(sent[PUSULA_RESPONSE_HEADERS.savingsTokens], undefined);
});

test("headers: an exact repeat HIT shows only what the cache sends for it", () => {
  const hit = hitHeaders();
  assert.deepEqual(
    hit.map((h) => `${h.name}: ${h.value}`),
    [`${HEADER.cache}: HIT`, `${HEADER.cacheLatency}: synthetic`]
  );
  assert.equal(CACHE_LATENCY_VALUE, "synthetic");
  // Pinned to the cache's own code: these two are set on every hit, the similarity only on a
  // semantic one (never on the exact repeat "Send it again" depicts).
  const source = fs.readFileSync(
    path.join(process.cwd(), "open-sse/handlers/chatCore/semanticCache.ts"),
    "utf8"
  );
  assert.match(source, /\[PUSULA_RESPONSE_HEADERS\.cache\]: "HIT"/);
  assert.match(source, /\[PUSULA_RESPONSE_HEADERS\.cacheLatency\]: "synthetic"/);
  assert.match(
    source,
    /if \(hitType === "semantic"[^\n]*\)\s*\{\s*headers\[PUSULA_RESPONSE_HEADERS\.cacheSimilarity\]/
  );
});

test("bench geometry: the flow is ordered source → mirror → lenses → port at every width", () => {
  for (const [g, widths] of [
    [BENCH_WIDE, [704, 960, 1200, 1376, 1440]],
    [BENCH_COMPACT, [288, 326, 358, 735]],
  ] as const) {
    for (const w of widths) {
      const src = anchorX(g.srcW, w);
      const mirror = anchorX(g.mirror, w);
      const first = anchorX(lensAnchor(g, 0, 12), w);
      const last = anchorX(lensAnchor(g, 11, 12), w);
      const port = anchorX(g.port, w);
      assert.ok(src < mirror && mirror < first && first < last && last < port, `w ${w}`);
      assert.ok(port + g.portR <= w, `port inside the box at ${w}`);
      const step = (last - first) / 11;
      assert.ok(step > (g === BENCH_WIDE ? 32 : 12), `lens spacing ${step} at ${w}`);
    }
  }
  assert.equal(anchorCss({ a: 0.16, b: 102 }), "calc(16% + 102px)");
  assert.equal(anchorCss({ a: 1, b: -28 }), "calc(100% - 28px)");
  assert.equal(anchorCss({ a: 0.2, b: 0 }), "20%");
  assert.ok(envelopeAt(46, 0.4) < 46 && envelopeAt(46, 0.4) > 20);
});

test("MCP matrix: exactly n lights, 11 × 10 for 110", () => {
  assert.deepEqual(ledGrid(MCP_TOOL_COUNT), { cols: 11, rows: 10 });
  for (const n of [1, 7, 33, 110, 140]) {
    const { cols, rows } = ledGrid(n);
    assert.ok(cols * rows >= n && cols * (rows - 1) < n, `n ${n}`);
  }
  assert.deepEqual(ledGrid(0), { cols: 0, rows: 0 });
  assert.equal(ledWave(0, 11, 10), 0);
  assert.equal(ledWave(109, 11, 10), 1);
  for (let i = 0; i < 110; i++) {
    const p = ledPhase(i);
    assert.ok(p >= 0 && p < 1);
    const led = ledForPacket(i, 110);
    assert.ok(led >= 0 && led < 110);
  }
});

test("MCP matrix: lanes enter on evenly spaced, centred rows; cells map row-major", () => {
  assert.deepEqual(laneEntryRows(10), [1, 4, 7]);
  assert.deepEqual(laneEntryRows(11), [2, 5, 8]);
  assert.deepEqual(laneEntryRows(3), [0, 1, 2]);
  for (const rows of [1, 2, 4, 9, 10, 13]) {
    const entry = laneEntryRows(rows);
    assert.equal(entry.length, 3);
    for (const r of entry) assert.ok(r >= 0 && r < rows, `rows ${rows}: ${entry.join(",")}`);
    for (let i = 1; i < entry.length; i++) assert.ok(entry[i] >= entry[i - 1]);
  }
  const { cols, rows } = ledGrid(MCP_TOOL_COUNT);
  assert.deepEqual(ledCell(0, cols), { row: 0, col: 0 });
  assert.deepEqual(ledCell(MCP_TOOL_COUNT - 1, cols), { row: rows - 1, col: cols - 1 });
  assert.deepEqual(ledCell(12, 11), { row: 1, col: 1 });
});

test("A2A exchanges use real method names and task states only", () => {
  const states = new Set(["working", "completed"]);
  A2A_SKILLS.forEach((skill, i) => {
    const lines = a2aExchange(skill, i, A2A_METHODS);
    assert.ok(lines[0].text.includes(`skill: ${skill}`));
    for (const line of lines) {
      if (line.method) assert.ok((A2A_METHODS as readonly string[]).includes(line.method));
      if (line.dir === "in") assert.ok(states.has(line.text.replace("← ", "")));
    }
  });
  assert.equal(a2aExchange("health-report", 0, A2A_METHODS)[0].method, "message/send");
  assert.equal(a2aExchange("health-report", 1, A2A_METHODS)[0].method, "message/stream");
});
