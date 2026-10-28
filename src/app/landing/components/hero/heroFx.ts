/**
 * The hero's take animation (spec §6.2 "Alive"): what the gyro shows when the
 * deck makes a featured routing decision.
 *
 *   0–500    a request comet flies in along a rhumb from the inline-start edge
 *   0–600    the factor arcs light in weight order, 37 ms apart
 *   600      the needle swings to the first attempt; a failing target is hit
 *            by an ember beam and a ✕ spark with its code, then the needle
 *            re-swings to the next target (`ATTEMPT_MS` each), exactly the
 *            order the deck tried them (`featured.attempts`)
 *   winner   gold beam with five particles, a phosphor streak flare on the
 *            star and a shockwave spreading on the horizon ring
 *
 * Everything is a closed-form function of `now − start`, so a paused or
 * resumed frame lands where it should. Allocation-free per frame.
 */
import { drawGlow, getSprite } from "../../runtime/glowSprites";
import { PROJECTED_STRIDE } from "../../sim/landingProjection";
import { DEG, FACTOR_RING_RATIO, type GyroGeometry, type GyroScene } from "./gyro";

/** First attempt after the take starts (the needle's first swing). */
export const TAKE_FIRST_MS = 600;
/** Each failed attempt holds the needle this long before it re-swings. */
export const ATTEMPT_MS = 650;
/** The ✕ spark lands this long after the needle starts swinging to a failing target. */
export const FAIL_HIT_MS = 450;
export const COMET_MS = 500;
export const FACTOR_STEP_MS = 37;
const FACTOR_DECAY_MS = 700;
const MAX_ATTEMPTS = 8;
const PARTICLES = 5;

export type TakeFx = {
  take: number;
  start: number;
  active: boolean;
  count: number;
  /** Candidate slot per attempt, in the order the deck tried them. */
  slots: Int8Array;
  /** Failure code per attempt (0 for the served one). */
  codes: Int16Array;
  served: boolean;
  /** The slot the needle rests on after the sequence. */
  winner: number;
  /** The slot it rested on before this take (-1: north). */
  previous: number;
  /** Rhumb bearing the comet arrives on (deg). */
  comet: number;
};

export function createTakeFx(): TakeFx {
  return {
    take: -1,
    start: 0,
    active: false,
    count: 0,
    slots: new Int8Array(MAX_ATTEMPTS),
    codes: new Int16Array(MAX_ATTEMPTS),
    served: true,
    winner: -1,
    previous: -1,
    comet: 270,
  };
}

/** Comet rhumbs on the inline-start side: left in LTR, right in RTL (never straight up or down). */
const COMET_RHUMBS_LTR = [247.5, 258.75, 270, 281.25, 292.5] as const;

export type FeaturedLike = {
  take: number;
  attempts: readonly string[];
  codes: readonly number[];
  winner: string;
  served: boolean;
};

/**
 * Start (or, with `animate` false, jump to the end of) a take. `slotOf` maps a
 * candidate id to its slot.
 */
export function beginTake(
  fx: TakeFx,
  featured: FeaturedLike,
  slotOf: (id: string) => number,
  now: number,
  animate: boolean,
  rtl: boolean
): void {
  fx.previous = fx.active ? takeRestSlot(fx) : fx.winner;
  fx.take = featured.take;
  fx.start = now;
  fx.count = Math.min(MAX_ATTEMPTS, featured.attempts.length);
  for (let k = 0; k < fx.count; k++) {
    fx.slots[k] = slotOf(featured.attempts[k]);
    fx.codes[k] = k < featured.codes.length ? featured.codes[k] : 0;
  }
  fx.served = featured.served;
  fx.winner = featured.served ? slotOf(featured.winner) : fx.previous;
  const pick = COMET_RHUMBS_LTR[((featured.take % 5) + 5) % 5];
  fx.comet = rtl ? 360 - pick : pick;
  fx.active = animate && fx.count > 0;
}

/** The slot the needle settles on once the sequence is over. */
function takeRestSlot(fx: TakeFx): number {
  return fx.winner;
}

/** Duration of the whole sequence: the needle has reached its final target. */
export function sequenceMs(attempts: number): number {
  return TAKE_FIRST_MS + Math.max(0, attempts - 1) * ATTEMPT_MS + 300;
}

/** Which slot the needle aims at `now` (-1: keep north). Ends the take when it is over. */
export function needleSlot(fx: TakeFx, now: number): number {
  if (!fx.active) return fx.winner;
  const u = now - fx.start;
  if (u < TAKE_FIRST_MS) return fx.previous;
  const k = Math.floor((u - TAKE_FIRST_MS) / ATTEMPT_MS);
  if (k < fx.count) {
    // A dropped take (nothing served) returns to where it was.
    if (k === fx.count - 1 && !fx.served && u - TAKE_FIRST_MS - k * ATTEMPT_MS > ATTEMPT_MS) {
      return fx.previous;
    }
    return fx.slots[k];
  }
  if (u > sequenceMs(fx.count) + 1600) fx.active = false;
  return fx.served ? fx.winner : fx.previous;
}

/** The slot that glows as "chosen" at `now` (-1 while the needle is still deciding). */
export function glowSlot(fx: TakeFx, now: number): number {
  if (!fx.active) return fx.winner;
  const u = now - fx.start;
  if (u < TAKE_FIRST_MS) return fx.previous;
  if (!fx.served) return -1;
  const winnerAt = TAKE_FIRST_MS + (fx.count - 1) * ATTEMPT_MS + 250;
  return u >= winnerAt ? fx.winner : -1;
}

/** Light the factor arcs in weight order (arc k at 37k ms), each decaying over 700 ms. */
export function factorLit(fx: TakeFx, now: number, out: Float32Array, count: number): void {
  const u = fx.active ? now - fx.start : Infinity;
  for (let k = 0; k < count; k++) {
    const at = k * FACTOR_STEP_MS;
    const v = u < at ? 0 : 1 - (u - at) / FACTOR_DECAY_MS;
    out[k] = v > 0 ? v : 0;
  }
}

/* ------------------------------------------------------------------------ */
/* Drawing                                                                  */
/* ------------------------------------------------------------------------ */

let streak: HTMLCanvasElement | null = null;

/** A soft horizontal streak (comet trails, star flares), rendered once. */
function streakSprite(): HTMLCanvasElement {
  if (streak) return streak;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 16;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const along = ctx.createLinearGradient(0, 0, 128, 0);
    along.addColorStop(0, "rgba(255,241,201,0)");
    along.addColorStop(0.7, "rgba(255,241,201,0.55)");
    along.addColorStop(1, "rgba(255,241,201,1)");
    ctx.fillStyle = along;
    ctx.fillRect(0, 0, 128, 16);
    // Soften across the streak.
    ctx.globalCompositeOperation = "destination-in";
    const across = ctx.createLinearGradient(0, 0, 0, 16);
    across.addColorStop(0, "rgba(0,0,0,0)");
    across.addColorStop(0.5, "rgba(0,0,0,1)");
    across.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = across;
    ctx.fillRect(0, 0, 128, 16);
  }
  streak = canvas;
  return canvas;
}

/**
 * Draw the streak with its bright end at (x, y), trailing back against
 * `angle` (rad, the direction of travel), `len` long and `thick` wide.
 */
function drawStreak(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  x: number,
  y: number,
  angle: number,
  len: number,
  thick: number,
  alpha: number
): void {
  if (!(alpha > 0)) return;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha > 1 ? 1 : alpha;
  ctx.setTransform(dpr * c, dpr * s, -dpr * s, dpr * c, dpr * x, dpr * y);
  ctx.drawImage(streakSprite(), -len, -thick / 2, len, thick);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = op;
}

const DASH: number[] = [4, 4];
const SOLID: number[] = [];

function starAt(scene: GyroScene, slot: number, out: Float32Array): boolean {
  if (slot < 0) return false;
  const i = scene.candStar[slot];
  if (i < 0) return false;
  const o = i * PROJECTED_STRIDE;
  out[0] = scene.proj[o];
  out[1] = scene.proj[o + 1];
  out[2] = scene.proj[o + 2];
  return true;
}

const point = new Float32Array(3);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Pass 4 extras, drawn right after the needle: beams, ✕ sparks with their
 * codes, the winner's particles, flare and shockwave.
 */
export function drawTakeMid(
  ctx: CanvasRenderingContext2D,
  fx: TakeFx,
  scene: GyroScene,
  geom: GyroGeometry,
  dpr: number,
  now: number,
  pitch: number,
  monoFont: string
): void {
  if (!fx.active) return;
  const u = now - fx.start;
  const { cx, cy, R } = geom;
  for (let k = 0; k < fx.count; k++) {
    const sk = TAKE_FIRST_MS + k * ATTEMPT_MS;
    const v = u - sk;
    if (v < 0) break;
    if (!starAt(scene, fx.slots[k], point)) continue;
    const x = point[0];
    const y = point[1];
    const failed = fx.codes[k] !== 0;
    if (failed) {
      // Ember beam (dashed: a failure is never colour alone), then the ✕ spark.
      const beam = v < 150 ? 0 : v < FAIL_HIT_MS ? 1 : 1 - (v - FAIL_HIT_MS) / 400;
      if (beam > 0) {
        ctx.globalAlpha = 0.85 * beam;
        ctx.strokeStyle = "#ff7a45";
        ctx.lineWidth = 1.5;
        ctx.setLineDash(DASH);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
          cx + (x - cx) * clamp01((v - 150) / 250),
          cy + (y - cy) * clamp01((v - 150) / 250)
        );
        ctx.stroke();
        ctx.setLineDash(SOLID);
        ctx.globalAlpha = 1;
      }
      const hit = v - FAIL_HIT_MS;
      if (hit >= 0 && hit < 1400) {
        const a = hit < 900 ? 1 : 1 - (hit - 900) / 500;
        const pop = hit < 120 ? hit / 120 : 1;
        drawGlow(ctx, getSprite("ember", 64), x, y, 46 * pop, 0.9 * a * (1 - hit / 2000));
        const r = 6 + 2 * (1 - pop);
        ctx.globalAlpha = a;
        ctx.strokeStyle = "#ff7a45";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - r, y - r);
        ctx.lineTo(x + r, y + r);
        ctx.moveTo(x + r, y - r);
        ctx.lineTo(x - r, y + r);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.font = monoFont;
        ctx.fillStyle = "#ff7a45";
        ctx.textBaseline = "middle";
        ctx.fillText(String(fx.codes[k]), x + r + 6, y - r - 6);
        ctx.globalAlpha = 1;
      }
      continue;
    }
    // The served target: a gold beam carrying five particles, a flare and a shockwave.
    const beam = v < 120 ? 0 : v < 700 ? 1 : 1 - (v - 700) / 500;
    if (beam > 0) {
      ctx.globalAlpha = 0.5 * beam;
      ctx.strokeStyle = "#ffd36e";
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
    }
    const hi = getSprite("goldHi", 32);
    for (let p = 0; p < PARTICLES; p++) {
      const pt = (v - 150 - p * 70) / 320;
      if (pt <= 0 || pt >= 1) continue;
      const e = pt * pt * (3 - 2 * pt);
      drawGlow(ctx, hi, cx + (x - cx) * e, cy + (y - cy) * e, 12 - p, 0.95);
    }
    const flare = v - 350;
    if (flare >= 0 && flare < 900) {
      const a = 1 - flare / 900;
      // Bright at the star, fading out to both sides.
      drawStreak(ctx, dpr, x, y, 0, 90, 10, a);
      drawStreak(ctx, dpr, x, y, Math.PI, 90, 10, a);
      drawGlow(ctx, getSprite("phosphor", 64), x, y, 54, a);
    }
    const wave = (v - 350) / 700;
    if (wave > 0 && wave < 1) {
      const r =
        R * (FACTOR_RING_RATIO + (1.08 - FACTOR_RING_RATIO) * (1 - (1 - wave) * (1 - wave)));
      ctx.globalAlpha = 0.6 * (1 - wave);
      ctx.strokeStyle = "#ffd36e";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * Math.sin(pitch), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Half-open probes                                                         */
/* ------------------------------------------------------------------------ */

/**
 * A breaker that half-opens admits one probe request (spec §6.2): a dashed
 * gold-hi beam reaches out to the provider's star and holds, a pulse running
 * along it, until the probe's outcome arrives: a gold ring (closed again) or
 * an ember ✕ (open again). Driven by the deck's breaker events.
 */
export type ProbeFx = {
  /** Per slot: when the probe beam started (ms), NaN when idle. */
  start: Float64Array;
  /** Per slot: 0 pending, 1 closed (served), 2 reopened (failed). */
  result: Uint8Array;
  resultAt: Float64Array;
};

/** A probe beam gives up waiting after this long (the deck may be paused or off screen). */
export const PROBE_HOLD_MS = 5000;
export const PROBE_RESULT_MS = 900;
const PROBE_REACH_MS = 380;
const PROBE_PULSE_MS = 700;

export function createProbeFx(slots: number): ProbeFx {
  return {
    start: new Float64Array(slots).fill(Number.NaN),
    result: new Uint8Array(slots),
    resultAt: new Float64Array(slots).fill(Number.NaN),
  };
}

export function startProbe(p: ProbeFx, slot: number, now: number): void {
  if (slot < 0 || slot >= p.start.length) return;
  p.start[slot] = now;
  p.result[slot] = 0;
  p.resultAt[slot] = Number.NaN;
}

/** The probe's outcome: `closed` true when the breaker closed again. Ignored without a probe. */
export function endProbe(p: ProbeFx, slot: number, closed: boolean, now: number): void {
  if (slot < 0 || slot >= p.start.length || Number.isNaN(p.start[slot])) return;
  if (p.result[slot] !== 0) return;
  p.result[slot] = closed ? 1 : 2;
  p.resultAt[slot] = now;
}

/** Whether a slot shows anything at `now` (pending, or its outcome still fading). */
export function probeActive(p: ProbeFx, slot: number, now: number): boolean {
  const start = p.start[slot];
  if (Number.isNaN(start)) return false;
  if (p.result[slot] === 0) return now - start < PROBE_HOLD_MS;
  return now - p.resultAt[slot] < PROBE_RESULT_MS;
}

export function drawProbes(
  ctx: CanvasRenderingContext2D,
  p: ProbeFx,
  scene: GyroScene,
  geom: GyroGeometry,
  now: number,
  monoFont: string
): void {
  const { cx, cy } = geom;
  for (let slot = 0; slot < p.start.length; slot++) {
    if (!probeActive(p, slot, now)) continue;
    if (!starAt(scene, slot, point)) continue;
    const x = point[0];
    const y = point[1];
    const result = p.result[slot];
    const sinceResult = result === 0 ? 0 : now - p.resultAt[slot];
    const fade = result === 0 ? 1 : 1 - sinceResult / PROBE_RESULT_MS;
    // The beam reaches out, then holds (dashed: a probe is a question, not a route).
    const reach = clamp01((now - p.start[slot]) / PROBE_REACH_MS);
    ctx.globalAlpha = 0.6 * fade;
    ctx.strokeStyle = result === 2 ? "#ff7a45" : "#ffd36e";
    ctx.lineWidth = 1.25;
    ctx.setLineDash(DASH);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (x - cx) * reach, cy + (y - cy) * reach);
    ctx.stroke();
    ctx.setLineDash(SOLID);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 1;
    if (result === 0) {
      // One pulse at a time runs out along the beam.
      const u = ((now - p.start[slot]) % PROBE_PULSE_MS) / PROBE_PULSE_MS;
      const e = u * reach;
      drawGlow(ctx, getSprite("goldHi", 32), cx + (x - cx) * e, cy + (y - cy) * e, 14, 0.9);
      continue;
    }
    if (result === 1) {
      // Closed again: a gold ring opens around the star.
      const k = clamp01(sinceResult / 600);
      ctx.globalAlpha = 0.85 * (1 - k);
      ctx.strokeStyle = "#ffd36e";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 6 + 18 * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
      drawGlow(ctx, getSprite("goldHi", 64), x, y, 40, 0.8 * fade);
      continue;
    }
    // Reopened: the probe failed, an ember ✕ on the star.
    const r = 6;
    ctx.globalAlpha = fade;
    ctx.strokeStyle = "#ff7a45";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.font = monoFont;
    ctx.fillStyle = "#ff7a45";
    ctx.textBaseline = "middle";
    ctx.fillText("503", x + r + 6, y - r - 6);
    ctx.globalAlpha = 1;
  }
}

/**
 * Pass 7: the request comet, from the stage edge along its rhumb into the
 * pivot, with an 80px trail and a phosphor head.
 */
export function drawTakeComet(
  ctx: CanvasRenderingContext2D,
  fx: TakeFx,
  geom: GyroGeometry,
  w: number,
  h: number,
  dpr: number,
  now: number
): void {
  if (!fx.active) return;
  const u = now - fx.start;
  if (u < 0 || u > COMET_MS + 120) return;
  const b = fx.comet * DEG;
  const dx = Math.sin(b);
  const dy = -Math.cos(b);
  // Distance from the pivot to the stage edge along the rhumb.
  const tx = dx > 0 ? (w - geom.cx) / dx : dx < 0 ? -geom.cx / dx : Infinity;
  const ty = dy > 0 ? (h - geom.cy) / dy : dy < 0 ? -geom.cy / dy : Infinity;
  const D = Math.min(tx, ty);
  const e = clamp01(u / COMET_MS);
  const along = D * (1 - e * e);
  const x = geom.cx + dx * along;
  const y = geom.cy + dy * along;
  const fade = u > COMET_MS ? 1 - (u - COMET_MS) / 120 : 1;
  // The trail points back out along the rhumb (the way it came).
  drawStreak(ctx, dpr, x, y, Math.atan2(-dy, -dx), 80 + 60 * e, 6, 0.9 * fade);
  drawGlow(ctx, getSprite("phosphor", 32), x, y, 22, fade);
  drawGlow(ctx, getSprite("goldHi", 64), x, y, 54, 0.35 * fade);
}
