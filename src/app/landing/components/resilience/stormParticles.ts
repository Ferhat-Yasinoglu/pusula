/**
 * The storm rail's particle pool, driven by `stormRender.ts`: every comet,
 * mote and runner lives in these typed arrays, indexed by slot, so a frame
 * allocates nothing. Also the codes that describe a particle (its kind, what
 * happens when it runs out of waypoints, its colour, the outcomes queued on
 * an attempt) and the per-particle primitives the renderer works with:
 * spawning, waypoints, queued outcomes, the comet tail, the routes through
 * the rail, and motion along them. Nothing here draws, reads the deck or
 * touches the renderer's effects.
 */
import type { InflightRequest } from "../../sim/landingSim";
import type { RailGeometry } from "./stormModel";

/* ------------------------------------------------------------------------ */
/* Pools                                                                    */
/* ------------------------------------------------------------------------ */

export const MAX = 120;
export const MAX_COMPACT = 70;
const WP_MAX = 6;
/** A failed comet hurries back to the hub. */
const RETREAT_BOOST = 1.6;
export const PEND_MAX = 4;

// Particle kinds.
export const K_ATTEMPT = 1;
export const K_MOTE = 2;
export const K_RUNNER = 3;
// What happens when a particle runs out of waypoints.
export const END_FADE = 0;
export const END_GATE = 1;
export const END_UPSTREAM = 2;
export const END_SOURCE = 3;
export const END_RAIL = 4;
// Colours.
export const C_GOLD = 0;
export const C_HI = 1;
export const C_PHOSPHOR = 2;
export const C_EMBER = 3;
// Outcomes queued on an attempt.
export const O_SERVED = 1;
export const O_RETRY_KEY = 2;
export const O_RETRY_MODEL = 3;
export const O_FAIL_503 = 4;
export const O_FAIL_OTHER = 5;

export const pActive = new Uint8Array(MAX);
export const pKind = new Uint8Array(MAX);
export const pEnd = new Uint8Array(MAX);
export const pColor = new Uint8Array(MAX);
export const pWaiting = new Uint8Array(MAX);
export const pX = new Float32Array(MAX);
export const pY = new Float32Array(MAX);
export const pDx = new Float32Array(MAX);
export const pDy = new Float32Array(MAX);
const pSpeed = new Float32Array(MAX);
export const pAlpha = new Float32Array(MAX);
export const pFade = new Float32Array(MAX);
export const pSize = new Float32Array(MAX);
export const pAge = new Float32Array(MAX);
export const pLane = new Int8Array(MAX);
export const pModel = new Int8Array(MAX);
const pWp = new Float32Array(MAX * WP_MAX * 2);
export const pWpN = new Uint8Array(MAX);
export const pWpI = new Uint8Array(MAX);
// Tracking a deck request (attempts only).
export const pRef: (InflightRequest | null)[] = new Array<InflightRequest | null>(MAX).fill(null);
export const pSeen = new Uint8Array(MAX);
export const pStart = new Float64Array(MAX);
export const pTriedK = new Uint8Array(MAX);
export const pTriedM = new Uint8Array(MAX);
export const pFailN = new Uint8Array(MAX);
export const pPend = new Uint8Array(MAX * PEND_MAX);
export const pPendK = new Int8Array(MAX * PEND_MAX);
export const pPendM = new Int8Array(MAX * PEND_MAX);
export const pPendN = new Uint8Array(MAX);
// Comet tails: a short ring of past positions, sampled by distance, so a tail bends round corners.
export const HIST = 9;
export const pHx = new Float32Array(MAX * HIST);
export const pHy = new Float32Array(MAX * HIST);
export const pHn = new Uint8Array(MAX);
export const pHead = new Uint8Array(MAX);

/**
 * Slots in use: fewer on the compact (phone) rail. The renderer's loops read
 * it live; its `setup` sets it per layout.
 */
export let poolSize = MAX;

export function setPoolSize(size: number): void {
  poolSize = size;
}

/* ------------------------------------------------------------------------ */
/* Particle helpers                                                         */
/* ------------------------------------------------------------------------ */

function alloc(): number {
  for (let i = 0; i < poolSize; i++) if (!pActive[i]) return i;
  return -1;
}

export function spawn(
  kind: number,
  x: number,
  y: number,
  color: number,
  speed: number,
  size: number
) {
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

export function wpPush(i: number, x: number, y: number): void {
  const n = pWpN[i];
  if (n >= WP_MAX) return;
  const o = (i * WP_MAX + n) * 2;
  pWp[o] = x;
  pWp[o + 1] = y;
  pWpN[i] = n + 1;
}

/** Which leg of the route the particle is on (0 = before its first waypoint). */
export function leg(i: number): number {
  return pWpI[i];
}

export function pendPush(i: number, code: number, key: number, model: number): void {
  const n = pPendN[i];
  if (n >= PEND_MAX) return;
  const o = i * PEND_MAX + n;
  pPend[o] = code;
  pPendK[o] = key;
  pPendM[o] = model;
  pPendN[i] = n + 1;
}

export function pendShift(i: number): void {
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
export function routeToGate(i: number, g: RailGeometry, key: number, model: number): void {
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
export function hopLane(i: number, g: RailGeometry, key: number, model: number): void {
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
export function bounceGate(i: number, g: RailGeometry, key: number, model: number): void {
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
export function routeServed(i: number, g: RailGeometry): void {
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
export function routeFallback(i: number, g: RailGeometry): void {
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
/* Motion                                                                   */
/* ------------------------------------------------------------------------ */

/** Advance along the waypoints by `speed × dt` (comets first sample their tail). */
export function move(i: number, dt: number, tailStep: number): void {
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
