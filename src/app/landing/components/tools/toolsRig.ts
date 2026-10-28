/**
 * The patch bay's pure model (spec §6.7): bay grid size, cable geometry and
 * pulse lookup tables, the simulated "Run it" result, and the run timeline.
 * No React, no DOM, no clock: everything is a function of its inputs, so it
 * is unit-tested (`tests/unit/landing-tools.test.ts`) and SSR-safe.
 */
import { SAMPLE_CANDIDATES } from "../../landingTypes";
import { HEALTH_FACTOR_ID } from "../../sim/sampleTable";
import {
  CANDIDATE_IDS,
  LATENCY_MS,
  measurements,
  rank,
  type CandidateId,
  type FailCode,
  type Featured,
  type SampleKey,
  type World,
} from "../../sim/landingSim";
import { hash32, int, mulberry32 } from "../../sim/prng";

/* ------------------------------------------------------------------------ */
/* The bay                                                                  */
/* ------------------------------------------------------------------------ */

/** Jacks per row: the bay is as square as the tool count allows (36 → 6×6). */
export function bayColumns(n: number): number {
  return n > 0 ? Math.ceil(Math.sqrt(n)) : 1;
}

/**
 * On a phone the chip cloud shows this many tools before "Show {count} more":
 * four full rows of compact chips at 390px (twelve left one chip alone on a
 * fifth row), keeping the station short.
 */
export const PHONE_VISIBLE_TOOLS = 11;

/** Lines in the phone funnel (cloud → hub). */
export const FUNNEL_LINES = 7;

/** The sample the station's request stands for: an agentic coding call. */
export const RUN_SAMPLE: SampleKey = "sampleAgentic";

/**
 * Where arrow keys move focus in the jack list (a roving tab stop): one step
 * along the reading order with Left/Right (mirrored in RTL), a row with
 * Up/Down in the square bay (`cols` > 1; a wrapping chip cloud passes 1),
 * and the ends with Home/End. Null for any other key or an empty list.
 */
export function rovingTarget(
  key: string,
  index: number,
  count: number,
  cols: number,
  rtl: boolean
): number | null {
  if (count <= 0) return null;
  const last = count - 1;
  const clamp = (i: number) => (i < 0 ? 0 : i > last ? last : i);
  const step = Math.max(1, cols);
  switch (key) {
    case "ArrowRight":
      return clamp(index + (rtl ? -1 : 1));
    case "ArrowLeft":
      return clamp(index + (rtl ? 1 : -1));
    case "ArrowDown":
      return clamp(index + step);
    case "ArrowUp":
      return clamp(index - step);
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------------ */
/* Cables                                                                   */
/* ------------------------------------------------------------------------ */

/** A cubic Bézier as x0 y0 x1 y1 x2 y2 x3 y3. */
export type Cubic = readonly [number, number, number, number, number, number, number, number];
/** A cable: cubic segments end to end (each starts where the previous one ends). */
export type CablePath = readonly Cubic[];

/** Points per cable in the pulse lookup table (precomputed at resize, never per frame). */
export const LUT_POINTS = 32;
/** Floats per cable in a lookup table (x, y per point). */
export const LUT_STRIDE = LUT_POINTS * 2;

/**
 * A patch cable hanging from a jack to the hub: it leaves the socket, sags
 * under its own weight and runs level into the hub's rim. The sag grows with
 * the span (capped), so cables from the far column hang lowest, like real
 * ones. Mirror-symmetric: an RTL bay (hub on the left) gets mirrored cables.
 */
export function sagCable(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  sagRatio = 0.18,
  maxSag = 72
): Cubic {
  const dx = bx - ax;
  const dy = by - ay;
  const sag = Math.min(maxSag, Math.hypot(dx, dy) * sagRatio);
  return [ax, ay, ax + dx * 0.3, ay + sag, bx - dx * 0.38, by + sag * 0.25, bx, by];
}

/** A vertical S-curve from `a` down (or up) to `b`: the phone funnel and the stacked trunk. */
export function dropCable(ax: number, ay: number, bx: number, by: number): Cubic {
  const dy = by - ay;
  return [ax, ay, ax, ay + dy * 0.55, bx, by - dy * 0.45, bx, by];
}

/** A level S-curve from `a` across to `b`, sagging a little (the side-by-side trunk). */
export function spanCable(ax: number, ay: number, bx: number, by: number, sag = 14): Cubic {
  const dx = bx - ax;
  return [ax, ay, ax + dx * 0.45, ay + sag, bx - dx * 0.45, by + sag, bx, by];
}

/** Point on a cubic at parameter `t` (writes into `out[offset]`, `out[offset + 1]`). */
function cubicAt(c: Cubic, t: number, out: Float32Array | Float64Array, offset: number): void {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const d = 3 * u * t * t;
  const e = t * t * t;
  out[offset] = a * c[0] + b * c[2] + d * c[4] + e * c[6];
  out[offset + 1] = a * c[1] + b * c[3] + d * c[5] + e * c[7];
}

/** A straight run from `a` to `b`, as a cubic (so every cable is one kind of path). */
export function lineSeg(ax: number, ay: number, bx: number, by: number): Cubic {
  const dx = bx - ax;
  const dy = by - ay;
  return [ax, ay, ax + dx / 3, ay + dy / 3, ax + (dx * 2) / 3, ay + (dy * 2) / 3, bx, by];
}

/** Control-point distance of a cubic quarter circle, as a fraction of its radius. */
const KAPPA = 0.5523;

/**
 * A rounded 90° bend from `a` to `b` (|dx| = |dy| = the radius). Leaving `a`
 * vertically and arriving at `b` horizontally, or the other way round.
 */
export function cornerSeg(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  verticalFirst: boolean
): Cubic {
  return verticalFirst
    ? [ax, ay, ax, ay + (by - ay) * KAPPA, bx - (bx - ax) * KAPPA, by, bx, by]
    : [ax, ay, ax + (bx - ax) * KAPPA, ay, bx, by - (by - ay) * KAPPA, bx, by];
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** SVG path data for a cable of one or more cubic segments (one decimal: crisp and short). */
export function pathData(path: CablePath): string {
  if (path.length === 0) return "";
  let d = `M${round1(path[0][0])} ${round1(path[0][1])}`;
  for (const c of path) {
    d += `C${round1(c[2])} ${round1(c[3])} ${round1(c[4])} ${round1(c[5])} ${round1(c[6])} ${round1(c[7])}`;
  }
  return d;
}

/** SVG path data for a single cubic. */
export function cablePath(c: Cubic): string {
  return pathData([c]);
}

/** Dense samples per path (at least this many per segment, more for short paths). */
const DENSE_MIN = 96;
const DENSE_PER_SEGMENT = 24;
let dense = new Float64Array((DENSE_MIN + 1) * 2);
let lengths = new Float64Array(DENSE_MIN + 1);

/**
 * Fill `LUT_POINTS` points evenly spaced by arc length along `path` into `out`
 * from `offset`, so a pulse moves at constant speed along the whole cable,
 * bends included. Returns the cable's length. Runs at resize only; the frame
 * loop just interpolates.
 */
export function fillPathLut(path: CablePath, out: Float32Array, offset: number): number {
  const segments = path.length;
  if (segments === 0) {
    out.fill(0, offset, offset + LUT_STRIDE);
    return 0;
  }
  const per = Math.max(DENSE_PER_SEGMENT, Math.ceil(DENSE_MIN / segments));
  const samples = segments * per;
  if (lengths.length < samples + 1) {
    dense = new Float64Array((samples + 1) * 2);
    lengths = new Float64Array(samples + 1);
  }
  lengths[0] = 0;
  cubicAt(path[0], 0, dense, 0);
  let i = 1;
  for (const c of path) {
    for (let s = 1; s <= per; s++, i++) {
      cubicAt(c, s / per, dense, i * 2);
      const dx = dense[i * 2] - dense[i * 2 - 2];
      const dy = dense[i * 2 + 1] - dense[i * 2 - 1];
      lengths[i] = lengths[i - 1] + Math.hypot(dx, dy);
    }
  }
  const total = lengths[samples];
  let j = 0;
  for (let k = 0; k < LUT_POINTS; k++) {
    const target = (total * k) / (LUT_POINTS - 1);
    while (j < samples - 1 && lengths[j + 1] < target) j++;
    const span = lengths[j + 1] - lengths[j];
    const f = span > 0 ? Math.min(1, Math.max(0, (target - lengths[j]) / span)) : 0;
    out[offset + k * 2] = dense[j * 2] + (dense[j * 2 + 2] - dense[j * 2]) * f;
    out[offset + k * 2 + 1] = dense[j * 2 + 1] + (dense[j * 2 + 3] - dense[j * 2 + 1]) * f;
  }
  return total;
}

/** `fillPathLut` for a single cubic. */
export function fillCableLut(c: Cubic, out: Float32Array, offset: number): number {
  return fillPathLut([c], out, offset);
}

/**
 * Position at `u` ∈ [0, 1] along one cable's lookup table (linear between the
 * 32 points), written into `out[0..1]`. Allocation-free: called per frame.
 */
export function lutAt(lut: Float32Array, offset: number, u: number, out: Float32Array): void {
  const s = (u <= 0 ? 0 : u >= 1 ? 1 : u) * (LUT_POINTS - 1);
  const i = Math.min(LUT_POINTS - 2, Math.floor(s));
  const f = s - i;
  const p = offset + i * 2;
  out[0] = lut[p] + (lut[p + 2] - lut[p]) * f;
  out[1] = lut[p + 1] + (lut[p + 3] - lut[p + 1]) * f;
}

/** Index of the funnel line whose top end is nearest `x` (the phone pulse leaves from there). */
export function nearestLine(anchors: ArrayLike<number>, x: number): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < anchors.length; i++) {
    const d = Math.abs(anchors[i] - x);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** `n` x positions spread evenly across [left, right] (inclusive ends inset by `inset`). */
export function spreadAnchors(left: number, right: number, n: number, inset = 0): number[] {
  const a = left + inset;
  const b = right - inset;
  if (n <= 1) return [(a + b) / 2];
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(a + ((b - a) * i) / (n - 1));
  return out;
}

/* ------------------------------------------------------------------------ */
/* Cable trays (the bay beside the hub)                                     */
/* ------------------------------------------------------------------------ */

/** One jack for the tray router: its plug's top centre and its bay row. */
export type TrayJack = { x: number; y: number; row: number };

export type TrayInput = {
  /** +1 when the hub is to the right of the bay, −1 when it is to the left (RTL). */
  side: 1 | -1;
  /** One entry per jack; a jack with `row` < 0 gets an empty cable. */
  jacks: readonly TrayJack[];
  /** Centre line of each row's tray: the gutter just above that row of plates. */
  trayY: readonly number[];
  /** x of the plates' hub-side edge, and of the bay panel's outer hub-side edge. */
  gridEdge: number;
  bayEdge: number;
  /** The hub dial: centre and rim radius. */
  hub: { x: number; y: number; r: number };
  /** Lane spacing inside a tray (the ribbon), default 2. */
  pitch?: number;
  /** Spacing of the row buses where they meet the rim, default 7. */
  inletPitch?: number;
  /** Bend radius, default 6. */
  radius?: number;
  /** First riser lane's distance beyond the bay edge, default 8; lane spacing, default 5. */
  laneGap?: number;
  lanePitch?: number;
};

/** How far past the rim a cable runs on, hidden under the hub's face. */
const RIM_TUCK = 6;

/**
 * Route every jack's cable through the bay's gutters, like a dressed patch
 * panel: up out of its plug into the tray above its row, along the tray as
 * one strand of a ribbon (the farthest jack on top, so strands never cross),
 * gathered into that row's bus at the bay's edge, then up or down a lane
 * beside the bay and level into the hub's rim. Rows above the hub take the
 * outer lanes top-first and rows below take them bottom-first, so the nested
 * bends never cross either. Every bend is a rounded corner.
 *
 * Pure geometry: the component passes measured rects (rig coordinates).
 */
export function trayCables(input: TrayInput): Cubic[][] {
  const { side, jacks, trayY, gridEdge, bayEdge, hub } = input;
  const pitch = input.pitch ?? 2;
  const inletPitch = input.inletPitch ?? 7;
  const radius = input.radius ?? 6;
  const laneGap = input.laneGap ?? 8;
  const rows = trayY.length;

  // Order each row's jacks from the far end of the tray to the hub end.
  const members: number[][] = Array.from({ length: rows }, () => []);
  jacks.forEach((jack, i) => {
    if (jack.row >= 0 && jack.row < rows) members[jack.row].push(i);
  });
  const strand = new Array<number>(jacks.length).fill(0);
  const strands = new Array<number>(rows).fill(0);
  members.forEach((list, row) => {
    list.sort((a, b) => side * jacks[a].x - side * jacks[b].x || a - b);
    list.forEach((jack, k) => {
      strand[jack] = k;
    });
    strands[row] = list.length;
  });

  // Each row's bus meets the rim at its own height, top row highest.
  const inlet = trayY.map((_, r) => hub.y + (r - (rows - 1) / 2) * inletPitch);
  const down: number[] = [];
  const up: number[] = [];
  for (let r = 0; r < rows; r++) {
    const dy = inlet[r] - trayY[r];
    if (dy > 0.5) down.push(r);
    else if (dy < -0.5) up.push(r);
  }
  const lane = new Array<number>(rows).fill(0);
  down.forEach((r, k) => {
    lane[r] = down.length - 1 - k; // the top row takes the outermost lane
  });
  up.forEach((r, k) => {
    lane[r] = k; // the bottom row takes the outermost lane
  });
  const rimNear = hub.x - side * hub.r;
  const room = side * (rimNear - bayEdge) - laneGap - radius - 2;
  const most = Math.max(down.length, up.length);
  const lanePitch =
    most > 1
      ? Math.min(input.lanePitch ?? 5, Math.max(1.5, room / (most - 1)))
      : (input.lanePitch ?? 5);
  const laneX = lane.map((l) => bayEdge + side * (laneGap + l * lanePitch));
  const rimAt = (y: number) => {
    const dy = y - hub.y;
    return hub.x - side * Math.sqrt(Math.max(0, hub.r * hub.r - dy * dy)) + side * RIM_TUCK;
  };
  const merge = Math.max(4, side * (bayEdge - gridEdge));
  const mergeX = gridEdge + side * merge;

  return jacks.map((jack, i) => {
    const row = jack.row;
    if (row < 0 || row >= rows) return [];
    const out: Cubic[] = [];
    const ty = trayY[row];
    const ly = ty + (strand[i] - (strands[row] - 1) / 2) * pitch;

    // Up out of the plug, bending into the strand's lane.
    const rise = jack.y - ly;
    const r1 = Math.max(0, Math.min(radius, rise / 2));
    if (rise - r1 > 0.01) out.push(lineSeg(jack.x, jack.y, jack.x, ly + r1));
    if (r1 > 0.01) out.push(cornerSeg(jack.x, ly + r1, jack.x + side * r1, ly, true));
    // Along the tray to the plates' edge, then gathered into the row's bus.
    const runFrom = jack.x + side * r1;
    if (side * (gridEdge - runFrom) > 0.01) out.push(lineSeg(runFrom, ly, gridEdge, ly));
    const from = side * (gridEdge - runFrom) > 0 ? gridEdge : runFrom;
    const half = (side * (mergeX - from)) / 2;
    out.push([from, ly, from + side * half, ly, mergeX - side * half, ty, mergeX, ty]);

    // The bus: a lane beside the bay, then level into the rim.
    const iy = inlet[row];
    const dy = iy - ty;
    const end = rimAt(iy);
    if (Math.abs(dy) <= 0.5) {
      out.push(lineSeg(mergeX, ty, end, iy));
      return out;
    }
    const vs = dy > 0 ? 1 : -1;
    const r2 = Math.min(radius, Math.abs(dy) / 2);
    const lx = laneX[row];
    out.push(lineSeg(mergeX, ty, lx - side * r2, ty));
    out.push(cornerSeg(lx - side * r2, ty, lx, ty + vs * r2, false));
    if (Math.abs(dy) - 2 * r2 > 0.01) out.push(lineSeg(lx, ty + vs * r2, lx, iy - vs * r2));
    out.push(cornerSeg(lx, iy - vs * r2, lx + side * r2, iy, true));
    out.push(lineSeg(lx + side * r2, iy, end, iy));
    return out;
  });
}

/* ------------------------------------------------------------------------ */
/* The hub                                                                  */
/* ------------------------------------------------------------------------ */

/** Each sample candidate owns one sixth of the hub dial, clockwise from north. */
export function candidateBearing(id: CandidateId): number {
  const i = CANDIDATE_IDS.indexOf(id);
  return i < 0 ? 0 : i * (360 / CANDIDATE_IDS.length);
}

/** The id a provider answers with in `X-Pusula-Provider` (its catalog id). */
export function catalogIdOf(id: CandidateId): string {
  for (const c of SAMPLE_CANDIDATES) if (c.id === id) return c.catalogId;
  return id;
}

/* ------------------------------------------------------------------------ */
/* The simulated run                                                        */
/* ------------------------------------------------------------------------ */

export type StopKind = "skip" | "fail" | "win";
/** One place the hub needle stops: a breaker it skipped, a target that failed, the winner. */
export type RunStop = { id: CandidateId; kind: StopKind; code: FailCode | null };

export type RunResult = {
  take: number;
  served: boolean;
  stops: readonly RunStop[];
  winner: CandidateId | null;
  /** `X-Pusula-Provider` value (catalog id), null when nothing could serve. */
  provider: string | null;
  /**
   * `X-Pusula-Fallback-Attempts`: targets passed over before the answer, open
   * breakers skipped included (the gateway reports the serving target's index
   * in the combo, and a circuit-open skip still counts as a fallback).
   */
  fallbackAttempts: number;
  /** `X-Pusula-Latency-Ms`: seeded from the take, part of the illustration. */
  latencyMs: number;
  /** `X-Pusula-Request-Id`: a seeded UUID, part of the illustration. */
  requestId: string;
};

/** The reason the gateway logs for a target it skips before dispatch (an OPEN breaker). */
export const SKIP_REASON = "circuit_open";

/**
 * Candidates whose breaker is OPEN and that the auto ranking would otherwise
 * have put ahead of today's leader (health counted as healthy): the hub skips
 * them without an attempt. Read the world BEFORE routing the take.
 */
export function skippedOpen(w: World, sample: SampleKey): CandidateId[] {
  const live = rank(w, sample);
  const leader = live.length > 0 ? live[0].score : -Infinity;
  const healthIndex = w.factorIds.indexOf(HEALTH_FACTOR_ID);
  const out: { id: CandidateId; score: number }[] = [];
  for (const c of w.candidates) {
    if (c.breaker.state !== "open") continue;
    const m = measurements(w, sample, c.id);
    let score = 0;
    for (let f = 0; f < m.length; f++) {
      score += w.weights[f] * (f === healthIndex ? 1 : m[f]);
    }
    if (score > leader) out.push({ id: c.id, score });
  }
  out.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  return out.map((entry) => entry.id);
}

const HEX = "0123456789abcdef";

function hex(value: number, digits: number): string {
  let s = "";
  for (let i = digits - 1; i >= 0; i--) s += HEX[(value >>> (i * 4)) & 15];
  return s;
}

/** A deterministic RFC 4122-shaped (v4 layout) id from a seed. */
export function seededUuid(seed: number): string {
  const rng = mulberry32(seed);
  const word = () => Math.floor(rng() * 0x100000000) >>> 0;
  const a = word();
  const b = word();
  const c = word();
  const d = word();
  const variant = (8 + (c >>> 30)) & 15; // 8, 9, a or b
  return [
    hex(a, 8),
    hex(b >>> 16, 4),
    `4${hex(b, 3)}`,
    `${HEX[variant]}${hex(c, 3)}`,
    `${hex(d, 8)}${hex(c >>> 12, 4)}`,
  ].join("-");
}

/**
 * The "Run it" answer for one featured take: the needle's stops (skipped open
 * breakers, failed targets, the winner) and the seeded header values.
 */
export function buildRun(featured: Featured, skipped: readonly CandidateId[]): RunResult {
  const stops: RunStop[] = skipped.map((id) => ({ id, kind: "skip", code: null }));
  const failedCount = featured.served ? featured.attempts.length - 1 : featured.attempts.length;
  for (let i = 0; i < failedCount; i++) {
    stops.push({ id: featured.attempts[i], kind: "fail", code: featured.codes[i] ?? 503 });
  }
  const winner = featured.served ? featured.winner : null;
  if (winner) stops.push({ id: winner, kind: "win", code: null });

  const rng = mulberry32(hash32("tools-run", featured.take, winner ?? "none"));
  let latencyMs = winner ? int(rng, LATENCY_MS[0], LATENCY_MS[1]) : 0;
  for (let i = 0; i < failedCount; i++) latencyMs += int(rng, 40, 160);

  return {
    take: featured.take,
    served: featured.served,
    stops,
    winner,
    provider: winner ? catalogIdOf(winner) : null,
    fallbackAttempts: skipped.length + featured.fallbackAttempts,
    latencyMs,
    requestId: seededUuid(hash32("tools-request", featured.take)),
  };
}

/**
 * The response headers a run shows, in order: the provider only when
 * something answered, and the fallback count only when it is above zero (the
 * gateway omits the header otherwise).
 */
export function runHeaders(
  run: RunResult,
  names: {
    provider: string;
    fallbackAttempts: string;
    latencyMs: string;
    requestId: string;
  }
): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  if (run.provider) out.push({ name: names.provider, value: run.provider });
  if (run.fallbackAttempts > 0) {
    out.push({ name: names.fallbackAttempts, value: String(run.fallbackAttempts) });
  }
  if (run.served) out.push({ name: names.latencyMs, value: String(run.latencyMs) });
  out.push({ name: names.requestId, value: run.requestId });
  return out;
}

/* ------------------------------------------------------------------------ */
/* The run timeline                                                         */
/* ------------------------------------------------------------------------ */

/** Each code line lights for this long, top to bottom (the whole scan capped below). */
export const HL_STEP_MS = 70;
export const HL_MAX_MS = 720;
/** The request packet's trip, terminal → hub. */
export const PACKET_MS = 560;
/** The needle's spin before it settles on the first stop. */
export const SPIN_MS = 950;
/** Dwell on a skipped or failed stop before the hub retries the next target. */
export const STOP_MS = 700;
/** Pause on the winner before the answer streams. */
export const SETTLE_MS = 320;
/** One reply token (word) every … */
export const REPLY_WORD_MS = 90;
/** Header lines type at … characters per second. */
export const HEADER_CPS = 120;

export type RunPlan = {
  lines: number;
  stops: number;
  words: number;
  chars: number;
  hlStep: number;
  packetStart: number;
  spinStart: number;
  /** Time the needle starts aiming at stop k (the first is the end of the spin). */
  stopAt: Float64Array;
  replyStart: number;
  headersStart: number;
  end: number;
};

export function runPlan(lines: number, stops: number, words: number, chars: number): RunPlan {
  const hlStep = lines > 0 ? Math.min(HL_STEP_MS, HL_MAX_MS / lines) : 0;
  const packetStart = hlStep * lines;
  const spinStart = packetStart + PACKET_MS;
  const stopAt = new Float64Array(Math.max(0, stops));
  for (let k = 0; k < stops; k++) stopAt[k] = spinStart + SPIN_MS + k * STOP_MS;
  const landed = spinStart + SPIN_MS + Math.max(0, stops - 1) * STOP_MS;
  const replyStart = landed + SETTLE_MS;
  const headersStart = replyStart + words * REPLY_WORD_MS;
  const end = headersStart + Math.ceil((chars * 1000) / HEADER_CPS);
  return {
    lines,
    stops,
    words,
    chars,
    hlStep,
    packetStart,
    spinStart,
    stopAt,
    replyStart,
    headersStart,
    end,
  };
}

/** What a run shows at time `t` (ms since Run). Mutated in place by `runFrameAt`. */
export type RunFrame = {
  /** Highlighted code line, −1 for none. */
  hl: number;
  /** Packet position along the trunk (0 at the terminal, 1 at the hub), −1 when not travelling. */
  packet: number;
  /** Spin progress 0..1 while spinning, −1 otherwise. */
  spin: number;
  /** Stops the needle has reached (0..stops). */
  reached: number;
  /** Reply tokens shown. */
  words: number;
  /** Header characters typed. */
  chars: number;
  done: boolean;
};

export function createRunFrame(): RunFrame {
  return { hl: -1, packet: -1, spin: -1, reached: 0, words: 0, chars: 0, done: false };
}

/** Smooth start and stop for the spin. */
export function easeInOutCubic(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

/** Fill `out` with the state of the run `plan` at `t` ms. Allocation-free. */
export function runFrameAt(plan: RunPlan, t: number, out: RunFrame): RunFrame {
  out.hl = t >= 0 && t < plan.packetStart && plan.hlStep > 0 ? Math.floor(t / plan.hlStep) : -1;
  out.packet =
    t >= plan.packetStart && t < plan.spinStart ? (t - plan.packetStart) / PACKET_MS : -1;
  const spinEnd = plan.spinStart + SPIN_MS;
  out.spin = t >= plan.spinStart && t < spinEnd ? (t - plan.spinStart) / SPIN_MS : -1;
  let reached = 0;
  for (let k = 0; k < plan.stops; k++) if (t >= plan.stopAt[k]) reached = k + 1;
  out.reached = reached;
  out.words =
    t < plan.replyStart
      ? 0
      : Math.min(plan.words, Math.floor((t - plan.replyStart) / REPLY_WORD_MS) + 1);
  out.chars =
    t < plan.headersStart
      ? 0
      : Math.min(plan.chars, Math.floor(((t - plan.headersStart) * HEADER_CPS) / 1000));
  out.done = t >= plan.end;
  if (out.done) {
    out.hl = -1;
    out.packet = -1;
    out.spin = -1;
    out.reached = plan.stops;
    out.words = plan.words;
    out.chars = plan.chars;
  }
  return out;
}

/**
 * End offsets (UTF-16) of each whitespace-separated token of `text`: the reply
 * streams by writing `text.slice(0, ends[k])`, one token at a time. Persian,
 * like every script here, separates words with spaces (ZWNJ is not one).
 */
export function wordEnds(text: string): number[] {
  const ends: number[] = [];
  const word = /\S+/g;
  for (let m = word.exec(text); m; m = word.exec(text)) ends.push(m.index + m[0].length);
  return ends;
}
