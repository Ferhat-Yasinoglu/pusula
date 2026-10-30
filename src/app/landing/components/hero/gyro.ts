/**
 * The bridge's gyro-compass: one star per catalog provider on a celestial
 * shell, three rings, a factor ring, a counter-rotating bezel and the needle.
 *
 * Shared by three renderers that must agree to the pixel:
 * - the hero canvas (`HeroBridge.tsx`), every frame;
 * - the intro canvas (`IntroSequence.tsx`), which hands the converged gyro to
 *   the hero at t = 2350 and draws the identical frame until it unmounts;
 * - the server poster (`HeroPoster.tsx`), which renders the yaw-0 frame as SVG
 *   from the same geometry (`posterGeometry`).
 *
 * Geometry (spec §6.2): `M = Rx(23.4° + 4°·sin(2πt/11s) + parallaxY) ·
 * Ry(yaw + parallaxX)`, `p = R·M·u`, perspective `s = F/(F − p.z)` with
 * `F = 3.2R`, screen `(cx + p.x·s, cy − p.y·s)`. That is `project3` with the
 * globe camera (`up: "y"`), unit-sphere input and `scale = R`.
 *
 * The motion state lives in the `gyroState` singleton so the intro's needle
 * spring and yaw continue seamlessly in the hero. Drawing is allocation-free:
 * every buffer is owned by the scene and reused.
 *
 * Pure apart from the canvas draw functions, which need a 2D context and the
 * glow sprites (created lazily on first draw). Safe to import on the server.
 */
import { nearestEquivalentAngle } from "../../landingGeometry";
import {
  PROJECTED_STRIDE,
  fibonacciSphere,
  makeCamera,
  project3,
  ringPolyline,
  updateCamera,
  type Camera,
} from "../../sim/landingProjection";
import { hash32 } from "../../sim/prng";
import { drawGlow, drawGlowBatch, getSprite } from "../../runtime/glowSprites";
import { springAt, type SpringState } from "../../runtime/springs";

export const DEG = Math.PI / 180;

/** Sphere radius as a share of the dial square's side. */
export const GYRO_R_RATIO = 0.36;
/** Perspective distance in sphere radii. */
export const GYRO_F = 3.2;
/** Axial tilt of the shell towards the viewer. */
export const GYRO_TILT_DEG = 23.4;
export const GYRO_NUTATION_DEG = 4;
export const GYRO_NUTATION_PERIOD_S = 11;
/** Idle spin of the shell. */
export const GYRO_YAW_RATE_DEG = 5;
/** The bezel counter-rotates. */
export const GYRO_BEZEL_RATE_DEG = -1;
export const BEZEL_TICKS = 120;
/** Bezel radius in sphere radii (a flat ring framing the sphere). */
export const BEZEL_RATIO = 1.13;
/** The scoring-factor ring on the horizon plane. */
export const FACTOR_RING_RATIO = 0.3;
export const RHUMB_COUNT = 32;
export const PARALLAX_MAX_DEG = 6;
export const RING_SEGMENTS = 120;
/** Needle tip and tail in sphere radii. */
export const NEEDLE_TIP = 0.82;
export const NEEDLE_TAIL = 0.3;
/** Drag inertia: velocity is multiplied by this per 60 Hz frame. */
export const SPIN_DECAY = 0.92;

/** Ring tilts about x before yaw: horizon (equator), meridian, ecliptic. */
export const RING_TILTS = [0, Math.PI / 2, GYRO_TILT_DEG * DEG] as const;

export type GyroGeometry = { cx: number; cy: number; R: number };

/* ------------------------------------------------------------------------ */
/* Motion state                                                             */
/* ------------------------------------------------------------------------ */

export type GyroState = {
  /** Who steps the gyro this frame: the intro until it hands off, then the hero. */
  driver: "hero" | "intro";
  /** Seconds of gyro time (nutation, twinkle, bezel). Starts at 0 when the gyro first shows. */
  clock: number;
  /** Shell yaw (rad). */
  yaw: number;
  /** Extra yaw velocity from a drag (rad/s), decays with `SPIN_DECAY`. */
  spin: number;
  /** Pointer parallax (deg), springing towards `parallaxTarget*`. */
  parallaxX: SpringState;
  parallaxY: SpringState;
  parallaxTargetX: number;
  parallaxTargetY: number;
  /** Bezel rotation (deg). */
  bezel: number;
  /** Needle angle (deg, compass bearing; may wind past 360). */
  needle: SpringState;
  /** "north": the intro's lock, held until the hero's first take; "route": follows takes. */
  needleMode: "north" | "route";
  /** The intro's clock (ms) while it drives; Infinity otherwise. */
  introT: number;
};

export const gyroState: GyroState = {
  driver: "hero",
  clock: 0,
  yaw: 0,
  spin: 0,
  parallaxX: springAt(0),
  parallaxY: springAt(0),
  parallaxTargetX: 0,
  parallaxTargetY: 0,
  bezel: 0,
  needle: springAt(0),
  needleMode: "route",
  introT: Infinity,
};

/** Shell pitch (rad) at gyro time `clock` with a parallax offset in degrees. */
export function gyroPitch(clock: number, parallaxDeg = 0): number {
  const nutation = GYRO_NUTATION_DEG * Math.sin((2 * Math.PI * clock) / GYRO_NUTATION_PERIOD_S);
  return (GYRO_TILT_DEG + nutation + parallaxDeg) * DEG;
}

/**
 * Advance yaw, drag inertia, bezel and clock by `dt` seconds (the needle
 * steps separately). While `dragging`, the finger owns the yaw: neither the
 * idle spin nor the inertia moves it, and the inertia (the drag's velocity
 * estimate) only decays, so a finger held still releases without a fling.
 */
export function stepGyro(state: GyroState, dt: number, dragging = false): void {
  if (!(dt > 0)) return;
  state.clock += dt;
  if (!dragging) state.yaw += (GYRO_YAW_RATE_DEG * DEG + state.spin) * dt;
  state.spin *= Math.pow(SPIN_DECAY, dt * 60);
  if (Math.abs(state.spin) < 1e-4) state.spin = 0;
  state.bezel += GYRO_BEZEL_RATE_DEG * dt;
  // Wrap yaw so precision never drifts on a long visit.
  if (state.yaw > Math.PI * 4 || state.yaw < -Math.PI * 4) state.yaw %= Math.PI * 2;
}

/* ------------------------------------------------------------------------ */
/* Scene: per-catalog buffers                                               */
/* ------------------------------------------------------------------------ */

export type GyroCatalogEntry = { readonly id: string; readonly free: boolean };

export type GyroScene = {
  n: number;
  /** Unit vectors, xyz per star, alphabetical catalog order. */
  unit: Float32Array;
  free: Uint8Array;
  /** Twinkle phase per star (rad), from `hash32(i)`. */
  phase: Float32Array;
  /** Projected stars: sx, sy, s, depth (stride 4), refreshed by `projectStars`. */
  proj: Float32Array;
  /** Star index per candidate slot (-1 when the catalog lacks it). */
  candStar: Int32Array;
  cam: Camera;
  ring: Float32Array;
  arc: Float32Array;
  poolGold: Float32Array;
  poolHi: Float32Array;
  /** Per-frame look inputs filled by the caller (see `GyroLook`). */
  look: GyroLook;
};

/**
 * What a frame shows, beyond the geometry. The hero and the intro fill the
 * same fields from the same state, which is what makes their frames identical.
 */
export type GyroLook = {
  /** Rings, bezel, factor ring and body (0..1). */
  rings: number;
  /** Stars (0..1). */
  stars: number;
  /** The canvas copy of the horizon ring's front half (the DOM overlay draws it otherwise). */
  horizonFront: number;
  needle: number;
  needleScale: number;
  /** One-shot bezel flash (0..1). */
  flash: number;
  /** Candidate slot the needle has chosen, or -1. */
  winner: number;
  /** Per candidate slot: 0 closed, 1 degraded, 2 open, 3 half-open. */
  candState: Uint8Array;
  /** Per factor arc (weight order): 0..1 lit level during a take. */
  factorLit: Float32Array;
  /** Normalised factor weights, weight-descending (the ring's arc lengths). */
  factorWeights: Float32Array;
  factorCount: number;
};

export const CAND_CLOSED = 0;
export const CAND_DEGRADED = 1;
export const CAND_OPEN = 2;
export const CAND_HALF_OPEN = 3;

const MAX_FACTORS = 32;
const ARC_POINTS = 24;

function createLook(): GyroLook {
  return {
    rings: 1,
    stars: 1,
    horizonFront: 0,
    needle: 1,
    needleScale: 1,
    flash: 0,
    winner: -1,
    candState: new Uint8Array(6),
    factorLit: new Float32Array(MAX_FACTORS),
    factorWeights: new Float32Array(MAX_FACTORS),
    factorCount: 0,
  };
}

/** Reset a look to the hero's idle values (the caller then sets what differs). */
export function resetLook(look: GyroLook): GyroLook {
  look.rings = 1;
  look.stars = 1;
  look.horizonFront = 0;
  look.needle = 1;
  look.needleScale = 1;
  look.flash = 0;
  look.winner = -1;
  look.candState.fill(0);
  look.factorLit.fill(0);
  return look;
}

/** Twinkle phase of star `i` in radians: stable across server, client and reloads. */
export function starPhase(i: number): number {
  return (hash32("star", i) / 4294967296) * Math.PI * 2;
}

export function createGyroScene(
  catalog: readonly GyroCatalogEntry[],
  candidateCatalogIds: readonly string[]
): GyroScene {
  const n = catalog.length;
  const unit = fibonacciSphere(n);
  const free = new Uint8Array(n);
  const phase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    free[i] = catalog[i].free ? 1 : 0;
    phase[i] = starPhase(i);
  }
  const candStar = new Int32Array(candidateCatalogIds.length);
  for (let c = 0; c < candidateCatalogIds.length; c++) {
    candStar[c] = catalog.findIndex((entry) => entry.id === candidateCatalogIds[c]);
  }
  return {
    n,
    unit,
    free,
    phase,
    proj: new Float32Array(n * PROJECTED_STRIDE),
    candStar,
    cam: makeCamera({ yaw: 0, pitch: 0, F: GYRO_F, cx: 0, cy: 0, scale: 1, up: "y" }),
    ring: new Float32Array((RING_SEGMENTS + 1) * PROJECTED_STRIDE),
    arc: new Float32Array((ARC_POINTS + 1) * PROJECTED_STRIDE),
    poolGold: new Float32Array(n * 4),
    poolHi: new Float32Array(n * 4),
    look: createLook(),
  };
}

let sceneCache: { key: string; scene: GyroScene } | null = null;

/** One scene per catalog, shared by the intro and the hero (same buffers, same projection). */
export function getGyroScene(
  catalog: readonly GyroCatalogEntry[],
  candidateCatalogIds: readonly string[]
): GyroScene {
  const key = `${catalog.length}|${catalog[0]?.id ?? ""}|${catalog[catalog.length - 1]?.id ?? ""}|${candidateCatalogIds.join(",")}`;
  if (sceneCache?.key === key) return sceneCache.scene;
  const scene = createGyroScene(catalog, candidateCatalogIds);
  sceneCache = { key, scene };
  return scene;
}

/** Copy the live (possibly retuned) weights into the look, weight-descending. */
export function setFactorWeights(look: GyroLook, weights: readonly number[]): void {
  const count = Math.min(weights.length, MAX_FACTORS);
  for (let i = 0; i < count; i++) look.factorWeights[i] = weights[i] > 0 ? weights[i] : 0;
  // Insertion sort, descending (16 values; no allocation).
  for (let i = 1; i < count; i++) {
    const v = look.factorWeights[i];
    let j = i - 1;
    while (j >= 0 && look.factorWeights[j] < v) {
      look.factorWeights[j + 1] = look.factorWeights[j];
      j--;
    }
    look.factorWeights[j + 1] = v;
  }
  let sum = 0;
  for (let i = 0; i < count; i++) sum += look.factorWeights[i];
  if (sum > 0) for (let i = 0; i < count; i++) look.factorWeights[i] /= sum;
  look.factorCount = count;
}

/* ------------------------------------------------------------------------ */
/* Projection                                                               */
/* ------------------------------------------------------------------------ */

/** Point the scene camera at the current state. */
export function aimCamera(
  scene: GyroScene,
  geom: GyroGeometry,
  yaw: number,
  pitch: number
): Camera {
  return updateCamera(scene.cam, {
    yaw,
    pitch,
    F: GYRO_F,
    cx: geom.cx,
    cy: geom.cy,
    scale: geom.R,
    up: "y",
  });
}

/** Aim the camera from `gyroState` (yaw + parallax, nutation). */
export function aimFromState(scene: GyroScene, geom: GyroGeometry, state: GyroState): Camera {
  return aimCamera(
    scene,
    geom,
    state.yaw + state.parallaxX.angle * DEG,
    gyroPitch(state.clock, state.parallaxY.angle)
  );
}

/** Project every star with the scene camera into `scene.proj`. */
export function projectStars(scene: GyroScene): void {
  const { unit, proj, cam } = scene;
  for (let i = 0; i < scene.n; i++) {
    project3(cam, unit[i * 3], unit[i * 3 + 1], unit[i * 3 + 2], proj, i * PROJECTED_STRIDE);
  }
}

/** Compass bearing (deg) from the pivot to a screen point: 0 up, clockwise. */
export function bearingTo(geom: GyroGeometry, sx: number, sy: number): number {
  return Math.atan2(sx - geom.cx, -(sy - geom.cy)) / DEG;
}

/** Bearing of star `i` as last projected, nearest to `current` (the short way round). */
export function starBearing(
  scene: GyroScene,
  geom: GyroGeometry,
  i: number,
  current: number
): number {
  if (i < 0) return current;
  const o = i * PROJECTED_STRIDE;
  return nearestEquivalentAngle(current, bearingTo(geom, scene.proj[o], scene.proj[o + 1]));
}

/**
 * Screen-space factor of the horizon ring's front point relative to the
 * nominal tilt: the DOM front-arc overlay applies it as `scaleY` (nutation).
 */
export function horizonScaleY(pitch: number): number {
  const front = (p: number) => (Math.sin(p) * GYRO_F) / (GYRO_F - Math.cos(p));
  return front(pitch) / front(GYRO_TILT_DEG * DEG);
}

/** Screen y offset (in R) of the horizon ring's far (top) point: the N cardinal. */
export function horizonBackY(pitch: number): number {
  return -(Math.sin(pitch) * GYRO_F) / (GYRO_F + Math.cos(pitch));
}

/** Screen y offset (in R) of the horizon ring's near (bottom) point: the S cardinal. */
export function horizonFrontY(pitch: number): number {
  return (Math.sin(pitch) * GYRO_F) / (GYRO_F - Math.cos(pitch));
}

/* ------------------------------------------------------------------------ */
/* Static geometry (server poster, DOM overlay)                             */
/* ------------------------------------------------------------------------ */

/** The dial's SVG box: 1000 units square, sphere centred, R = .36 · 1000. */
export const POSTER_BOX = 1000;
export const POSTER_GEOMETRY: GyroGeometry = {
  cx: POSTER_BOX / 2,
  cy: POSTER_BOX / 2,
  R: GYRO_R_RATIO * POSTER_BOX,
};

/** One decimal in the 1000-unit box is under a tenth of a pixel at any dial size. */
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Ring resolution for SVG (the canvas uses `RING_SEGMENTS`). */
const POSTER_SEGMENTS = 72;

function ringHalfPath(buf: Float32Array, segments: number, front: boolean): string {
  let d = "";
  let pen = false;
  for (let i = 0; i < segments; i++) {
    const o = i * PROJECTED_STRIDE;
    const o2 = o + PROJECTED_STRIDE;
    const mid = buf[o + 3] + buf[o2 + 3];
    if (mid < 0 === front) {
      if (!pen) {
        d += `M${round1(buf[o])} ${round1(buf[o + 1])}`;
        pen = true;
      }
      d += `L${round1(buf[o2])} ${round1(buf[o2 + 1])}`;
    } else {
      pen = false;
    }
  }
  return d;
}

/** SVG path of one ring half at yaw 0 and nominal tilt, in the 1000-unit dial box. */
export function posterRingPath(tilt: number, front: boolean, yaw = 0): string {
  const cam = makeCamera({
    yaw,
    pitch: GYRO_TILT_DEG * DEG,
    F: GYRO_F,
    cx: POSTER_GEOMETRY.cx,
    cy: POSTER_GEOMETRY.cy,
    scale: POSTER_GEOMETRY.R,
    up: "y",
  });
  const buf = new Float32Array((POSTER_SEGMENTS + 1) * PROJECTED_STRIDE);
  ringPolyline(cam, 1, tilt, POSTER_SEGMENTS, buf);
  return ringHalfPath(buf, POSTER_SEGMENTS, front);
}

/** The horizon ring's front half (the sandwich arc in front of the headline). */
export const HORIZON_FRONT_PATH = posterRingPath(0, true);

/** Short radial ticks at the horizon ring's four cardinal points, in the dial box. */
export const HORIZON_TICKS_PATH = (() => {
  const { cx, cy, R } = POSTER_GEOMETRY;
  const pitch = GYRO_TILT_DEG * DEG;
  const north = round1(cy + R * horizonBackY(pitch));
  const south = round1(cy + R * horizonFrontY(pitch));
  const len = 24;
  return (
    `M${cx - R} ${cy}h${-len}M${cx + R} ${cy}h${len}` +
    `M${cx} ${north}v${-len * 0.6}M${cx} ${south}v${len * 0.6}`
  );
})();

/** Yaw-0 projection of every star in the 1000-unit dial box (server poster, SSR labels). */
export function posterStars(scene: GyroScene): Float32Array {
  const cam = makeCamera({
    yaw: 0,
    pitch: GYRO_TILT_DEG * DEG,
    F: GYRO_F,
    cx: POSTER_GEOMETRY.cx,
    cy: POSTER_GEOMETRY.cy,
    scale: POSTER_GEOMETRY.R,
    up: "y",
  });
  const out = new Float32Array(scene.n * PROJECTED_STRIDE);
  for (let i = 0; i < scene.n; i++) {
    project3(
      cam,
      scene.unit[i * 3],
      scene.unit[i * 3 + 1],
      scene.unit[i * 3 + 2],
      out,
      i * PROJECTED_STRIDE
    );
  }
  return out;
}

/** Factor-ring arcs on the horizon plane at yaw 0, as SVG paths (weights weight-descending). */
export function posterFactorArcs(weights: readonly number[]): string[] {
  const look = createLook();
  setFactorWeights(look, weights);
  const cam = makeCamera({
    yaw: 0,
    pitch: GYRO_TILT_DEG * DEG,
    F: GYRO_F,
    cx: POSTER_GEOMETRY.cx,
    cy: POSTER_GEOMETRY.cy,
    scale: POSTER_GEOMETRY.R,
    up: "y",
  });
  const out: string[] = [];
  const buf = new Float32Array(PROJECTED_STRIDE);
  let a0 = FACTOR_START;
  for (let k = 0; k < look.factorCount; k++) {
    const span = look.factorWeights[k] * Math.PI * 2;
    const gap = Math.min(FACTOR_GAP, span * 0.5);
    let d = "";
    if (span > 0) {
      for (let j = 0; j <= 8; j++) {
        const a = a0 + gap / 2 + ((span - gap) * j) / 8;
        project3(cam, Math.cos(a) * FACTOR_RING_RATIO, 0, Math.sin(a) * FACTOR_RING_RATIO, buf, 0);
        d += `${j === 0 ? "M" : "L"}${round1(buf[0])} ${round1(buf[1])}`;
      }
    }
    out.push(d);
    a0 += span;
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Canvas drawing                                                           */
/* ------------------------------------------------------------------------ */

const GOLD = "#d4a840";
const GOLD_LO = "#8c6a1e";
const GOLD_HI = "#ffd36e";
const PHOSPHOR = "#fff1c9";
const EMBER = "#ff7a45";
const EMBER_SHADE = "#c4552b";
const GOLD_SHADE = "#8c6a1e";
const BEZEL_FILL = "#1a1712";

/** The factor ring starts at the horizon's far side and runs clockwise seen from above. */
const FACTOR_START = -Math.PI / 2;
const FACTOR_GAP = 0.035;

function strokeRingHalf(ctx: CanvasRenderingContext2D, buf: Float32Array, front: boolean): void {
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const o = i * PROJECTED_STRIDE;
    const o2 = o + PROJECTED_STRIDE;
    const mid = buf[o + 3] + buf[o2 + 3];
    if (mid < 0 === front) {
      if (!pen) {
        ctx.moveTo(buf[o], buf[o + 1]);
        pen = true;
      }
      ctx.lineTo(buf[o2], buf[o2 + 1]);
    } else {
      pen = false;
    }
  }
  ctx.stroke();
}

/** Star sprite size (CSS px) at perspective scale 1. */
export function starSize(R: number): number {
  return Math.min(10, Math.max(5, R * 0.027));
}

/**
 * Passes 0–4: sphere body, back stars, back ring halves, factor ring, bezel
 * ticks, needle. The hero draws its beam and particles right after this.
 */
export function drawGyroBack(
  ctx: CanvasRenderingContext2D,
  scene: GyroScene,
  geom: GyroGeometry,
  state: GyroState,
  now: number
): void {
  const { look, proj, ring } = scene;
  const { cx, cy, R } = geom;
  const ringsA = look.rings;

  // 0. Body: a dark glass sphere with a faint gold rim light, and the bezel band.
  if (ringsA > 0) {
    drawGlow(ctx, getSprite("gold", 64), cx, cy - R * 0.08, R * 2.5, 0.07 * ringsA);
    ctx.globalAlpha = ringsA;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(212,168,64,0.22)";
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.02, 0, Math.PI * 2);
    ctx.stroke();
    // Bezel band.
    ctx.strokeStyle = BEZEL_FILL;
    ctx.lineWidth = R * 0.07;
    ctx.beginPath();
    ctx.arc(cx, cy, R * (BEZEL_RATIO + 0.035), 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(212,168,64,0.4)";
    ctx.beginPath();
    ctx.arc(cx, cy, R * BEZEL_RATIO, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(212,168,64,0.18)";
    ctx.beginPath();
    ctx.arc(cx, cy, R * (BEZEL_RATIO + 0.07), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 1. Back stars: rects in three depth bands.
  if (look.stars > 0) {
    const px = R < 200 ? 1.2 : 1.5;
    ctx.fillStyle = GOLD_LO;
    for (let band = 0; band < 3; band++) {
      ctx.globalAlpha = (0.5 - band * 0.125) * look.stars;
      ctx.beginPath();
      for (let i = 0; i < scene.n; i++) {
        const o = i * PROJECTED_STRIDE;
        const depth = proj[o + 3];
        if (depth <= 0) continue;
        const b = depth < 0.34 ? 0 : depth < 0.67 ? 1 : 2;
        if (b !== band) continue;
        ctx.rect(proj[o] - px / 2, proj[o + 1] - px / 2, px, px);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (ringsA > 0) {
    // 2. Back ring halves.
    ctx.lineWidth = 1;
    ctx.strokeStyle = GOLD;
    for (let r = 0; r < RING_TILTS.length; r++) {
      ringPolyline(scene.cam, 1, RING_TILTS[r], RING_SEGMENTS, ring);
      ctx.globalAlpha = (r === 0 ? 0.35 : 0.2) * ringsA;
      strokeRingHalf(ctx, ring, false);
    }

    // 3. Factor ring on the horizon plane, and the bezel ticks.
    drawFactorRing(ctx, scene, ringsA);

    ctx.globalAlpha = 0.55 * ringsA;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const rot = state.bezel * DEG;
    const r0 = R * BEZEL_RATIO;
    for (let k = 0; k < BEZEL_TICKS; k++) {
      const a = rot + (k / BEZEL_TICKS) * Math.PI * 2;
      const major = k % 10 === 0;
      const len = R * (major ? 0.05 : 0.025);
      const c = Math.cos(a);
      const s = Math.sin(a);
      ctx.moveTo(cx + c * r0, cy + s * r0);
      ctx.lineTo(cx + c * (r0 + len), cy + s * (r0 + len));
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    drawBezelFlash(ctx, geom, look.flash);
  }

  // 4. Needle.
  if (look.needle > 0) drawNeedle(ctx, geom, state.needle.angle, look, now);
}

/** The intro's lock: the bezel flashes once (peak 30% luminance on the glow). */
export function drawBezelFlash(
  ctx: CanvasRenderingContext2D,
  geom: GyroGeometry,
  flash: number
): void {
  if (!(flash > 0)) return;
  const { cx, cy, R } = geom;
  ctx.globalAlpha = Math.min(1, flash);
  ctx.strokeStyle = GOLD_HI;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R * BEZEL_RATIO, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;
  drawGlow(ctx, getSprite("goldHi", 64), cx, cy, R * 2.9, 0.3 * flash);
}

/**
 * The horizon ring's front half alone, at `alpha` × .6 (the canvas twin of
 * the DOM front arc): the intro fades it out while the hero's arc fades in.
 * Uses the scene camera as last aimed.
 */
export function drawHorizonFront(
  ctx: CanvasRenderingContext2D,
  scene: GyroScene,
  alpha: number
): void {
  if (!(alpha > 0)) return;
  ringPolyline(scene.cam, 1, RING_TILTS[0], RING_SEGMENTS, scene.ring);
  ctx.globalAlpha = 0.6 * alpha;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.25;
  strokeRingHalf(ctx, scene.ring, true);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;
}

function drawFactorRing(ctx: CanvasRenderingContext2D, scene: GyroScene, alpha: number): void {
  const { look, arc, cam } = scene;
  let a0 = FACTOR_START;
  ctx.lineCap = "round";
  for (let k = 0; k < look.factorCount; k++) {
    const span = look.factorWeights[k] * Math.PI * 2;
    if (span <= 0) {
      // A zero weight is a hairline notch on the ring.
      project3(cam, Math.cos(a0) * 0.27, 0, Math.sin(a0) * 0.27, arc, 0);
      project3(cam, Math.cos(a0) * 0.33, 0, Math.sin(a0) * 0.33, arc, PROJECTED_STRIDE);
      ctx.globalAlpha = 0.35 * alpha;
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(arc[0], arc[1]);
      ctx.lineTo(arc[PROJECTED_STRIDE], arc[PROJECTED_STRIDE + 1]);
      ctx.stroke();
      continue;
    }
    const gap = Math.min(FACTOR_GAP, span * 0.5);
    const steps = Math.max(2, Math.min(ARC_POINTS, Math.ceil(span / 0.12)));
    for (let j = 0; j <= steps; j++) {
      const a = a0 + gap / 2 + ((span - gap) * j) / steps;
      project3(
        cam,
        Math.cos(a) * FACTOR_RING_RATIO,
        0,
        Math.sin(a) * FACTOR_RING_RATIO,
        arc,
        j * PROJECTED_STRIDE
      );
    }
    const lit = look.factorLit[k];
    ctx.globalAlpha = (0.45 + 0.55 * lit) * alpha;
    ctx.strokeStyle = lit > 0.05 ? GOLD_HI : GOLD;
    ctx.lineWidth = 2 + lit * 1.5;
    ctx.beginPath();
    ctx.moveTo(arc[0], arc[1]);
    for (let j = 1; j <= steps; j++) {
      ctx.lineTo(arc[j * PROJECTED_STRIDE], arc[j * PROJECTED_STRIDE + 1]);
    }
    ctx.stroke();
    a0 += span;
  }
  ctx.lineCap = "butt";
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;
}

function drawNeedle(
  ctx: CanvasRenderingContext2D,
  geom: GyroGeometry,
  angleDeg: number,
  look: GyroLook,
  now: number
): void {
  const { cx, cy, R } = geom;
  const k = look.needleScale;
  const sec = now / 1000;
  const tremor = 0.7 * Math.sin(sec * 7.3) * Math.sin(sec * 2.9 + 1.3);
  const a = (angleDeg + tremor) * DEG;
  // Unit vectors along the needle (towards its tip) and across it.
  const ux = Math.sin(a);
  const uy = -Math.cos(a);
  const vx = -uy;
  const vy = ux;
  const tip = R * NEEDLE_TIP * k;
  const tail = R * NEEDLE_TAIL * k;
  const half = Math.max(2.5, R * 0.032) * k;
  const tipX = cx + ux * tip;
  const tipY = cy + uy * tip;
  const tailX = cx - ux * tail;
  const tailY = cy - uy * tail;
  const lx = cx - vx * half;
  const ly = cy - vy * half;
  const rx = cx + vx * half;
  const ry = cy + vy * half;

  ctx.globalAlpha = look.needle;
  // North half: lit and shaded facets; then the tail.
  needleFacet(ctx, EMBER, tipX, tipY, lx, ly, cx, cy);
  needleFacet(ctx, EMBER_SHADE, tipX, tipY, rx, ry, cx, cy);
  needleFacet(ctx, GOLD, tailX, tailY, lx, ly, cx, cy);
  needleFacet(ctx, GOLD_SHADE, tailX, tailY, rx, ry, cx, cy);
  // Pivot.
  ctx.fillStyle = BEZEL_FILL;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(cx, cy, half * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PHOSPHOR;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1.2, half * 0.45), 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;
  drawGlow(ctx, getSprite("ember", 32), tipX, tipY, R * 0.06, 0.45 * look.needle);
  drawGlow(ctx, getSprite("phosphor", 32), cx, cy, R * 0.16, 0.35 * look.needle);
}

function needleFacet(
  ctx: CanvasRenderingContext2D,
  color: string,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
}

/**
 * Passes 5–6: front ring halves, front stars (free = gold-hi, others gold,
 * twinkling ±15%), candidate glows.
 */
export function drawGyroFront(
  ctx: CanvasRenderingContext2D,
  scene: GyroScene,
  geom: GyroGeometry,
  state: GyroState,
  now: number,
  quality: 0 | 1 | 2 = 0
): void {
  const { look, proj, ring } = scene;
  const ringsA = look.rings;

  // 5. Front ring halves (the horizon's front half is the DOM overlay's job).
  if (ringsA > 0) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = GOLD;
    for (let r = 0; r < RING_TILTS.length; r++) {
      const a = r === 0 ? 0.6 * look.horizonFront : 0.6;
      if (a <= 0) continue;
      ringPolyline(scene.cam, 1, RING_TILTS[r], RING_SEGMENTS, ring);
      ctx.globalAlpha = a * ringsA;
      ctx.lineWidth = r === 0 ? 1.25 : 1;
      strokeRingHalf(ctx, ring, true);
    }
    ctx.lineWidth = 1;
    ctx.globalAlpha = 1;
  }

  if (look.stars <= 0) return;

  // 6. Front stars as glow sprites, batched per colour.
  const base = starSize(geom.R);
  const t = state.clock;
  let nGold = 0;
  let nHi = 0;
  for (let i = 0; i < scene.n; i++) {
    const o = i * PROJECTED_STRIDE;
    const depth = proj[o + 3];
    if (depth >= 0) continue;
    const s = proj[o + 2];
    const twinkle = quality === 2 ? 1 : 1 + 0.15 * Math.sin(t * 2.3 + scene.phase[i]);
    // Brighter towards the viewer.
    const alpha = Math.min(1, (0.45 - depth * 0.55) * twinkle * look.stars);
    const size = base * s;
    if (scene.free[i]) {
      const p = nHi * 4;
      scene.poolHi[p] = proj[o];
      scene.poolHi[p + 1] = proj[o + 1];
      scene.poolHi[p + 2] = size;
      scene.poolHi[p + 3] = alpha;
      nHi++;
    } else {
      const p = nGold * 4;
      scene.poolGold[p] = proj[o];
      scene.poolGold[p + 1] = proj[o + 1];
      scene.poolGold[p + 2] = size;
      scene.poolGold[p + 3] = alpha;
      nGold++;
    }
  }
  drawGlowBatch(ctx, getSprite("gold", 16), scene.poolGold, nGold);
  drawGlowBatch(ctx, getSprite("goldHi", 16), scene.poolHi, nHi);

  // Candidate glows: the six providers the simulation routes between.
  for (let c = 0; c < scene.candStar.length; c++) {
    const i = scene.candStar[c];
    if (i < 0) continue;
    const o = i * PROJECTED_STRIDE;
    const front = proj[o + 3] < 0;
    const s = proj[o + 2];
    const fade = (front ? 1 : 0.35) * look.stars;
    const st = look.candState[c];
    const x = proj[o];
    const y = proj[o + 1];
    if (st === CAND_OPEN) {
      // Tripped: no glow, a dim star the needle no longer visits.
      continue;
    }
    if (c === look.winner) {
      drawGlow(ctx, getSprite("ember", 64), x, y, base * 7 * s, 0.85 * fade);
      drawGlow(ctx, getSprite("phosphor", 32), x, y, base * 2.2 * s, fade);
      continue;
    }
    if (st === CAND_HALF_OPEN) {
      const blink = 0.5 + 0.5 * Math.sin((now / 1000) * Math.PI * 4);
      drawGlow(ctx, getSprite("goldHi", 64), x, y, base * 5 * s, (0.3 + 0.6 * blink) * fade);
      continue;
    }
    drawGlow(ctx, getSprite("gold", 32), x, y, base * 4.2 * s, 0.6 * fade);
    drawGlow(ctx, getSprite("goldHi", 16), x, y, base * 1.6 * s, 0.9 * fade);
  }
}

/** Both halves with nothing in between: the intro's hand-off frame and the hero's idle frame. */
export function drawGyro(
  ctx: CanvasRenderingContext2D,
  scene: GyroScene,
  geom: GyroGeometry,
  state: GyroState,
  now: number,
  quality: 0 | 1 | 2 = 0
): void {
  drawGyroBack(ctx, scene, geom, state, now);
  drawGyroFront(ctx, scene, geom, state, now, quality);
}
