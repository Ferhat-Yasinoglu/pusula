/**
 * Pure helpers for the launch station (spec §6.9): the facts paired with the
 * dashboard screenshot's hotspots, the CRT boot schedule, the fuse geometry
 * (path, arc-length lookup table, burn legs) and the compass bearings.
 *
 * No React, no DOM, no clock: every function is deterministic, so the
 * component can call them in effects and the unit tests can pin them.
 */

/* ------------------------------------------------------------------------ */
/* Facts and hotspots                                                        */
/* ------------------------------------------------------------------------ */

export type FactId = "encrypted" | "local" | "port" | "noAccount";

export type Fact = {
  id: FactId;
  title:
    | "dashboardFactEncryptedTitle"
    | "dashboardFactLocalTitle"
    | "dashboardFactPortTitle"
    | "dashboardFactNoAccountTitle";
  desc:
    | "dashboardFactEncryptedDesc"
    | "dashboardFactLocalDesc"
    | "dashboardFactPortDesc"
    | "dashboardFactNoAccountDesc";
};

/**
 * The self-test rows, in order. The first three each have a hotspot on the
 * screenshot (same index in `HOTSPOTS`); "No account" has none, because
 * nothing on screen shows it.
 */
export const FACTS: readonly Fact[] = [
  { id: "encrypted", title: "dashboardFactEncryptedTitle", desc: "dashboardFactEncryptedDesc" },
  { id: "local", title: "dashboardFactLocalTitle", desc: "dashboardFactLocalDesc" },
  { id: "port", title: "dashboardFactPortTitle", desc: "dashboardFactPortDesc" },
  { id: "noAccount", title: "dashboardFactNoAccountTitle", desc: "dashboardFactNoAccountDesc" },
];

export type Hotspot = {
  fact: FactId;
  /** Percent of the screenshot's width (from its left edge; never mirrored). */
  x: number;
  /** Percent of the screenshot's height. */
  y: number;
  /**
   * Width of the evidence in percent of the screenshot's width. 0 means a
   * ring around an icon; otherwise the marker is a pill that encloses the
   * text, so the evidence stays readable inside it.
   */
  w: number;
  /**
   * Where its callout chip opens, clear of what the hotspot points at: above
   * the banner (I, II), below the base-URL line (III).
   */
  side: "above" | "below";
};

/**
 * Hotspots at percent coordinates of `/screenshots/dashboard.png` (1280×720),
 * checked against the image:
 * - I: a ring on the zero-config banner's warning icon at (287, 192) px (the
 *   banner says the encryption keys were auto-generated);
 * - II: a pill around the `~/.pusula/server.env` chip, 868–1022 px wide,
 *   centred at (945, 209) px (the data directory);
 * - III: a pill around "http://127.0.0.1:20128/v1" on the "Set base URL"
 *   line, 455–613 px wide, centred at (534, 517) px.
 */
export const HOTSPOTS: readonly Hotspot[] = [
  { fact: "encrypted", x: 22.4, y: 26.7, w: 0, side: "above" },
  { fact: "local", x: 73.8, y: 29.0, w: 12.1, side: "above" },
  { fact: "port", x: 41.7, y: 71.8, w: 12.4, side: "below" },
];

/** Hotspot numerals, shared by the ring badges and the self-test rows. */
export const NUMERALS = ["I", "II", "III"] as const;

/** Index of the hotspot paired with a fact row, or -1 when it has none. */
export function hotspotOf(factIndex: number): number {
  const fact = FACTS[factIndex];
  if (!fact) return -1;
  return HOTSPOTS.findIndex((hotspot) => hotspot.fact === fact.id);
}

/* ------------------------------------------------------------------------ */
/* Timing                                                                    */
/* ------------------------------------------------------------------------ */

/** CRT power-on: the screen layer opens from scaleY(.004) to 1. */
export const POWER_MS = 420;
/** Each self-test row types in over this long, one after another. */
export const ROW_MS = 300;
/** Idle: the hotspots light in sequence, one step every 1.6s. */
export const LIT_MS = 1600;
/** A hotspot or row the visitor hovered or tapped stays lit this long. */
export const HOLD_MS = 6000;
/** The ember spark burns along the whole fuse in 1.2s. */
export const SPARK_MS = 1200;
/** The final compass spins once in this long, then locks back on its target. */
export const SPIN_MS = 1000;
/** Terminal lines print with this stagger. */
export const LINE_MS = 250;
/** "Copied" stays on the launch button this long. */
export const COPIED_MS = 1800;
/** The burnt fuse stays ember this long after the spark lands, then cools. */
export const COOL_MS = 2600;

/** When row `index` starts typing, in ms after power-on. */
export function rowStartMs(index: number): number {
  return POWER_MS + index * ROW_MS;
}

/** When row `index` shows its tick (just before the next row starts). */
export function rowDoneMs(index: number): number {
  return rowStartMs(index) + ROW_MS - 40;
}

/** When the whole boot (power-on plus every row) is over. */
export function bootDoneMs(rows: number): number {
  return rowStartMs(rows);
}

/** Characters per second so `chars` characters type in at most `ms` (≥ 1). */
export function cpsFor(chars: number, ms: number): number {
  if (!(chars > 0) || !(ms > 0)) return 1;
  return Math.max(1, Math.ceil((chars * 1000) / ms));
}

export function clamp01(value: number): number {
  if (!(value > 0)) return 0;
  return value > 1 ? 1 : value;
}

export function easeInOutCubic(t: number): number {
  const u = clamp01(t);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

/** The compass's extra rotation `ms` into its spin: 0 → 360°, eased. */
export function spinOffset(ms: number): number {
  return 360 * easeInOutCubic(ms / SPIN_MS);
}

/** The next hotspot to light in the idle sequence. */
export function nextLit(current: number, count: number): number {
  if (count <= 0) return -1;
  return current < 0 ? 0 : (current + 1) % count;
}

/**
 * Idle "pilot" bead: every `BEAD_MS` a small gold bead runs the whole fuse in
 * `BEAD_RUN_MS`, then rests. Each step node glints as the bead passes it.
 */
export const BEAD_MS = 6000;
export const BEAD_RUN_MS = 1900;
/** Share of the fuse around a node over which it glints. */
export const GLINT_SPAN = 0.075;

/** Bead progress (0..1, sine-eased) `ms` into its cycle, or -1 while it rests. */
export function beadProgress(ms: number): number {
  if (!(ms >= 0)) return -1;
  const cycle = ms % BEAD_MS;
  if (cycle >= BEAD_RUN_MS) return -1;
  const t = cycle / BEAD_RUN_MS;
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

/** The bead's opacity at progress `p`: fades in off the pilot, out into the terminal. */
export function beadOpacity(p: number): number {
  if (p < 0) return 0;
  const fadeIn = clamp01(p / 0.06);
  const fadeOut = clamp01((1 - p) / 0.08);
  return Math.min(fadeIn, fadeOut);
}

/** How brightly a node at fuse share `threshold` glints with the bead at `p` (0..1). */
export function glintAt(p: number, threshold: number, span = GLINT_SPAN): number {
  if (p < 0 || !(span > 0)) return 0;
  const d = Math.abs(p - threshold) / span;
  if (d >= 1) return 0;
  // Smooth bell: 1 at the node, 0 at ±span.
  const u = 1 - d * d;
  return Math.round(u * u * 1000) / 1000;
}

/**
 * The final compass's server-render aim, before it measures the real layout:
 * the desktop band puts "Open dashboard" up and to the inline end of the
 * compass. The client re-aims on mount.
 */
export const DEFAULT_AIM = { ltr: 64, rtl: 296 } as const;

export function defaultAim(rtl: boolean): number {
  return rtl ? DEFAULT_AIM.rtl : DEFAULT_AIM.ltr;
}

/* ------------------------------------------------------------------------ */
/* Compass                                                                   */
/* ------------------------------------------------------------------------ */

export type Box = { left: number; top: number; width: number; height: number };

/**
 * The point the final compass aims at on a button: level with its centre,
 * `lead` of its width in from the edge that faces the compass. It is still
 * on the button, but nearer, so the needle visibly swings between two
 * stacked buttons instead of pointing at both centres almost alike.
 */
export function aimPoint(from: Box, to: Box, lead = 0.28): Box {
  const fromX = from.left + from.width / 2;
  const toX = to.left + to.width / 2;
  const share = Math.min(0.5, Math.max(0, lead));
  let x = toX;
  if (toX > fromX + 1) x = Math.min(toX, to.left + to.width * share);
  else if (toX < fromX - 1) x = Math.max(toX, to.left + to.width * (1 - share));
  return { left: x, top: to.top + to.height / 2, width: 0, height: 0 };
}

/**
 * Compass bearing (0 = up/north, clockwise, 0..360) of a screen offset
 * (`dy` grows downwards). A zero offset points north.
 */
export function compassBearing(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const wrapped = (deg + 360) % 360;
  return Math.round(wrapped * 100) / 100;
}

/** Bearing from the centre of `from` to the centre of `to`. */
export function bearingBetween(from: Box, to: Box): number {
  return compassBearing(
    to.left + to.width / 2 - (from.left + from.width / 2),
    to.top + to.height / 2 - (from.top + from.height / 2)
  );
}

/**
 * The compass dial's tick marks as one path (a 120-unit box, centre 60/60):
 * 72 ticks every 5°, longer every 45°. Built once at module load, so the
 * server and the client render the same string.
 */
export function dialTicks(size = 120, outer = 54): { minor: string; major: string } {
  const c = size / 2;
  let minor = "";
  let major = "";
  for (let i = 0; i < 72; i++) {
    const deg = i * 5;
    const isMajor = deg % 45 === 0;
    const len = isMajor ? 9 : deg % 15 === 0 ? 5 : 3;
    const rad = (deg * Math.PI) / 180;
    const sx = c + Math.sin(rad) * outer;
    const sy = c - Math.cos(rad) * outer;
    const ex = c + Math.sin(rad) * (outer - len);
    const ey = c - Math.cos(rad) * (outer - len);
    const seg = `M${r2(sx)} ${r2(sy)}L${r2(ex)} ${r2(ey)}`;
    if (isMajor) major += seg;
    else minor += seg;
  }
  return { minor, major };
}

/* ------------------------------------------------------------------------ */
/* Fuse                                                                      */
/* ------------------------------------------------------------------------ */

export type FusePoint = { x: number; y: number };

/** One straight leg of the fuse, for the burnt-trail clip (axis-aligned in practice). */
export type FuseLeg = {
  x: number;
  y: number;
  /** Direction in degrees for an SVG `rotate()`: 0 = +x, 90 = +y, 180 = −x, 270 = −y. */
  angle: number;
  length: number;
  /** Share of the fuse's polyline length where this leg starts and ends. */
  from: number;
  to: number;
};

export type Fuse = {
  /** SVG path data (rounded corners), "" when there is nothing to draw. */
  d: string;
  /** Arc length of the rounded path, px. */
  length: number;
  /** `samples` points (x, y pairs) evenly spaced by arc length. */
  lut: Float32Array;
  samples: number;
  legs: FuseLeg[];
};

/** LUT points per fuse: plenty for 1.2s at 120 Hz. */
export const FUSE_SAMPLES = 160;
/** Stride of the fuse LUT (x, y). */
export const FUSE_STRIDE = 2;

function r2(value: number): number {
  return Math.round(value * 100) / 100;
}

function dist(a: FusePoint, b: FusePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

type Piece =
  | { kind: "line"; a: FusePoint; b: FusePoint; length: number }
  | { kind: "quad"; a: FusePoint; c: FusePoint; b: FusePoint; length: number };

function quadAt(a: FusePoint, c: FusePoint, b: FusePoint, t: number, out: FusePoint): void {
  const u = 1 - t;
  out.x = u * u * a.x + 2 * u * t * c.x + t * t * b.x;
  out.y = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
}

function quadLength(a: FusePoint, c: FusePoint, b: FusePoint): number {
  const p: FusePoint = { x: a.x, y: a.y };
  const q: FusePoint = { x: 0, y: 0 };
  let total = 0;
  for (let i = 1; i <= 16; i++) {
    quadAt(a, c, b, i / 16, q);
    total += dist(p, q);
    p.x = q.x;
    p.y = q.y;
  }
  return total;
}

/** Drop repeated points (closer than half a pixel). */
function dedupe(points: readonly FusePoint[]): FusePoint[] {
  const out: FusePoint[] = [];
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const last = out[out.length - 1];
    if (last && dist(last, point) < 0.5) continue;
    out.push({ x: point.x, y: point.y });
  }
  return out;
}

/**
 * A fuse through `points`: straight legs joined by rounded corners of up to
 * `radius` px (never more than half of either leg), its SVG path, its
 * arc-length lookup table and its straight legs.
 */
export function buildFuse(
  points: readonly FusePoint[],
  radius: number,
  samples = FUSE_SAMPLES
): Fuse {
  const pts = dedupe(points);
  const count = Math.max(2, Math.floor(samples));
  const lut = new Float32Array(count * FUSE_STRIDE);
  if (pts.length < 2) {
    if (pts.length === 1) {
      for (let i = 0; i < count; i++) {
        lut[i * 2] = pts[0].x;
        lut[i * 2 + 1] = pts[0].y;
      }
    }
    return { d: "", length: 0, lut, samples: count, legs: [] };
  }

  // Straight legs (polyline), for the burn clip.
  const legs: FuseLeg[] = [];
  let polyline = 0;
  for (let i = 1; i < pts.length; i++) polyline += dist(pts[i - 1], pts[i]);
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const length = dist(a, b);
    const angle = (((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 360) % 360) % 360;
    legs.push({
      x: a.x,
      y: a.y,
      angle: r2(angle),
      length,
      from: walked / polyline,
      to: (walked + length) / polyline,
    });
    walked += length;
  }

  // Rounded path: line, corner, line, corner, …, line.
  const pieces: Piece[] = [];
  let cursor = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const corner = pts[i];
    const next = pts[i + 1];
    const inLen = dist(prev, corner);
    const outLen = dist(corner, next);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const a = {
      x: corner.x - ((corner.x - prev.x) / inLen) * r,
      y: corner.y - ((corner.y - prev.y) / inLen) * r,
    };
    const b = {
      x: corner.x + ((next.x - corner.x) / outLen) * r,
      y: corner.y + ((next.y - corner.y) / outLen) * r,
    };
    pieces.push({ kind: "line", a: cursor, b: a, length: dist(cursor, a) });
    pieces.push({ kind: "quad", a, c: corner, b, length: quadLength(a, corner, b) });
    cursor = b;
  }
  const end = pts[pts.length - 1];
  pieces.push({ kind: "line", a: cursor, b: end, length: dist(cursor, end) });

  let d = `M${r2(pts[0].x)} ${r2(pts[0].y)}`;
  let length = 0;
  for (const piece of pieces) {
    length += piece.length;
    if (piece.kind === "line") d += `L${r2(piece.b.x)} ${r2(piece.b.y)}`;
    else d += `Q${r2(piece.c.x)} ${r2(piece.c.y)} ${r2(piece.b.x)} ${r2(piece.b.y)}`;
  }

  // Evenly spaced samples by arc length (a corner's parameter is close
  // enough to its arc length for a spark).
  const point: FusePoint = { x: 0, y: 0 };
  let pieceIndex = 0;
  let pieceStart = 0;
  for (let i = 0; i < count; i++) {
    const s = (i / (count - 1)) * length;
    while (pieceIndex < pieces.length - 1 && s > pieceStart + pieces[pieceIndex].length + 1e-9) {
      pieceStart += pieces[pieceIndex].length;
      pieceIndex++;
    }
    const piece = pieces[pieceIndex];
    const t = piece.length > 0 ? clamp01((s - pieceStart) / piece.length) : 1;
    if (piece.kind === "line") {
      point.x = piece.a.x + (piece.b.x - piece.a.x) * t;
      point.y = piece.a.y + (piece.b.y - piece.a.y) * t;
    } else {
      quadAt(piece.a, piece.c, piece.b, t, point);
    }
    lut[i * 2] = point.x;
    lut[i * 2 + 1] = point.y;
  }

  return { d, length, lut, samples: count, legs };
}

/** LUT index of the spark at progress `p` (0..1). */
export function sparkIndex(p: number, samples: number): number {
  if (samples <= 1) return 0;
  return Math.min(samples - 1, Math.max(0, Math.round(clamp01(p) * (samples - 1))));
}

/** A leg's own burn progress (0..1) when the whole fuse is at `p`. */
export function legProgress(leg: FuseLeg, p: number): number {
  const span = leg.to - leg.from;
  if (!(span > 0)) return p >= leg.to ? 1 : 0;
  return clamp01((p - leg.from) / span);
}

export type FuseLayout =
  /** Steps in a row: along the nodes, then down the end edge into the terminal. */
  | { mode: "row"; start: FusePoint; dropX: number; endY: number }
  /** Steps stacked: down the inline-start edge into the capsule. */
  | { mode: "column"; start: FusePoint; endY: number };

/** The fuse's waypoints for a layout. */
export function fuseWaypoints(layout: FuseLayout): FusePoint[] {
  const { start } = layout;
  if (layout.mode === "column") return [start, { x: start.x, y: layout.endY }];
  return [start, { x: layout.dropX, y: start.y }, { x: layout.dropX, y: layout.endY }];
}

/**
 * The share of the fuse's polyline at which each node ticks: nodes sit on the
 * first leg, so it is their distance from the start over the polyline length.
 */
export function nodeThresholds(
  start: FusePoint,
  nodes: readonly FusePoint[],
  fuse: Fuse
): number[] {
  let polyline = 0;
  for (const leg of fuse.legs) polyline += leg.length;
  if (!(polyline > 0)) return nodes.map(() => 0);
  return nodes.map((node) => clamp01(dist(start, node) / polyline));
}
