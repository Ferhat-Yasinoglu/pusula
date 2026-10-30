/**
 * Canvas renderer of the compression bench (spec §6.8), loaded on demand by
 * `CompressionBench`. It draws only what moves; the DOM around it (server
 * poster, lens labels, terminal) is the complete, readable picture.
 *
 * Process flow, left to right (mirrored as a whole in RTL):
 *   source block (48 token tiles) → semantic-cache mirror → 12 lenses in
 *   stack order → upstream port.
 *
 * - Idle: a beam of grains flows through. At lens k a grain is removed when
 *   `unitHash(grainId, k) < rate[k]` (illustrative, uniform per class); it
 *   falls away as dust and fades, and the beam visibly narrows after every
 *   active lens. Each lens and the mirror carry a moving specular stripe.
 * - Flights: "New prompt" lifts the 48 tiles into the beam, presses them
 *   through the lenses (the tiles the outcome removes drop out) into the
 *   port; "Send it again" reflects them off the mirror back to the source
 *   while the port stays dark. `onLand` fires when the tiles arrive.
 *
 * Allocation-free per frame: every pool is a typed array sized in `setup`;
 * glows are pre-rendered sprites stamped with "lighter" (no shadowBlur).
 *
 * Still frames (Pause, or any draw while the heartbeat cannot animate) are
 * complete on their own: the lenses are fully powered, every eased value
 * sits on its target, a flight in progress lands at once and the grains are
 * re-seeded deterministically for the current rates, so a control changed
 * while paused shows its final picture on the next `requestDraw()`.
 */

import { canAnimate, getQualityTier } from "../../runtime/heartbeat";
import { drawGlow, drawGlowBatch, getSprite, type GlowSprite } from "../../runtime/glowSprites";
import { mulberry32, type Rng } from "../../sim/prng";
import {
  BENCH_COMPACT,
  BENCH_COMPACT_MAX,
  BENCH_WIDE,
  PROMPT_ROWS,
  PROMPT_TILES,
  anchorX,
  envelopeAt,
  lensAnchor,
  unitHash,
  type BenchGeometry,
  type PromptTile,
} from "./benchModel";

export type BenchFlight = {
  /** 0 = none. A new value starts a flight. */
  seq: number;
  kind: "miss" | "hit";
  /** `performance.now()` when it was issued; stale flights are ignored. */
  issuedAt: number;
  removedAt: Int8Array;
};

export type BenchInput = {
  rtl: boolean;
  /** Per lens, in stack order: 1 when the engine is lossy. */
  lossy: Uint8Array;
  /** Per lens removal rate; 0 = lens switched off ("Lossless only"). */
  rates: Float32Array;
  /** Highlighted lens (hover, focus or tap), -1 for none. */
  focus: number;
  /** True once the bench has scrolled into view: the lenses power on. */
  powered: boolean;
  /** The prompt in the source block. */
  prompt: readonly PromptTile[];
  flight: BenchFlight;
  onLand: (seq: number) => void;
  /** The overlay's content box: the geometry's reference frame. */
  box: HTMLElement | null;
};

const TAU = Math.PI * 2;
const MAX_GRAINS = 240;
const MAX_LENSES = 16;
const FLOW = 0;
const DUST = 1;
const TIER_SHARE = [1, 0.7, 0.45] as const;
/** `S.powerAt` before the lenses have powered on (the clock itself starts at 0). */
const NOT_POWERED = -Infinity;
/** Ignore a flight issued this long ago (it already landed by the fallback timer). */
const STALE_FLIGHT_MS = 2500;

/* timeline (seconds) */
const LIFT_START = 0.3;
const LIFT_S = 0.34;
const TRAVEL_START = 0.62;
const MISS_TRAVEL_S = 2.05;
const HIT_TO_MIRROR_S = 0.5;
const HIT_BACK_S = 0.62;

/* palette (landing.css tokens) */
const GOLD = "#d4a840";
const GOLD_HI = "#ffd36e";
const GOLD_LO = "#8c6a1e";
const BEZEL = "#1a1712";
const PHOSPHOR = "#fff1c9";

type Sprites = {
  gold16: GlowSprite;
  goldHi32: GlowSprite;
  goldHi64: GlowSprite;
  phosphor16: GlowSprite;
  phosphor32: GlowSprite;
  ember16: GlowSprite;
  ember32: GlowSprite;
};

const S = {
  ready: false,
  input: null as BenchInput | null,
  g: BENCH_WIDE as BenchGeometry,
  compact: false,
  w: 0,
  h: 0,
  dpr: 1,
  x0: 0,
  boxW: 0,
  srcW: 0,
  srcTop: 0,
  beamStart: 0,
  mirrorX: 0,
  portX: 0,
  lensCount: 0,
  lensX: new Float32Array(MAX_LENSES),
  clock: 0,
  drawnFor: 0,
  powerAt: NOT_POWERED,
  /* smoothed per-lens state */
  act: new Float32Array(MAX_LENSES).fill(1),
  foc: new Float32Array(MAX_LENSES),
  surv: new Float32Array(MAX_LENSES + 1).fill(1),
  survTarget: new Float32Array(MAX_LENSES + 1).fill(1),
  env: new Float32Array(MAX_LENSES + 1),
  /* grains */
  grainCount: 0,
  gx: new Float32Array(MAX_GRAINS),
  gy: new Float32Array(MAX_GRAINS),
  gu: new Float32Array(MAX_GRAINS),
  gs: new Float32Array(MAX_GRAINS),
  gvx: new Float32Array(MAX_GRAINS),
  gvy: new Float32Array(MAX_GRAINS),
  glife: new Float32Array(MAX_GRAINS),
  gid: new Uint32Array(MAX_GRAINS),
  gstage: new Uint8Array(MAX_GRAINS),
  gstate: new Uint8Array(MAX_GRAINS),
  nextId: 1,
  rng: mulberry32(0x5e71) as Rng,
  glowBuf: new Float32Array(MAX_GRAINS * 4),
  coreBuf: new Float32Array(MAX_GRAINS * 4),
  sparkBuf: new Float32Array((MAX_GRAINS + PROMPT_TILES) * 4),
  /* flight */
  fSeq: 0,
  fKind: "miss" as "miss" | "hit",
  fStart: 0,
  fLanded: true,
  fEndAt: -10,
  tState: new Uint8Array(PROMPT_TILES),
  tx: new Float32Array(PROMPT_TILES),
  ty: new Float32Array(PROMPT_TILES),
  tvx: new Float32Array(PROMPT_TILES),
  tvy: new Float32Array(PROMPT_TILES),
  tlife: new Float32Array(PROMPT_TILES),
  /* glows */
  portGlow: 0,
  portDark: 0,
  mirrorFlash: 0,
  dim: 1,
  sprites: null as Sprites | null,
  mirrorGrad: null as CanvasGradient | null,
  envGrad: null as CanvasGradient | null,
  lensGrad: [] as CanvasGradient[],
};

/* tile states during a flight */
const T_HOME = 0;
const T_FLY = 1;
const T_DUST = 2;
const T_GONE = 3;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeOut(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

function easeInOut(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

function sprites(): Sprites {
  if (!S.sprites) {
    S.sprites = {
      gold16: getSprite("gold", 16),
      goldHi32: getSprite("goldHi", 32),
      goldHi64: getSprite("goldHi", 64),
      phosphor16: getSprite("phosphor", 16),
      phosphor32: getSprite("phosphor", 32),
      ember16: getSprite("ember", 16),
      ember32: getSprite("ember", 32),
    };
  }
  return S.sprites;
}

export function setup(
  ctx: CanvasRenderingContext2D,
  s: { w: number; h: number; dpr: number },
  input: BenchInput
): void {
  const compact =
    typeof window.matchMedia === "function"
      ? window.matchMedia(`(max-width: ${BENCH_COMPACT_MAX}px)`).matches
      : s.w < 600;
  const g = compact ? BENCH_COMPACT : BENCH_WIDE;
  if (S.input !== input) {
    // A new mount (e.g. client-side navigation back to the page): forget the old flight.
    S.input = input;
    S.fSeq = 0;
    S.fLanded = true;
    S.fEndAt = -10;
    S.powerAt = NOT_POWERED;
    S.drawnFor = 0;
  }
  S.g = g;
  S.compact = compact;
  S.w = s.w;
  S.h = s.h;
  S.dpr = s.dpr;

  // The overlay box is the reference frame (layout read on resize only).
  const box = input.box;
  let boxW = s.w;
  let boxLeft = 0;
  if (box && box.offsetWidth > 0) {
    boxW = box.offsetWidth;
    boxLeft = box.offsetLeft;
  }
  S.boxW = boxW;
  // Centred, so the mirrored (RTL) start equals the LTR one; computed anyway.
  S.x0 = input.rtl ? s.w - (boxLeft + boxW) : boxLeft;

  S.srcW = anchorX(g.srcW, boxW);
  S.srcTop = g.beamY - ((PROMPT_ROWS - 1) * g.rowPitch + g.tileH) / 2;
  S.beamStart = S.x0 + S.srcW + 4;
  S.mirrorX = S.x0 + anchorX(g.mirror, boxW);
  S.portX = S.x0 + anchorX(g.port, boxW);
  const n = Math.min(MAX_LENSES, input.rates.length);
  S.lensCount = n;
  for (let k = 0; k < n; k++) S.lensX[k] = S.x0 + anchorX(lensAnchor(g, k, n), boxW);

  sprites();
  const mirrorGrad = ctx.createLinearGradient(0, g.mirrorTop, 0, g.mirrorBottom);
  mirrorGrad.addColorStop(0, "rgba(107,74,18,0.15)");
  mirrorGrad.addColorStop(0.45, "rgba(212,168,64,0.55)");
  mirrorGrad.addColorStop(0.55, "rgba(255,211,110,0.62)");
  mirrorGrad.addColorStop(1, "rgba(107,74,18,0.15)");
  S.mirrorGrad = mirrorGrad;
  // The beam's haze: brightest on the axis, fading to the envelope's edges.
  const envGrad = ctx.createLinearGradient(0, g.beamY - g.env0, 0, g.beamY + g.env0);
  envGrad.addColorStop(0, "rgba(212,168,64,0.05)");
  envGrad.addColorStop(0.5, "rgba(255,211,110,0.16)");
  envGrad.addColorStop(1, "rgba(212,168,64,0.05)");
  S.envGrad = envGrad;
  S.lensGrad = [];
  for (let k = 0; k < n; k++) {
    const x = S.lensX[k];
    const grad = ctx.createLinearGradient(x - g.lensRx, 0, x + g.lensRx, 0);
    grad.addColorStop(0, "rgba(255,211,110,0.30)");
    grad.addColorStop(0.5, "rgba(212,168,64,0.06)");
    grad.addColorStop(1, "rgba(255,211,110,0.18)");
    S.lensGrad.push(grad);
  }

  seedGrains(input);
  S.ready = true;
}

/** Spread the stream over the path at once, already thinned, so the first frame looks steady. */
function seedGrains(input: BenchInput): void {
  S.rng = mulberry32(0x5e71 ^ Math.round(S.boxW));
  const count = Math.min(MAX_GRAINS, S.g.grains);
  const span = Math.max(1, S.portX - S.beamStart);
  for (let i = 0; i < count; i++) {
    respawn(i);
    const x = S.beamStart + S.rng() * span;
    let stage = 0;
    let removed = false;
    while (stage < S.lensCount && S.lensX[stage] <= x) {
      const rate = input.rates[stage];
      if (rate > 0 && unitHash(S.gid[i], stage) < rate) {
        removed = true;
        break;
      }
      stage++;
    }
    if (removed) {
      // Queued before the source: it enters later, as a real removal would have freed it.
      S.gx[i] = S.beamStart - S.rng() * span;
    } else {
      S.gx[i] = x;
      S.gstage[i] = stage;
    }
  }
}

/** Settle every eased value on its target: the still frame is the final picture. */
function settle(input: BenchInput): void {
  const n = S.lensCount;
  S.powerAt = S.clock - 10;
  S.survTarget[0] = 1;
  for (let k = 0; k < n; k++) {
    const rate = input.rates[k];
    S.survTarget[k + 1] = S.survTarget[k] * (1 - rate);
    S.act[k] = rate > 0 ? 1 : 0;
    S.foc[k] = input.focus === k ? 1 : 0;
  }
  for (let k = 0; k <= n; k++) S.surv[k] = S.survTarget[k];
  if (!S.fLanded) {
    S.fLanded = true;
    S.fEndAt = -10;
    input.onLand(S.fSeq);
  }
  S.fSeq = input.flight.seq;
  S.tState.fill(T_GONE);
  S.dim = 1;
  S.portDark = 0;
  S.mirrorFlash = 0;
  S.nextId = 1;
  seedGrains(input);
}

function respawn(i: number): void {
  const rng = S.rng;
  S.gstate[i] = FLOW;
  S.gx[i] = S.beamStart - rng() * 28;
  S.gu[i] = (rng() + rng() - 1) * 0.96;
  S.gs[i] = S.g.speed * (0.82 + rng() * 0.36);
  S.gid[i] = S.nextId++;
  S.gstage[i] = 0;
  S.glife[i] = 0;
}

/** Beam half-height at x for a grain that has passed `stage` lenses. */
function envAt(x: number, stage: number): number {
  const g = S.g;
  let e = S.env[stage];
  if (stage > 0) {
    const since = x - S.lensX[stage - 1];
    const blend = clamp01(since / (S.compact ? 14 : 38));
    e = S.env[stage - 1] + (e - S.env[stage - 1]) * easeOut(blend);
  }
  // Funnel into the port.
  const funnel = S.compact ? 26 : 70;
  const into = (x - (S.portX - funnel)) / (funnel - g.portR);
  if (into > 0) e += (g.portR * 0.55 - e) * clamp01(into);
  return e;
}

function lensPower(k: number): number {
  if (S.powerAt === NOT_POWERED) return 0;
  return clamp01((S.clock - S.powerAt - k * 0.07) / 0.45);
}

export function draw(
  ctx: CanvasRenderingContext2D,
  s: { w: number; h: number; dpr: number },
  dt: number,
  now: number,
  input: BenchInput
): void {
  if (!S.ready) setup(ctx, s, input);
  const g = S.g;
  const sp = sprites();
  const n = S.lensCount;
  const still = !canAnimate();
  if (still) {
    dt = 0;
    settle(input);
  }
  S.clock += dt;
  S.drawnFor += dt;

  /* ---- inputs → smoothed state ---- */
  if (S.powerAt === NOT_POWERED && (input.powered || S.drawnFor > 1.4)) S.powerAt = S.clock;
  const ease = Math.min(1, dt * 5);
  S.survTarget[0] = 1;
  for (let k = 0; k < n; k++) {
    const rate = input.rates[k];
    S.survTarget[k + 1] = S.survTarget[k] * (1 - rate);
    S.act[k] += ((rate > 0 ? 1 : 0) - S.act[k]) * ease;
    S.foc[k] += ((input.focus === k ? 1 : 0) - S.foc[k]) * Math.min(1, dt * 9);
  }
  for (let k = 0; k <= n; k++) {
    S.surv[k] += (S.survTarget[k] - S.surv[k]) * Math.min(1, dt * 3);
    S.env[k] = envelopeAt(g.env0, S.surv[k]);
  }
  if (dt === 0) {
    // A resize or resume frame: settle at once so the still frame is the final picture.
    for (let k = 0; k <= n; k++) S.env[k] = envelopeAt(g.env0, S.survTarget[k]);
  }

  /* ---- flight bookkeeping ---- */
  const flight = input.flight;
  if (flight.seq !== 0 && flight.seq !== S.fSeq) {
    S.fSeq = flight.seq;
    if (now - flight.issuedAt < STALE_FLIGHT_MS) {
      S.fKind = flight.kind;
      S.fStart = S.clock;
      S.fLanded = false;
      S.tState.fill(T_HOME);
    }
  }
  const inFlight = !S.fLanded;
  const ft = S.clock - S.fStart;
  S.dim += ((inFlight ? 0.38 : 1) - S.dim) * Math.min(1, dt * 4);
  const hitDarkTarget =
    inFlight && S.fKind === "hit" ? 1 : S.clock - S.fEndAt < 0.5 && S.fKind === "hit" ? 1 : 0;
  S.portDark += (hitDarkTarget - S.portDark) * Math.min(1, dt * 6);
  S.portGlow *= Math.exp(-dt * 2.6);
  S.mirrorFlash *= Math.exp(-dt * 3.2);

  /* ---- transform: mirror the whole diagram in RTL ---- */
  const dpr = s.dpr;
  const m = input.rtl ? -1 : 1;
  const ox = input.rtl ? s.w * dpr : 0;
  ctx.setTransform(m * dpr, 0, 0, dpr, ox, 0);
  ctx.clearRect(0, 0, s.w, s.h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  const beamY = g.beamY;

  /* ---- rail: client side and upstream side, full bleed ---- */
  ctx.fillStyle = "rgba(212,168,64,0.16)";
  ctx.fillRect(0, beamY - 0.5, S.x0, 1);
  ctx.fillRect(S.portX + g.portR, beamY - 0.5, s.w - S.portX - g.portR, 1);

  /* ---- envelope (the beam's band), narrowing after each active lens ---- */
  drawEnvelope(ctx);

  /* ---- mirror ---- */
  drawMirror(ctx, sp);

  /* ---- lenses ---- */
  for (let k = 0; k < n; k++) drawLens(ctx, sp, k, input.lossy[k] === 1);

  /* ---- grains ---- */
  stepAndDrawGrains(ctx, sp, dt, input);

  /* ---- source block and flight tiles ---- */
  drawSource(ctx, input, inFlight, ft);
  if (!S.fLanded || S.clock - S.fEndAt < 1.2) stepAndDrawFlight(ctx, sp, dt, input, ft);

  /* ---- port ---- */
  drawPort(ctx, sp);

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function drawEnvelope(ctx: CanvasRenderingContext2D): void {
  const g = S.g;
  const n = S.lensCount;
  const y = g.beamY;
  const after = S.compact ? 14 : 38;
  const funnelStart = S.portX - (S.compact ? 26 : 70);
  const portMouth = g.portR * 0.55;
  ctx.beginPath();
  ctx.moveTo(S.beamStart, y - S.env[0]);
  for (let k = 0; k < n; k++) {
    ctx.lineTo(S.lensX[k], y - S.env[k]);
    ctx.lineTo(Math.min(S.lensX[k] + after, funnelStart), y - S.env[k + 1]);
  }
  ctx.lineTo(funnelStart, y - S.env[n]);
  ctx.lineTo(S.portX - g.portR, y - portMouth);
  ctx.lineTo(S.portX - g.portR, y + portMouth);
  ctx.lineTo(funnelStart, y + S.env[n]);
  for (let k = n - 1; k >= 0; k--) {
    ctx.lineTo(Math.min(S.lensX[k] + after, funnelStart), y + S.env[k + 1]);
    ctx.lineTo(S.lensX[k], y + S.env[k]);
  }
  ctx.lineTo(S.beamStart, y + S.env[0]);
  ctx.closePath();
  if (S.envGrad) {
    ctx.fillStyle = S.envGrad;
    ctx.fill();
  }
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
  // The axis.
  ctx.fillStyle = "rgba(255,211,110,0.18)";
  ctx.fillRect(S.beamStart, y - 0.5, S.portX - g.portR - S.beamStart, 1);
}

function drawMirror(ctx: CanvasRenderingContext2D, sp: Sprites): void {
  const g = S.g;
  const x = S.mirrorX;
  const top = g.mirrorTop;
  const bottom = g.mirrorBottom;
  const half = S.compact ? 3 : 5;
  const skew = S.compact ? 6 : 10;
  ctx.beginPath();
  ctx.moveTo(x - half, top + skew);
  ctx.lineTo(x + half, top);
  ctx.lineTo(x + half, bottom - skew);
  ctx.lineTo(x - half, bottom);
  ctx.closePath();
  if (S.mirrorGrad) {
    ctx.fillStyle = S.mirrorGrad;
    ctx.fill();
  }
  // Specular stripe sliding down the plane.
  ctx.save();
  ctx.clip();
  const phase = (S.clock * 0.3) % 1.35;
  const sy = top - 30 + phase * (bottom - top + 60);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.7;
  ctx.drawImage(sp.goldHi32.image, x - half * 2, sy - 22, half * 4, 44);
  ctx.restore();
  // Front edge.
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = GOLD_HI;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + half, top);
  ctx.lineTo(x + half, bottom - skew);
  ctx.stroke();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(x - half, top + skew);
  ctx.lineTo(x - half, bottom);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (S.mirrorFlash > 0.01) {
    drawGlow(ctx, sp.goldHi64, x, g.beamY, S.compact ? 70 : 130, S.mirrorFlash * 0.75);
    drawGlow(ctx, sp.ember32, x, g.beamY, S.compact ? 30 : 54, S.mirrorFlash * 0.55);
  }
}

function drawLens(ctx: CanvasRenderingContext2D, sp: Sprites, k: number, lossy: boolean): void {
  const g = S.g;
  const p = lensPower(k);
  if (p <= 0) return;
  const pe = easeOut(p);
  const x = S.lensX[k];
  const y = g.beamY;
  const act = S.act[k];
  const foc = S.foc[k];
  const alpha = pe * (0.26 + 0.74 * act);
  const scale = 0.6 + 0.4 * pe;
  const ry = g.lensRy * scale;

  if (foc > 0.01) drawGlow(ctx, sp.goldHi64, x, y, ry * 2.6, 0.5 * foc * pe);

  if (S.compact) {
    // A tick: the lens seen edge-on.
    ctx.globalAlpha = alpha * (0.75 + 0.25 * foc);
    ctx.strokeStyle = foc > 0.5 ? GOLD_HI : GOLD;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - ry);
    ctx.lineTo(x, y + ry);
    ctx.stroke();
    if (act > 0.5) {
      const phase = (S.clock * 0.42 + k * 0.137) % 1.3;
      ctx.globalAlpha = 1;
      drawGlow(ctx, sp.phosphor16, x, y - ry + phase * ry * 2, 9, 0.7 * alpha * act);
    }
  } else {
    const rx = g.lensRx * scale;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = S.lensGrad[k] ?? "rgba(212,168,64,0.1)";
    ctx.fill();
    ctx.globalAlpha = alpha * (0.7 + 0.3 * foc);
    ctx.strokeStyle = foc > 0.5 ? GOLD_HI : GOLD;
    ctx.lineWidth = 1.25;
    ctx.stroke();
    if (act > 0.3) {
      // Specular stripe sweeping down the glass.
      ctx.save();
      ctx.clip();
      const phase = (S.clock * 0.36 + k * 0.137) % 1.25;
      const sy = y - ry - 14 + phase * (ry * 2 + 28);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.6 * alpha * act;
      ctx.drawImage(sp.goldHi32.image, x - rx * 1.8, sy - 9, rx * 3.6, 18);
      ctx.restore();
    }
    // Glass thickness: an inner highlight on the source side.
    ctx.globalAlpha = 0.45 * alpha;
    ctx.strokeStyle = PHOSPHOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.32, y, rx * 0.34, ry * 0.78, 0, Math.PI * 0.62, Math.PI * 1.38);
    ctx.stroke();
  }

  // ◇ lossless / ◆ lossy marker.
  const r = S.compact ? 3 : 4;
  const my = g.markY;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x, my - r);
  ctx.lineTo(x + r, my);
  ctx.lineTo(x, my + r);
  ctx.lineTo(x - r, my);
  ctx.closePath();
  if (lossy) {
    ctx.fillStyle = foc > 0.5 ? GOLD_HI : GOLD;
    ctx.fill();
  } else {
    ctx.strokeStyle = foc > 0.5 ? GOLD_HI : GOLD;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  // A hairline from the marker down to the rim.
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = GOLD;
  ctx.fillRect(x - 0.5, my + r + 2, 1, Math.max(0, y - ry - my - r - 4));
  ctx.globalAlpha = 1;
}

function stepAndDrawGrains(
  ctx: CanvasRenderingContext2D,
  sp: Sprites,
  dt: number,
  input: BenchInput
): void {
  const g = S.g;
  const tier = getQualityTier();
  const count = Math.min(MAX_GRAINS, Math.round(g.grains * TIER_SHARE[tier]));
  S.grainCount = count;
  const n = S.lensCount;
  const portHit = S.portX - g.portR * 0.6;
  const glowSize = S.compact ? 9 : 13;
  const coreSize = S.compact ? 3.2 : 4.2;
  const dim = S.dim;
  let glowN = 0;
  let sparkN = 0;

  ctx.fillStyle = GOLD;
  for (let i = 0; i < count; i++) {
    if (S.gstate[i] === FLOW) {
      const x = S.gx[i] + S.gs[i] * dt;
      S.gx[i] = x;
      let stage = S.gstage[i];
      while (stage < n && x >= S.lensX[stage]) {
        const rate = input.rates[stage];
        if (rate > 0 && unitHash(S.gid[i], stage) < rate) {
          // Removed: becomes dust that falls away from the lens.
          S.gstate[i] = DUST;
          S.gx[i] = S.lensX[stage];
          S.gy[i] = g.beamY + S.gu[i] * envAt(S.lensX[stage], stage);
          S.gvx[i] = S.gs[i] * 0.18;
          S.gvy[i] = (S.rng() - 0.35) * 26;
          S.glife[i] = 1;
          break;
        }
        stage++;
      }
      if (S.gstate[i] === DUST) continue;
      S.gstage[i] = stage;
      if (x >= portHit) {
        if (S.portDark < 0.5) S.portGlow = Math.min(1, S.portGlow + 0.03);
        respawn(i);
        continue;
      }
      if (x < S.beamStart - 2) continue;
      const y = g.beamY + S.gu[i] * envAt(x, stage);
      S.gy[i] = y;
      const fadeIn = clamp01((x - S.beamStart) / 26);
      const a = fadeIn * dim * (0.72 + 0.04 * stage);
      const o = glowN * 4;
      S.glowBuf[o] = x;
      S.glowBuf[o + 1] = y;
      S.glowBuf[o + 2] = glowSize;
      S.glowBuf[o + 3] = a * 0.5;
      S.coreBuf[o] = x;
      S.coreBuf[o + 1] = y;
      S.coreBuf[o + 2] = coreSize;
      S.coreBuf[o + 3] = a;
      glowN++;
    } else {
      // Dust: falls, drifts downstream, fades.
      S.gvy[i] += 170 * dt;
      S.gx[i] += S.gvx[i] * dt;
      S.gy[i] += S.gvy[i] * dt;
      S.glife[i] -= dt * 1.1;
      const life = S.glife[i];
      if (life <= 0 || S.gy[i] > S.h) {
        respawn(i);
        continue;
      }
      ctx.globalAlpha = life * life * 0.85 * dim;
      ctx.fillRect(S.gx[i] - 1, S.gy[i] - 1, 2, 2);
      if (life > 0.72) {
        const o = sparkN * 4;
        S.sparkBuf[o] = S.gx[i];
        S.sparkBuf[o + 1] = S.gy[i];
        S.sparkBuf[o + 2] = S.compact ? 10 : 14;
        S.sparkBuf[o + 3] = (life - 0.72) * 3.4 * dim;
        sparkN++;
      }
    }
  }
  ctx.globalAlpha = 1;
  if (getQualityTier() < 2) drawGlowBatch(ctx, sp.gold16, S.glowBuf, glowN);
  drawGlowBatch(ctx, sp.phosphor16, S.coreBuf, glowN);
  drawGlowBatch(ctx, sp.ember16, S.sparkBuf, sparkN);
}

/** Where tile i sits in the source block (its centre). */
function homeX(tile: PromptTile): number {
  return S.x0 + (tile.x + tile.w / 2) * S.srcW;
}
function homeY(tile: PromptTile): number {
  return S.srcTop + tile.row * S.g.rowPitch + S.g.tileH / 2;
}

function departAt(tile: PromptTile): number {
  return LIFT_START + tile.col * 0.028 + tile.row * 0.016;
}

function drawSource(
  ctx: CanvasRenderingContext2D,
  input: BenchInput,
  inFlight: boolean,
  ft: number
): void {
  const g = S.g;
  const prompt = input.prompt;
  const th = g.tileH;
  // A reading cursor walks the prompt.
  const cursor = (S.clock * 7) % (PROMPT_TILES + 18);
  const sinceLand = S.clock - S.fEndAt;
  for (let i = 0; i < prompt.length && i < PROMPT_TILES; i++) {
    const tile = prompt[i];
    const x = S.x0 + tile.x * S.srcW;
    const y = S.srcTop + tile.row * g.rowPitch;
    const w = tile.w * S.srcW;
    let a = 0.62;
    const d = cursor - i;
    if (d >= 0 && d < 3) a += 0.3 * (1 - d / 3);
    if (inFlight) {
      if (S.fKind === "miss" && ft < LIFT_START) a *= clamp01((ft - i * 0.004) / 0.2);
      if (ft >= departAt(tile)) {
        // Departed: an outline holds its place.
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = GOLD_LO;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, w - 1), th - 1);
        continue;
      }
    } else if (sinceLand < 0.5 && S.fKind === "miss") {
      a *= clamp01(sinceLand / 0.45 - i * 0.004);
    }
    ctx.globalAlpha = a;
    ctx.fillStyle = GOLD;
    ctx.fillRect(x, y, w, th);
  }
  ctx.globalAlpha = 1;
}

function stepAndDrawFlight(
  ctx: CanvasRenderingContext2D,
  sp: Sprites,
  dt: number,
  input: BenchInput,
  ft: number
): void {
  const g = S.g;
  const prompt = input.prompt;
  const removedAt = input.flight.removedAt;
  const spacing = S.compact ? 6 : 15;
  const rowSpan = 0.86;
  const startX = S.mirrorX - (S.compact ? 12 : 28);
  const tileH = S.compact ? 3.5 : 6;
  let sparkN = 0;
  let glowN = 0;
  const miss = S.fKind === "miss";
  const travel = miss ? MISS_TRAVEL_S : HIT_TO_MIRROR_S;
  const q = clamp01((ft - TRAVEL_START) / travel);
  const head = miss
    ? startX + (S.portX - startX) * easeInOut(q)
    : startX + (S.mirrorX - 3 - startX) * easeInOut(q);
  const back = miss ? 0 : clamp01((ft - TRAVEL_START - HIT_TO_MIRROR_S) / HIT_BACK_S);
  if (!miss && q >= 1 && S.mirrorFlash < 0.5 && back < 0.05) {
    S.mirrorFlash = 1;
  }
  if (miss && ft > 0.5 && ft < 0.6 && S.mirrorFlash < 0.3) S.mirrorFlash = 0.55;

  for (let i = 0; i < prompt.length && i < PROMPT_TILES; i++) {
    const tile = prompt[i];
    const state = S.tState[i];
    const depart = departAt(tile);
    const tw0 = tile.w * S.srcW;
    const tw = Math.min(tw0, spacing - 2);
    if (state === T_GONE) continue;
    if (state === T_DUST) {
      S.tvy[i] += 150 * dt;
      S.tx[i] += S.tvx[i] * dt;
      S.ty[i] += S.tvy[i] * dt;
      S.tlife[i] -= dt * 1.15;
      const life = S.tlife[i];
      if (life <= 0) {
        S.tState[i] = T_GONE;
        continue;
      }
      // Tumbling: the height flips through cos.
      const tumble = Math.abs(Math.cos((1 - life) * 9 + i));
      ctx.globalAlpha = life * 0.9;
      ctx.fillStyle = life > 0.55 ? GOLD : GOLD_LO;
      ctx.fillRect(S.tx[i] - tw / 2, S.ty[i] - (tileH * tumble) / 2, tw, tileH * tumble + 0.5);
      if (life > 0.7) {
        const o = sparkN * 4;
        S.sparkBuf[o] = S.tx[i];
        S.sparkBuf[o + 1] = S.ty[i];
        S.sparkBuf[o + 2] = S.compact ? 12 : 20;
        S.sparkBuf[o + 3] = (life - 0.7) * 3;
        sparkN++;
      }
      continue;
    }
    if (S.fLanded || ft < depart) continue;
    if (state === T_HOME) S.tState[i] = T_FLY;

    const u = ((tile.row - (PROMPT_ROWS - 1) / 2) / ((PROMPT_ROWS - 1) / 2)) * rowSpan;
    const offset = (tile.col + (tile.row % 2) * 0.5) * spacing;
    const lift = clamp01((ft - depart) / LIFT_S);
    const hx = homeX(tile);
    const hy = homeY(tile);
    // Where the tile's place in the travelling cluster is now.
    let x: number;
    let y: number;
    let w = tw;
    if (miss || back <= 0) {
      x = head - offset;
      let stage = 0;
      while (stage < S.lensCount && S.lensX[stage] <= x) stage++;
      y = g.beamY + u * envAt(Math.max(x, S.beamStart), stage);
      if (lift >= 1) {
        const k = removedAt[i];
        if (miss && k >= 0 && k < S.lensCount && x >= S.lensX[k]) {
          S.tState[i] = T_DUST;
          S.tx[i] = S.lensX[k];
          S.ty[i] = y;
          S.tvx[i] = 26 + (i % 5) * 6;
          S.tvy[i] = -18 + (i % 7) * 5;
          S.tlife[i] = 1;
          continue;
        }
        if (miss && x >= S.portX - g.portR * 0.7) {
          S.tState[i] = T_GONE;
          S.portGlow = Math.min(1, S.portGlow + 0.12);
          continue;
        }
      }
    } else {
      // Reflected: back along a lower arc into its slot.
      const e = easeInOut(back);
      const fromX = S.mirrorX - 3 - offset;
      const fromY = g.beamY + u * S.env[0];
      x = fromX + (hx - fromX) * e;
      // Arcs up and over, so the returning tiles never cross the caption under the block.
      y = fromY + (hy - fromY) * e - Math.sin(Math.PI * e) * (S.compact ? 8 : 16);
      w = tw + (tw0 - tw) * e;
    }
    if (lift < 1) {
      // Lifting out of the source block towards its (moving) place.
      const e = easeOut(lift);
      x = hx + (x - hx) * e;
      y = hy + (y - hy) * e;
      w = tw0 + (tw - tw0) * e;
    }
    S.tx[i] = x;
    S.ty[i] = y;
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = GOLD_HI;
    ctx.fillRect(x - w / 2, y - tileH / 2, w, tileH);
    const o = glowN * 4;
    S.glowBuf[o] = x;
    S.glowBuf[o + 1] = y;
    S.glowBuf[o + 2] = S.compact ? 12 : 22;
    S.glowBuf[o + 3] = 0.32;
    glowN++;
  }
  ctx.globalAlpha = 1;
  drawGlowBatch(ctx, sp.goldHi32, S.glowBuf, glowN);
  drawGlowBatch(ctx, sp.ember16, S.sparkBuf, sparkN);

  if (!S.fLanded) {
    const landAt = miss
      ? TRAVEL_START + MISS_TRAVEL_S + 0.12
      : TRAVEL_START + HIT_TO_MIRROR_S + HIT_BACK_S + 0.05;
    if (ft >= landAt) {
      S.fLanded = true;
      S.fEndAt = S.clock;
      input.onLand(S.fSeq);
    }
  }
}

function drawPort(ctx: CanvasRenderingContext2D, sp: Sprites): void {
  const g = S.g;
  const x = S.portX;
  const y = g.beamY;
  const r = g.portR;
  const live = 1 - S.portDark;
  const glow = S.portGlow * live;
  // Mouth.
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = BEZEL;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.58, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.55 + 0.45 * live;
  ctx.strokeStyle = GOLD_LO;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Ticks.
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = GOLD;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    const c = Math.cos(a);
    const s = Math.sin(a);
    ctx.moveTo(x + c * (r + 3), y + s * (r + 3));
    ctx.lineTo(x + c * (r + 6), y + s * (r + 6));
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  // The core lights with what arrives; dark on a cache hit.
  const core = 0.3 * live + glow * 0.7;
  if (core > 0.01) {
    drawGlow(ctx, sp.goldHi32, x, y, r * 2.6, core);
    drawGlow(ctx, sp.phosphor16, x, y, r * 1.1, core * 0.9);
    drawGlow(ctx, sp.goldHi64, x, y, r * 6, core * 0.3);
  }
}
