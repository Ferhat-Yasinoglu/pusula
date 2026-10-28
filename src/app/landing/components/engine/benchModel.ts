/**
 * The engine room's pure model (spec §6.8): geometry, the illustrative
 * prompt and its outcome, the response headers that outcome produces, the
 * MCP light matrix and the A2A exchanges. No React, no DOM, no clock: the
 * server poster, the client overlay and the canvas renderer all read the
 * same numbers from here, so the three layers line up exactly.
 *
 * Truth rules this module enforces:
 * - removal rates are illustrative and uniform within a class (lossless or
 *   lossy), so no engine ever reads as "saving more" than another, and no
 *   rate is ever displayed;
 * - the end reduction stays inside the documented 15–95% band: about 60%
 *   with the full stack and about 20% with the lossless engines only;
 * - the example header values are produced by the illustration itself
 *   (`X-Pusula-Savings-Tokens` is the number of tiles this prompt lost).
 */

import { mulberry32 } from "../../sim/prng";
import { HEADER, type CompressionEngine } from "../../landingTypes";

/* ------------------------------------------------------------------------ */
/* Removal rates                                                            */
/* ------------------------------------------------------------------------ */

/** Chance a lossless lens removes a token (illustrative; never shown). */
export const RATE_LOSSLESS = 0.06;
/** Chance a lossy lens removes a token (illustrative; never shown). */
export const RATE_LOSSY = 0.082;
/** The documented savings band (`compressionEnginesDesc`): 15% to 95% of prompt tokens. */
export const RATIO_MIN = 0.15;
export const RATIO_MAX = 0.95;

/** Per-lens removal rate in stack order; lossy lenses are 0 under "Lossless only". */
export function lensRates(
  engines: readonly CompressionEngine[],
  losslessOnly: boolean,
  out: Float32Array = new Float32Array(engines.length)
): Float32Array {
  for (let i = 0; i < engines.length; i++) {
    const lossy = engines[i].lossy;
    out[i] = lossy ? (losslessOnly ? 0 : RATE_LOSSY) : RATE_LOSSLESS;
  }
  return out;
}

/**
 * Cumulative survival before each stage: `out[0] = 1`, `out[k + 1]` is the
 * share of tokens still in the beam after lens `k`.
 */
export function survivalByStage(
  rates: ArrayLike<number>,
  out: Float32Array = new Float32Array(rates.length + 1)
): Float32Array {
  out[0] = 1;
  for (let i = 0; i < rates.length; i++) out[i + 1] = out[i] * (1 - rates[i]);
  return out;
}

/** The share of prompt tokens the stack removes on average (0..1). */
export function expectedReduction(
  engines: readonly CompressionEngine[],
  losslessOnly: boolean
): number {
  const survival = survivalByStage(lensRates(engines, losslessOnly));
  return 1 - survival[engines.length];
}

/**
 * A stable integer hash of two numbers to [0, 1): the "hash32(grainId,
 * lensIdx) < rate" test of the spec, without the string conversion that
 * `sim/prng.hash32` does, so the renderer can call it per grain per frame
 * without allocating.
 */
export function unitHash(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca77);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/* ------------------------------------------------------------------------ */
/* The prompt: 48 token tiles, and what the stack does to them              */
/* ------------------------------------------------------------------------ */

export const PROMPT_TILES = 48;
export const PROMPT_ROWS = 8;
export const PROMPT_COLS = 6;
/** Gap between two tiles of a row, as a share of the block width. */
const TILE_GAP = 0.04;
/** The last row ends early, like the last line of a paragraph. */
const LAST_ROW_SPAN = 0.58;

/** One tile: its row, and its start and width as shares of the source block's width. */
export type PromptTile = { row: number; col: number; x: number; w: number };

/** The 48 abstract word-blocks of prompt `seed`: 8 justified rows of 6, seeded widths. */
export function promptTiles(seed: number): PromptTile[] {
  const rng = mulberry32((Math.imul(seed + 1, 0x2545f491) ^ 0x5eb3) | 0);
  const tiles: PromptTile[] = [];
  const raw = new Array<number>(PROMPT_COLS);
  for (let row = 0; row < PROMPT_ROWS; row++) {
    let sum = 0;
    for (let c = 0; c < PROMPT_COLS; c++) {
      raw[c] = 0.55 + rng() * 1.35;
      sum += raw[c];
    }
    const span = row === PROMPT_ROWS - 1 ? LAST_ROW_SPAN : 1;
    const available = span - TILE_GAP * (PROMPT_COLS - 1);
    let x = 0;
    for (let c = 0; c < PROMPT_COLS; c++) {
      const w = (raw[c] / sum) * available;
      tiles.push({ row, col: c, x: round4(x), w: round4(w) });
      x += w + TILE_GAP;
    }
  }
  return tiles;
}

export type PromptOutcome = {
  /** Lens index that removed each tile, or -1 when it reached upstream. */
  removedAt: Int8Array;
  /** Tiles removed: the `X-Pusula-Savings-Tokens` value of this illustration. */
  removed: number;
};

/**
 * What the stack does to prompt `seed`: a tile is removed by the first
 * active lens whose hash test it fails. If a draw ever falls outside the
 * documented 15–95% band, the next salt is tried, so every outcome the page
 * can show is inside it.
 */
export function promptOutcome(
  seed: number,
  engines: readonly CompressionEngine[],
  losslessOnly: boolean
): PromptOutcome {
  const rates = lensRates(engines, losslessOnly);
  const min = Math.ceil(RATIO_MIN * PROMPT_TILES);
  const max = Math.floor(RATIO_MAX * PROMPT_TILES);
  let best: PromptOutcome | null = null;
  for (let salt = 0; salt < 64; salt++) {
    const removedAt = new Int8Array(PROMPT_TILES).fill(-1);
    let removed = 0;
    const base = Math.imul(seed + 1, 977) + salt * 7919 + (losslessOnly ? 0x51 : 0);
    for (let i = 0; i < PROMPT_TILES; i++) {
      for (let k = 0; k < rates.length; k++) {
        if (rates[k] > 0 && unitHash(base, i * 31 + k) < rates[k]) {
          removedAt[i] = k;
          removed++;
          break;
        }
      }
    }
    const outcome = { removedAt, removed };
    if (removed >= min && removed <= max) return outcome;
    best ??= outcome;
  }
  return best as PromptOutcome;
}

/* ------------------------------------------------------------------------ */
/* Response headers                                                         */
/* ------------------------------------------------------------------------ */

export type HeaderLine = { name: string; value: string };

export const STATUS_LINE = "HTTP/1.1 200 OK";
/**
 * `formatCompressionMeta` (open-sse/services/compression/planResolution.ts)
 * renders `${plan.mode}; source=${plan.source}`; a stacked plan from the
 * active compression profile reads like this.
 */
export const COMPRESSION_VALUE = "stacked; source=active-profile";
/** `similarity.toFixed(4)` for an exact repeat. */
export const EXACT_SIMILARITY = "1.0000";

/** A fresh prompt: the cache misses, the stack runs, and the savings are this prompt's. */
export function missHeaders(savings: number): HeaderLine[] {
  return [
    { name: HEADER.cache, value: "MISS" },
    { name: HEADER.compression, value: COMPRESSION_VALUE },
    { name: HEADER.savingsTokens, value: String(savings) },
  ];
}

/** The same prompt again: answered by the semantic cache, no upstream call. */
export function hitHeaders(): HeaderLine[] {
  return [
    { name: HEADER.cache, value: "HIT" },
    { name: HEADER.cacheSimilarity, value: EXACT_SIMILARITY },
  ];
}

/* ------------------------------------------------------------------------ */
/* Bench geometry                                                           */
/* ------------------------------------------------------------------------ */

/** A horizontal position inside the bench box: `a · boxWidth + b` CSS px. */
export type Anchor = { a: number; b: number };

export type BenchGeometry = {
  /** Stage height (CSS px). */
  h: number;
  beamY: number;
  /** Half-height of the token beam before the first lens. */
  env0: number;
  /** Source block width (it starts at the box's inline start). */
  srcW: Anchor;
  /** Vertical pitch of the source block's rows, and a tile's height. */
  rowPitch: number;
  tileH: number;
  mirror: Anchor;
  mirrorTop: number;
  mirrorBottom: number;
  /** First and last lens centres; the 12 are evenly spaced between them. */
  lensFirst: Anchor;
  lensLast: Anchor;
  lensRx: number;
  lensRy: number;
  /** ◇/◆ marker centre above each lens. */
  markY: number;
  /** Where the rotated labels hang from (wide only). */
  labelY: number;
  port: Anchor;
  portR: number;
  /** Grain count at quality tier 0. */
  grains: number;
  /** Grain speed, px per second. */
  speed: number;
};

/** Below this viewport width the bench is the compact phone bench. */
export const BENCH_COMPACT_MAX = 767;

/** Desktop and tablet: full-bleed, 300px tall, labels hang beneath the lenses. */
export const BENCH_WIDE: BenchGeometry = {
  h: 300,
  beamY: 116,
  env0: 46,
  srcW: { a: 0.08, b: 50 },
  rowPitch: 14,
  tileH: 8,
  mirror: { a: 0.11, b: 72 },
  mirrorTop: 34,
  mirrorBottom: 198,
  lensFirst: { a: 0.16, b: 102 },
  lensLast: { a: 0.95, b: -84 },
  lensRx: 9,
  lensRy: 60,
  markY: 40,
  labelY: 196,
  port: { a: 1, b: -28 },
  portR: 17,
  grains: 240,
  speed: 190,
};

/**
 * Phone: 358 × 214, lenses as ticks, no labels on the canvas. The bottom
 * 52px of the band hold the engine chips (`.bench-chips`), so the drawing
 * lives in the top 160px.
 */
export const BENCH_COMPACT: BenchGeometry = {
  h: 214,
  beamY: 84,
  env0: 28,
  srcW: { a: 0.2, b: 0 },
  rowPitch: 9,
  tileH: 5,
  mirror: { a: 0.2, b: 18 },
  mirrorTop: 46,
  mirrorBottom: 124,
  lensFirst: { a: 0.2, b: 42 },
  lensLast: { a: 1, b: -46 },
  lensRx: 2,
  lensRy: 30,
  markY: 44,
  labelY: 0,
  port: { a: 1, b: -16 },
  portR: 11,
  grains: 140,
  speed: 58,
};

export function anchorX(anchor: Anchor, boxWidth: number): number {
  return anchor.a * boxWidth + anchor.b;
}

/** The same position as an inline-start offset inside the bench box (`calc()`). */
export function anchorCss(anchor: Anchor): string {
  const pct = round4(anchor.a * 100);
  const px = round4(anchor.b);
  if (px === 0) return `${pct}%`;
  return `calc(${pct}% ${px < 0 ? "-" : "+"} ${Math.abs(px)}px)`;
}

/** Lens `k` of `count`, evenly spaced from the first lens to the last. */
export function lensAnchor(g: BenchGeometry, k: number, count: number): Anchor {
  const t = count > 1 ? k / (count - 1) : 0;
  return {
    a: g.lensFirst.a + (g.lensLast.a - g.lensFirst.a) * t,
    b: g.lensFirst.b + (g.lensLast.b - g.lensFirst.b) * t,
  };
}

/**
 * Half-height of the beam after each stage, given cumulative survival: the
 * beam narrows visibly but never to a thread (`survival^0.75`).
 */
export function envelopeAt(env0: number, survival: number): number {
  return env0 * Math.pow(Math.max(0, survival), 0.75);
}

/* ------------------------------------------------------------------------ */
/* MCP light matrix                                                         */
/* ------------------------------------------------------------------------ */

/** Spec: `cols = ceil(√(n · 1.1))`, rows to fit exactly `n` lights (11 × 10 for 110). */
export function ledGrid(n: number): { cols: number; rows: number } {
  const count = Math.max(0, Math.floor(n));
  if (count === 0) return { cols: 0, rows: 0 };
  const cols = Math.ceil(Math.sqrt(count * 1.1));
  return { cols, rows: Math.ceil(count / cols) };
}

/** Power-on wave position of light `i` (0 top-start corner … 1 bottom-end corner). */
export function ledWave(i: number, cols: number, rows: number): number {
  if (cols <= 0) return 0;
  const span = cols + rows - 2;
  if (span <= 0) return 0;
  return round4(((i % cols) + Math.floor(i / cols)) / span);
}

/** A stable breathing phase (0..1) per light, so the matrix never pulses in unison. */
export function ledPhase(i: number): number {
  return round4(unitHash(i, 0x1ed));
}

/**
 * The plate rows the three waveguides enter on (wide layout): evenly spaced
 * and centred, e.g. rows 1, 4 and 7 of 10. The lanes are laid out on the
 * same pitch, so each guide meets the plate exactly on its row.
 */
export function laneEntryRows(rows: number, lanes = 3): number[] {
  if (rows <= 0) return Array.from({ length: lanes }, () => 0);
  const step = Math.max(1, Math.floor((rows - 1) / lanes));
  const first = Math.max(0, Math.floor((rows - 1 - step * (lanes - 1)) / 2));
  return Array.from({ length: lanes }, (_, i) => Math.min(rows - 1, first + i * step));
}

/** Row and column of light `i` in a grid of `cols` columns. */
export function ledCell(i: number, cols: number): { row: number; col: number } {
  if (cols <= 0) return { row: 0, col: 0 };
  return { row: Math.floor(i / cols), col: i % cols };
}

/** Which light packet `seq` lands on. Positions are not a map of the real tools. */
export function ledForPacket(seq: number, n: number): number {
  if (n <= 0) return -1;
  return Math.min(n - 1, Math.floor(unitHash(seq, 0x9ac) * n));
}

/* ------------------------------------------------------------------------ */
/* A2A exchanges (real method names and task states only)                   */
/* ------------------------------------------------------------------------ */

export type ExchangeLine = { dir: "out" | "in"; text: string; method?: string; skill?: string };

/**
 * The log for exchange `index` with `skill`: even exchanges use
 * `message/send` (the route answers with the completed task), odd ones
 * `message/stream` (a `working` event, then `completed`), and each is
 * followed by a `tasks/get` poll. Methods and states are the strings
 * `src/app/a2a/route.ts` and `src/lib/a2a/taskManager.ts` use.
 */
export function a2aExchange(
  skill: string,
  index: number,
  methods: readonly string[]
): ExchangeLine[] {
  const send = methods[0] ?? "message/send";
  const stream = methods[1] ?? "message/stream";
  const get = methods[2] ?? "tasks/get";
  const method = index % 2 === 0 ? send : stream;
  const lines: ExchangeLine[] = [
    { dir: "out", text: `→ ${method} · skill: ${skill}`, method, skill },
  ];
  if (method === stream) lines.push({ dir: "in", text: "← working" });
  lines.push({ dir: "in", text: "← completed" });
  lines.push({ dir: "out", text: `→ ${get}`, method: get });
  lines.push({ dir: "in", text: "← completed" });
  return lines;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
