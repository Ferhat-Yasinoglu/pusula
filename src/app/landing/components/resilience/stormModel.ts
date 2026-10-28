/**
 * The storm rail's pure model (spec §6.6): the rail geometry shared by the DOM
 * frame (`resilience.css`) and the canvas (`stormRender.ts`), the profile →
 * candidate focus, and the autoplay script. No React, no DOM, no clock.
 *
 * Geometry: every coordinate is a CSS pixel in the stage, drawn left to right
 * (the renderer mirrors x for RTL). Each constant is anchored either to the
 * stage's start edge or to its end edge, never to its width, so the DOM frame
 * can place the same lines with plain logical insets. `resilience.css` repeats
 * the constants as custom properties; `landing-resilience.test.ts` pins that
 * the two agree.
 */
import {
  candidate,
  type BreakerState,
  type CandidateId,
  type ProfileId,
  type World,
} from "../../sim/landingSim";

/* ------------------------------------------------------------------------ */
/* Profiles                                                                 */
/* ------------------------------------------------------------------------ */

export const PROFILE_IDS: readonly ProfileId[] = ["oauth", "apikey", "local"];

/** The candidate the rail follows for each breaker profile. */
export const PROFILE_FOCUS: Readonly<Record<ProfileId, CandidateId>> = {
  oauth: "claude",
  apikey: "glm",
  local: "ollama",
};

/** The faults the three latches switch: model 2 (index 1) and key 2 (index 1). */
export const FAULT_MODEL = 1;
export const FAULT_KEY = 1;

/* ------------------------------------------------------------------------ */
/* Geometry                                                                 */
/* ------------------------------------------------------------------------ */

/** Below this stage width the compressed phone rail is used (CSS: the `res-rail` container query). */
export const COMPACT_MAX_WIDTH = 640;

export type RailMetrics = {
  /** Stage height. */
  h: number;
  /** Centre line of the band, the entry and the exit. */
  mid: number;
  /** Source node centre and radius. */
  srcX: number;
  srcR: number;
  /** Where the hub's fallback rail drops from the entry line. */
  dropX: number;
  /** Provider band: start x, distance of its end from the stage end, top, bottom, corner radius. */
  bandX0: number;
  bandEnd: number;
  bandY0: number;
  bandY1: number;
  bandR: number;
  /** Connection lanes: tops, height, where the straight lane starts. */
  laneTop: readonly [number, number, number];
  laneH: number;
  laneX0: number;
  /** Radius of the cooldown ring drawn on each lane's junction (laneX0, lane centre). */
  ringR: number;
  /** Model gates: distance of the gate start from the band end, gate width, slot height and gap. */
  gateOff: number;
  gateW: number;
  slotH: number;
  slotGap: number;
  /** The fan from the lane into its three gate slots. */
  fanW: number;
  /** Upstream node: distance of its centre from the stage end, radius. */
  upEnd: number;
  upR: number;
  /** Fallback rail: y and distance of its end from the stage end. */
  fbY: number;
  fbEnd: number;
  /** Breaker cells, centred on the band's top edge. */
  cellW: number;
  cellH: number;
  cellGap: number;
};

export const RAIL_WIDE: RailMetrics = {
  h: 380,
  mid: 178,
  srcX: 52,
  srcR: 12,
  dropX: 88,
  bandX0: 120,
  bandEnd: 200,
  bandY0: 56,
  bandY1: 300,
  bandR: 20,
  laneTop: [84, 154, 224],
  laneH: 60,
  laneX0: 184,
  ringR: 9,
  gateOff: 64,
  gateW: 24,
  slotH: 18,
  slotGap: 3,
  fanW: 40,
  upEnd: 96,
  upR: 18,
  fbY: 346,
  fbEnd: 24,
  cellW: 14,
  cellH: 22,
  cellGap: 6,
};

export const RAIL_COMPACT: RailMetrics = {
  h: 280,
  mid: 136,
  srcX: 16,
  srcR: 8,
  dropX: 30,
  bandX0: 44,
  bandEnd: 50,
  bandY0: 48,
  bandY1: 224,
  bandR: 14,
  laneTop: [70, 118, 166],
  laneH: 44,
  laneX0: 84,
  ringR: 7,
  gateOff: 42,
  gateW: 16,
  slotH: 13,
  slotGap: 2.5,
  fanW: 22,
  upEnd: 24,
  upR: 10,
  fbY: 252,
  fbEnd: 10,
  cellW: 10,
  cellH: 18,
  cellGap: 4,
};

export function railMetrics(width: number): RailMetrics {
  return width < COMPACT_MAX_WIDTH ? RAIL_COMPACT : RAIL_WIDE;
}

/** Resolved coordinates for one stage width (all in CSS px, left to right). */
export type RailGeometry = RailMetrics & {
  w: number;
  compact: boolean;
  bandX1: number;
  /** Lane centre lines. */
  laneMid: Float32Array;
  /** Where each straight lane ends and its fan into the gate slots begins. */
  laneEndX: number;
  gateX0: number;
  gateX1: number;
  /** Slot centre y, `[lane * 3 + model]`. */
  slotMid: Float32Array;
  upX: number;
  fbX1: number;
};

export function railGeometry(width: number): RailGeometry {
  const m = railMetrics(width);
  const bandX1 = width - m.bandEnd;
  const gateX0 = bandX1 - m.gateOff;
  const laneMid = new Float32Array(3);
  const slotMid = new Float32Array(9);
  for (let k = 0; k < 3; k++) {
    laneMid[k] = m.laneTop[k] + m.laneH / 2;
    for (let s = 0; s < 3; s++) {
      slotMid[k * 3 + s] = m.laneTop[k] + s * (m.slotH + m.slotGap) + m.slotH / 2;
    }
  }
  return {
    ...m,
    w: width,
    compact: m === RAIL_COMPACT,
    bandX1,
    laneMid,
    laneEndX: gateX0 - m.fanW,
    gateX0,
    gateX1: gateX0 + m.gateW,
    slotMid,
    upX: width - m.upEnd,
    fbX1: width - m.fbEnd,
  };
}

/** Centre x of breaker cell `i` of `count`, the row centred on the band (as the CSS flex row). */
export function cellCenterX(g: RailGeometry, i: number, count: number): number {
  const row = count * g.cellW + Math.max(0, count - 1) * g.cellGap;
  const start = (g.bandX0 + g.bandX1) / 2 - row / 2;
  return start + i * (g.cellW + g.cellGap) + g.cellW / 2;
}

/** The band outline's perimeter (a rounded rectangle), for the closing sweep. */
export function bandPerimeter(g: RailGeometry): number {
  const w = g.bandX1 - g.bandX0;
  const h = g.bandY1 - g.bandY0;
  const r = Math.min(g.bandR, w / 2, h / 2);
  return 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
}

/* ------------------------------------------------------------------------ */
/* Autoplay                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * The autoplay script: soon after the rail comes into view (`AUTOPLAY_IDLE_S`),
 * a loop at ×5 time-lapse walks the three scopes in turn —
 *
 *   0 s   OAuth (claude): 429 latch on model 2; the model locks, siblings serve.
 *   4 s   off.
 *   5 s   401 latch on key 2: cooling ×1, a concurrent failure is ignored,
 *         the cooldown lapses, the next failure cools ×2.
 *  10 s   off; a success clears the level.
 *  11 s   API key (glm): 503 latch on; failures climb to DEGRADED, then OPEN.
 *         Shortly after it opens the latch goes off, so the half-open probe
 *         that follows the reset succeeds and the breaker closes.
 *         Hold, then loop.
 *
 * The provider beat waits for the real breaker (it never fakes a state), so
 * its length follows the simulated traffic; caps keep the loop moving.
 *
 * It starts after only a moment in view: at the real pace the focused provider
 * sees about one request every two seconds, so an idle rail would read empty
 * to a visitor scrolling past. After a visitor's input it waits out the
 * cool-off instead.
 */
export const AUTOPLAY_IDLE_S = 0.8;
/** Any input stops autoplay for this long. */
export const AUTOPLAY_COOLOFF_S = 20;
export const AUTOPLAY_SPEED = 5;

export type AutoplayPhase =
  "model" | "modelRest" | "key" | "keyRest" | "provider" | "providerOpen" | "recover" | "hold";

export type AutoplayState = { phase: AutoplayPhase; t: number };

export type AutoplayTargets = {
  profile: ProfileId;
  model: boolean;
  key: boolean;
  provider: boolean;
};

/** Seconds per beat; for the provider beats, the cap. */
export const AUTOPLAY_BEATS: Readonly<Record<AutoplayPhase, number>> = {
  model: 4,
  modelRest: 1,
  key: 5,
  keyRest: 1,
  provider: 9,
  providerOpen: 1.5,
  recover: 12,
  hold: 2.5,
};

const NEXT_PHASE: Readonly<Record<AutoplayPhase, AutoplayPhase>> = {
  model: "modelRest",
  modelRest: "key",
  key: "keyRest",
  keyRest: "provider",
  provider: "providerOpen",
  providerOpen: "recover",
  recover: "hold",
  hold: "model",
};

export function createAutoplay(): AutoplayState {
  return { phase: "model", t: 0 };
}

/** The latches and profile a phase asks for. */
export function autoplayTargets(phase: AutoplayPhase): AutoplayTargets {
  switch (phase) {
    case "model":
      return { profile: "oauth", model: true, key: false, provider: false };
    case "key":
      return { profile: "oauth", model: false, key: true, provider: false };
    case "modelRest":
    case "keyRest":
      return { profile: "oauth", model: false, key: false, provider: false };
    case "provider":
    case "providerOpen":
      return { profile: "apikey", model: false, key: false, provider: true };
    case "recover":
    case "hold":
      return { profile: "apikey", model: false, key: false, provider: false };
  }
}

/** Index of the lowest set bit of a small mask, or −1. */
export function lowestBit(mask: number): number {
  for (let i = 0; i < 8; i++) if (mask & (1 << i)) return i;
  return -1;
}

/**
 * Advance the script by `dt` real seconds, given the focused breaker's state.
 * Mutates and returns `st`. The provider beat ends as soon as the breaker is
 * OPEN; the recover beat ends once it has closed again.
 */
export function stepAutoplay(st: AutoplayState, dt: number, breaker: BreakerState): AutoplayState {
  st.t += Math.max(0, dt);
  const beat = AUTOPLAY_BEATS[st.phase];
  // A timed beat hands its overshoot to the next one, so the script keeps its clock.
  const timed = st.t >= beat - 1e-6;
  let early = false;
  if (st.phase === "provider" && breaker === "open") early = true;
  if (st.phase === "recover" && breaker === "closed" && st.t >= 0.5) early = true;
  if (timed || early) {
    st.t = timed && !early ? Math.max(0, st.t - beat) : 0;
    st.phase = NEXT_PHASE[st.phase];
  }
  return st;
}

/** May autoplay start? In view long enough, the cool-off after input over, nothing latched by anyone else. */
export function autoplayMayStart(
  idleS: number,
  sinceInputS: number,
  foreignLatches: boolean
): boolean {
  return idleS >= AUTOPLAY_IDLE_S && sinceInputS >= AUTOPLAY_COOLOFF_S && !foreignLatches;
}

/* ------------------------------------------------------------------------ */
/* Reduced motion: latches resolved at once                                 */
/* ------------------------------------------------------------------------ */

export type LatchKind = "model" | "key" | "provider";

/**
 * Does the deck already show what a latch change should show? Under reduced
 * motion or Pause nothing steps on its own, so a toggle runs the deck until it
 * does: on, the faulted model is locked or the faulted key is cooling (it takes
 * a request on that model or key); off, the lock or cooldown has lapsed. The
 * provider latch is resolved by `dispatch` itself (OPEN while down, CLOSED once
 * restored); it is included for completeness.
 */
export function latchShown(w: World, id: CandidateId, kind: LatchKind, on: boolean): boolean {
  const c = candidate(w, id);
  if (kind === "model") {
    const locked = c.models[FAULT_MODEL].lockedUntilMs > w.simMs;
    return locked === on;
  }
  if (kind === "key") {
    const cooling = c.keys[FAULT_KEY].coolingUntilMs > w.simMs;
    return cooling === on;
  }
  return on ? c.breaker.state === "open" : c.breaker.state === "closed";
}

/** Sim ms a reduced-motion toggle may run the deck to show its result (a key cools ≤ 40 s). */
export const LATCH_RESOLVE_MAX_MS = 60_000;

/* ------------------------------------------------------------------------ */
/* Readouts                                                                 */
/* ------------------------------------------------------------------------ */

export const STATE_ORDER: readonly BreakerState[] = ["closed", "degraded", "open", "halfOpen"];

export const STATE_KEY: Readonly<
  Record<BreakerState, "stateClosed" | "stateDegraded" | "stateOpen" | "stateHalfOpen">
> = {
  closed: "stateClosed",
  degraded: "stateDegraded",
  open: "stateOpen",
  halfOpen: "stateHalfOpen",
};

/**
 * How loud the failure meter reads: idle (no failures), counting, hot (from the
 * profile's degraded threshold), or open (the threshold is reached).
 */
export type MeterLevel = "idle" | "count" | "hot" | "open";

export function meterLevel(
  failures: number,
  state: BreakerState,
  degradesAfter: number | null,
  opensAfter: number
): MeterLevel {
  if (state === "open" || failures >= opensAfter) return "open";
  if (state === "degraded" || (degradesAfter !== null && failures >= degradesAfter)) return "hot";
  return failures > 0 ? "count" : "idle";
}

/** Whole seconds left on a countdown (ceil), never negative. */
export function ceilSeconds(ms: number): number {
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}

/** Tenths of a second left (ceil to 0.1 s), never negative. */
export function tenthSeconds(ms: number): number {
  return ms > 0 ? Math.ceil(ms / 100) / 10 : 0;
}

/**
 * The share of the hub's traffic the focused provider usually carries,
 * smoothed: `focus` and `total` decay together so the ratio tracks the last
 * few seconds. While the breaker is OPEN the rail diverts this share of new
 * requests to the fallback rail (the hub skips the provider for them).
 */
export type ShareMeter = { focus: number; total: number };

export const SHARE_PRIOR: Readonly<ShareMeter> = { focus: 1, total: 6 };

export function decayShare(meter: ShareMeter, dt: number, halfLifeS = 8): void {
  const k = Math.pow(0.5, Math.max(0, dt) / halfLifeS);
  meter.focus *= k;
  meter.total *= k;
}

export function shareOf(meter: ShareMeter): number {
  if (!(meter.total > 0)) return SHARE_PRIOR.focus / SHARE_PRIOR.total;
  const share = meter.focus / meter.total;
  return share < 0.05 ? 0.05 : share > 0.6 ? 0.6 : share;
}
