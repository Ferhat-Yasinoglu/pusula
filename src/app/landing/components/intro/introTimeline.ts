/**
 * "Landfall", the first-visit intro (spec §5.4), as closed-form functions of
 * the intro clock `t` (ms). Every particle position and alpha, every label
 * and HUD opacity is a pure function of `t` and the measured layout, so a skip
 * (`t = max(t, 2350)`) lands on exactly the converged frame and a dropped
 * frame never accumulates error. The needle spring is the one exception
 * (`IntroSequence` steps it); its spin-in before the spring engages is
 * closed-form here.
 *
 *   0–300      ignition: a gold point, its glow, a sextant crosshair
 *   0–480      the boot log types `$ npx pusula`
 *              (0–480 is also played by CSS alone from first paint, before
 *              any script runs: see `cssHold` and `intro.css`)
 *   120–800    starfield: every particle fades in on a slowly yawing sphere
 *   560–1160   boot lines roll the gateway's real figures
 *   700–1500   landfall: particles fall onto the dot-matrix Afghanistan,
 *              west to east (never mirrored)
 *   1150–1650  the border strokes in
 *   1300–1700  Kabul pulses; 1350–1760 eight arcs fly to the other cities
 *   1750–2350  transmutation: provider stars fly to their places on the
 *              gyro's shell, the rest swirl onto its rings
 *   2050–2550  the needle spins in and locks north
 *   2150–2450  rhumbs shoot out; 2300–2600 the lock shockwave
 *   2350–2600  hand-off: the curtain lifts over the live hero
 *
 * No React, no DOM: unit-tested in `tests/unit/landing-intro.test.ts`.
 */
import {
  BORDER_POINTS,
  CITIES,
  CITY_POINTS,
  MAP_HEIGHT,
  MAP_WIDTH,
  arcControl,
  buildDotGrid,
  type CityId,
} from "../../landingGeometry";
import {
  PROJECTED_STRIDE,
  fibonacciSphere,
  makeCamera,
  project3,
} from "../../sim/landingProjection";
import { hash32, mulberry32 } from "../../sim/prng";
import { starPhase, starSize as gyroStarSize } from "../hero/gyro";

/** Storyboard windows (ms). */
export const INTRO_T = {
  igniteEnd: 300,
  /** Top HUD fade-in. */
  hudIn: 200,
  typeCps: 25,
  starfield: 120,
  starfieldSpread: 480,
  starFade: 260,
  crossOut: [500, 800],
  boot: 560,
  bootGap: 110,
  running: 1160,
  land: 700,
  landDur: 520,
  landSweep: 280,
  border: [1150, 1650],
  kabul: [1300, 1700],
  arcs: 1350,
  arcDur: 300,
  arcGap: 15,
  labelsOut: [1750, 1900],
  mapOut: [1750, 2000],
  trans: 1750,
  flySpread: 180,
  flyDur: 420,
  swirlSpread: 80,
  swirlDur: 420,
  particlesOut: [2250, 2350],
  ringsIn: [2150, 2350],
  bootOut: [2150, 2350],
  needle: 2050,
  needleSpring: 2200,
  north: 2250,
  rhumbs: [2150, 2450],
  lock: [2300, 2600],
  handoff: 2350,
  done: 2600,
  /**
   * The server-rendered curtain plays the ignition, the HUD fade and the
   * typing in CSS from first paint (`intro.css`, the same curves), then holds
   * this frame until the script takes over. The canvas resumes at
   * `min(time since the CSS started, cssHold)`, so the hand-over is seamless
   * and a slow hydration never shows a black screen.
   */
  cssHold: 480,
  /** The JS failsafe: the end state is forced this long after mount. */
  failsafe: 4000,
} as const;

/** The boot log's command (typed) and its figure lines (rolled). */
export const BOOT_COMMAND = "$ npx pusula";
export const BOOT_LINES = 6;

/* ------------------------------------------------------------------------ */
/* Easing                                                                   */
/* ------------------------------------------------------------------------ */

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 0 → 1 across [a, b], clamped. */
export const ramp = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
export const easeInOutCubic = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const easeInOutQuart = (x: number): number =>
  x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);
/** The dot landing pop: 1 → 1.6 → 1 (the `--ease-lift` overshoot, closed form). */
export const liftPop = (x: number): number =>
  x <= 0 || x >= 1 ? 1 : 1 + 0.6 * Math.sin(Math.PI * x);

/* ------------------------------------------------------------------------ */
/* Layout                                                                   */
/* ------------------------------------------------------------------------ */

export type IntroLayoutInput = {
  vw: number;
  vh: number;
  /** The hero dial in viewport px (`[data-hero-dial]`): centre and sphere radius. */
  dial: { cx: number; cy: number; R: number };
  /** Provider stars on the shell (catalog size). */
  stars: number;
  /** Shell pitch at the hand-off (rad): the hero's nominal tilt. */
  pitch: number;
  /** Perspective distance in sphere radii (`GYRO_F`). */
  F: number;
  /** Per provider star: 1 when it has a free tier or needs no key (its sprite is gold-hi). */
  free?: ArrayLike<number>;
};

export type IntroLayout = {
  vw: number;
  vh: number;
  phone: boolean;
  /** Map px → screen: `x·scale + ox`. */
  scale: number;
  ox: number;
  oy: number;
  /** Particles (= dots). */
  n: number;
  dotX: Float32Array;
  dotY: Float32Array;
  level: Uint8Array;
  /** Dot radius at rest (px). */
  dotR: number;
  /** Starfield: unit vectors (xyz), sphere centre and radius (px). */
  starU: Float32Array;
  starSize: Float32Array;
  /** Per particle, 0..1: its seeded place in the starfield fade-in (see `retimeStarfield`). */
  fadeSeed: Float32Array;
  fieldCx: number;
  fieldCy: number;
  fieldR: number;
  fadeAt: Float32Array;
  landAt: Float32Array;
  /** Provider star index per particle, or -1. */
  provider: Int32Array;
  /** Transmutation start per particle (ms). */
  transAt: Float32Array;
  /** Transmutation target (shell star or ring point), screen px. */
  targetX: Float32Array;
  targetY: Float32Array;
  /** Provider stars: the size, alpha and class they land with (the gyro's own look at clock 0). */
  targetSize: Float32Array;
  targetAlpha: Float32Array;
  targetClass: Uint8Array;
  /** Swirl: polar start around Kabul and sweep to the target around the dial centre. */
  theta0: Float32Array;
  dist0: Float32Array;
  sweep: Float32Array;
  rEnd: Float32Array;
  kabulX: number;
  kabulY: number;
  /** City screen points in `CITIES` order. */
  cityX: Float32Array;
  cityY: Float32Array;
  /** Arc control points (Kabul → city), in `CITIES` order (Kabul's own slot unused). */
  arcQX: Float32Array;
  arcQY: Float32Array;
  /** Border polygon (closed) in screen px and cumulative length. */
  borderX: Float32Array;
  borderY: Float32Array;
  borderLen: Float32Array;
  dial: { cx: number; cy: number; R: number };
};

export const CITY_IDS: readonly CityId[] = CITIES.map((c) => c.id);
export const KABUL_INDEX = CITY_IDS.indexOf("kabul");

/** Particle `j` is provider star `i` when `j = floor((i + .5) · nDots / stars)` (spec §5.3). */
export function providerParticle(i: number, nDots: number, stars: number): number {
  return Math.floor(((i + 0.5) * nDots) / stars);
}

const SWIRL_TURN = Math.PI * 2;
/** Particles swirl at least this far (rad) on their way to the rings. */
const SWIRL_MIN = 0.9;

export function buildIntroLayout(input: IntroLayoutInput): IntroLayout {
  const { vw, vh, dial } = input;
  const phone = vw < 768;
  const spacing = phone ? 14 : 12;
  const dots = buildDotGrid(spacing);
  const n = dots.length;
  const fitW = (phone ? 0.86 : 0.55) * vw;
  const scale = Math.min(fitW / MAP_WIDTH, ((phone ? 0.5 : 0.66) * vh) / MAP_HEIGHT);
  const mapCx = vw / 2;
  const mapCy = (phone ? 0.4 : 0.46) * vh;
  const ox = mapCx - (MAP_WIDTH / 2) * scale;
  const oy = mapCy - (MAP_HEIGHT / 2) * scale;

  const dotX = new Float32Array(n);
  const dotY = new Float32Array(n);
  const level = new Uint8Array(n);
  let minX = Infinity;
  let maxX = -Infinity;
  for (let j = 0; j < n; j++) {
    dotX[j] = ox + dots[j].x * scale;
    dotY[j] = oy + dots[j].y * scale;
    level[j] = dots[j].level;
    if (dots[j].x < minX) minX = dots[j].x;
    if (dots[j].x > maxX) maxX = dots[j].x;
  }

  const kabul = CITY_POINTS.kabul;
  const kabulX = ox + kabul.x * scale;
  const kabulY = oy + kabul.y * scale;

  // Starfield.
  const rng = mulberry32(hash32("landfall", n));
  const starU = new Float32Array(n * 3);
  const starSize = new Float32Array(n);
  const fadeSeed = new Float32Array(n);
  const fadeAt = new Float32Array(n);
  const landAt = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const z = rng() * 2 - 1;
    const phi = rng() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    starU[j * 3] = r * Math.cos(phi);
    starU[j * 3 + 1] = r * Math.sin(phi);
    starU[j * 3 + 2] = z;
    starSize[j] = 0.6 + rng();
    fadeSeed[j] = hash32("fade", j) / 4294967296;
    fadeAt[j] = INTRO_T.starfield + fadeSeed[j] * INTRO_T.starfieldSpread;
    // West to east, whatever the reading direction.
    landAt[j] = INTRO_T.land + ((dots[j].x - minX) / Math.max(1, maxX - minX)) * INTRO_T.landSweep;
  }

  // Provider stars and their places on the shell.
  const stars = Math.max(0, Math.floor(input.stars));
  const provider = new Int32Array(n).fill(-1);
  for (let i = 0; i < stars; i++) {
    const j = Math.min(n - 1, providerParticle(i, n, stars));
    if (provider[j] < 0) provider[j] = i;
  }
  const unit = fibonacciSphere(stars);
  const cam = makeCamera({
    yaw: 0,
    pitch: input.pitch,
    F: input.F,
    cx: dial.cx,
    cy: dial.cy,
    scale: dial.R,
    up: "y",
  });
  const proj = new Float32Array(PROJECTED_STRIDE);

  const targetX = new Float32Array(n);
  const targetY = new Float32Array(n);
  const targetSize = new Float32Array(n);
  const targetAlpha = new Float32Array(n);
  const targetClass = new Uint8Array(n);
  const base = gyroStarSize(dial.R);
  const backPx = dial.R < 200 ? 1.2 : 1.5;
  const transAt = new Float32Array(n);
  const theta0 = new Float32Array(n);
  const dist0 = new Float32Array(n);
  const sweep = new Float32Array(n);
  const rEnd = new Float32Array(n);

  // Distances from Kabul: provider stars leave nearest first; the rest pick a
  // ring by distance tercile (near → horizon, mid → meridian, far → ecliptic).
  const order = Array.from({ length: n }, (_, j) => j);
  const dist = new Float32Array(n);
  for (let j = 0; j < n; j++) dist[j] = Math.hypot(dotX[j] - kabulX, dotY[j] - kabulY);
  order.sort((a, b) => dist[a] - dist[b]);
  const rank = new Float32Array(n);
  for (let k = 0; k < n; k++) rank[order[k]] = n > 1 ? k / (n - 1) : 0;

  const tilts = [0, Math.PI / 2, 23.4 * (Math.PI / 180)];
  for (let j = 0; j < n; j++) {
    const dx = dotX[j] - kabulX;
    const dy = dotY[j] - kabulY;
    theta0[j] = Math.atan2(dy, dx);
    dist0[j] = dist[j];
    const p = provider[j];
    if (p >= 0) {
      project3(cam, unit[p * 3], unit[p * 3 + 1], unit[p * 3 + 2], proj, 0);
      targetX[j] = proj[0];
      targetY[j] = proj[1];
      const depth = proj[3];
      if (depth >= 0) {
        // Back hemisphere: the gyro draws a dim rect in one of three depth bands.
        targetClass[j] = P_SHELL_BACK;
        targetSize[j] = backPx;
        targetAlpha[j] = 0.5 - (depth < 0.34 ? 0 : depth < 0.67 ? 1 : 2) * 0.125;
      } else {
        const twinkle = 1 + 0.15 * Math.sin(starPhase(p));
        targetClass[j] = input.free?.[p] ? P_SHELL_HI : P_SHELL_GOLD;
        targetSize[j] = base * proj[2];
        targetAlpha[j] = Math.min(1, (0.45 - depth * 0.55) * twinkle);
      }
      transAt[j] = INTRO_T.trans + rank[j] * INTRO_T.flySpread;
      continue;
    }
    const ringIndex = rank[j] < 1 / 3 ? 0 : rank[j] < 2 / 3 ? 1 : 2;
    const a = theta0[j] + 40 * (Math.PI / 180);
    const u = Math.cos(a);
    const v = Math.sin(a);
    const tilt = tilts[ringIndex];
    project3(cam, u, -v * Math.sin(tilt), v * Math.cos(tilt), proj, 0);
    targetX[j] = proj[0];
    targetY[j] = proj[1];
    const thetaT = Math.atan2(proj[1] - dial.cy, proj[0] - dial.cx);
    let d = (thetaT - theta0[j]) % SWIRL_TURN;
    if (d < 0) d += SWIRL_TURN;
    if (d < SWIRL_MIN) d += SWIRL_TURN;
    sweep[j] = d;
    rEnd[j] = Math.hypot(proj[0] - dial.cx, proj[1] - dial.cy);
    transAt[j] = INTRO_T.trans + (hash32("swirl", j) / 4294967296) * INTRO_T.swirlSpread;
  }

  // Cities, arcs and the border.
  const cityX = new Float32Array(CITIES.length);
  const cityY = new Float32Array(CITIES.length);
  const arcQX = new Float32Array(CITIES.length);
  const arcQY = new Float32Array(CITIES.length);
  CITIES.forEach((city, c) => {
    const pt = CITY_POINTS[city.id];
    cityX[c] = ox + pt.x * scale;
    cityY[c] = oy + pt.y * scale;
    const q = arcControl(kabul, pt, 0.3);
    arcQX[c] = ox + q.x * scale;
    arcQY[c] = oy + q.y * scale;
  });
  const m = BORDER_POINTS.length;
  const borderX = new Float32Array(m + 1);
  const borderY = new Float32Array(m + 1);
  const borderLen = new Float32Array(m + 1);
  for (let k = 0; k <= m; k++) {
    const pt = BORDER_POINTS[k % m];
    borderX[k] = ox + pt.x * scale;
    borderY[k] = oy + pt.y * scale;
    borderLen[k] =
      k === 0
        ? 0
        : borderLen[k - 1] + Math.hypot(borderX[k] - borderX[k - 1], borderY[k] - borderY[k - 1]);
  }

  return {
    vw,
    vh,
    phone,
    scale,
    ox,
    oy,
    n,
    dotX,
    dotY,
    level,
    dotR: Math.max(0.9, spacing * scale * 0.19),
    starU,
    starSize,
    fadeSeed,
    fieldCx: vw / 2,
    fieldCy: vh / 2,
    fieldR: 0.6 * Math.max(vw, vh),
    fadeAt,
    landAt,
    provider,
    transAt,
    targetX,
    targetY,
    targetSize,
    targetAlpha,
    targetClass,
    theta0,
    dist0,
    sweep,
    rEnd,
    kabulX,
    kabulY,
    cityX,
    cityY,
    arcQX,
    arcQY,
    borderX,
    borderY,
    borderLen,
    dial: { ...dial },
  };
}

/**
 * The canvas resumes the intro at `from` ms (the CSS ignition ran until
 * then): stars that would already be part-way into their fade-in start it
 * from `from` instead, so the starfield never pops in at once. Their order is
 * kept and they all finish by the usual time (the spread shrinks to a
 * quarter at most). `from` at or before the starfield's start restores the
 * storyboard exactly. In place; cheap (one pass).
 */
export function retimeStarfield(L: IntroLayout, from: number): void {
  const T = INTRO_T;
  const start = Math.max(from, T.starfield);
  const spread = T.starfieldSpread * Math.max(0.25, 1 - (start - T.starfield) / T.starfieldSpread);
  for (let j = 0; j < L.n; j++) L.fadeAt[j] = start + L.fadeSeed[j] * spread;
}

/* ------------------------------------------------------------------------ */
/* Scalars                                                                  */
/* ------------------------------------------------------------------------ */

export type IntroScalars = {
  /** Ignition glow alpha and radius (px). */
  glow: number;
  glowR: number;
  /** Ignition point alpha. */
  point: number;
  /** Crosshair alpha and extent (0..1 of the way to the edges). */
  cross: number;
  crossLen: number;
  /** Top HUD opacity. */
  hud: number;
  /** Characters of `BOOT_COMMAND` typed. */
  typed: number;
  /** Boot lines shown (0..6), and the "running" line (0/1). */
  boot: number;
  running: number;
  /** Boot log opacity (fades at the hand-off). */
  bootLog: number;
  /** Border stroke progress (0..1) and alpha. */
  border: number;
  borderA: number;
  /** Kabul pulse ring radius (px) and alpha. */
  kabulR: number;
  kabulA: number;
  /** Arcs fade (shared). Per-arc progress comes from `arcProgress`. */
  arcsA: number;
  /** City labels fade (shared); each label's own arrival comes from `cityLabel`. */
  labelsA: number;
  /** Gyro rings, bezel and factor ring (0..1). */
  rings: number;
  /** Gyro stars (0 or 1: the provider particles stand in until the hand-off). */
  stars: number;
  /** Needle alpha and scale; `spin` is its closed-form angle before the spring engages (NaN after). */
  needle: number;
  needleScale: number;
  spin: number;
  /** Rhumbs: length progress and alpha. */
  rhumbs: number;
  rhumbsA: number;
  /** Lock shockwave radius (in R) and alpha; bezel flash. */
  shock: number;
  shockA: number;
  flash: number;
  /** Cardinal letters, and the N's ember ignition. */
  cardinals: number;
  north: number;
  /** Curtain opacity (1 → 0 across the hand-off). */
  curtain: number;
  /** Gyro clock (s): 0 at the hand-off. */
  gyroClock: number;
};

export function createScalars(): IntroScalars {
  return {
    glow: 0,
    glowR: 0,
    point: 0,
    cross: 0,
    crossLen: 0,
    hud: 0,
    typed: 0,
    boot: 0,
    running: 0,
    bootLog: 0,
    border: 0,
    borderA: 0,
    kabulR: 0,
    kabulA: 0,
    arcsA: 0,
    labelsA: 0,
    rings: 0,
    stars: 0,
    needle: 0,
    needleScale: 0,
    spin: Number.NaN,
    rhumbs: 0,
    rhumbsA: 0,
    shock: 0,
    shockA: 0,
    flash: 0,
    cardinals: 0,
    north: 0,
    curtain: 1,
    gyroClock: 0,
  };
}

/** Needle spin-in before the spring: 1080°/s, braking to 300°/s at −60° by `needleSpring`. */
export const NEEDLE_SPIN = { from: -163.5, v0: 1080, decel: 5200, at: -60, v: 300 } as const;

export function needleSpinAt(t: number): { angle: number; velocity: number } {
  const u = Math.max(0, Math.min(t, INTRO_T.needleSpring) - INTRO_T.needle) / 1000;
  return {
    angle: NEEDLE_SPIN.from + NEEDLE_SPIN.v0 * u - 0.5 * NEEDLE_SPIN.decel * u * u,
    velocity: NEEDLE_SPIN.v0 - NEEDLE_SPIN.decel * u,
  };
}

export function introScalars(t: number, out: IntroScalars = createScalars()): IntroScalars {
  const T = INTRO_T;
  // Ignition.
  const ig = ramp(t, 0, T.igniteEnd);
  out.glowR = 120 * easeOutCubic(ig);
  out.glow =
    (ig < 0.5 ? 0.9 * (ig / 0.5) : 0.9 - 0.55 * ((ig - 0.5) / 0.5)) * (1 - ramp(t, 500, 900));
  out.point = ramp(t, 0, 60) * (1 - ramp(t, 700, 900));
  out.crossLen = easeOutCubic(ig);
  out.cross = 0.35 * ramp(t, 0, 80) * (1 - ramp(t, T.crossOut[0], T.crossOut[1]));
  out.hud = ramp(t, 0, T.hudIn) * (1 - ramp(t, T.handoff, T.done));

  // Boot log.
  out.typed = Math.min(BOOT_COMMAND.length, Math.floor(t / (1000 / T.typeCps)));
  out.boot = t < T.boot ? 0 : Math.min(BOOT_LINES, 1 + Math.floor((t - T.boot) / T.bootGap));
  out.running = t >= T.running ? 1 : 0;
  out.bootLog = 1 - ramp(t, T.bootOut[0], T.bootOut[1]);

  // Map.
  const mapFade = 1 - ramp(t, T.mapOut[0], T.mapOut[1]);
  out.border = easeInOutCubic(ramp(t, T.border[0], T.border[1]));
  out.borderA = 0.8 * (t >= T.border[0] ? 1 : 0) * mapFade;
  const k = ramp(t, T.kabul[0], T.kabul[1]);
  out.kabulR = 24 * easeOutCubic(k);
  out.kabulA = t >= T.kabul[0] && t < T.kabul[1] ? 0.8 * (1 - k) : 0;
  out.arcsA = mapFade;
  out.labelsA = 1 - ramp(t, T.labelsOut[0], T.labelsOut[1]);

  // Gyro.
  out.rings = ramp(t, T.ringsIn[0], T.ringsIn[1]);
  out.stars = t >= T.handoff ? 1 : 0;
  out.needle = t >= T.needle ? 1 : 0;
  out.needleScale =
    t < T.needle ? 0.6 : 0.6 + 0.4 * easeOutCubic(ramp(t, T.needle, T.needleSpring));
  out.spin = t < T.needleSpring ? needleSpinAt(t).angle : Number.NaN;
  out.rhumbs = easeOutCubic(ramp(t, T.rhumbs[0], T.rhumbs[1]));
  out.rhumbsA = t >= T.rhumbs[0] ? 1 : 0;
  const lock = ramp(t, T.lock[0], T.lock[1]);
  out.shock = 1.4 * easeOutCubic(lock);
  out.shockA = t >= T.lock[0] && t < T.lock[1] ? 0.5 * (1 - lock) : 0;
  out.flash =
    t < T.lock[0]
      ? 0
      : t < T.handoff
        ? ramp(t, T.lock[0], T.handoff)
        : 1 - ramp(t, T.handoff, T.done);
  out.cardinals = ramp(t, T.ringsIn[0], T.ringsIn[1]);
  out.north = ramp(t, T.north, T.north + 120);

  out.curtain = 1 - ramp(t, T.handoff, T.done);
  out.gyroClock = Math.max(0, t - T.handoff) / 1000;
  return out;
}

/** Arc `c` (Kabul → city c) drawing progress at `t`, 0..1 (Kabul's own slot is always 0). */
export function arcProgress(t: number, c: number): number {
  if (c === KABUL_INDEX) return 0;
  const order = c < KABUL_INDEX ? c : c - 1;
  const start = INTRO_T.arcs + order * INTRO_T.arcGap;
  return easeInOutCubic(ramp(t, start, start + INTRO_T.arcDur));
}

/** A city's label opacity at `t`: in as its arc lands (Kabul with its pulse), out at 1750–1900. */
export function cityLabel(t: number, c: number): number {
  const shared = 1 - ramp(t, INTRO_T.labelsOut[0], INTRO_T.labelsOut[1]);
  if (c === KABUL_INDEX) return 0.85 * ramp(t, INTRO_T.kabul[0], INTRO_T.kabul[0] + 160) * shared;
  const order = c < KABUL_INDEX ? c : c - 1;
  const arrive = INTRO_T.arcs + order * INTRO_T.arcGap + INTRO_T.arcDur;
  return 0.85 * ramp(t, arrive - 60, arrive + 120) * shared;
}

/** A city's flare when its arc lands (0..1). */
export function cityFlare(t: number, c: number): number {
  if (c === KABUL_INDEX) return 0;
  const order = c < KABUL_INDEX ? c : c - 1;
  const arrive = INTRO_T.arcs + order * INTRO_T.arcGap + INTRO_T.arcDur;
  const u = (t - arrive) / 380;
  return u < 0 || u >= 1 ? 0 : 1 - u;
}

/* ------------------------------------------------------------------------ */
/* Particles                                                                */
/* ------------------------------------------------------------------------ */

/** Floats per particle in `writeParticles`' output: x, y, size, alpha, class. */
export const PARTICLE_STRIDE = 5;
/**
 * Particle classes: hidden; starlight (provider stars brighter, phosphor);
 * dot levels 0–4 (3..7); and provider stars flying to the shell, drawn as
 * the gyro draws them: gold or gold-hi sprites in front, dim rects behind.
 */
export const P_HIDDEN = 0;
export const P_STAR = 1;
export const P_PROVIDER = 2;
export const P_DOT = 3;
export const P_SHELL_GOLD = 8;
export const P_SHELL_HI = 9;
export const P_SHELL_BACK = 10;

const projScratch = new Float32Array(PROJECTED_STRIDE);

/** Starfield position of particle `j` at `t` (the sphere yaws at 10°/s), into `out[0..2]` = x, y, s. */
function starfieldAt(L: IntroLayout, j: number, t: number, out: Float32Array): void {
  const yaw = ((10 * Math.PI) / 180) * (t / 1000);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const x = L.starU[j * 3];
  const y = L.starU[j * 3 + 1];
  const z = L.starU[j * 3 + 2];
  const x1 = x * c + z * s;
  const z1 = -x * s + z * c;
  const F = 2.2;
  const k = F / (F - z1);
  out[0] = L.fieldCx + x1 * L.fieldR * k;
  out[1] = L.fieldCy - y * L.fieldR * k;
  out[2] = k;
}

/**
 * Every particle at `t` into `out` (`PARTICLE_STRIDE` floats each). Returns
 * how many are visible. From the hand-off on, none are: the gyro's own stars
 * and rings stand exactly where they landed.
 */
export function writeParticles(L: IntroLayout, t: number, out: Float32Array): number {
  let visible = 0;
  const T = INTRO_T;
  const out3 = projScratch;
  const particlesOut = 1 - ramp(t, T.particlesOut[0], T.particlesOut[1]);
  for (let j = 0; j < L.n; j++) {
    const o = j * PARTICLE_STRIDE;
    const isProvider = L.provider[j] >= 0;
    if (t >= T.handoff || t < L.fadeAt[j]) {
      out[o + 3] = 0;
      out[o + 4] = P_HIDDEN;
      continue;
    }
    const fade = ramp(t, L.fadeAt[j], L.fadeAt[j] + T.starFade);
    const landStart = L.landAt[j];
    const landT = ramp(t, landStart, landStart + T.landDur);
    let x: number;
    let y: number;
    let size: number;
    let alpha: number;
    let cls: number;

    if (landT < 1) {
      // In the sky, or falling onto the map.
      starfieldAt(L, j, Math.min(t, landStart + T.landDur), out3);
      const e = easeInOutCubic(landT);
      x = out3[0] + (L.dotX[j] - out3[0]) * e;
      y = out3[1] + (L.dotY[j] - out3[1]) * e;
      const depthDim = 0.55 + 0.45 * Math.min(1, out3[2]);
      size = L.starSize[j] * Math.min(1.6, out3[2]) * (1 - e) + L.dotR * 2 * e;
      alpha = fade * (isProvider ? 1 : 0.7) * depthDim;
      cls = isProvider ? P_PROVIDER : P_STAR;
    } else if (t < L.transAt[j]) {
      // On the map: popped on landing, then resting in its band.
      const pop = liftPop((t - (landStart + T.landDur)) / 220);
      x = L.dotX[j];
      y = L.dotY[j];
      size = L.dotR * 2 * pop;
      alpha = 1;
      cls = P_DOT + L.level[j];
    } else if (isProvider) {
      // Provider stars fly to their places on the shell and take its look.
      const f = easeInOutQuart(ramp(t, L.transAt[j], L.transAt[j] + T.flyDur));
      x = L.dotX[j] + (L.targetX[j] - L.dotX[j]) * f;
      y = L.dotY[j] + (L.targetY[j] - L.dotY[j]) * f;
      size = L.dotR * 2 + (L.targetSize[j] - L.dotR * 2) * f;
      alpha = 1 + (L.targetAlpha[j] - 1) * f;
      cls = f < 0.5 ? P_DOT + L.level[j] : L.targetClass[j];
    } else {
      // The rest swirl around a centre gliding from Kabul to the dial.
      const f = easeInOutCubic(ramp(t, L.transAt[j], L.transAt[j] + T.swirlDur));
      const cx = L.kabulX + (L.dial.cx - L.kabulX) * f;
      const cy = L.kabulY + (L.dial.cy - L.kabulY) * f;
      const theta = L.theta0[j] + L.sweep[j] * f;
      const r = L.dist0[j] + (L.rEnd[j] - L.dist0[j]) * f;
      x = cx + Math.cos(theta) * r;
      y = cy + Math.sin(theta) * r;
      if (f >= 1) {
        x = L.targetX[j];
        y = L.targetY[j];
      }
      size = L.dotR * 2 * (1 - 0.4 * f);
      alpha = particlesOut * (1 - 0.3 * f);
      cls = P_DOT + L.level[j];
    }
    out[o] = x;
    out[o + 1] = y;
    out[o + 2] = size;
    out[o + 3] = alpha;
    out[o + 4] = alpha > 0 ? cls : P_HIDDEN;
    if (alpha > 0) visible++;
  }
  return visible;
}

/** The whole frame at `t` (tests and debugging; the renderer calls the two parts itself). */
export function introFrame(
  t: number,
  L: IntroLayout
): { scalars: IntroScalars; particles: Float32Array; visible: number } {
  const particles = new Float32Array(L.n * PARTICLE_STRIDE);
  const visible = writeParticles(L, t, particles);
  return { scalars: introScalars(t), particles, visible };
}

/** Skip: jump forward to the converged frame, never back. */
export function skipTo(t: number): number {
  return Math.max(t, INTRO_T.handoff);
}
