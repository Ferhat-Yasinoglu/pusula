/**
 * The network map's canvas renderer (spec §6.3), loaded lazily by
 * `NetworkMap` and driven by the heartbeat's canvas lane through
 * `useCanvasStage`. Client-only.
 *
 * The world is the map in its own units (825 × 643), centred, z up. Every
 * frame is a full repaint, because the camera always breathes:
 *
 *   wash → wall top → dot matrix (5 brightness bands, rippled, heated) →
 *   border → spokes and breaker roads → pillars of light → city beacons →
 *   ripples → breaker rings → city nodes → flights (comets) → sparks and codes.
 *
 * The dots are round, as in the reference image: one path of arcs and one
 * fill per band (five `fillStyle` changes), which profiled no slower than the
 * spec's `fillRect` squares (≈0.9 ms per desktop frame, all layers).
 *
 * Flights come from the deck's `routed` / `dropped` events, handed over by
 * the station through `launch()`; each plays as hub-arc legs (client → Kabul,
 * then Kabul → each target in turn: the hub retries the next one, never a
 * relay). Landings are reported back through the bound handlers, which drive
 * the counters and the flight board.
 *
 * Hygiene: one module-level scene; typed-array pools sized at setup; no
 * allocation, `shadowBlur` or `ctx.filter` on the per-frame path (glows are
 * pre-rendered sprites stamped with "lighter"). Animation time is an internal
 * clock fed by the heartbeat's clamped `dt`, so a frozen or hidden stage
 * resumes where it stopped instead of fast-forwarding.
 */
import { BORDER_POINTS, MAP_HEIGHT, MAP_WIDTH, buildDotGrid } from "../../landingGeometry";
import { BREAKER_PROFILES, SAMPLE_CANDIDATES } from "../../landingTypes";
import {
  PROJECTED_STRIDE,
  arcPoint3,
  makeCamera,
  project3,
  ringPolyline,
  updateCamera,
  vec3,
  type Arc3,
  type CameraInput,
} from "../../sim/landingProjection";
import type { BreakerState, CandidateId, DeckEvent } from "../../sim/landingSim";
import { mulberry32, hash32 } from "../../sim/prng";
import { getWorld } from "../../runtime/deckStore";
import { drawGlow, drawGlowBatch, getSprite, type GlowSprite } from "../../runtime/glowSprites";
import { getQualityTier } from "../../runtime/heartbeat";
import { CAMERA, springAt, stepSpring } from "../../runtime/springs";
import type { StageSize } from "../../runtime/useCanvasStage";
import {
  BREATH_YAW_DEG,
  CITY_COUNT,
  CLIENT_HEAT_KICK,
  DEG,
  FLOW_PITCH_DEG,
  FLOW_YAW_DEG,
  HEAT_HALF_LIFE_S,
  HEAT_KICK,
  HEAT_SIGMA_SPACINGS,
  HUB_ARCS,
  HUB_HEAT_KICK,
  HUB_INDEX,
  MAP_CANDIDATES,
  NODE_COUNT,
  NODE_POINTS,
  PARALLAX_YAW_DEG,
  PERSPECTIVE_F,
  PILLAR_THRESHOLD,
  PIN_PITCH_DEG,
  TILT_FEATURES_DEG,
  candidateAtNode,
  clientNode,
  emptyLeg,
  fitMap,
  flowPitch,
  kickHeat,
  pillarHeight,
  pinCameraTarget,
  planFlight,
  providerNode,
  tiltFrame,
  type LegPlan,
  type MapFrame,
  type MapLayout,
} from "./mapRoles";

/* ------------------------------------------------------------------------ */
/* Binding                                                                  */
/* ------------------------------------------------------------------------ */

export type FlightEvent = Extract<DeckEvent, { kind: "routed" } | { kind: "dropped" }>;

/** What the station feeds the renderer each frame (a mutable object it owns). */
export type MapInput = {
  layout: MapLayout;
  /** Pin progress on desktop, traverse progress on phone (0..1). */
  progress: { current: number };
  /** Flow layout: the map has been ≥ 40% on screen once (starts the tilt). */
  revealed: boolean;
  /** −1..1 pointer offset across the stage (desktop parallax), 0 at rest. */
  parallax: number;
  /** Hovered city index (`CITIES` order) or −1. */
  hover: number;
  /** The page is right-to-left: the desktop framing leans further right (`MAP_FITS`). */
  rtl: boolean;
};

export type MapHandlers = {
  /** A request reached Kabul (its client leg landed). */
  onHub: (event: FlightEvent) => void;
  /** A request's flight is over: served at its last leg, or dropped. */
  onLand: (event: FlightEvent) => void;
};

let input: MapInput | null = null;
let handlers: MapHandlers | null = null;

/**
 * Connect the station; returns the disconnect. A new binding starts a fresh
 * scene (the module outlives a remount: a locale switch, HMR), so the phone's
 * time-based tilt replays and no stale heat, ripple or spark carries over.
 */
export function bind(nextInput: MapInput, nextHandlers: MapHandlers): () => void {
  input = nextInput;
  handlers = nextHandlers;
  resetScene();
  return () => {
    if (input === nextInput) {
      input = null;
      handlers = null;
      for (const flight of flights) {
        flight.active = false;
        flight.event = null;
      }
    }
  };
}

/** Projected nodes of the last frame: `NODE_COUNT` records of sx, sy, s, depth (CSS px). */
export const nodeScreen = new Float32Array(NODE_COUNT * PROJECTED_STRIDE);
let frameCount = 0;
/** Bumped after every drawn frame (labels skip work when it has not moved). */
export function getFrameCount(): number {
  return frameCount;
}

/* ------------------------------------------------------------------------ */
/* Palette (landing.css tokens)                                             */
/* ------------------------------------------------------------------------ */

const GOLD = "#d4a840";
const GOLD_HI = "#ffd36e";
const GOLD_LO = "#8c6a1e";
const PHOSPHOR = "#fff1c9";
const EMBER = "#ff7a45";
const VOID = "#040405";
/** Ember-gold, the tint of a fallback leg (between --ember and --gold-hi). */
const EMBER_GOLD = "#ffa65a";
const CODE_FONT = "600 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Five dot bands, dim gold to phosphor: [r, g, b, alpha]. */
const BAND_RGBA: readonly (readonly [number, number, number, number])[] = [
  [140, 106, 30, 0.62],
  [176, 136, 48, 0.78],
  [212, 168, 64, 0.9],
  [255, 211, 110, 0.96],
  [255, 241, 201, 1],
];
const BANDS = BAND_RGBA.length;
const BAND_FILL: readonly string[] = BAND_RGBA.map(([r, g, b, a]) => `rgba(${r},${g},${b},${a})`);
const DASH_NONE: number[] = [];
const DASH_HUB: number[] = [3, 4];
const DASH_CUT: number[] = [5, 5];
/** The poster's spoke dash (`strokeDasharray="3 5"` in MapPoster). */
const DASH_SPOKE: number[] = [3, 5];

/* ------------------------------------------------------------------------ */
/* Scene state                                                              */
/* ------------------------------------------------------------------------ */

const cam = makeCamera({ yaw: 0, pitch: 0, F: PERSPECTIVE_F, cx: 0, cy: 0, scale: 1 });
const camInput: CameraInput = { yaw: 0, pitch: 0, F: PERSPECTIVE_F, cx: 0, cy: 0, scale: 1 };
const frame: MapFrame = { scale: 1, cx: 0, cy: 0 };
const tilted: MapFrame = { scale: 1, cx: 0, cy: 0 };
const target = { pitch: 0, yaw: 0 };
const pitchSpring = springAt(0);
const yawSpring = springAt(0);
let clockMs = 0;
let revealClock = -1;

const PIN_PITCH_RAD = PIN_PITCH_DEG * DEG;
const FLOW_PITCH_RAD = FLOW_PITCH_DEG * DEG;
/** rad/s of the idle yaw breath (a ~24 s period). */
const BREATH_RATE = 0.26;
const HALF_W = MAP_WIDTH / 2;
const HALF_H = MAP_HEIGHT / 2;

// Dot matrix ------------------------------------------------------------------
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

// Heat ------------------------------------------------------------------------
const heat = new Float32Array(CITY_COUNT);

// Static arcs: 20 segments per hub arc, world xyz ------------------------------
const ARC_SEGMENTS = 20;
const arcSamples: (Float32Array | null)[] = HUB_ARCS.map((arc) => {
  if (!arc) return null;
  const out = new Float32Array((ARC_SEGMENTS + 1) * 3);
  const v = vec3();
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    arcPoint3(arc, i / ARC_SEGMENTS, v);
    out[i * 3] = v[0] - HALF_W;
    out[i * 3 + 1] = v[1] - HALF_H;
    out[i * 3 + 2] = v[2];
  }
  return out;
});
const arcScreen = new Float32Array((ARC_SEGMENTS + 1) * PROJECTED_STRIDE);
const borderScreen = new Float32Array(BORDER_POINTS.length * PROJECTED_STRIDE);
const ringScreen = new Float32Array(49 * PROJECTED_STRIDE);
const point3 = vec3();
const scratch = new Float32Array(PROJECTED_STRIDE * 2);

// Flights ---------------------------------------------------------------------
const MAX_FLIGHTS = 16;
const MAX_LEGS = 6;
const TRAIL_POINTS = 11;
const TRAIL_SPAN = 0.22;
type Flight = {
  active: boolean;
  event: FlightEvent | null;
  /** Internal clock ms at which it started; NaN until the next frame picks it up. */
  start: number;
  legs: LegPlan[];
  legCount: number;
  /** 0 waiting, 1 flying, 2 done. */
  legState: Uint8Array;
};
const flights: Flight[] = Array.from({ length: MAX_FLIGHTS }, () => ({
  active: false,
  event: null,
  start: Number.NaN,
  legs: Array.from({ length: MAX_LEGS }, emptyLeg),
  legCount: 0,
  legState: new Uint8Array(MAX_LEGS),
}));
const failedNodes: number[] = [];
const trailScreen = new Float32Array(TRAIL_POINTS * PROJECTED_STRIDE);

// Ripples, sparks, code labels, flashes ----------------------------------------
const MAX_RIPPLES = 4;
const RIPPLE_MS = 900;
const RIPPLE_RADIUS = 140;
const RIPPLE_BAND = 10;
const rippleNode = new Int32Array(MAX_RIPPLES).fill(-1);
const rippleStart = new Float64Array(MAX_RIPPLES);

const SPARKS_PER_BURST = 12;
const MAX_SPARKS = SPARKS_PER_BURST * 4;
const SPARK_MS = 700;
/** x, y, vx, vy per particle. */
const sparkState = new Float32Array(MAX_SPARKS * 4);
const sparkStart = new Float64Array(MAX_SPARKS).fill(-1e9);
const sparkDraw = new Float32Array(MAX_SPARKS * 4);
let sparkCursor = 0;
const sparkRng = mulberry32(hash32("network-map", "sparks"));

const MAX_CODES = 4;
const CODE_MS = 1100;
const codeNode = new Int32Array(MAX_CODES).fill(-1);
const codeValue = new Int32Array(MAX_CODES);
const codeStart = new Float64Array(MAX_CODES);
let codeCursor = 0;

const FLASH_MS = 700;
const flashStart = new Float64Array(MAP_CANDIDATES.length).fill(-1e9);

/** Breaker ring cells per candidate: its profile's `opensAfter`. */
const RING_CELLS: readonly number[] = MAP_CANDIDATES.map((id) => {
  const profile = SAMPLE_CANDIDATES.find((c) => c.id === id)?.profile ?? "apikey";
  return BREAKER_PROFILES.find((p) => p.id === profile)?.opensAfter ?? 12;
});

// Sprites ---------------------------------------------------------------------
let gold32: GlowSprite | null = null;
let gold64: GlowSprite | null = null;
let goldHi16: GlowSprite | null = null;
let goldHi32: GlowSprite | null = null;
let phosphor32: GlowSprite | null = null;
let ember16: GlowSprite | null = null;
let ember32: GlowSprite | null = null;

function resetScene(): void {
  clockMs = 0;
  revealClock = -1;
  pitchSpring.angle = 0;
  pitchSpring.velocity = 0;
  yawSpring.angle = 0;
  yawSpring.velocity = 0;
  heat.fill(0);
  rippleNode.fill(-1);
  sparkStart.fill(-1e9);
  codeNode.fill(-1);
  flashStart.fill(-1e9);
  for (const flight of flights) {
    flight.active = false;
    flight.event = null;
  }
}

/* ------------------------------------------------------------------------ */
/* Events in                                                                */
/* ------------------------------------------------------------------------ */

/**
 * Queue a request's flight. Returns false when 16 flights are already in the
 * air (the station then lands the request at once, without a flight).
 */
export function launch(event: FlightEvent): boolean {
  let slot: Flight | null = null;
  for (const flight of flights) {
    if (!flight.active) {
      slot = flight;
      break;
    }
  }
  if (!slot) return false;
  failedNodes.length = 0;
  for (const id of event.failed) failedNodes.push(providerNode(id));
  const to = event.kind === "routed" ? providerNode(event.to) : -1;
  slot.legCount = planFlight(slot.legs, clientNode(event.from), failedNodes, event.codes, to);
  slot.legState.fill(0);
  slot.event = event;
  slot.start = Number.NaN;
  slot.active = true;
  return true;
}

/** A breaker changed state: closing flashes its road gold. */
export function breakerChanged(id: CandidateId, state: BreakerState): void {
  if (state !== "closed") return;
  const index = MAP_CANDIDATES.indexOf(id);
  if (index >= 0) flashStart[index] = clockMs;
}

/* ------------------------------------------------------------------------ */
/* Stage                                                                    */
/* ------------------------------------------------------------------------ */

function wantedSpacing(width: number, tier: number): number {
  return (width < 640 ? 14 : 12) + (tier >= 2 ? 2 : 0);
}

export function setup(_ctx: CanvasRenderingContext2D, s: StageSize): void {
  gold32 = getSprite("gold", 32);
  gold64 = getSprite("gold", 64);
  goldHi16 = getSprite("goldHi", 16);
  goldHi32 = getSprite("goldHi", 32);
  phosphor32 = getSprite("phosphor", 32);
  ember16 = getSprite("ember", 16);
  ember32 = getSprite("ember", 32);
  const spacing = wantedSpacing(s.w, getQualityTier());
  if (spacing !== builtSpacing) buildDots(spacing);
}

export function draw(ctx: CanvasRenderingContext2D, s: StageSize, dt: number): void {
  const tier = getQualityTier();
  const spacing = wantedSpacing(s.w, tier);
  if (spacing !== builtSpacing) buildDots(spacing);

  clockMs += dt * 1000;
  const now = clockMs;
  const layout: MapLayout = input?.layout ?? (s.w >= 1024 ? "pin" : "flow");
  const flow = layout === "flow";
  const nodeK = flow ? 0.72 : 1;

  // Camera ------------------------------------------------------------------
  fitMap(s.w, s.h, layout, input ? input.rtl : false, frame);
  const progress = input ? input.progress.current : 0;
  let pitch: number;
  if (!flow) {
    pinCameraTarget(progress, target);
    stepSpring(pitchSpring, target.pitch, dt, CAMERA);
    stepSpring(
      yawSpring,
      target.yaw + (input ? input.parallax : 0) * PARALLAX_YAW_DEG * DEG,
      dt,
      CAMERA
    );
    pitch = pitchSpring.angle;
  } else {
    if (input?.revealed && revealClock < 0) revealClock = now;
    pitch = revealClock < 0 ? 0 : flowPitch(now - revealClock);
    pitchSpring.angle = pitch;
    pitchSpring.velocity = 0;
    const share = pitch / FLOW_PITCH_RAD;
    stepSpring(yawSpring, FLOW_YAW_DEG * DEG * share + (progress - 0.5) * 8 * DEG, dt, CAMERA);
  }
  const tiltDeg = pitch / DEG;
  const tilt = Math.max(0, Math.min(1, (tiltDeg - TILT_FEATURES_DEG) / 10));
  const tiltShare = Math.min(1, Math.max(0, pitch / (flow ? FLOW_PITCH_RAD : PIN_PITCH_RAD)));
  // The idle yaw breath: ±3° over ~24 s (spec: sin(t·.07), a 90 s period
  // that never visibly moves; tuned so the map perceptibly drifts).
  const breath = Math.sin((now / 1000) * BREATH_RATE) * BREATH_YAW_DEG * DEG;
  // Tilted, the map is shallower: it grows and settles into the freed height.
  tiltFrame(frame, s.w, s.h, layout, tiltShare, tilted);
  camInput.yaw = yawSpring.angle + breath;
  camInput.pitch = pitch;
  camInput.cx = tilted.cx;
  camInput.cy = tilted.cy;
  camInput.scale = tilted.scale;
  updateCamera(cam, camInput);
  const scale = cam.scale;
  const cosPitch = cam.cosPitch;

  // Heat decays with a 3 s half-life.
  const decay = dt > 0 ? Math.pow(0.5, dt / HEAT_HALF_LIFE_S) : 1;
  for (let c = 0; c < CITY_COUNT; c++) heat[c] *= decay;

  // Nodes.
  for (let n = 0; n < NODE_COUNT; n++) {
    const p = NODE_POINTS[n];
    project3(cam, p.x - HALF_W, p.y - HALF_H, 0, nodeScreen, n * PROJECTED_STRIDE);
  }

  ctx.clearRect(0, 0, s.w, s.h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.setLineDash(DASH_NONE);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Wash: one stretched glow under the country.
  if (gold64) {
    const w = MAP_WIDTH * scale * 1.15;
    const h = MAP_HEIGHT * scale * 1.15 * (0.55 + 0.45 * cosPitch);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.085;
    ctx.drawImage(gold64.image, cam.cx - w / 2, cam.cy - h / 2, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // Wall top (z = 4) once tilted.
  if (tilt > 0) {
    projectBorder(4);
    ctx.globalAlpha = 0.35 * tilt;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1;
    strokeBorder(ctx);
    ctx.globalAlpha = 1;
  }

  updateRipples(now, tier);
  drawDots(ctx, tier, tilt);

  // Border: a soft underlay and a crisp line whose alpha breathes .6 ↔ 1 over 4 s.
  projectBorder(0);
  const breathe = 0.8 + 0.2 * Math.sin((now / 4000) * Math.PI * 2);
  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = 0.13 * breathe;
  ctx.lineWidth = 6;
  strokeBorder(ctx);
  ctx.strokeStyle = GOLD_HI;
  ctx.globalAlpha = breathe;
  ctx.lineWidth = flow ? 1.1 : 1.4;
  strokeBorder(ctx);
  ctx.globalAlpha = 1;

  const world = getWorld();
  drawSpokes(ctx, now, world.candidates, tiltShare);
  if (tier === 0 && tilt > 0) drawPillars(ctx, tilt);
  if (tilt > 0) drawBeacons(ctx, tilt, world.candidates);
  if (tier < 1) drawRipples(ctx, now);
  drawBreakerRings(ctx, world.candidates, nodeK);
  drawNodes(ctx, now, nodeK, world.candidates);
  drawFlights(ctx, now, tier);
  drawSparksAndCodes(ctx, now);

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.setLineDash(DASH_NONE);
  frameCount++;
}

/* ------------------------------------------------------------------------ */
/* Layers                                                                   */
/* ------------------------------------------------------------------------ */

function projectBorder(z: number): void {
  for (let i = 0; i < BORDER_POINTS.length; i++) {
    const p = BORDER_POINTS[i];
    project3(cam, p.x - HALF_W, p.y - HALF_H, z, borderScreen, i * PROJECTED_STRIDE);
  }
}

function strokeBorder(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(borderScreen[0], borderScreen[1]);
  for (let i = 1; i < BORDER_POINTS.length; i++) {
    ctx.lineTo(borderScreen[i * PROJECTED_STRIDE], borderScreen[i * PROJECTED_STRIDE + 1]);
  }
  ctx.closePath();
  ctx.stroke();
}

function updateRipples(now: number, tier: number): void {
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

function drawDots(ctx: CanvasRenderingContext2D, tier: number, tilt: number): void {
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
 * glowing tip, binned by strength so the rim of a heat field fades out.
 */
function drawPillars(ctx: CanvasRenderingContext2D, tilt: number): void {
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
  if (goldHi16) drawGlowBatch(ctx, goldHi16, pillarTops, pillarCount, 4);
}

/**
 * City beacons: a shaft of light over every warm city once the map is tilted,
 * as tall as the city is busy (ember over a provider whose road is cut).
 */
function drawBeacons(
  ctx: CanvasRenderingContext2D,
  tilt: number,
  candidates: readonly CandidateView[]
): void {
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "butt";
  for (let n = 0; n < CITY_COUNT; n++) {
    const h = Math.min(1, heat[n]);
    if (h < 0.04) continue;
    const p = NODE_POINTS[n];
    const height = BEACON_HEIGHT * h * tilt;
    project3(cam, p.x - HALF_W, p.y - HALF_H, height, scratch, 0);
    const o = n * PROJECTED_STRIDE;
    const x0 = nodeScreen[o];
    const y0 = nodeScreen[o + 1];
    const x1 = scratch[0];
    const y1 = scratch[1];
    const candidateId = candidateAtNode(n);
    const ci = candidateId ? MAP_CANDIDATES.indexOf(candidateId) : -1;
    const c = ci >= 0 ? candidates[ci] : null;
    const failing = c !== null && (c.upstreamDown || c.breaker.state === "open");
    ctx.strokeStyle = failing ? EMBER : GOLD_HI;
    // A soft wide underlay, then a core that fades towards the top.
    ctx.lineWidth = 7;
    ctx.globalAlpha = 0.1 * h;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.lineWidth = 1.8;
    for (let k = 0; k < BEACON_SEGMENTS; k++) {
      const a = k / BEACON_SEGMENTS;
      const b = (k + 1) / BEACON_SEGMENTS;
      ctx.globalAlpha = (0.85 - 0.75 * a) * h;
      ctx.beginPath();
      ctx.moveTo(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a);
      ctx.lineTo(x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
      ctx.stroke();
    }
    const tip = failing ? ember16 : goldHi16;
    if (tip) drawGlow(ctx, tip, x1, y1, 10, 0.6 * h);
  }
  ctx.lineCap = "round";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

const BEACON_HEIGHT = 90;
const BEACON_SEGMENTS = 6;

function drawRipples(ctx: CanvasRenderingContext2D, now: number): void {
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

function projectArc(node: number): boolean {
  const samples = arcSamples[node];
  if (!samples) return false;
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    project3(
      cam,
      samples[i * 3],
      samples[i * 3 + 1],
      samples[i * 3 + 2],
      arcScreen,
      i * PROJECTED_STRIDE
    );
  }
  return true;
}

function strokeArc(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(arcScreen[0], arcScreen[1]);
  for (let i = 1; i <= ARC_SEGMENTS; i++) {
    ctx.lineTo(arcScreen[i * PROJECTED_STRIDE], arcScreen[i * PROJECTED_STRIDE + 1]);
  }
  ctx.stroke();
}

type CandidateView = {
  upstreamDown: boolean;
  breaker: { state: BreakerState; failures: number };
};

/**
 * Roads out of Kabul. Flat, they are the poster's dashed gold arcs (so the
 * hand-off from the server still is seamless); they turn solid as the map
 * tilts. A cut road is always ember and dashed, its dashes running.
 */
function drawSpokes(
  ctx: CanvasRenderingContext2D,
  now: number,
  candidates: readonly CandidateView[],
  tiltShare: number
): void {
  const hover = input ? input.hover : -1;
  for (let node = 0; node < CITY_COUNT; node++) {
    if (node === HUB_INDEX || !projectArc(node)) continue;
    const candidateId = candidateAtNode(node);
    const ci = candidateId ? MAP_CANDIDATES.indexOf(candidateId) : -1;
    const c = ci >= 0 ? candidates[ci] : null;
    const state = c ? c.breaker.state : "closed";
    const cut = c !== null && (c.upstreamDown || state === "open");
    const highlighted = hover === node || hover === HUB_INDEX;

    if (cut) {
      ctx.setLineDash(DASH_CUT);
      ctx.lineDashOffset = -now / 60;
      ctx.strokeStyle = EMBER;
      ctx.globalAlpha = highlighted ? 1 : 0.85;
      ctx.lineWidth = 1.5;
      strokeArc(ctx);
      ctx.setLineDash(DASH_NONE);
      if (state === "open") drawCross(ctx, arcScreen, ARC_SEGMENTS / 2);
    } else if (highlighted) {
      ctx.strokeStyle = GOLD_HI;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.6;
      strokeArc(ctx);
    } else {
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1;
      if (tiltShare < 1) {
        ctx.setLineDash(DASH_SPOKE);
        ctx.lineDashOffset = 0;
        ctx.globalAlpha = 0.5 * (1 - tiltShare);
        strokeArc(ctx);
        ctx.setLineDash(DASH_NONE);
      }
      if (tiltShare > 0) {
        ctx.globalAlpha = 0.34 * tiltShare;
        strokeArc(ctx);
      }
    }

    // A closing breaker flashes its road gold.
    if (ci >= 0) {
      const t = (now - flashStart[ci]) / FLASH_MS;
      if (t >= 0 && t < 1) {
        ctx.strokeStyle = GOLD_HI;
        ctx.globalAlpha = 0.9 * (1 - t);
        ctx.lineWidth = 2.6;
        strokeArc(ctx);
        if (goldHi32) {
          const mid = (ARC_SEGMENTS / 2) * PROJECTED_STRIDE;
          drawGlow(ctx, goldHi32, arcScreen[mid], arcScreen[mid + 1], 40, 0.7 * (1 - t));
        }
      }
      // Half-open: one pale probe comet travels the road.
      if (state === "halfOpen") drawProbe(ctx, node, now);
    }
  }
  ctx.globalAlpha = 1;
}

function drawCross(ctx: CanvasRenderingContext2D, pts: Float32Array, index: number): void {
  const o = index * PROJECTED_STRIDE;
  const x = pts[o];
  const y = pts[o + 1];
  const r = 5;
  ctx.globalAlpha = 1;
  ctx.fillStyle = VOID;
  ctx.beginPath();
  ctx.arc(x, y, r + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = EMBER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r);
  ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r);
  ctx.lineTo(x - r, y + r);
  ctx.stroke();
}

function drawProbe(ctx: CanvasRenderingContext2D, node: number, now: number): void {
  const arc = HUB_ARCS[node];
  if (!arc) return;
  const u = (now % 1400) / 1400;
  sampleTrail(arc, u, false);
  strokeTrail(ctx, GOLD_HI, 0.55, 1.4);
  if (goldHi32) drawGlow(ctx, goldHi32, trailScreen[0], trailScreen[1], 18, 0.6);
}

function drawBreakerRings(
  ctx: CanvasRenderingContext2D,
  candidates: readonly CandidateView[],
  nodeK: number
): void {
  ctx.lineCap = "butt";
  for (let ci = 0; ci < MAP_CANDIDATES.length; ci++) {
    const c = candidates[ci];
    if (!c) continue;
    const cells = RING_CELLS[ci];
    const node = providerNode(MAP_CANDIDATES[ci]);
    const o = node * PROJECTED_STRIDE;
    const x = nodeScreen[o];
    const y = nodeScreen[o + 1];
    const s = nodeScreen[o + 2];
    const r = 14 * nodeK * s;
    const ry = r * Math.max(0.35, cam.cosPitch);
    const state = c.breaker.state;
    const filled = state === "open" ? cells : Math.min(cells, c.breaker.failures);
    const gap = cells > 4 ? 0.16 : 0.3;
    const step = (Math.PI * 2) / cells;
    for (let k = 0; k < cells; k++) {
      const a0 = -Math.PI / 2 + k * step + gap / 2;
      const a1 = a0 + step - gap;
      if (k < filled) {
        ctx.strokeStyle = EMBER;
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2.4 * nodeK;
      } else if (state === "halfOpen") {
        ctx.strokeStyle = GOLD_HI;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 1.6 * nodeK;
      } else {
        ctx.strokeStyle = GOLD_LO;
        ctx.globalAlpha = state === "degraded" ? 0.9 : 0.6;
        ctx.lineWidth = 1.4 * nodeK;
      }
      ctx.beginPath();
      ctx.ellipse(x, y, r, ry, 0, a0, a1);
      ctx.stroke();
    }
  }
  ctx.lineCap = "round";
  ctx.globalAlpha = 1;
}

function drawNodes(
  ctx: CanvasRenderingContext2D,
  now: number,
  nodeK: number,
  candidates: readonly CandidateView[]
): void {
  const hover = input ? input.hover : -1;
  // Edge vertices: faint gate marks on the border.
  ctx.fillStyle = GOLD_LO;
  for (let n = CITY_COUNT; n < NODE_COUNT; n++) {
    const o = n * PROJECTED_STRIDE;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(nodeScreen[o], nodeScreen[o + 1], 2 * nodeK, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (let n = 0; n < CITY_COUNT; n++) {
    const o = n * PROJECTED_STRIDE;
    const x = nodeScreen[o];
    const y = nodeScreen[o + 1];
    const s = nodeScreen[o + 2] * nodeK;
    const h = Math.min(1, heat[n]);
    const isHub = n === HUB_INDEX;
    const candidateId = candidateAtNode(n);
    const ci = candidateId ? MAP_CANDIDATES.indexOf(candidateId) : -1;
    const c = ci >= 0 ? candidates[ci] : null;
    const failing = c !== null && (c.upstreamDown || c.breaker.state === "open");
    const hot = hover === n ? 0.35 : 0;

    const glow = failing ? ember32 : gold32;
    if (glow) drawGlow(ctx, glow, x, y, (isHub ? 64 : 40 + 26 * h) * s, 0.5 + 0.4 * h + hot);

    if (isHub) {
      if (phosphor32) drawGlow(ctx, phosphor32, x, y, 26 * s, 0.75);
      // Dashed hub ring, one turn every 9 s.
      ctx.setLineDash(DASH_HUB);
      ctx.lineDashOffset = -(now / 9000) * 2 * Math.PI * 15 * s;
      ctx.strokeStyle = GOLD_HI;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(x, y, 15 * s, 15 * s * Math.max(0.4, cam.cosPitch), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash(DASH_NONE);
      ctx.globalAlpha = 1;
      ctx.fillStyle = VOID;
      ctx.strokeStyle = GOLD_HI;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, 6 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PHOSPHOR;
      ctx.beginPath();
      ctx.arc(x, y, 2.8 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (c) {
      ctx.fillStyle = VOID;
      ctx.strokeStyle = failing ? EMBER : GOLD_HI;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 4.6 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = failing ? EMBER : GOLD_HI;
      ctx.beginPath();
      ctx.arc(x, y, 2 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Client city: a hollow diamond.
      const r = 4.4 * s;
      ctx.fillStyle = VOID;
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

/** Sample a comet's trail (head first) along `arc` at head position `u`. */
function sampleTrail(arc: Arc3, u: number, inbound: boolean): void {
  for (let i = 0; i < TRAIL_POINTS; i++) {
    const back = (i / (TRAIL_POINTS - 1)) * TRAIL_SPAN;
    const v = inbound ? Math.min(1, u + back) : Math.max(0, u - back);
    arcPoint3(arc, v, point3);
    project3(
      cam,
      point3[0] - HALF_W,
      point3[1] - HALF_H,
      point3[2],
      trailScreen,
      i * PROJECTED_STRIDE
    );
  }
}

/** Ten segments, alpha and width tapering towards the tail. */
function strokeTrail(ctx: CanvasRenderingContext2D, color: string, alpha: number, width: number) {
  ctx.strokeStyle = color;
  for (let i = 0; i < TRAIL_POINTS - 1; i++) {
    const f = 1 - i / (TRAIL_POINTS - 1);
    ctx.globalAlpha = alpha * f * f;
    ctx.lineWidth = Math.max(0.5, width * f);
    const a = i * PROJECTED_STRIDE;
    const b = a + PROJECTED_STRIDE;
    ctx.beginPath();
    ctx.moveTo(trailScreen[a], trailScreen[a + 1]);
    ctx.lineTo(trailScreen[b], trailScreen[b + 1]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2;
}

function drawFlights(ctx: CanvasRenderingContext2D, now: number, tier: number): void {
  ctx.globalCompositeOperation = "lighter";
  for (const flight of flights) {
    if (!flight.active) continue;
    if (Number.isNaN(flight.start)) {
      flight.start = now;
      // The client leg is a departure: warm the client city.
      const first = flight.legs[0];
      if (flight.legCount > 0 && first.inbound && first.node < CITY_COUNT) {
        heat[first.node] = kickHeat(heat[first.node], CLIENT_HEAT_KICK);
      }
    }
    let open = 0;
    for (let l = 0; l < flight.legCount; l++) {
      const leg = flight.legs[l];
      const state = flight.legState[l];
      if (state === 2) continue;
      open++;
      const t = (now - flight.start - leg.delayMs) / leg.durationMs;
      if (t < 0) continue;
      if (t >= 1) {
        flight.legState[l] = 2;
        open--;
        legLanded(flight, leg, now);
        continue;
      }
      flight.legState[l] = 1;
      const arc = HUB_ARCS[leg.node];
      if (!arc) continue;
      const e = easeInOut(t);
      const u = leg.inbound ? 1 - e : e;
      if (tier >= 2) {
        arcPoint3(arc, u, point3);
        project3(cam, point3[0] - HALF_W, point3[1] - HALF_H, point3[2], trailScreen, 0);
      } else {
        sampleTrail(arc, u, leg.inbound);
      }
      const hx = trailScreen[0];
      const hy = trailScreen[1];
      const hs = trailScreen[2];
      if (leg.tint === "client") {
        if (tier < 2) strokeTrail(ctx, GOLD_LO, 0.9, 1.6);
        if (gold32) drawGlow(ctx, gold32, hx, hy, 14 * hs, 0.7);
      } else if (leg.tint === "provider") {
        if (tier < 2) strokeTrail(ctx, GOLD_HI, 0.95, 2.2);
        if (goldHi32) drawGlow(ctx, goldHi32, hx, hy, 26 * hs, 0.8);
        if (phosphor32) drawGlow(ctx, phosphor32, hx, hy, 10 * hs, 1);
      } else {
        if (tier < 2) strokeTrail(ctx, EMBER_GOLD, 0.95, 2.2);
        if (ember32) drawGlow(ctx, ember32, hx, hy, 26 * hs, 0.85);
        if (phosphor32) drawGlow(ctx, phosphor32, hx, hy, 9 * hs, 1);
      }
    }
    if (open === 0) {
      flight.active = false;
      const event = flight.event;
      flight.event = null;
      if (event && handlers) handlers.onLand(event);
    }
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

function legLanded(flight: Flight, leg: LegPlan, now: number): void {
  if (leg.inbound) {
    heat[HUB_INDEX] = kickHeat(heat[HUB_INDEX], HUB_HEAT_KICK);
    if (flight.event && handlers) handlers.onHub(flight.event);
    return;
  }
  if (leg.code !== 0) {
    burst(leg.node, now);
    // One code label per city: a second failure there restarts it rather
    // than stacking a stuttering "503 503".
    let slot = -1;
    for (let k = 0; k < MAX_CODES; k++) {
      if (codeNode[k] === leg.node) {
        slot = k;
        break;
      }
    }
    if (slot < 0) {
      slot = codeCursor;
      codeCursor = (codeCursor + 1) % MAX_CODES;
    }
    codeNode[slot] = leg.node;
    codeValue[slot] = leg.code;
    codeStart[slot] = now;
    return;
  }
  if (leg.final && leg.node < CITY_COUNT) {
    heat[leg.node] = kickHeat(heat[leg.node], HEAT_KICK);
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
    rippleNode[slot] = leg.node;
    rippleStart[slot] = now;
  }
}

function burst(node: number, now: number): void {
  const o = node * PROJECTED_STRIDE;
  const x = nodeScreen[o];
  const y = nodeScreen[o + 1];
  for (let k = 0; k < SPARKS_PER_BURST; k++) {
    const i = sparkCursor;
    sparkCursor = (sparkCursor + 1) % MAX_SPARKS;
    const angle = (k / SPARKS_PER_BURST) * Math.PI * 2 + sparkRng() * 0.5;
    const speed = 50 + sparkRng() * 70;
    sparkState[i * 4] = x;
    sparkState[i * 4 + 1] = y;
    sparkState[i * 4 + 2] = Math.cos(angle) * speed;
    sparkState[i * 4 + 3] = Math.sin(angle) * speed - 30;
    sparkStart[i] = now;
  }
}

function drawSparksAndCodes(ctx: CanvasRenderingContext2D, now: number): void {
  let count = 0;
  for (let i = 0; i < MAX_SPARKS; i++) {
    const t = (now - sparkStart[i]) / SPARK_MS;
    if (t < 0 || t >= 1) continue;
    const travel = (1 - Math.pow(1 - t, 3)) * (SPARK_MS / 1000);
    const o = count * 4;
    sparkDraw[o] = sparkState[i * 4] + sparkState[i * 4 + 2] * travel;
    sparkDraw[o + 1] = sparkState[i * 4 + 1] + sparkState[i * 4 + 3] * travel + 30 * t * t;
    sparkDraw[o + 2] = 9 * (1 - t) + 3;
    sparkDraw[o + 3] = 1 - t;
    count++;
  }
  if (count > 0 && ember16) drawGlowBatch(ctx, ember16, sparkDraw, count, 4);

  let font = false;
  for (let k = 0; k < MAX_CODES; k++) {
    const node = codeNode[k];
    if (node < 0) continue;
    const t = (now - codeStart[k]) / CODE_MS;
    if (t >= 1) {
      codeNode[k] = -1;
      continue;
    }
    if (!font) {
      ctx.font = CODE_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      font = true;
    }
    const o = node * PROJECTED_STRIDE;
    const x = nodeScreen[o];
    const y = nodeScreen[o + 1] - 14 - 12 * t;
    const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = VOID;
    ctx.fillRect(x - 15, y - 15, 30, 16);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = EMBER;
    ctx.fillText(codeLabel(codeValue[k]), x, y);
  }
  ctx.globalAlpha = 1;
}

/** Pre-built strings: no number → string allocation per frame. */
const CODE_TEXT: Readonly<Record<number, string>> = { 401: "401", 429: "429", 503: "503" };
function codeLabel(code: number): string {
  return CODE_TEXT[code] ?? "503";
}
