/**
 * The storm rail's canvas (spec §6.6): everything that moves over the DOM
 * frame. Loaded on demand by `ResilienceStation` and driven by the page
 * heartbeat through `useCanvasStage`; never imported on the server.
 *
 * What it draws, all from the page's one simulation (`getWorld()`):
 * - Every request the deck sends to the focused provider is a comet that
 *   leaves the hub (source node), takes its key's lane and its model's gate,
 *   and plays the attempt's real outcome: through the gate to the upstream
 *   node (served), a bounce at the gate and a hop to a sibling model (429),
 *   a hop to a sibling lane while the old lane flashes (401), or a lightning
 *   strike and a drop onto the fallback rail, where the hub retries the next
 *   target (503). A half-open breaker's probe is a phosphor comet.
 *   The rail runs as a time-lapse (`railSpeed`), and a comet takes about two
 *   seconds from hub to upstream (`cometPace`), so several are always in
 *   flight. When the rail starts (or switches provider, or comes back on
 *   screen) it is not drawn empty: the focused provider's requests served in
 *   the last moments (the deck's `routed` events) are placed along the route
 *   where they would be now, on lanes and gates that are free.
 * - Every request the hub receives arrives as a faint mote at the source.
 *   While the breaker is OPEN, the provider's usual share of them is
 *   diverted at the entry straight down onto the fallback rail.
 * - Cooldown rings that drain around cooling lanes, breaker-cell pops, the
 *   white flash when the breaker opens (≤ 12%, at most 3 a second), and the
 *   clockwise gold sweep along the band when it closes.
 *
 * Allocation-free per frame: particles live in typed-array pools; bolts are
 * built only when one strikes. Glows are pre-rendered sprites ("lighter"),
 * never `shadowBlur`. RTL mirrors the whole drawing (x' = W − x).
 */
import { getWorld } from "../../runtime/deckStore";
import { getQualityTier } from "../../runtime/heartbeat";
import { drawGlow, getSprite, type GlowSprite } from "../../runtime/glowSprites";
import type { StageSize } from "../../runtime/useCanvasStage";
import { bolt, type Bolt } from "../../sim/lightning";
import { hash32, mulberry32, type Rng } from "../../sim/prng";
import {
  breakerProfile,
  type BreakerState,
  type CandidateId,
  type CandidateState,
  type InflightRequest,
  type World,
} from "../../sim/landingSim";
import {
  COMET_TRAVEL_S,
  bandPerimeter,
  cellCenterX,
  cometPace,
  decayShare,
  railGeometry,
  railSpeed,
  servedRouteLength,
  shareOf,
} from "./stormModel";
import type { RailGeometry, ShareMeter } from "./stormModel";

/** What the station hands the renderer (a mutable object it owns). */
export type StormInput = {
  focus: CandidateId;
  rtl: boolean;
  /** The white flash layer (opacity only). */
  flash: HTMLElement | null;
  /** The rail root: the renderer marks which lane's gate shows the padlock. */
  rail: HTMLElement | null;
};

/* ------------------------------------------------------------------------ */
/* Pools                                                                    */
/* ------------------------------------------------------------------------ */

const MAX = 120;
const MAX_COMPACT = 70;
const WP_MAX = 6;
/** A failed comet hurries back to the hub. */
const RETREAT_BOOST = 1.6;
const PEND_MAX = 4;

// Particle kinds.
const K_ATTEMPT = 1;
const K_MOTE = 2;
const K_RUNNER = 3;
// What happens when a particle runs out of waypoints.
const END_FADE = 0;
const END_GATE = 1;
const END_UPSTREAM = 2;
const END_SOURCE = 3;
const END_RAIL = 4;
// Colours.
const C_GOLD = 0;
const C_HI = 1;
const C_PHOSPHOR = 2;
const C_EMBER = 3;
// Outcomes queued on an attempt.
const O_SERVED = 1;
const O_RETRY_KEY = 2;
const O_RETRY_MODEL = 3;
const O_FAIL_503 = 4;
const O_FAIL_OTHER = 5;

const pActive = new Uint8Array(MAX);
const pKind = new Uint8Array(MAX);
const pEnd = new Uint8Array(MAX);
const pColor = new Uint8Array(MAX);
const pWaiting = new Uint8Array(MAX);
const pX = new Float32Array(MAX);
const pY = new Float32Array(MAX);
const pDx = new Float32Array(MAX);
const pDy = new Float32Array(MAX);
const pSpeed = new Float32Array(MAX);
const pAlpha = new Float32Array(MAX);
const pFade = new Float32Array(MAX);
const pSize = new Float32Array(MAX);
const pAge = new Float32Array(MAX);
const pLane = new Int8Array(MAX);
const pModel = new Int8Array(MAX);
const pWp = new Float32Array(MAX * WP_MAX * 2);
const pWpN = new Uint8Array(MAX);
const pWpI = new Uint8Array(MAX);
// Tracking a deck request (attempts only).
const pRef: (InflightRequest | null)[] = new Array<InflightRequest | null>(MAX).fill(null);
const pSeen = new Uint8Array(MAX);
const pStart = new Float64Array(MAX);
const pTriedK = new Uint8Array(MAX);
const pTriedM = new Uint8Array(MAX);
const pFailN = new Uint8Array(MAX);
const pPend = new Uint8Array(MAX * PEND_MAX);
const pPendK = new Int8Array(MAX * PEND_MAX);
const pPendM = new Int8Array(MAX * PEND_MAX);
const pPendN = new Uint8Array(MAX);
// Comet tails: a short ring of past positions, sampled by distance, so a tail bends round corners.
const HIST = 9;
const pHx = new Float32Array(MAX * HIST);
const pHy = new Float32Array(MAX * HIST);
const pHn = new Uint8Array(MAX);
const pHead = new Uint8Array(MAX);

type Strike = { shape: Bolt; age: number; x: number; y: number };
const MAX_STRIKES = 3;
/** A jump in sim time larger than this (the stage was off screen) resyncs without effects. */
const RESYNC_SIM_MS = 2500;
const strikes: (Strike | null)[] = [null, null, null];

// Effects.
const laneFlash = new Float32Array(3);
const gateBurst = new Float32Array(9);
const cellPop = new Float32Array(16);
/** Each key's current cooldown: when it ends and how long it was when first seen. */
const coolUntil = new Float64Array(3);
const coolTotal = new Float64Array(3);
const flashTimes = new Float64Array(3).fill(-Infinity);

/* ------------------------------------------------------------------------ */
/* Renderer state                                                           */
/* ------------------------------------------------------------------------ */

let geo: RailGeometry | null = null;
/** A comet's speed at ×1 (px/s): its route over `COMET_TRAVEL_S`. */
let cometBase = 520;
/** The feeders' stroke: gold that fades in from the origin nodes (built per layout). */
let feederFade: CanvasGradient | null = null;
let poolSize = MAX;
let rng: Rng = mulberry32(hash32("storm-rail"));
let gold: GlowSprite | null = null;
let goldHi: GlowSprite | null = null;
let phosphor: GlowSprite | null = null;
let ember: GlowSprite | null = null;

let lastFocus: CandidateId | null = null;
let focusIndex = -1;
let lastState: BreakerState = "closed";
let lastFailures = 0;
let lastRequestId = -1;
/** Next request id the arrival feeders have not drawn yet. */
let nextMoteId = -1;
let lastSimMs = -1;
let strikesOwed = 0;
let srcPulse = 1;
let upPulse = 1;
let sweep = -1;
let railGlow = 0;
let divertCarry = 0;
let padlockLane = -1;
/** The rail (re)started, switched provider or came back: fill it on the next moving frame. */
let warmPending = false;
/** 0..1: how much "weather" shows while the provider's 503 latch is on. */
let storm = 0;
let stormClock = 0;
const RAIN = 26;
/** Rain streaks: x phase (0..1), speed factor, length, alpha. */
const rain = new Float32Array(RAIN * 4);
const share: ShareMeter = { focus: 1, total: 6 };
/** Scratch for `setLineDash` (copied by the browser, never reallocated here). */
const dash: number[] = [0, 0];
const noDash: number[] = [];

/** Canvas colours (the `landing.css` tokens); alpha always goes through `globalAlpha`. */
const GOLD = "rgb(212,168,64)";
const GOLD_HI = "rgb(255,211,110)";
const PHOSPHOR = "rgb(255,241,201)";
const EMBER = "rgb(255,122,69)";
/** Tail colour per particle colour, and the brighter core. */
const TAIL = [GOLD, GOLD_HI, PHOSPHOR, EMBER] as const;
const CORE = [GOLD_HI, PHOSPHOR, "rgb(255,252,240)", "rgb(255,176,140)"] as const;

/* ------------------------------------------------------------------------ */
/* Setup                                                                    */
/* ------------------------------------------------------------------------ */

export function setup(ctx: CanvasRenderingContext2D, s: StageSize, _input: StormInput): void {
  geo = railGeometry(s.w);
  cometBase = servedRouteLength(geo) / COMET_TRAVEL_S;
  feederFade = ctx.createLinearGradient(FEED_X0, 0, geo.srcX - geo.srcR, 0);
  feederFade.addColorStop(0, "rgba(212,168,64,0.05)");
  feederFade.addColorStop(1, "rgba(212,168,64,0.32)");
  poolSize = geo.compact ? MAX_COMPACT : MAX;
  gold = getSprite("gold", 32);
  goldHi = getSprite("goldHi", 32);
  phosphor = getSprite("phosphor", 32);
  ember = getSprite("ember", 64);
  rng = mulberry32(hash32("storm-rail", s.w));
  for (let r = 0; r < RAIN; r++) {
    rain[r * 4] = rng();
    rain[r * 4 + 1] = 0.7 + rng() * 0.6;
    rain[r * 4 + 2] = 8 + rng() * 14;
    rain[r * 4 + 3] = 0.25 + rng() * 0.5;
  }
  // A new layout: let whatever is in flight vanish rather than jump.
  for (let i = 0; i < MAX; i++) {
    if (!pActive[i]) continue;
    pRef[i] = null;
    pFade[i] = Math.max(pFade[i], 4);
  }
}

/* ------------------------------------------------------------------------ */
/* Particle helpers                                                         */
/* ------------------------------------------------------------------------ */

function alloc(): number {
  for (let i = 0; i < poolSize; i++) if (!pActive[i]) return i;
  return -1;
}

function spawn(kind: number, x: number, y: number, color: number, speed: number, size: number) {
  const i = alloc();
  if (i < 0) return -1;
  pActive[i] = 1;
  pKind[i] = kind;
  pEnd[i] = END_FADE;
  pColor[i] = color;
  pWaiting[i] = 0;
  pX[i] = x;
  pY[i] = y;
  pDx[i] = 1;
  pDy[i] = 0;
  pSpeed[i] = speed;
  pAlpha[i] = 1;
  pFade[i] = 0;
  pSize[i] = size;
  pAge[i] = 0;
  pLane[i] = -1;
  pModel[i] = -1;
  pWpN[i] = 0;
  pWpI[i] = 0;
  pRef[i] = null;
  pSeen[i] = 0;
  pPendN[i] = 0;
  pHn[i] = 0;
  pHead[i] = 0;
  return i;
}

/** Record the position into the tail ring when it has moved far enough. */
function sampleTail(i: number, step: number): void {
  const n = pHn[i];
  if (n > 0) {
    const last = i * HIST + pHead[i];
    const dx = pX[i] - pHx[last];
    const dy = pY[i] - pHy[last];
    if (dx * dx + dy * dy < step * step) return;
  }
  const head = n === 0 ? 0 : (pHead[i] + 1) % HIST;
  pHead[i] = head;
  pHx[i * HIST + head] = pX[i];
  pHy[i * HIST + head] = pY[i];
  if (n < HIST) pHn[i] = n + 1;
}

function wpClear(i: number): void {
  pWpN[i] = 0;
  pWpI[i] = 0;
  pWaiting[i] = 0;
}

function wpPush(i: number, x: number, y: number): void {
  const n = pWpN[i];
  if (n >= WP_MAX) return;
  const o = (i * WP_MAX + n) * 2;
  pWp[o] = x;
  pWp[o + 1] = y;
  pWpN[i] = n + 1;
}

/** Which leg of the route the particle is on (0 = before its first waypoint). */
function leg(i: number): number {
  return pWpI[i];
}

function pendPush(i: number, code: number, key: number, model: number): void {
  const n = pPendN[i];
  if (n >= PEND_MAX) return;
  const o = i * PEND_MAX + n;
  pPend[o] = code;
  pPendK[o] = key;
  pPendM[o] = model;
  pPendN[i] = n + 1;
}

function pendShift(i: number): void {
  const base = i * PEND_MAX;
  const n = pPendN[i];
  for (let j = 1; j < n; j++) {
    pPend[base + j - 1] = pPend[base + j];
    pPendK[base + j - 1] = pPendK[base + j];
    pPendM[base + j - 1] = pPendM[base + j];
  }
  pPendN[i] = n > 0 ? n - 1 : 0;
}

/* ------------------------------------------------------------------------ */
/* Routes                                                                   */
/* ------------------------------------------------------------------------ */

/** Hub → band entry → the key's lane → the model's gate; waits there for the outcome. */
function routeToGate(i: number, g: RailGeometry, key: number, model: number): void {
  wpClear(i);
  wpPush(i, g.bandX0, g.mid);
  wpPush(i, g.laneX0, g.laneMid[key]);
  wpPush(i, g.laneEndX, g.laneMid[key]);
  wpPush(i, g.gateX0, g.slotMid[key * 3 + model]);
  pEnd[i] = END_GATE;
  pLane[i] = key;
  pModel[i] = model;
}

/** From wherever it is in the band to another lane (401: a sibling key), then on to the gate. */
function hopLane(i: number, g: RailGeometry, key: number, model: number): void {
  const x = Math.min(Math.max(pX[i] + 18, g.laneX0), g.laneEndX);
  wpClear(i);
  wpPush(i, x, g.laneMid[key]);
  wpPush(i, g.laneEndX, g.laneMid[key]);
  wpPush(i, g.gateX0, g.slotMid[key * 3 + model]);
  pEnd[i] = END_GATE;
  pLane[i] = key;
  pModel[i] = model;
}

/** Bounce off a locked gate (429) and line up on a sibling model's slot. */
function bounceGate(i: number, g: RailGeometry, key: number, model: number): void {
  const old = (pLane[i] < 0 ? 0 : pLane[i]) * 3 + (pModel[i] < 0 ? 0 : pModel[i]);
  wpClear(i);
  wpPush(i, g.gateX0 - 14, g.slotMid[old]);
  wpPush(i, g.laneEndX + g.fanW * 0.35, g.laneMid[key]);
  wpPush(i, g.gateX0, g.slotMid[key * 3 + model]);
  pEnd[i] = END_GATE;
  pLane[i] = key;
  pModel[i] = model;
}

/** Through the gate, out of the band and into the upstream node. */
function routeServed(i: number, g: RailGeometry): void {
  const slot = g.slotMid[Math.max(0, pLane[i]) * 3 + Math.max(0, pModel[i])];
  wpClear(i);
  wpPush(i, g.gateX1, slot);
  wpPush(i, g.bandX1, g.mid);
  wpPush(i, g.upX - g.upR, g.mid);
  pEnd[i] = END_UPSTREAM;
}

/**
 * The target failed: the hub retries the next one. The comet runs back out of
 * the band to the hub's drop, then down and along the fallback rail (spec §7.4:
 * fallback is always the hub retrying, never the provider forwarding).
 */
function routeFallback(i: number, g: RailGeometry): void {
  const lane = pLane[i] < 0 ? 1 : pLane[i];
  wpClear(i);
  if (pX[i] > g.laneEndX + 0.5) wpPush(i, g.laneEndX, g.laneMid[lane]);
  if (pX[i] > g.laneX0 + 0.5) wpPush(i, g.laneX0, g.laneMid[lane]);
  wpPush(i, g.bandX0, g.mid);
  wpPush(i, g.dropX, g.mid);
  wpPush(i, g.dropX, g.fbY);
  wpPush(i, g.fbX1, g.fbY);
  pEnd[i] = END_RAIL;
  pKind[i] = K_RUNNER;
  pSpeed[i] *= RETREAT_BOOST;
  pRef[i] = null;
  pPendN[i] = 0;
}

/* ------------------------------------------------------------------------ */
/* Effects                                                                  */
/* ------------------------------------------------------------------------ */

function strike(ax: number, ay: number, bx: number, by: number): void {
  let slot = -1;
  let oldest = -1;
  for (let s = 0; s < MAX_STRIKES; s++) {
    const st = strikes[s];
    if (!st || st.age >= 0.32) {
      slot = s;
      break;
    }
    if (oldest < 0 || st.age > (strikes[oldest]?.age ?? 0)) oldest = s;
  }
  if (slot < 0) slot = oldest;
  if (slot < 0) return;
  strikes[slot] = { shape: bolt(ax, ay, bx, by, rng, geo?.compact ? 5 : 6), age: 0, x: bx, y: by };
}

/** The ≤ 12% white flash on the breaker opening: at most 3 in any second. */
function flash(input: StormInput, now: number): void {
  const el = input.flash;
  if (!el || typeof el.animate !== "function") return;
  let oldest = 0;
  for (let k = 1; k < flashTimes.length; k++) if (flashTimes[k] < flashTimes[oldest]) oldest = k;
  if (now - flashTimes[oldest] < 1000) return;
  flashTimes[oldest] = now;
  el.animate([{ opacity: 0.12 }, { opacity: 0 }], { duration: 420, easing: "ease-out" });
}

function setPadlock(input: StormInput, lane: number): void {
  if (lane === padlockLane || !input.rail) return;
  padlockLane = lane;
  input.rail.setAttribute("data-padlock", String(lane));
}

/* ------------------------------------------------------------------------ */
/* World → particles                                                        */
/* ------------------------------------------------------------------------ */

function findFocus(w: World, id: CandidateId): CandidateState | null {
  if (focusIndex >= 0 && w.candidates[focusIndex]?.id === id) return w.candidates[focusIndex];
  for (let i = 0; i < w.candidates.length; i++) {
    if (w.candidates[i].id === id) {
      focusIndex = i;
      return w.candidates[i];
    }
  }
  focusIndex = -1;
  return null;
}

function retarget(c: CandidateState, w: World, input: StormInput): void {
  lastFocus = c.id;
  lastState = c.breaker.state;
  lastFailures = c.breaker.failures;
  strikesOwed = 0;
  share.focus = 1;
  share.total = 6;
  divertCarry = 0;
  for (let i = 0; i < MAX; i++) {
    if (!pActive[i] || pKind[i] === K_MOTE) continue;
    pRef[i] = null;
    pFade[i] = Math.max(pFade[i], 3);
  }
  laneFlash.fill(0);
  gateBurst.fill(0);
  cellPop.fill(0);
  if (lastRequestId < 0) lastRequestId = w.nextRequestId;
  if (nextMoteId < 0) nextMoteId = w.nextRequestId;
  padlockLane = -2;
  setPadlock(input, 0);
}

/** New attempts on the focused provider become comets; tracked ones report their outcomes. */
function trackAttempts(w: World, c: CandidateState, g: RailGeometry, pace: number): void {
  for (let i = 0; i < poolSize; i++) pSeen[i] = 0;

  const inflight = w.inflight;
  for (let r = 0; r < inflight.length; r++) {
    const req = inflight[r];
    let found = -1;
    for (let i = 0; i < poolSize; i++) {
      if (pRef[i] === req) {
        found = i;
        break;
      }
    }
    if (found >= 0) {
      pSeen[found] = 1;
      continue;
    }
    if (req.to !== c.id) continue;
    const i = spawn(
      K_ATTEMPT,
      g.srcX,
      g.mid,
      req.probe ? C_PHOSPHOR : C_HI,
      cometBase * pace,
      req.probe ? 1.5 : 1
    );
    if (i < 0) continue;
    routeToGate(i, g, req.key, req.model);
    pRef[i] = req;
    pSeen[i] = 1;
    pStart[i] = req.startedAtMs;
    pTriedK[i] = req.triedKeys;
    pTriedM[i] = req.triedModels;
    pFailN[i] = req.failed.length;
    share.focus += 1;
  }

  for (let i = 0; i < poolSize; i++) {
    const req = pRef[i];
    if (!pActive[i] || !req) continue;
    // The target failed: the hub moves on to the next one.
    if (req.failed.length > pFailN[i]) {
      let code = 0;
      for (let f = pFailN[i]; f < req.failed.length; f++) {
        if (req.failed[f] === c.id) code = req.codes[f] ?? 503;
      }
      pFailN[i] = req.failed.length;
      if (code !== 0) {
        if (code === 503) strikesOwed++;
        pendPush(i, code === 503 ? O_FAIL_503 : O_FAIL_OTHER, -1, -1);
        pRef[i] = null;
        continue;
      }
    }
    if (!pSeen[i]) {
      // Finished without failing here: served.
      if (req.to === c.id) pendPush(i, O_SERVED, -1, -1);
      pRef[i] = null;
      continue;
    }
    if (req.to !== c.id) {
      pRef[i] = null;
      continue;
    }
    if (req.startedAtMs !== pStart[i]) {
      // A sibling inside the same provider: a new key after a 401, a new model after a 429.
      const keyFailed = req.triedKeys !== pTriedK[i];
      pendPush(i, keyFailed ? O_RETRY_KEY : O_RETRY_MODEL, req.key, req.model);
      pStart[i] = req.startedAtMs;
      pTriedK[i] = req.triedKeys;
      pTriedM[i] = req.triedModels;
    }
  }
}

/** Play queued outcomes when the comet reaches the point where they belong. */
function playOutcomes(i: number, g: RailGeometry, input: StormInput): void {
  while (pPendN[i] > 0) {
    const o = i * PEND_MAX;
    const code = pPend[o];
    const atGate = pWaiting[i] === 1;
    // Key and provider failures show once the comet is in its lane; model and success at the gate.
    const inLane = leg(i) >= 2 || atGate;
    if (code === O_FAIL_503 || code === O_FAIL_OTHER) {
      if (!inLane) return;
      if (code === O_FAIL_503) {
        if (strikesOwed > 0) strikesOwed--;
        strike(pX[i] + (rng() * 2 - 1) * 40, 0, pX[i], pY[i]);
      } else if (pLane[i] >= 0) {
        laneFlash[pLane[i]] = 1;
      }
      pColor[i] = C_EMBER;
      routeFallback(i, g);
      return;
    }
    if (code === O_RETRY_KEY) {
      if (!inLane) return;
      if (pLane[i] >= 0) laneFlash[pLane[i]] = 1;
      hopLane(i, g, pPendK[o], pPendM[o]);
      pendShift(i);
      continue;
    }
    if (!atGate) return;
    if (code === O_RETRY_MODEL) {
      const lane = pLane[i] < 0 ? 0 : pLane[i];
      const slot = lane * 3 + (pModel[i] < 0 ? 0 : pModel[i]);
      gateBurst[slot] = 1;
      setPadlock(input, lane);
      bounceGate(i, g, pPendK[o], pPendM[o]);
      pendShift(i);
      continue;
    }
    // Served.
    routeServed(i, g);
    pendShift(i);
    return;
  }
}

/* ------------------------------------------------------------------------ */
/* Warm start                                                               */
/* ------------------------------------------------------------------------ */

/** A warm start fills the rail up to this many comets. */
const SEED_MAX = 6;
/** Fast-forward step for a placed comet (the normal motion code, run ahead). */
const SEED_DT = 1 / 30;
/** Served this close together (sim ms), requests count as one batch: one session, one key. */
const SEED_BATCH_MS = 400;

/** The first key from `start` that serves now (not revoked, not cooling), or −1. */
function freeKey(w: World, c: CandidateState, start: number): number {
  for (let j = 0; j < c.keys.length; j++) {
    const k = (start + j) % c.keys.length;
    if (!c.keys[k].revoked && c.keys[k].coolingUntilMs <= w.simMs) return k;
  }
  return -1;
}

/** The first model from `start` that serves now (not rate-limited, not locked), or −1. */
function freeModel(w: World, c: CandidateState, start: number): number {
  for (let j = 0; j < c.models.length; j++) {
    const m = (start + j) % c.models.length;
    if (!c.models[m].rateLimited && c.models[m].lockedUntilMs <= w.simMs) return m;
  }
  return -1;
}

/**
 * Place the focused provider's most recently served requests (the deck's
 * `routed` events) where their comets would be now, newest first, so a rail
 * that just started, switched provider or came back on screen is not drawn
 * empty. The event names the provider, not the key or model: as in the deck,
 * a batch shares one key (its lane) and the models take turns, all among the
 * keys and models that serve now.
 */
function seedRecent(
  w: World,
  c: CandidateState,
  g: RailGeometry,
  speed: number,
  pace: number,
  input: StormInput
): void {
  // Nothing gets through an open breaker, and while the upstream is down a served comet would lie.
  if (c.breaker.state === "open" || c.upstreamDown) return;
  let live = 0;
  for (let i = 0; i < poolSize; i++) {
    if (pActive[i] && pKind[i] === K_ATTEMPT && pFade[i] === 0) live++;
  }
  // Only comets still short of the upstream are placed.
  const reach = (COMET_TRAVEL_S / pace) * 0.92;
  const tailStep = g.compact ? 4 : 6;
  const events = w.events;
  let batchT = -Infinity;
  let batchKey = -1;
  for (let e = events.length - 1; e >= 0 && live < SEED_MAX; e--) {
    const ev = events[e];
    if (ev.kind !== "routed") continue;
    const age = (w.simMs - ev.t) / speed / 1000;
    if (age >= reach) break;
    if (ev.to !== c.id || ev.probe) continue;
    const sameBatch =
      batchKey >= 0 && batchT - ev.t < SEED_BATCH_MS && freeKey(w, c, batchKey) === batchKey;
    // Going back in time, the batch before used the key before (keys take turns).
    const key = sameBatch ? batchKey : freeKey(w, c, batchKey < 0 ? ev.n % 3 : batchKey + 2);
    const model = freeModel(w, c, ev.n % 3);
    if (key < 0 || model < 0) continue;
    batchT = ev.t;
    batchKey = key;
    const i = spawn(K_ATTEMPT, g.srcX, g.mid, C_HI, cometBase * pace, 1);
    if (i < 0) return;
    routeToGate(i, g, key, model);
    pendPush(i, O_SERVED, -1, -1);
    live++;
    for (let t = 0; t < age && pActive[i]; t += SEED_DT) {
      pAge[i] += Math.min(SEED_DT, age - t);
      move(i, Math.min(SEED_DT, age - t), tailStep);
      if (pWpI[i] >= pWpN[i]) arrive(i);
      playOutcomes(i, g, input);
    }
  }
}

/** Which feeder a client's requests arrive on: top, middle, bottom. */
function feederOf(from: string): number {
  return from === "ghazni" ? 0 : from === "faizabad" ? 1 : 2;
}

/*
 * Client feeders (desktop): three short streams into the hub, each from a small
 * origin node just inside the stage's start edge. Side feeders bend in through
 * two waypoints; the middle one runs along the DOM's arrival line.
 */
const FEED_X0 = 10;
const FEED_DY = 44;

function feederY(g: RailGeometry, feeder: number): number {
  return g.compact || feeder === 1 ? g.mid : g.mid + (feeder === 0 ? -1 : 1) * FEED_DY;
}

/** Push the feeder route into the hub (desktop: three streams; phone: one). */
function routeFeeder(i: number, g: RailGeometry, feeder: number): void {
  const end = g.srcX - g.srcR * 0.4;
  if (g.compact || feeder === 1) {
    wpPush(i, end, g.mid);
    return;
  }
  const side = feeder === 0 ? -1 : 1;
  wpPush(i, FEED_X0 + 14, g.mid + side * (FEED_DY - 8));
  wpPush(i, g.srcX - 15, g.mid + side * 9);
  wpPush(i, end, g.mid);
}

function spawnArrivals(w: World, c: CandidateState, g: RailGeometry, pace: number): void {
  if (lastRequestId < 0) lastRequestId = w.nextRequestId;
  if (nextMoteId < 0) nextMoteId = w.nextRequestId;
  const fresh = w.nextRequestId - lastRequestId;
  lastRequestId = w.nextRequestId;
  if (fresh <= 0) return;
  share.total += fresh;

  // While OPEN, the provider's usual share of the new requests is turned away at the entry.
  if (c.breaker.state === "open") {
    for (let n = 0; n < fresh && n < 8; n++) {
      divertCarry += shareOf(share);
      if (divertCarry < 1) continue;
      divertCarry -= 1;
      const i = spawn(K_RUNNER, g.srcX, g.mid, C_GOLD, (g.compact ? 230 : 460) * pace, 1);
      if (i < 0) continue;
      wpPush(i, g.dropX, g.mid);
      wpPush(i, g.dropX, g.fbY);
      wpPush(i, g.fbX1, g.fbY);
      pEnd[i] = END_RAIL;
    }
  }

  // Every request the hub receives arrives as a mote on its client's feeder.
  const tier = getQualityTier();
  let drawn = 0;
  let maxId = nextMoteId - 1;
  const inflight = w.inflight;
  for (let r = 0; r < inflight.length; r++) {
    const req = inflight[r];
    if (req.id < nextMoteId) continue;
    if (req.id > maxId) maxId = req.id;
    if (drawn >= 8 || (tier >= 2 && req.id % 2 === 1)) continue;
    const feeder = g.compact ? 1 : feederOf(req.from);
    const i = spawn(
      K_MOTE,
      g.compact ? -6 : FEED_X0,
      feederY(g, feeder),
      C_GOLD,
      (g.compact ? 110 : 150) * pace,
      0.8
    );
    if (i < 0) continue;
    drawn++;
    pAlpha[i] = 0.7;
    routeFeeder(i, g, feeder);
    pEnd[i] = END_SOURCE;
  }
  nextMoteId = Math.max(nextMoteId, maxId + 1, w.nextRequestId - 12);
}

/* ------------------------------------------------------------------------ */
/* Motion                                                                   */
/* ------------------------------------------------------------------------ */

function move(i: number, dt: number, tailStep: number): void {
  if (pKind[i] !== K_MOTE) sampleTail(i, tailStep);
  let budget = pSpeed[i] * dt;
  let guard = 0;
  while (budget > 0 && pWpI[i] < pWpN[i] && guard++ < WP_MAX + 1) {
    const o = (i * WP_MAX + pWpI[i]) * 2;
    const tx = pWp[o];
    const ty = pWp[o + 1];
    const dx = tx - pX[i];
    const dy = ty - pY[i];
    const dist = Math.hypot(dx, dy);
    if (dist > 1e-3) {
      pDx[i] = dx / dist;
      pDy[i] = dy / dist;
    }
    if (dist <= budget) {
      pX[i] = tx;
      pY[i] = ty;
      budget -= dist;
      pWpI[i]++;
    } else {
      pX[i] += (dx / dist) * budget;
      pY[i] += (dy / dist) * budget;
      budget = 0;
    }
  }
}

function arrive(i: number): void {
  switch (pEnd[i]) {
    case END_GATE:
      pWaiting[i] = 1;
      break;
    case END_UPSTREAM:
      upPulse = 0;
      pFade[i] = 9;
      pEnd[i] = END_FADE;
      break;
    case END_SOURCE:
      if (srcPulse > 0.12) srcPulse = 0;
      pActive[i] = 0;
      break;
    case END_RAIL:
      pFade[i] = 6;
      pEnd[i] = END_FADE;
      break;
    default:
      if (pFade[i] === 0) pFade[i] = 5;
  }
}

/* ------------------------------------------------------------------------ */
/* Drawing                                                                  */
/* ------------------------------------------------------------------------ */

function bandPath(ctx: CanvasRenderingContext2D, g: RailGeometry): void {
  const x0 = g.bandX0;
  const y0 = g.bandY0;
  const x1 = g.bandX1;
  const y1 = g.bandY1;
  const r = Math.min(g.bandR, (x1 - x0) / 2, (y1 - y0) / 2);
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0);
  ctx.lineTo(x1 - r, y0);
  ctx.arc(x1 - r, y0 + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x1, y1 - r);
  ctx.arc(x1 - r, y1 - r, r, 0, Math.PI / 2);
  ctx.lineTo(x0 + r, y1);
  ctx.arc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x0, y0 + r);
  ctx.arc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5);
}

function spriteFor(color: number): GlowSprite | null {
  return color === C_EMBER
    ? ember
    : color === C_PHOSPHOR
      ? phosphor
      : color === C_HI
        ? goldHi
        : gold;
}

function drawParticles(ctx: CanvasRenderingContext2D, g: RailGeometry, now: number): void {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Tails first (comets: their recent path; motes: a short streak), then glows, then cores.
  for (let pass = 0; pass < 4; pass++) {
    ctx.strokeStyle = TAIL[pass];
    for (let i = 0; i < poolSize; i++) {
      if (!pActive[i] || pColor[i] !== pass) continue;
      const a = pAlpha[i];
      if (pKind[i] === K_MOTE) {
        const len = g.compact ? 7 : 12;
        ctx.lineWidth = 1;
        ctx.globalAlpha = a * 0.5;
        ctx.beginPath();
        ctx.moveTo(pX[i] - pDx[i] * len, pY[i] - pDy[i] * len);
        ctx.lineTo(pX[i], pY[i]);
        ctx.stroke();
        continue;
      }
      const n = pHn[i];
      if (n === 0) continue;
      let px = pX[i];
      let py = pY[i];
      const base = (g.compact ? 1.8 : 2.6) * pSize[i];
      for (let j = 0; j < n; j++) {
        const at = i * HIST + ((pHead[i] - j + HIST) % HIST);
        const k = 1 - j / HIST;
        ctx.globalAlpha = a * 0.75 * k * k;
        ctx.lineWidth = Math.max(0.6, base * k);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(pHx[at], pHy[at]);
        ctx.stroke();
        px = pHx[at];
        py = pHy[at];
      }
    }
  }
  ctx.globalAlpha = 1;
  const glow = g.compact ? 20 : 32;
  for (let i = 0; i < poolSize; i++) {
    if (!pActive[i]) continue;
    const sprite = spriteFor(pColor[i]);
    if (!sprite) continue;
    const mote = pKind[i] === K_MOTE;
    let a = pAlpha[i] * (mote ? 0.4 : 0.95);
    // Waiting at the gate for the upstream's answer: a slow pulse.
    if (pWaiting[i]) a *= 0.7 + 0.3 * Math.sin(now / 140 + i);
    drawGlow(ctx, sprite, pX[i], pY[i], glow * pSize[i] * (mote ? 0.45 : 1), a);
  }
  for (let pass = 0; pass < 4; pass++) {
    ctx.fillStyle = CORE[pass];
    for (let i = 0; i < poolSize; i++) {
      if (!pActive[i] || pColor[i] !== pass) continue;
      const r = (g.compact ? 1.6 : 2.2) * pSize[i] * (pKind[i] === K_MOTE ? 0.6 : 1);
      ctx.globalAlpha = pAlpha[i];
      ctx.beginPath();
      ctx.arc(pX[i], pY[i], r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** The three client feeders into the hub (desktop only), faint guides under the motes. */
/**
 * While the visitor (or autoplay) holds the provider's 503 latch, faint rain
 * slants across the whole rail: the weather the breaker is reacting to.
 * Decorative, gold at low alpha; it fades in and out with the latch.
 */
function drawRain(ctx: CanvasRenderingContext2D, g: RailGeometry, down: boolean, dt: number) {
  storm += ((down ? 1 : 0) - storm) * Math.min(1, dt * (down ? 1.6 : 0.9));
  stormClock += dt;
  if (storm < 0.02) return;
  const span = g.w + 80;
  const fall = g.h + 40;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  for (let r = 0; r < RAIN; r++) {
    const o = r * 4;
    const speed = rain[o + 1];
    const len = rain[o + 2];
    // Each streak falls on a 1.4 s cycle (scaled by its speed), drifting sideways.
    const t = (stormClock * speed * 0.7 + rain[o]) % 1;
    const x = ((rain[o] * span + t * 90) % span) - 40;
    const y = t * fall - 20;
    ctx.globalAlpha = storm * rain[o + 3] * 0.35;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len * 0.22, y - len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** The client feeders into the hub (desktop only): faint guides that fade in from their origin nodes. */
function drawFeeders(ctx: CanvasRenderingContext2D, g: RailGeometry): void {
  if (g.compact) return;
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  ctx.strokeStyle = feederFade ?? GOLD;
  ctx.globalAlpha = 1;
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(FEED_X0, g.mid + side * FEED_DY);
    ctx.lineTo(FEED_X0 + 14, g.mid + side * (FEED_DY - 8));
    ctx.lineTo(g.srcX - 15, g.mid + side * 9);
    ctx.lineTo(g.srcX - g.srcR, g.mid);
    ctx.stroke();
  }
  // Origin nodes: one per client stream (top, middle on the arrival line, bottom).
  ctx.strokeStyle = GOLD;
  ctx.fillStyle = "rgb(10,10,12)";
  ctx.globalAlpha = 0.55;
  for (let f = 0; f < 3; f++) {
    ctx.beginPath();
    ctx.arc(FEED_X0, feederY(g, f), 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawStrikes(ctx: CanvasRenderingContext2D, dt: number): void {
  for (let s = 0; s < MAX_STRIKES; s++) {
    const st = strikes[s];
    if (!st) continue;
    st.age += dt;
    if (st.age >= 0.32) {
      strikes[s] = null;
      continue;
    }
    // 120 ms life, then a 200 ms afterglow.
    const k = st.age < 0.12 ? 1 : 1 - (st.age - 0.12) / 0.2;
    ctx.globalCompositeOperation = "lighter";
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? EMBER : PHOSPHOR;
      ctx.lineWidth = pass === 0 ? 7 : 1.5;
      ctx.globalAlpha = pass === 0 ? 0.25 * k : (st.age < 0.12 ? 0.95 : 0.5) * k;
      strokeFlat(ctx, st.shape.main);
      ctx.lineWidth = pass === 0 ? 4 : 1;
      for (let b = 0; b < st.shape.branches.length; b++) strokeFlat(ctx, st.shape.branches[b]);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (ember) drawGlow(ctx, ember, st.x, st.y, 54, 0.8 * k);
  }
}

function strokeFlat(ctx: CanvasRenderingContext2D, pts: Float32Array): void {
  if (pts.length < 4) return;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let p = 2; p < pts.length; p += 2) ctx.lineTo(pts[p], pts[p + 1]);
  ctx.stroke();
}

function drawRings(
  ctx: CanvasRenderingContext2D,
  g: RailGeometry,
  w: World,
  c: CandidateState,
  base: number
): void {
  ctx.lineWidth = g.compact ? 1.5 : 2;
  for (let k = 0; k < 3; k++) {
    const key = c.keys[k];
    if (!key || key.coolingUntilMs <= w.simMs) continue;
    // Measure the cooldown when it starts (its real length, also at the backoff cap).
    if (coolUntil[k] !== key.coolingUntilMs) {
      coolUntil[k] = key.coolingUntilMs;
      coolTotal[k] = Math.max(base, key.coolingUntilMs - w.simMs);
    }
    const left = Math.min(1, (key.coolingUntilMs - w.simMs) / coolTotal[k]);
    const cy = g.laneMid[k];
    ctx.strokeStyle = GOLD;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(g.laneX0, cy, g.ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = EMBER;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(g.laneX0, cy, g.ringR, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawEffects(
  ctx: CanvasRenderingContext2D,
  g: RailGeometry,
  opensAfter: number,
  dt: number
): void {
  // 401: the old lane flashes ember along its length.
  ctx.lineWidth = g.compact ? 2 : 3;
  ctx.strokeStyle = EMBER;
  for (let k = 0; k < 3; k++) {
    if (laneFlash[k] <= 0) continue;
    ctx.globalAlpha = laneFlash[k] * 0.55;
    ctx.beginPath();
    ctx.moveTo(g.laneX0, g.laneMid[k]);
    ctx.lineTo(g.laneEndX, g.laneMid[k]);
    ctx.stroke();
    laneFlash[k] = Math.max(0, laneFlash[k] - dt * 2.2);
  }
  ctx.globalAlpha = 1;
  // 429: a burst at the locked gate.
  for (let s = 0; s < 9; s++) {
    if (gateBurst[s] <= 0 || !ember) continue;
    drawGlow(
      ctx,
      ember,
      (g.gateX0 + g.gateX1) / 2,
      g.slotMid[s],
      g.compact ? 34 : 48,
      gateBurst[s]
    );
    gateBurst[s] = Math.max(0, gateBurst[s] - dt * 2.4);
  }
  // Breaker cells that just filled.
  for (let n = 0; n < opensAfter && n < cellPop.length; n++) {
    if (cellPop[n] <= 0 || !ember) continue;
    drawGlow(ctx, ember, cellCenterX(g, n, opensAfter), g.bandY0, g.compact ? 30 : 44, cellPop[n]);
    cellPop[n] = Math.max(0, cellPop[n] - dt * 1.8);
  }
  // Source and upstream pulses.
  if (srcPulse < 0.6) {
    const u = srcPulse / 0.6;
    ctx.strokeStyle = GOLD_HI;
    ctx.globalAlpha = (1 - u) * 0.55;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(g.srcX, g.mid, g.srcR + u * (g.compact ? 10 : 18), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  srcPulse += dt;
  if (upPulse < 0.7) {
    const u = upPulse / 0.7;
    ctx.strokeStyle = GOLD_HI;
    ctx.globalAlpha = (1 - u) * 0.7;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(g.upX, g.mid, g.upR + u * (g.compact ? 10 : 22), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (goldHi) drawGlow(ctx, goldHi, g.upX, g.mid, g.upR * 3, (1 - u) * 0.6);
  }
  upPulse += dt;
}

function drawRailGlow(ctx: CanvasRenderingContext2D, g: RailGeometry, open: boolean, dt: number) {
  let runners = false;
  for (let i = 0; i < poolSize; i++) {
    if (pActive[i] && pKind[i] === K_RUNNER && pY[i] >= g.fbY - 0.5) {
      runners = true;
      break;
    }
  }
  const target = open ? 1 : runners ? 0.7 : 0;
  railGlow += (target - railGlow) * Math.min(1, dt * (target > railGlow ? 8 : 2));
  if (railGlow < 0.01) return;
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = railGlow * 0.28;
  ctx.lineWidth = g.compact ? 5 : 7;
  ctx.beginPath();
  ctx.moveTo(g.dropX, g.mid + g.srcR);
  ctx.lineTo(g.dropX, g.fbY);
  ctx.lineTo(g.fbX1, g.fbY);
  ctx.stroke();
  ctx.strokeStyle = GOLD_HI;
  ctx.globalAlpha = railGlow * 0.85;
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function drawSweep(ctx: CanvasRenderingContext2D, g: RailGeometry, dt: number): void {
  if (sweep < 0) return;
  sweep += dt / 1.2;
  if (sweep >= 1) {
    sweep = -1;
    return;
  }
  const perimeter = bandPerimeter(g);
  const seg = perimeter * 0.16;
  const ease = 1 - Math.pow(1 - sweep, 2);
  const fade = sweep < 0.8 ? 1 : (1 - sweep) / 0.2;
  bandPath(ctx, g);
  dash[0] = seg;
  dash[1] = perimeter;
  ctx.setLineDash(dash);
  ctx.lineDashOffset = -ease * perimeter;
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = 0.35 * fade;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.strokeStyle = GOLD_HI;
  ctx.globalAlpha = 0.95 * fade;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.setLineDash(noDash);
  ctx.lineDashOffset = 0;
  ctx.globalCompositeOperation = "source-over";
}

/* ------------------------------------------------------------------------ */
/* Frame                                                                    */
/* ------------------------------------------------------------------------ */

export function draw(
  ctx: CanvasRenderingContext2D,
  s: StageSize,
  dt: number,
  now: number,
  input: StormInput
): void {
  if (!geo || geo.w !== s.w) setup(ctx, s, input);
  const g = geo;
  if (!g) return;
  ctx.setTransform(input.rtl ? -s.dpr : s.dpr, 0, 0, s.dpr, input.rtl ? s.w * s.dpr : 0, 0);
  ctx.clearRect(0, 0, s.w, s.h);

  const w = getWorld();
  const c = findFocus(w, input.focus);
  if (!c) return;
  // The rail only moves while its time-lapse runs (it starts before the canvas does,
  // ahead of the canvas's own margin), so its pace is the lapsed one.
  const speed = railSpeed(w.speed, true);
  const pace = cometPace(speed);
  if (lastFocus !== c.id) {
    retarget(c, w, input);
    warmPending = true;
  }
  // Back on screen after the deck ran on without us: catch up silently, no burst of effects.
  if (lastSimMs >= 0 && w.simMs - lastSimMs > RESYNC_SIM_MS) {
    lastState = c.breaker.state;
    lastFailures = c.breaker.failures;
    lastRequestId = w.nextRequestId;
    nextMoteId = w.nextRequestId;
    strikesOwed = 0;
    warmPending = true;
  }
  lastSimMs = w.simMs;
  // On the first moving frame (a still paint at setup comes before the rail is on screen).
  if (warmPending && dt > 0) {
    warmPending = false;
    seedRecent(w, c, g, speed, pace, input);
  }
  const profile = breakerProfile(c.profile);
  const state = c.breaker.state;

  // Breaker transitions.
  if (state !== lastState) {
    if (state === "open") flash(input, now);
    if (state === "closed" && lastState !== "degraded") sweep = 0;
    lastState = state;
  }

  // Requests.
  if (dt > 0) {
    trackAttempts(w, c, g, pace);
    spawnArrivals(w, c, g, pace);
    if (state === "closed" || state === "degraded") decayShare(share, dt);
  } else {
    lastRequestId = w.nextRequestId;
    nextMoteId = Math.max(nextMoteId, w.nextRequestId);
  }

  // Failures counted by the breaker: a cell pops; a strike with no comet to carry it lands on the cell.
  const failures = c.breaker.failures;
  if (failures > lastFailures) {
    for (let n = lastFailures; n < failures; n++) {
      const cell = Math.min(n, profile.opensAfter - 1);
      if (cell >= 0 && cell < cellPop.length) cellPop[cell] = 1;
      if (strikesOwed > 0) continue;
      if (dt > 0 && state !== "open") {
        const x = cellCenterX(g, Math.max(0, cell), profile.opensAfter);
        strike(x + (rng() * 2 - 1) * 30, 0, x, g.bandY0);
      }
    }
  }
  lastFailures = failures;

  // Motion.
  for (let i = 0; i < poolSize; i++) {
    if (!pActive[i]) continue;
    pAge[i] += dt;
    if (pKind[i] === K_ATTEMPT) playOutcomes(i, g, input);
    if (!pWaiting[i]) {
      move(i, dt, g.compact ? 4 : 6);
      // On the fallback rail a failed request turns gold: the next target serves it.
      if (pKind[i] === K_RUNNER && pY[i] >= g.fbY - 0.5) pColor[i] = C_HI;
      if (pWpI[i] >= pWpN[i]) arrive(i);
      if (pKind[i] === K_ATTEMPT && pActive[i]) playOutcomes(i, g, input);
    } else if (pAge[i] > 14) {
      pFade[i] = Math.max(pFade[i], 4);
    }
    if (!pRef[i] && pKind[i] === K_ATTEMPT && pPendN[i] === 0 && pWaiting[i]) {
      // Its request vanished without an outcome we could follow (e.g. a reset): let it go.
      pFade[i] = Math.max(pFade[i], 4);
    }
    if (pFade[i] > 0) {
      pAlpha[i] -= pFade[i] * dt;
      if (pAlpha[i] <= 0) {
        pActive[i] = 0;
        pRef[i] = null;
      }
    }
  }

  // Paint, back to front.
  drawRain(ctx, g, c.upstreamDown, dt);
  drawFeeders(ctx, g);
  drawRailGlow(ctx, g, state === "open", dt);
  drawSweep(ctx, g, dt);
  drawRings(ctx, g, w, c, profile.cooldownBaseMs);
  drawEffects(ctx, g, profile.opensAfter, dt);
  drawParticles(ctx, g, now);
  drawStrikes(ctx, dt);
}
