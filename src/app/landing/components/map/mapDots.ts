/**
 * The network map's dot matrix, drawn by `mapRender.ts` (spec §6.3). Client-only.
 *
 * It holds the grid of dots inside the border (each with its influence weight
 * per city, so heat can brighten it), the 32-unit bucket grid the ripples
 * walk, the ripple pool (a served landing lifts a travelling ring of dots and
 * draws its ring line), the five-band fill and the pillars of light that rise
 * from hot dots once the map is tilted.
 *
 * The dots are round, as in the reference image: one path of arcs and one
 * fill per band (five `fillStyle` changes), which profiled no slower than the
 * spec's `fillRect` squares (≈0.9 ms per desktop frame, all layers).
 *
 * The renderer owns the camera and the heat and passes them in. The pools are
 * typed arrays sized when the grid is (re)built, so a frame allocates nothing.
 */
import { MAP_HEIGHT, MAP_WIDTH, buildDotGrid } from "../../landingGeometry";
import { PROJECTED_STRIDE, project3, ringPolyline, type Camera } from "../../sim/landingProjection";
import { drawGlowBatch, type GlowSprite } from "../../runtime/glowSprites";
import { BANDS, BAND_FILL, GOLD, GOLD_HI } from "./mapPalette";
import {
  CITY_COUNT,
  HEAT_SIGMA_SPACINGS,
  NODE_POINTS,
  PILLAR_THRESHOLD,
  pillarHeight,
} from "./mapRoles";

const HALF_W = MAP_WIDTH / 2;
const HALF_H = MAP_HEIGHT / 2;
const scratch = new Float32Array(PROJECTED_STRIDE * 2);

/* ------------------------------------------------------------------------ */
/* Grid                                                                     */
/* ------------------------------------------------------------------------ */

const DOT_RADIUS = 1.3;
const CELL = 32;
const CELLS_X = Math.ceil(MAP_WIDTH / CELL);
const CELLS_Y = Math.ceil(MAP_HEIGHT / CELL);
let builtSpacing = 0;
let dotCount = 0;
let dotX = new Float32Array(0);
let dotY = new Float32Array(0);
let dotBase = new Float32Array(0);
/** Per dot, the influence weight of each city: `exp(−d² / 2σ²)`, σ = 4 · spacing. */
let dotWeight = new Float32Array(0);
let dotLift = new Float32Array(0);
let cellStart = new Int32Array(CELLS_X * CELLS_Y + 1);
let cellDots = new Int32Array(0);
/** Per band: x, y, radius records. */
let bandData: Float32Array[] = [];
const bandCount = new Int32Array(BANDS);
let pillarLines = new Float32Array(0);
let pillarTops = new Float32Array(0);
let pillarStrength = new Float32Array(0);
let pillarCount = 0;

/** (Re)build the grid when the wanted dot spacing changed. */
export function ensureDots(spacing: number): void {
  if (spacing !== builtSpacing) buildDots(spacing);
}

function buildDots(spacing: number): void {
  const dots = buildDotGrid(spacing);
  dotCount = dots.length;
  dotX = new Float32Array(dotCount);
  dotY = new Float32Array(dotCount);
  dotBase = new Float32Array(dotCount);
  dotWeight = new Float32Array(dotCount * CITY_COUNT);
  dotLift = new Float32Array(dotCount);
  const sigma = HEAT_SIGMA_SPACINGS * spacing;
  const twoSigma2 = 2 * sigma * sigma;
  const counts = new Int32Array(CELLS_X * CELLS_Y);
  for (let i = 0; i < dotCount; i++) {
    const dot = dots[i];
    dotX[i] = dot.x - HALF_W;
    dotY[i] = dot.y - HALF_H;
    // At rest every dot is gold (bands 0–2); only heat lifts one to gold-hi
    // and phosphor, so the flat map reads as the reference's gold matrix.
    dotBase[i] = 0.2 + 0.085 * dot.level;
    for (let c = 0; c < CITY_COUNT; c++) {
      const p = NODE_POINTS[c];
      const d2 = (p.x - dot.x) ** 2 + (p.y - dot.y) ** 2;
      dotWeight[i * CITY_COUNT + c] = Math.exp(-d2 / twoSigma2);
    }
    counts[cellOf(dot.x, dot.y)]++;
  }
  cellStart = new Int32Array(CELLS_X * CELLS_Y + 1);
  for (let c = 0; c < counts.length; c++) cellStart[c + 1] = cellStart[c] + counts[c];
  cellDots = new Int32Array(dotCount);
  const fill = cellStart.slice(0, counts.length);
  for (let i = 0; i < dotCount; i++) {
    cellDots[fill[cellOf(dotX[i] + HALF_W, dotY[i] + HALF_H)]++] = i;
  }
  bandData = Array.from({ length: BANDS }, () => new Float32Array(dotCount * 3));
  pillarLines = new Float32Array(dotCount * 4);
  pillarTops = new Float32Array(dotCount * 4);
  pillarStrength = new Float32Array(dotCount);
  builtSpacing = spacing;
}

function cellOf(x: number, y: number): number {
  const cx = Math.min(CELLS_X - 1, Math.max(0, Math.floor(x / CELL)));
  const cy = Math.min(CELLS_Y - 1, Math.max(0, Math.floor(y / CELL)));
  return cy * CELLS_X + cx;
}

/* ------------------------------------------------------------------------ */
/* Ripples                                                                  */
/* ------------------------------------------------------------------------ */

const MAX_RIPPLES = 4;
const RIPPLE_MS = 900;
const RIPPLE_RADIUS = 140;
const RIPPLE_BAND = 10;
const rippleNode = new Int32Array(MAX_RIPPLES).fill(-1);
const rippleStart = new Float64Array(MAX_RIPPLES);
const ringScreen = new Float32Array(49 * PROJECTED_STRIDE);

/** Start a ripple at a city (a served landing): a free slot, else the oldest. */
export function startRipple(node: number, now: number): void {
  let slot = -1;
  let oldest = 0;
  for (let r = 0; r < MAX_RIPPLES; r++) {
    if (rippleNode[r] < 0) {
      slot = r;
      break;
    }
    if (rippleStart[r] < rippleStart[oldest]) oldest = r;
  }
  if (slot < 0) slot = oldest;
  rippleNode[slot] = node;
  rippleStart[slot] = now;
}

/** Drop every ripple (a fresh scene). */
export function clearRipples(): void {
  rippleNode.fill(-1);
}

/** Expire finished ripples and lift the dots under each running ring. */
export function updateRipples(now: number, tier: number): void {
  dotLift.fill(0);
  if (tier >= 1) return;
  for (let r = 0; r < MAX_RIPPLES; r++) {
    const node = rippleNode[r];
    if (node < 0) continue;
    const t = (now - rippleStart[r]) / RIPPLE_MS;
    if (t >= 1) {
      rippleNode[r] = -1;
      continue;
    }
    const radius = RIPPLE_RADIUS * (1 - (1 - t) * (1 - t));
    const amount = 4 * (1 - t);
    const p = NODE_POINTS[node];
    const reach = radius + RIPPLE_BAND;
    const x0 = Math.max(0, Math.floor((p.x - reach) / CELL));
    const x1 = Math.min(CELLS_X - 1, Math.floor((p.x + reach) / CELL));
    const y0 = Math.max(0, Math.floor((p.y - reach) / CELL));
    const y1 = Math.min(CELLS_Y - 1, Math.floor((p.y + reach) / CELL));
    const px = p.x - HALF_W;
    const py = p.y - HALF_H;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = cy * CELLS_X + cx;
        for (let k = cellStart[cell]; k < cellStart[cell + 1]; k++) {
          const i = cellDots[k];
          const d = Math.hypot(dotX[i] - px, dotY[i] - py);
          const off = Math.abs(d - radius);
          if (off < RIPPLE_BAND) dotLift[i] += amount * (1 - off / RIPPLE_BAND);
        }
      }
    }
  }
}

/** The ring line of every running ripple, fading as it widens. */
export function drawRipples(ctx: CanvasRenderingContext2D, cam: Camera, now: number): void {
  ctx.strokeStyle = GOLD_HI;
  ctx.lineWidth = 1.2;
  for (let r = 0; r < MAX_RIPPLES; r++) {
    const node = rippleNode[r];
    if (node < 0) continue;
    const t = (now - rippleStart[r]) / RIPPLE_MS;
    if (t >= 1 || t < 0) continue;
    const radius = RIPPLE_RADIUS * (1 - (1 - t) * (1 - t));
    const p = NODE_POINTS[node];
    ringPolyline(cam, Math.max(radius, 1), 0, 48, ringScreen, p.x - HALF_W, p.y - HALF_H, 0);
    ctx.globalAlpha = 0.55 * (1 - t);
    ctx.beginPath();
    ctx.moveTo(ringScreen[0], ringScreen[1]);
    for (let i = 1; i <= 48; i++) {
      ctx.lineTo(ringScreen[i * PROJECTED_STRIDE], ringScreen[i * PROJECTED_STRIDE + 1]);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------------ */
/* Dots and pillars                                                         */
/* ------------------------------------------------------------------------ */

/**
 * Project every dot (lifted by the ripples, brightened by `heat`) into its
 * band and fill the bands. With pillars on (tier 0, tilted) it also collects
 * the pillars of the hot dots for `drawPillars`.
 */
export function drawDots(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  heat: Float32Array,
  tier: number,
  tilt: number
): void {
  bandCount.fill(0);
  pillarCount = 0;
  const pillars = tier === 0 && tilt > 0;
  const scale = cam.scale;
  let hot = 0;
  for (let c = 0; c < CITY_COUNT; c++) if (heat[c] > 0.01) hot++;
  for (let i = 0; i < dotCount; i++) {
    let h = 0;
    if (hot > 0) {
      const base = i * CITY_COUNT;
      for (let c = 0; c < CITY_COUNT; c++) h += heat[c] * dotWeight[base + c];
    }
    const lift = dotLift[i];
    const s = project3(cam, dotX[i], dotY[i], lift, scratch, 0);
    const brightness = dotBase[i] + 0.42 * Math.min(h, 1.3) + lift * 0.08;
    const band = Math.min(BANDS - 1, Math.max(0, Math.floor(brightness * BANDS)));
    const o = bandCount[band]++ * 3;
    const data = bandData[band];
    data[o] = scratch[0];
    data[o + 1] = scratch[1];
    data[o + 2] = (DOT_RADIUS + 0.13 * band) * scale * s;
    if (pillars && h > PILLAR_THRESHOLD) {
      project3(cam, dotX[i], dotY[i], lift + pillarHeight(h) * tilt, scratch, PROJECTED_STRIDE);
      const q = pillarCount * 4;
      pillarLines[q] = scratch[0];
      pillarLines[q + 1] = scratch[1];
      pillarLines[q + 2] = scratch[PROJECTED_STRIDE];
      pillarLines[q + 3] = scratch[PROJECTED_STRIDE + 1];
      pillarTops[q] = scratch[PROJECTED_STRIDE];
      pillarTops[q + 1] = scratch[PROJECTED_STRIDE + 1];
      // Soft edge: pillars at the rim of a heat field are short-lived and dim.
      const strength = Math.min(1, (h - PILLAR_THRESHOLD) / 0.5);
      pillarTops[q + 2] = (3 + 5 * strength) * Math.min(1.2, scale);
      pillarTops[q + 3] = (0.3 + 0.6 * strength) * tilt;
      pillarStrength[pillarCount] = strength;
      pillarCount++;
    }
  }
  // One path and one fill per band: five fillStyle changes for the whole matrix.
  for (let b = 0; b < BANDS; b++) {
    const data = bandData[b];
    const count = bandCount[b];
    if (count === 0) continue;
    ctx.fillStyle = BAND_FILL[b];
    ctx.beginPath();
    for (let k = 0; k < count; k++) {
      const o = k * 3;
      const r = data[o + 2];
      ctx.moveTo(data[o] + r, data[o + 1]);
      ctx.arc(data[o], data[o + 1], r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

/** Pillar strength bins: [from, to) and the alpha of each bin's light. */
const PILLAR_BINS: readonly (readonly [number, number, number])[] = [
  [0, 0.34, 0.35],
  [0.34, 0.67, 0.65],
  [0.67, 1.01, 1],
];

/**
 * Pillars of light: a dim shaft from the dot, a brighter upper half and a
 * glowing tip (the `tip` sprite), binned by strength so the rim of a heat
 * field fades out.
 */
export function drawPillars(
  ctx: CanvasRenderingContext2D,
  tilt: number,
  tip: GlowSprite | null
): void {
  if (pillarCount === 0) return;
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "butt";
  for (let bin = 0; bin < PILLAR_BINS.length; bin++) {
    const from = PILLAR_BINS[bin][0];
    const to = PILLAR_BINS[bin][1];
    const alpha = PILLAR_BINS[bin][2];
    // Shaft.
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.22 * alpha * tilt;
    ctx.beginPath();
    for (let i = 0; i < pillarCount; i++) {
      const f = pillarStrength[i];
      if (f < from || f >= to) continue;
      const q = i * 4;
      ctx.moveTo(pillarLines[q], pillarLines[q + 1]);
      ctx.lineTo(pillarLines[q + 2], pillarLines[q + 3]);
    }
    ctx.stroke();
    // The upper half burns brighter.
    ctx.strokeStyle = GOLD_HI;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.55 * alpha * tilt;
    ctx.beginPath();
    for (let i = 0; i < pillarCount; i++) {
      const f = pillarStrength[i];
      if (f < from || f >= to) continue;
      const q = i * 4;
      const mx = pillarLines[q] + (pillarLines[q + 2] - pillarLines[q]) * 0.55;
      const my = pillarLines[q + 1] + (pillarLines[q + 3] - pillarLines[q + 1]) * 0.55;
      ctx.moveTo(mx, my);
      ctx.lineTo(pillarLines[q + 2], pillarLines[q + 3]);
    }
    ctx.stroke();
  }
  ctx.lineCap = "round";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  if (tip) drawGlowBatch(ctx, tip, pillarTops, pillarCount, 4);
}
