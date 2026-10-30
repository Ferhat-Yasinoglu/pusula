/**
 * Pure geometry and arithmetic for the routing station (spec §6.5): the rose
 * of sixteen (one kite per auto scoring factor, sized by its real weight),
 * the retune maths that turn a drag or a key press into `act.setWeight`, the
 * output bus needle, the strategy tuner band and the lanes figure.
 *
 * No React, no DOM, no clock: everything here is unit-tested
 * (`tests/unit/landing-routing.test.ts`).
 */

/* ------------------------------------------------------------------------ */
/* Rose                                                                     */
/* ------------------------------------------------------------------------ */

/** Rose radius in SVG user units; the longest (heaviest) point reaches it. */
export const ROSE_R = 200;
/** Tip of a weightless point, as a share of R (the spec's .28R). */
export const ROSE_MIN = 0.28;
/** Kite base: half-width .11R at .18R from the centre. */
export const ROSE_BASE_AT = 0.18;
export const ROSE_HALF_W = 0.11;
/** The centre disc (score readout) covers this share of R. */
export const ROSE_DISC = 0.24;
/** Silent (zero-weight) factors: a dotted spoke out to this share of R. */
export const ROSE_SILENT_TO = 0.46;
/** Labels sit on a ring R + this many units out. */
export const ROSE_LABEL_GAP = 16;
/** Half the side of the square SVG viewBox (ring, ticks and numbers fit inside). */
export const ROSE_VIEW = 236;
/** The desktop figure frame around the rose (labels live in its margin), in user units. */
export const ROSE_FRAME_W = 740;
export const ROSE_FRAME_H = 600;
/** Weights below this count as silent. */
export const SILENT_EPS = 1e-4;

/** Compass bearing (deg, clockwise from north) of point `index` out of `count`. */
export function pointBearing(index: number, count: number): number {
  return count > 0 ? (index * 360) / count : 0;
}

/** Each weight over the largest (0 when every weight is 0). */
export function weightRatios(weights: readonly number[]): number[] {
  let max = 0;
  for (const w of weights) if (Number.isFinite(w) && w > max) max = w;
  return weights.map((w) => (max > 0 && Number.isFinite(w) && w > 0 ? w / max : 0));
}

/** Tip distance (user units) of a point whose weight is `ratio` of the largest. */
export function pointRadius(ratio: number, R = ROSE_R): number {
  const q = Math.max(0, Math.min(ratio, 1));
  return R * (ROSE_MIN + (1 - ROSE_MIN) * q);
}

/** The ratio that puts a point's tip at `distance` (inverse of `pointRadius`, unclamped above). */
export function ratioForDistance(distance: number, R = ROSE_R): number {
  return Math.max(0, (distance / R - ROSE_MIN) / (1 - ROSE_MIN));
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Polygon `points` of one kite in its local frame (the axis points up, -y):
 * the light half, the dark half and the whole outline, with the tip at `tip`.
 */
export function kitePoints(tip: number, R = ROSE_R): { hi: string; lo: string; full: string } {
  const b = r2(-ROSE_BASE_AT * R);
  const w = r2(ROSE_HALF_W * R);
  const t = r2(-Math.max(tip, ROSE_BASE_AT * R + 1));
  return {
    hi: `0,0 ${-w},${b} 0,${t}`,
    lo: `0,0 0,${t} ${w},${b}`,
    full: `0,0 ${-w},${b} 0,${t} ${w},${b}`,
  };
}

/**
 * Transform of a point's inner fill: the kite scaled by `x` (its measurement,
 * 0..1) about the edge of the centre disc, so the visible level of the point
 * above the disc is proportional to `x`.
 */
export function fillTransform(x: number, R = ROSE_R): string {
  const d = r2(ROSE_DISC * R);
  const s = Math.round(Math.max(0, Math.min(x, 1)) * 1000) / 1000;
  return `translate(0 ${-d}) scale(${s}) translate(0 ${d})`;
}

export type LabelAnchor = { h: "start" | "middle" | "end"; v: "top" | "middle" | "bottom" };

/**
 * How a label hangs off its anchor point, from the bearing alone (never the
 * locale: the rose is not mirrored in RTL). `h: "start"` means the text runs
 * rightwards from the anchor; `v: "bottom"` means it sits above it.
 */
export function labelAnchor(bearing: number): LabelAnchor {
  const rad = (bearing * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  const h = sin > 0.2 ? "start" : sin < -0.2 ? "end" : "middle";
  const v = cos > 0.8 ? "bottom" : cos < -0.8 ? "top" : "middle";
  return { h, v };
}

/** A point at `radius` and `bearing` around the centre of a `w`×`h` frame, as percentages. */
export function framePercent(
  bearing: number,
  radius: number,
  w: number,
  h: number
): { left: number; top: number } {
  const rad = (bearing * Math.PI) / 180;
  const x = w / 2 + radius * Math.sin(rad);
  const y = h / 2 - radius * Math.cos(rad);
  return {
    left: Math.round((x / w) * 100000) / 1000,
    top: Math.round((y / h) * 100000) / 1000,
  };
}

/**
 * The raw value for `act.setWeight` that makes factor `index` exactly `ratio`
 * times the largest of the OTHER weights (the others keep their proportions):
 * the drag on a point's tip. A ratio above 1 makes it the new largest.
 */
export function rawWeightForRatio(
  weights: readonly number[],
  index: number,
  ratio: number
): number {
  let maxOthers = 0;
  for (let i = 0; i < weights.length; i++) {
    if (i !== index && weights[i] > maxOthers) maxOthers = weights[i];
  }
  return Math.max(0, ratio) * maxOthers;
}

/** Largest normalised share the retune controls allow one factor. */
export const MAX_SHARE = 0.9;

/**
 * The raw value for `act.setWeight` that makes factor `index`'s normalised
 * share exactly `share` once `normalizeWeights` divides by the new sum (the
 * keyboard ±.01 steps and the phone range rows).
 */
export function rawWeightForShare(
  weights: readonly number[],
  index: number,
  share: number
): number {
  const s = Math.max(0, Math.min(share, MAX_SHARE));
  let rest = 0;
  for (let i = 0; i < weights.length; i++) if (i !== index) rest += Math.max(0, weights[i] || 0);
  if (rest <= 0) return s;
  return (s * rest) / (1 - s);
}

/** Σ wᵢ·xᵢ. */
export function weightedScore(weights: readonly number[], values: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += (weights[i] || 0) * (values[i] || 0);
  return total;
}

/* ------------------------------------------------------------------------ */
/* Reveal sequence                                                          */
/* ------------------------------------------------------------------------ */

/** Share of the sequence spent growing the points; the rest fills them. */
export const GROW_END = 0.35;
export const FILL_END = 0.9;

export function clamp01(v: number): number {
  return v > 0 ? (v < 1 ? v : 1) : 0;
}

export function easeOutCubic(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}

/** Scale of point `index` (weight order) while the sequence is at `seq` (0..1). */
export function growAt(seq: number, index: number, count: number): number {
  const phase = clamp01(seq / GROW_END);
  const start = count > 1 ? (index / (count - 1)) * 0.55 : 0;
  return easeOutCubic((phase - start) / 0.45);
}

/** Share (0..1) of point `index`'s measurement filled while the sequence is at `seq`. */
export function fillAt(seq: number, index: number, count: number): number {
  const phase = clamp01((seq - GROW_END) / (FILL_END - GROW_END));
  const start = count > 1 ? (index / (count - 1)) * 0.7 : 0;
  return easeOutCubic((phase - start) / 0.3);
}

/** A pinned stage inside its track, in CSS px (measured in observers, never in a loop). */
export type PinGeometry = {
  /** Height of the track the stage is stuck in. */
  trackH: number;
  /** Height of the sticky stage (as tall as its content). */
  stageH: number;
  /** Viewport height. */
  vh: number;
  /** The stage's sticky `top`. */
  top: number;
};

/**
 * Reveal progress (0..1) of the pinned rose from its track's traverse
 * progress (0 when the track's top enters at the bottom, 1 when its bottom
 * leaves at the top). It starts once half the stage is on screen and is
 * complete at `end` of the pinned stretch, so it always finishes while the
 * rose is still stuck. 0 until the geometry is known.
 */
export function pinnedReveal(traverse: number, g: PinGeometry, end = 0.85): number {
  if (!(g.trackH > 0) || !(g.vh > 0) || !(g.stageH > 0)) return 0;
  const scrolled = clamp01(traverse) * (g.trackH + g.vh);
  const pinStart = g.vh - g.top;
  const start = Math.min(g.stageH * 0.5, pinStart);
  const done = pinStart + Math.max(1, g.trackH - g.stageH) * end;
  return clamp01((scrolled - start) / Math.max(1, done - start));
}

/* ------------------------------------------------------------------------ */
/* Output bus                                                               */
/* ------------------------------------------------------------------------ */

/**
 * The order the bus lists its meters in: the ranking first (best score on
 * top), then every candidate the ranking leaves out (an OPEN breaker), in
 * candidate order. Indices outside `0..count-1` and repeats are ignored.
 */
export function busOrder(ranking: readonly number[], count: number): number[] {
  const out: number[] = [];
  const seen = new Array<boolean>(count).fill(false);
  for (const i of ranking) {
    if (Number.isInteger(i) && i >= 0 && i < count && !seen[i]) {
      seen[i] = true;
      out.push(i);
    }
  }
  for (let i = 0; i < count; i++) if (!seen[i]) out.push(i);
  return out;
}

/**
 * Bearing (deg) for the bus needle so it points at the meter in display
 * position `row` (0 = the top of the ranking). Desktop: one column of
 * `count` rows 30px apart. Compact: two columns of three rows, filled row by
 * row. In RTL the bus mirrors, so the needle sits at the inline end and
 * points the other way.
 */
export function busBearing(
  row: number,
  layout: "column" | "grid",
  rtl: boolean,
  count = 6
): number {
  let dx: number;
  let dy: number;
  if (layout === "column") {
    dx = 72;
    dy = (row - (count - 1) / 2) * 30;
  } else {
    const col = row % 2;
    const line = Math.floor(row / 2);
    dx = 70 + col * 137;
    dy = (line - 1) * 48;
  }
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const bearing = rtl ? 270 - deg : 90 + deg;
  return Math.round(((bearing % 360) + 360) % 360);
}

/* ------------------------------------------------------------------------ */
/* Strategy band                                                            */
/* ------------------------------------------------------------------------ */

/** i18n key of a strategy's description (`round-robin` → `strategy_round_robin`). */
export function strategyKey(id: string): string {
  return `strategy_${id.replace(/-/g, "_")}`;
}

/** i18n key of a scoring factor's label. */
export function factorKey(id: string): string {
  return `factor_${id.replace(/-/g, "_")}`;
}

/**
 * Grid placement of id `index` on the tuner band: two rows, each id spanning
 * two of `count + 1` columns, so the rows interleave (0 above, 1 below, 2
 * above …) and every id keeps its own width (mono text, laid out by CSS).
 */
export function tunerCell(index: number): { row: number; col: number } {
  return { row: (index % 2) + 1, col: index + 1 };
}

/**
 * Whether the tuner needle hops a short way (lively NEEDLE spring) or makes a
 * long jump (a damped spring that cannot overshoot off the band).
 */
export function isShortHop(from: number, to: number, reach = 2): boolean {
  return Math.abs(to - from) <= reach;
}

/** `v` limited to `[lo, hi]` (`lo` wins when the range is empty). */
export function clampTo(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? (hi < lo ? lo : hi) : v;
}

/** The next index of an auto-tour or arrow key, wrapping. */
export function wrapIndex(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (((index + delta) % count) + count) % count;
}

/** Index of the item whose centre is nearest `center` (picker scroll position). */
export function nearestIndex(centers: ArrayLike<number>, center: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < centers.length; i++) {
    const distance = Math.abs(centers[i] - center);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/* ------------------------------------------------------------------------ */
/* Lanes figure                                                             */
/* ------------------------------------------------------------------------ */

export type LaneLayout = {
  w: number;
  h: number;
  rtl: boolean;
  /** The client (source) node. */
  source: { x: number; y: number };
  /** The fusion judge, between the source and the lane fan. */
  judge: { x: number; y: number };
  /** Lane rows: the y of each track, where its track starts and ends, and its card box. */
  laneY: number[];
  trackStart: number;
  trackEnd: number;
  cardX: number;
  cardW: number;
  cardH: number;
};

/**
 * Geometry of the lanes figure: a process flow from the source at the inline
 * start to four lane cards at the inline end (mirrored in RTL). `compact`
 * is the 358×200 phone figure, otherwise 560×240.
 */
export function laneLayout(compact: boolean, rtl: boolean): LaneLayout {
  const w = compact ? 358 : 560;
  const h = compact ? 200 : 240;
  const top = compact ? 28 : 34;
  const gap = compact ? 48 : 56;
  const laneY = [0, 1, 2, 3].map((i) => top + i * gap);
  const cardW = compact ? 136 : 196;
  const cardH = compact ? 40 : 46;
  const pad = compact ? 6 : 10;
  const sourceX = compact ? 24 : 34;
  const cardX = w - pad - cardW;
  const mid = (laneY[0] + laneY[3]) / 2;
  const flip = (x: number) => (rtl ? w - x : x);
  return {
    w,
    h,
    rtl,
    source: { x: flip(sourceX), y: mid },
    judge: { x: flip(sourceX + (compact ? 50 : 70)), y: mid },
    laneY,
    trackStart: flip(compact ? 92 : 128),
    trackEnd: flip(cardX - 8),
    cardX: rtl ? w - cardX - cardW : cardX,
    cardW,
    cardH,
  };
}

/** The card edge facing the source (where packets arrive) for a layout. */
export function cardDoor(layout: LaneLayout): number {
  return layout.rtl ? layout.cardX + layout.cardW : layout.cardX;
}

/**
 * A lane's tap target, in user units: its track and its card, not the trunk
 * (so a tap on the source or hub does not fail a lane). Mirrors in RTL.
 */
export function laneHitSpan(layout: LaneLayout): { x: number; w: number } {
  // A little of the curve before the track, but clear of the judge's ring.
  const lead = layout.w < 400 ? 4 : 8;
  if (layout.rtl) {
    const x = layout.cardX;
    return { x, w: layout.trackStart + lead - x };
  }
  const x = layout.trackStart - lead;
  return { x, w: layout.cardX + layout.cardW - x };
}

/** Points sampled along a hand-off arc (see `hopArc`). */
export const HOP_POINTS = 9;

/**
 * The hand-off between two lane cards (pipeline's next stage, context-relay's
 * summary): a loop out of `from`'s door, bulging back towards the source, into
 * `to`'s door. Writes `HOP_POINTS` x,y pairs into `out` at `offset` and
 * returns the SVG path.
 */
export function hopArc(
  layout: LaneLayout,
  from: number,
  to: number,
  out: Float32Array,
  offset = 0
): string {
  const door = cardDoor(layout);
  const dir = layout.rtl ? -1 : 1;
  const y0 = layout.laneY[from] ?? 0;
  const y1 = layout.laneY[to] ?? 0;
  // A symmetric cubic bulges 3/4 of its control offset.
  const reach = (layout.w < 400 ? 22 : 30) + Math.abs(y1 - y0) * 0.12;
  const cx = door - dir * reach * (4 / 3);
  for (let k = 0; k < HOP_POINTS; k++) {
    const t = k / (HOP_POINTS - 1);
    const u = 1 - t;
    out[offset + k * 2] =
      u * u * u * door + 3 * u * u * t * cx + 3 * u * t * t * cx + t * t * t * door;
    out[offset + k * 2 + 1] =
      u * u * u * y0 + 3 * u * u * t * y0 + 3 * u * t * t * y1 + t * t * t * y1;
  }
  const r = (v: number) => Math.round(v * 100) / 100;
  return `M${r(door)} ${r(y0)}C${r(cx)} ${r(y0)} ${r(cx)} ${r(y1)} ${r(door)} ${r(y1)}`;
}

/** Position along a polyline (flat x,y pairs, `count` points) at `u` (0..1), into `out`. */
export function polylineAt(
  points: ArrayLike<number>,
  offset: number,
  count: number,
  u: number,
  out: Float32Array
): void {
  if (count <= 1) {
    out[0] = points[offset];
    out[1] = points[offset + 1];
    return;
  }
  let total = 0;
  for (let i = 1; i < count; i++) {
    const ax = points[offset + (i - 1) * 2];
    const ay = points[offset + (i - 1) * 2 + 1];
    const bx = points[offset + i * 2];
    const by = points[offset + i * 2 + 1];
    total += Math.hypot(bx - ax, by - ay);
  }
  let target = clamp01(u) * total;
  for (let i = 1; i < count; i++) {
    const ax = points[offset + (i - 1) * 2];
    const ay = points[offset + (i - 1) * 2 + 1];
    const bx = points[offset + i * 2];
    const by = points[offset + i * 2 + 1];
    const seg = Math.hypot(bx - ax, by - ay);
    if (target <= seg || i === count - 1) {
      const t = seg > 0 ? Math.min(target / seg, 1) : 1;
      out[0] = ax + (bx - ax) * t;
      out[1] = ay + (by - ay) * t;
      return;
    }
    target -= seg;
  }
}

/** Length of a polyline (flat x,y pairs). */
export function polylineLength(points: ArrayLike<number>, offset: number, count: number): number {
  let total = 0;
  for (let i = 1; i < count; i++) {
    total += Math.hypot(
      points[offset + i * 2] - points[offset + (i - 1) * 2],
      points[offset + i * 2 + 1] - points[offset + (i - 1) * 2 + 1]
    );
  }
  return total;
}
