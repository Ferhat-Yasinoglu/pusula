/**
 * The intro canvas: draws one "Landfall" frame from the closed-form timeline
 * (`introTimeline.ts`) and, from the needle's arrival on, the gyro itself
 * with the hero's own `drawGyro`, so the hand-off at 2350–2600 is the same
 * pixels the hero canvas then keeps drawing.
 *
 * Client-only (canvas, glow sprites). Allocation-free per frame: every pool
 * lives on the `IntroCanvas` record built at layout time.
 */
import { drawGlow, drawGlowBatch, getSprite } from "../../runtime/glowSprites";
import {
  DEG,
  RHUMB_COUNT,
  aimFromState,
  drawBezelFlash,
  drawGyro,
  drawHorizonFront,
  gyroState,
  projectStars,
  type GyroGeometry,
  type GyroScene,
} from "../hero/gyro";
import {
  INTRO_T,
  KABUL_INDEX,
  PARTICLE_STRIDE,
  P_DOT,
  P_PROVIDER,
  P_SHELL_BACK,
  P_SHELL_GOLD,
  P_SHELL_HI,
  P_STAR,
  arcProgress,
  cityFlare,
  type IntroLayout,
  type IntroScalars,
  writeParticles,
} from "./introTimeline";

/** The five map bands, darkest to brightest (gold ramp ending in phosphor near the cities). */
const LEVEL_FILL = ["#a47c26", "#c09432", "#d4a840", "#ffd36e", "#fff1c9"] as const;
const LEVEL_ALPHA = [0.72, 0.8, 0.88, 0.95, 1] as const;
/**
 * Dots are drawn one path per (band, alpha step): during the swirl and the
 * provider flight their alpha differs per particle, so it is quantised to
 * eighths rather than assumed shared.
 */
const ALPHA_STEPS = 8;
const DOT_BUCKETS = LEVEL_FILL.length * (ALPHA_STEPS + 1);

export type IntroCanvas = {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  dpr: number;
  layout: IntroLayout;
  scene: GyroScene;
  geom: GyroGeometry;
  /** The hero's sky (stage) in viewport px: the rhumbs end at its edges, like the DOM ones. */
  sky: { x: number; y: number; w: number; h: number };
  parts: Float32Array;
  poolLight: Float32Array;
  poolGold: Float32Array;
  poolHi: Float32Array;
  /** Dot buckets: counts, then start offsets into `bucketIdx` (particle indices). */
  bucketCount: Int32Array;
  bucketStart: Int32Array;
  bucketIdx: Int32Array;
};

export function createIntroCanvas(
  ctx: CanvasRenderingContext2D,
  size: { w: number; h: number; dpr: number },
  layout: IntroLayout,
  scene: GyroScene,
  geom: GyroGeometry,
  sky: { x: number; y: number; w: number; h: number }
): IntroCanvas {
  return {
    ctx,
    ...size,
    layout,
    scene,
    geom,
    sky,
    parts: new Float32Array(layout.n * PARTICLE_STRIDE),
    poolLight: new Float32Array(layout.n * 4),
    poolGold: new Float32Array(layout.n * 4),
    poolHi: new Float32Array(layout.n * 4),
    bucketCount: new Int32Array(DOT_BUCKETS),
    bucketStart: new Int32Array(DOT_BUCKETS + 1),
    bucketIdx: new Int32Array(layout.n),
  };
}

export function renderIntro(
  c: IntroCanvas,
  S: IntroScalars,
  t: number,
  now: number,
  quality: 0 | 1 | 2
): void {
  const { ctx, w, h, layout: L } = c;
  ctx.clearRect(0, 0, w, h);
  const mx = w / 2;
  const my = h / 2;

  // Ignition: a point, its glow, a sextant crosshair.
  if (S.cross > 0) {
    ctx.globalAlpha = S.cross;
    ctx.strokeStyle = "#ffd36e";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx - mx * S.crossLen, my + 0.5);
    ctx.lineTo(mx + mx * S.crossLen, my + 0.5);
    ctx.moveTo(mx + 0.5, my - my * S.crossLen);
    ctx.lineTo(mx + 0.5, my + my * S.crossLen);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (S.glow > 0) drawGlow(ctx, getSprite("goldHi", 64), mx, my, S.glowR * 2, S.glow);
  if (S.point > 0) {
    ctx.globalAlpha = S.point;
    ctx.fillStyle = "#ffd36e";
    ctx.fillRect(mx - 0.75, my - 0.75, 1.5, 1.5);
    ctx.globalAlpha = 1;
  }

  // From the hand-off the bridge has risen above this canvas and draws the
  // gyro and its rhumbs itself; only the lock's own effects stay here, and
  // the horizon's front half fades out under the DOM arc fading in.
  const handoff = t >= INTRO_T.handoff;

  // Rhumbs shoot out from the compass centre (clipped to the hero's sky).
  if (!handoff && S.rhumbsA > 0 && S.rhumbs > 0) {
    const { cx, cy } = c.geom;
    const reach = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) * S.rhumbs;
    ctx.save();
    ctx.beginPath();
    ctx.rect(c.sky.x, c.sky.y, c.sky.w, c.sky.h);
    ctx.clip();
    ctx.strokeStyle = "#d4a840";
    ctx.lineWidth = 1;
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = (pass === 0 ? 0.1 : 0.18) * S.rhumbsA;
      ctx.beginPath();
      for (let k = 0; k < RHUMB_COUNT; k++) {
        if ((k % 4 === 0) !== (pass === 1)) continue;
        const a = k * (360 / RHUMB_COUNT) * DEG;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.sin(a) * reach, cy - Math.cos(a) * reach);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // The gyro: rings fade in under the swirl, the needle spins in and locks.
  if (handoff) {
    drawHorizonFront(ctx, c.scene, S.curtain);
    drawBezelFlash(ctx, c.geom, S.flash);
  } else if (S.rings > 0 || S.needle > 0) {
    drawGyro(ctx, c.scene, c.geom, gyroState, now, quality);
  }

  // The map wash and border.
  if (S.borderA > 0 && S.border > 0) drawBorder(c, S);

  // Particles: starlight, the dot-matrix map, the swirl and the provider stars.
  if (!handoff) drawParticles(c, t);

  // Kabul's pulse, the arcs and the city flares.
  if (S.kabulA > 0) {
    ctx.globalAlpha = S.kabulA;
    ctx.strokeStyle = "#ffd36e";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(L.kabulX, L.kabulY, Math.max(0.1, S.kabulR), 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.globalAlpha = 1;
  }
  if (S.arcsA > 0 && t >= 1300) {
    drawGlow(ctx, getSprite("goldHi", 64), L.kabulX, L.kabulY, 38, 0.8 * S.arcsA);
    drawGlow(ctx, getSprite("phosphor", 32), L.kabulX, L.kabulY, 12, S.arcsA);
    drawArcs(c, S, t);
  }

  // The lock shockwave.
  if (S.shockA > 0) {
    ctx.globalAlpha = S.shockA;
    ctx.strokeStyle = "#ffd36e";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.geom.cx, c.geom.cy, Math.max(0.1, S.shock * c.geom.R), 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.globalAlpha = 1;
  }
}

function drawBorder(c: IntroCanvas, S: IntroScalars): void {
  const { ctx, layout: L } = c;
  const m = L.borderX.length - 1;
  const total = L.borderLen[m];
  const reach = total * S.border;
  if (S.border >= 1) {
    // Complete: a faint gold wash inside, like the reference map.
    ctx.globalAlpha = 0.06 * (S.borderA / 0.8);
    ctx.fillStyle = "#d4a840";
    ctx.beginPath();
    ctx.moveTo(L.borderX[0], L.borderY[0]);
    for (let k = 1; k <= m; k++) ctx.lineTo(L.borderX[k], L.borderY[k]);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(L.borderX[0], L.borderY[0]);
  let headX = L.borderX[0];
  let headY = L.borderY[0];
  for (let k = 1; k <= m; k++) {
    if (L.borderLen[k] <= reach) {
      ctx.lineTo(L.borderX[k], L.borderY[k]);
      headX = L.borderX[k];
      headY = L.borderY[k];
      continue;
    }
    const seg = L.borderLen[k] - L.borderLen[k - 1];
    const f = seg > 0 ? (reach - L.borderLen[k - 1]) / seg : 0;
    headX = L.borderX[k - 1] + (L.borderX[k] - L.borderX[k - 1]) * f;
    headY = L.borderY[k - 1] + (L.borderY[k] - L.borderY[k - 1]) * f;
    ctx.lineTo(headX, headY);
    break;
  }
  ctx.strokeStyle = "#d4a840";
  ctx.lineJoin = "round";
  ctx.globalAlpha = 0.16 * (S.borderA / 0.8);
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.globalAlpha = S.borderA;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;
  if (S.border < 1) drawGlow(ctx, getSprite("phosphor", 32), headX, headY, 18, S.borderA);
}

function drawArcs(c: IntroCanvas, S: IntroScalars, t: number): void {
  const { ctx, layout: L } = c;
  const hi = getSprite("goldHi", 64);
  const head = getSprite("phosphor", 32);
  for (let k = 0; k < L.cityX.length; k++) {
    if (k === KABUL_INDEX) continue;
    const p = arcProgress(t, k);
    if (p <= 0) continue;
    // The sub-curve [0, p] of a quadratic: control lerp(K, Q, p), end B(p).
    const qx = L.kabulX + (L.arcQX[k] - L.kabulX) * p;
    const qy = L.kabulY + (L.arcQY[k] - L.kabulY) * p;
    const u = 1 - p;
    const bx = u * u * L.kabulX + 2 * u * p * L.arcQX[k] + p * p * L.cityX[k];
    const by = u * u * L.kabulY + 2 * u * p * L.arcQY[k] + p * p * L.cityY[k];
    ctx.globalAlpha = 0.85 * S.arcsA;
    ctx.strokeStyle = "#ffd36e";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(L.kabulX, L.kabulY);
    ctx.quadraticCurveTo(qx, qy, bx, by);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.globalAlpha = 1;
    if (p < 1) drawGlow(ctx, head, bx, by, 16, S.arcsA);
    const flare = cityFlare(t, k);
    if (flare > 0)
      drawGlow(ctx, hi, L.cityX[k], L.cityY[k], 44 + 30 * (1 - flare), flare * S.arcsA);
    if (p >= 1) drawGlow(ctx, head, L.cityX[k], L.cityY[k], 10, 0.9 * S.arcsA);
  }
}

function drawParticles(c: IntroCanvas, t: number): void {
  const { ctx, layout: L, parts } = c;
  writeParticles(L, t, parts);
  let nLight = 0;
  let nGold = 0;
  let nHi = 0;

  // Starlight and back-hemisphere rects, one fillRect each.
  ctx.fillStyle = "#ffe7a8";
  for (let j = 0; j < L.n; j++) {
    const o = j * PARTICLE_STRIDE;
    const cls = parts[o + 4];
    if (cls === P_STAR) {
      const s = parts[o + 2];
      ctx.globalAlpha = parts[o + 3];
      ctx.fillRect(parts[o] - s / 2, parts[o + 1] - s / 2, s, s);
    } else if (cls === P_PROVIDER) {
      const p = nLight * 4;
      c.poolLight[p] = parts[o];
      c.poolLight[p + 1] = parts[o + 1];
      c.poolLight[p + 2] = parts[o + 2] * 4.5;
      c.poolLight[p + 3] = Math.min(1, parts[o + 3] * 1.4);
      nLight++;
    } else if (cls === P_SHELL_GOLD || cls === P_SHELL_HI) {
      const pool = cls === P_SHELL_HI ? c.poolHi : c.poolGold;
      const p = (cls === P_SHELL_HI ? nHi++ : nGold++) * 4;
      pool[p] = parts[o];
      pool[p + 1] = parts[o + 1];
      pool[p + 2] = parts[o + 2];
      pool[p + 3] = parts[o + 3];
    }
  }
  ctx.fillStyle = "#8c6a1e";
  for (let j = 0; j < L.n; j++) {
    const o = j * PARTICLE_STRIDE;
    if (parts[o + 4] !== P_SHELL_BACK) continue;
    const s = parts[o + 2];
    ctx.globalAlpha = parts[o + 3];
    ctx.fillRect(parts[o] - s / 2, parts[o + 1] - s / 2, s, s);
  }
  ctx.globalAlpha = 1;

  // Map dots: one path per (band, alpha step), bucketed in two passes.
  const { bucketCount, bucketStart, bucketIdx } = c;
  bucketCount.fill(0);
  for (let j = 0; j < L.n; j++) {
    const o = j * PARTICLE_STRIDE;
    const level = parts[o + 4] - P_DOT;
    if (level < 0 || level >= LEVEL_FILL.length) continue;
    const step = Math.round(Math.min(1, parts[o + 3]) * ALPHA_STEPS);
    if (step <= 0) continue;
    bucketCount[level * (ALPHA_STEPS + 1) + step]++;
  }
  bucketStart[0] = 0;
  for (let b = 0; b < DOT_BUCKETS; b++) bucketStart[b + 1] = bucketStart[b] + bucketCount[b];
  bucketCount.fill(0);
  for (let j = 0; j < L.n; j++) {
    const o = j * PARTICLE_STRIDE;
    const level = parts[o + 4] - P_DOT;
    if (level < 0 || level >= LEVEL_FILL.length) continue;
    const step = Math.round(Math.min(1, parts[o + 3]) * ALPHA_STEPS);
    if (step <= 0) continue;
    const b = level * (ALPHA_STEPS + 1) + step;
    bucketIdx[bucketStart[b] + bucketCount[b]++] = j;
  }
  for (let b = 0; b < DOT_BUCKETS; b++) {
    const from = bucketStart[b];
    const to = bucketStart[b + 1];
    if (to <= from) continue;
    const level = Math.floor(b / (ALPHA_STEPS + 1));
    const step = b % (ALPHA_STEPS + 1);
    ctx.beginPath();
    for (let k = from; k < to; k++) {
      const o = bucketIdx[k] * PARTICLE_STRIDE;
      const r = parts[o + 2] / 2;
      ctx.moveTo(parts[o] + r, parts[o + 1]);
      ctx.arc(parts[o], parts[o + 1], r, 0, Math.PI * 2);
    }
    ctx.globalAlpha = LEVEL_ALPHA[level] * (step / ALPHA_STEPS);
    ctx.fillStyle = LEVEL_FILL[level];
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawGlowBatch(ctx, getSprite("phosphor", 16), c.poolLight, nLight);
  drawGlowBatch(ctx, getSprite("gold", 16), c.poolGold, nGold);
  drawGlowBatch(ctx, getSprite("goldHi", 16), c.poolHi, nHi);
}

/** Refresh the gyro's projection for this frame (the intro owns the shared state while it drives). */
export function aimIntroGyro(c: IntroCanvas): void {
  aimFromState(c.scene, c.geom, gyroState);
  projectStars(c.scene);
}
