/**
 * The Deck: a seeded, deterministic model of the gateway that drives every
 * instrument on the landing page — the hero's needle, the map's flights, the
 * resilience rail, the footer logbook. It is labelled as a simulation wherever
 * it is shown; what it simulates is the real resilience contract, rule for
 * rule, so the page never depicts behaviour the gateway does not have:
 *
 * - Scoring: Σ wᵢ·mᵢ over the real `DEFAULT_WEIGHTS` (`calculateScore`,
 *   `open-sse/services/autoCombo/scoring.ts`); health is derived from breaker
 *   state exactly as `calculateFactors` does (CLOSED 1, HALF_OPEN .5) after
 *   `combo.ts` folds DEGRADED into CLOSED; OPEN providers are not attempted
 *   (`canExecute()` is false).
 * - Provider breaker: `CircuitBreaker` in `src/shared/utils/circuitBreaker.ts`
 *   (`_onFailure`, `_onSuccess`, `_refreshOpenState`) with the per-profile
 *   thresholds of `PROVIDER_PROFILES` (`open-sse/config/constants.ts`), carried
 *   client-side by `BREAKER_PROFILES` and pinned by `landing-stats.test.ts`.
 *   Only upstream failures (503) count; 401 and 429 never touch it.
 * - Connection cooldown: `markAccountUnavailable` in `src/sse/services/auth.ts`,
 *   including its anti-thundering-herd guard (a failure on a key that is
 *   already cooling is ignored: no extension, no level increment), with the
 *   `base · 2^level` backoff of `checkFallbackError`. Requests arrive in
 *   batches (an agent's parallel calls) that share one session, and session
 *   stickiness (`open-sse/services/combo/sessionStickiness.ts`) pins a session
 *   to one connection — so concurrent failures on one key happen naturally.
 * - Model lockout: `lockModel` in `open-sse/services/accountFallback.ts`
 *   (sibling models keep serving; a longer lock wins). The 6 s duration is
 *   illustrative and is never displayed.
 * - Fallback: the hub retries the next target in the request's ranking and
 *   counts it in `X-Pusula-Fallback-Attempts`.
 *
 * Pure TypeScript — no React, no DOM, no clock, no `Math.random`. The world is
 * plain mutable data advanced by `step()` from the page heartbeat's fixed
 * 100 ms sim lane (or by `advance()` synchronously under reduced motion). Two
 * worlds created with the same seed and given the same actions at the same
 * sim times produce identical event logs (pinned by `landing-sim.test.ts`).
 * The data shapes (world, candidates, requests, events) live in
 * `landingSimTypes.ts` and are re-exported here.
 */
import { BREAKER_PROFILES, SAMPLE_CANDIDATES } from "../landingTypes";
import { mulberry32Next, mulberry32Value } from "./prng";
import {
  HEALTH_FACTOR_ID,
  LIVE_FACTOR_IDS,
  SAMPLE_KEYS,
  isCandidateId,
  measurement,
  type CandidateId,
  type SampleKey,
} from "./sampleTable";
import type {
  BreakerProfile,
  BreakerSnapshot,
  BreakerState,
  CandidateState,
  ClientId,
  DeckEvent,
  FailCode,
  InflightRequest,
  ProfileId,
  RankEntry,
  Speed,
  World,
} from "./landingSimTypes";

export type { CandidateId, SampleKey } from "./sampleTable";
export { CANDIDATE_IDS, SAMPLE_KEYS, SAMPLES } from "./sampleTable";
export type {
  BreakerProfile,
  BreakerState,
  CandidateState,
  ClientId,
  DeckEvent,
  FailCode,
  Featured,
  InflightRequest,
  ProfileId,
  RankEntry,
  Speed,
  World,
} from "./landingSimTypes";

/* ------------------------------------------------------------------------ */
/* Constants                                                                */
/* ------------------------------------------------------------------------ */

/** "seyir", as close as hex allows. Used when no seed is given (SSR and first paint). */
export const DEFAULT_SEED = 0x5e71;
/** The heartbeat's fixed sim step, in real milliseconds. */
export const STEP_MS = 100;
export const SPEEDS: readonly Speed[] = [1, 5, 10];
export const KEYS_PER_CANDIDATE = 3;
export const MODELS_PER_CANDIDATE = 3;
export const EVENT_BUFFER = 64;
/** Seeded latency of one attempt, in sim milliseconds. */
export const LATENCY_MS: readonly [number, number] = [300, 900];
/** Gap between request batches; with `BATCH_SIZE_WEIGHTS` this averages ~4.5 req/s. */
export const BATCH_GAP_MS: readonly [number, number] = [400, 700];
/** Weights for a batch of 1, 2, 3 or 4 requests (an agent's parallel calls). */
export const BATCH_SIZE_WEIGHTS: readonly number[] = [0.2, 0.3, 0.3, 0.2];
/** Illustrative model lockout. Never displayed. */
export const MODEL_LOCKOUT_MS = 6000;
/** Backoff level cap for the illustration (`base · 2^level`, so at most 8 × base). */
export const MAX_BACKOFF_LEVEL = 3;
/** Amplitude of the per-request telemetry offset on the live factors (quota, latency). */
export const TELEMETRY_JITTER = 0.35;
/** Full sim seconds averaged into `World.reqPerSec`. */
export const RATE_WINDOWS = 5;

/**
 * The `health` factor per breaker state, as `calculateFactors` computes it
 * (CLOSED 1, HALF_OPEN .5, OPEN 0) after `combo.ts` maps DEGRADED to CLOSED.
 * OPEN candidates are excluded from `rank()` altogether.
 */
export const HEALTH_BY_STATE: Readonly<Record<BreakerState, number>> = {
  closed: 1,
  degraded: 1,
  halfOpen: 0.5,
  open: 0,
};

const CLIENT_EDGES: readonly ClientId[] = ["edge0", "edge1", "edge2", "edge3"];

const SAMPLE_INDEX: Readonly<Record<SampleKey, number>> = Object.fromEntries(
  SAMPLE_KEYS.map((key, i) => [key, i])
) as Record<SampleKey, number>;

/* ------------------------------------------------------------------------ */
/* Profiles, weights, randomness                                            */
/* ------------------------------------------------------------------------ */

export function breakerProfile(id: ProfileId): BreakerProfile {
  for (const p of BREAKER_PROFILES) {
    if (p.id === id) {
      return {
        id: p.id,
        opensAfter: p.opensAfter,
        resetSeconds: p.resetSeconds,
        degradesAfter: p.degradesAfter,
        cooldownBaseMs: p.cooldownBaseMs,
      };
    }
  }
  throw new Error(`landingSim: unknown breaker profile ${id}`);
}

/** Cached per profile: the hot path reads thresholds on every attempt. */
const PROFILE_CACHE = new Map<ProfileId, BreakerProfile>();
function profileOf(c: CandidateState): BreakerProfile {
  let p = PROFILE_CACHE.get(c.profile);
  if (!p) {
    p = breakerProfile(c.profile);
    PROFILE_CACHE.set(c.profile, p);
  }
  return p;
}

/**
 * Mirrors `normalizeScoringWeights`: a non-finite or negative weight becomes 0,
 * an all-zero vector falls back to the defaults, and the result is divided by
 * its sum. The output has `defaults.length` entries; missing raw entries are 0.
 */
export function normalizeWeights(raw: readonly number[], defaults: readonly number[]): number[] {
  const n = defaults.length;
  const out = new Array<number>(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const value = Number(raw[i]);
    out[i] = Number.isFinite(value) && value >= 0 ? value : 0;
    total += out[i];
  }
  if (total > 0) {
    for (let i = 0; i < n; i++) out[i] /= total;
    return out;
  }
  let defaultTotal = 0;
  for (let i = 0; i < n; i++) {
    const value = Number(defaults[i]);
    out[i] = Number.isFinite(value) && value >= 0 ? value : 0;
    defaultTotal += out[i];
  }
  if (defaultTotal > 0) for (let i = 0; i < n; i++) out[i] /= defaultTotal;
  return out;
}

function rand(w: World): number {
  w.rngState = mulberry32Next(w.rngState);
  return mulberry32Value(w.rngState);
}

function randRange(w: World, [min, max]: readonly [number, number]): number {
  return min + (max - min) * rand(w);
}

function pickClient(w: World): ClientId {
  const r = rand(w);
  if (r < 0.45) return "ghazni";
  if (r < 0.8) return "faizabad";
  return CLIENT_EDGES[Math.min(3, Math.floor(((r - 0.8) / 0.2) * 4))];
}

function pickBatchSize(w: World): number {
  let r = rand(w);
  for (let i = 0; i < BATCH_SIZE_WEIGHTS.length; i++) {
    r -= BATCH_SIZE_WEIGHTS[i];
    if (r < 0) return i + 1;
  }
  return BATCH_SIZE_WEIGHTS.length;
}

/* ------------------------------------------------------------------------ */
/* World                                                                    */
/* ------------------------------------------------------------------------ */

function freshBreaker(): BreakerSnapshot {
  return { state: "closed", failures: 0, openedAtMs: null, probeInFlight: false, generation: 0 };
}

function buildCandidates(): CandidateState[] {
  const out: CandidateState[] = [];
  for (const entry of SAMPLE_CANDIDATES) {
    const id = entry.id as CandidateId;
    if (!isCandidateId(id)) throw new Error(`landingSim: unknown sample candidate ${entry.id}`);
    out.push({
      id,
      catalogId: entry.catalogId,
      profile: entry.profile as ProfileId,
      upstreamDown: false,
      breaker: freshBreaker(),
      keys: Array.from({ length: KEYS_PER_CANDIDATE }, () => ({
        revoked: false,
        coolingUntilMs: 0,
        level: 0,
      })),
      models: Array.from({ length: MODELS_PER_CANDIDATE }, () => ({
        rateLimited: false,
        lockedUntilMs: 0,
      })),
      served: 0,
      keyCursor: 0,
      modelCursor: 0,
    });
  }
  return out;
}

function buildMeasure(factorIds: readonly string[], candidates: readonly CandidateState[]) {
  const F = factorIds.length;
  const C = candidates.length;
  const m = new Float64Array(SAMPLE_KEYS.length * C * F);
  for (let s = 0; s < SAMPLE_KEYS.length; s++) {
    for (let c = 0; c < C; c++) {
      for (let f = 0; f < F; f++) {
        m[(s * C + c) * F + f] =
          factorIds[f] === HEALTH_FACTOR_ID
            ? Number.NaN
            : measurement(SAMPLE_KEYS[s], candidates[c].id, factorIds[f]);
      }
    }
  }
  return m;
}

/**
 * A fresh world at tick 0. Deterministic: no clock and no global randomness,
 * so the server snapshot and the client's first world are identical. The
 * featured take is the first sample's ranking, routed to its leader.
 */
export function createWorld(input: {
  factorIds: readonly string[];
  defaults: readonly number[];
  seed?: number;
}): World {
  if (input.factorIds.length !== input.defaults.length) {
    throw new Error("landingSim: factorIds and defaults must have the same length");
  }
  const seed = (input.seed ?? DEFAULT_SEED) | 0;
  const candidates = buildCandidates();
  const factorIds = [...input.factorIds];
  const defaults = [...input.defaults];
  const w: World = {
    seed,
    tick: 0,
    simMs: 0,
    speed: 1,
    factorIds,
    defaults,
    weights: normalizeWeights(defaults, defaults),
    candidates,
    inflight: [],
    featured: {
      take: 0,
      sample: SAMPLE_KEYS[0],
      ranking: [],
      attempts: [],
      winner: candidates[0].id,
      fallbackAttempts: 0,
      codes: [],
      served: true,
    },
    totals: { routed: 0, rerouted: 0, fallbacks: 0, dropped: 0 },
    session: { outagesCaused: 0 },
    events: [],
    eventSeq: 0,
    rev: 0,
    reqPerSec: 0,
    batches: 0,
    rngState: seed,
    nextBatchMs: 0,
    nextRequestId: 1,
    rateWindowStartMs: 0,
    rateWindowCount: 0,
    rateHistory: new Uint16Array(RATE_WINDOWS),
    rateWindowsClosed: 0,
    measure: buildMeasure(factorIds, candidates),
    jitter: new Float64Array(candidates.length * LIVE_FACTOR_IDS.length),
    liveIndex: Int8Array.from(factorIds, (id) =>
      (LIVE_FACTOR_IDS as readonly string[]).indexOf(id)
    ),
    batchKey: new Int8Array(candidates.length).fill(-1),
  };
  const ranking = rank(w, SAMPLE_KEYS[0]);
  w.featured.ranking = ranking;
  if (ranking.length > 0) {
    w.featured.winner = ranking[0].id;
    w.featured.attempts = [ranking[0].id];
  }
  w.nextBatchMs = randRange(w, BATCH_GAP_MS);
  return w;
}

export function candidate(w: World, id: CandidateId): CandidateState {
  for (const c of w.candidates) if (c.id === id) return c;
  throw new Error(`landingSim: no candidate ${id}`);
}

/** Index of a candidate in `w.candidates` (−1 if absent); a plain loop, no closure per call. */
function candidateIndex(w: World, id: CandidateId): number {
  for (let i = 0; i < w.candidates.length; i++) if (w.candidates[i].id === id) return i;
  return -1;
}

/* ------------------------------------------------------------------------ */
/* Events                                                                   */
/* ------------------------------------------------------------------------ */

type EventBody = DeckEvent extends infer E
  ? E extends DeckEvent
    ? Omit<E, "n" | "t">
    : never
  : never;

function emit(w: World, body: EventBody): void {
  const event = { ...body, n: w.eventSeq++, t: w.simMs } as DeckEvent;
  w.events.push(event);
  // `shift`, not `splice`: dropping the oldest event must not allocate a removed-items array.
  while (w.events.length > EVENT_BUFFER) w.events.shift();
}

/* ------------------------------------------------------------------------ */
/* Breaker, cooldown, lockout                                               */
/* ------------------------------------------------------------------------ */

function transition(w: World, c: CandidateState, state: BreakerState): void {
  const b = c.breaker;
  if (b.state === state) return;
  b.state = state;
  b.probeInFlight = false;
  b.generation++;
  emit(w, { kind: "breaker", id: c.id, state });
}

/**
 * `CircuitBreaker._onFailure` for an upstream failure: count it, stamp the
 * failure time, then CLOSED → DEGRADED → OPEN at the profile's thresholds, or
 * HALF_OPEN → OPEN when the probe fails. Exported for tests.
 */
export function recordFailure(w: World, c: CandidateState): void {
  const p = profileOf(c);
  const b = c.breaker;
  b.failures++;
  if (b.state === "open") {
    // Already open: only the failure time moves, as `lastFailureTime` does.
    b.openedAtMs = w.simMs;
    return;
  }
  if (b.state === "halfOpen") {
    b.openedAtMs = w.simMs;
    transition(w, c, "open");
    return;
  }
  if (b.failures >= p.opensAfter) {
    b.openedAtMs = w.simMs;
    transition(w, c, "open");
  } else if (b.state === "closed" && p.degradesAfter !== null && b.failures >= p.degradesAfter) {
    transition(w, c, "degraded");
  }
}

/**
 * `CircuitBreaker._onSuccess`: OPEN or HALF_OPEN → CLOSED with the count reset;
 * CLOSED/DEGRADED decay the count by one (gradual recovery) and DEGRADED
 * closes once the count is back at or under the degradation threshold.
 * Exported for tests.
 */
export function recordSuccess(w: World, c: CandidateState): void {
  const p = profileOf(c);
  const b = c.breaker;
  if (b.state === "open" || b.state === "halfOpen") {
    b.failures = 0;
    transition(w, c, "closed");
    return;
  }
  b.failures = Math.max(0, b.failures - 1);
  if (b.state === "degraded" && b.failures <= (p.degradesAfter ?? p.opensAfter)) {
    transition(w, c, "closed");
  }
}

/**
 * `markAccountUnavailable` for a 401 on one key. A key that is already cooling
 * is left alone (the anti-thundering-herd guard) and the failure is reported
 * as ignored; otherwise it cools for `base · 2^level` and its level rises.
 * Never touches the provider breaker. Exported for tests.
 */
export function recordKeyFailure(w: World, c: CandidateState, key: number): void {
  const k = c.keys[key];
  if (!k) return;
  if (k.coolingUntilMs > w.simMs) {
    emit(w, { kind: "ignored", id: c.id, key });
    return;
  }
  k.coolingUntilMs = w.simMs + profileOf(c).cooldownBaseMs * 2 ** k.level;
  k.level = Math.min(MAX_BACKOFF_LEVEL, k.level + 1);
  emit(w, { kind: "cooldown", id: c.id, key, level: k.level, untilMs: k.coolingUntilMs });
}

/** A success on a key clears its backoff (`clearAccountError`). Exported for tests. */
export function recordKeySuccess(c: CandidateState, key: number): void {
  const k = c.keys[key];
  if (k) k.level = 0;
}

/**
 * `lockModel` for a 429 on one model: lock it, keeping the longer lock if one
 * is already running. Emits `lockout` only when the model was not locked.
 * Never touches the provider breaker. Exported for tests.
 */
export function recordModelLimit(w: World, c: CandidateState, model: number): void {
  const m = c.models[model];
  if (!m) return;
  const wasLocked = m.lockedUntilMs > w.simMs;
  m.lockedUntilMs = Math.max(m.lockedUntilMs, w.simMs + MODEL_LOCKOUT_MS);
  if (!wasLocked) emit(w, { kind: "lockout", id: c.id, model });
}

/** `CircuitBreaker.canExecute()`: CLOSED/DEGRADED yes, OPEN no, HALF_OPEN once. */
export function canExecute(c: CandidateState): boolean {
  const s = c.breaker.state;
  if (s === "closed" || s === "degraded") return true;
  if (s === "halfOpen") return !c.breaker.probeInFlight;
  return false;
}

/** Next key in round-robin order that is not cooling (and not in the `exclude` bitmask). */
function freeKey(w: World, c: CandidateState, exclude = 0): number {
  for (let i = 0; i < c.keys.length; i++) {
    const k = (c.keyCursor + i) % c.keys.length;
    if (c.keys[k].coolingUntilMs <= w.simMs && !(exclude & (1 << k))) return k;
  }
  return -1;
}

/** Next model in round-robin order that is not locked (and not in the `exclude` bitmask). */
function freeModel(w: World, c: CandidateState, exclude = 0): number {
  for (let i = 0; i < c.models.length; i++) {
    const m = (c.modelCursor + i) % c.models.length;
    if (c.models[m].lockedUntilMs <= w.simMs && !(exclude & (1 << m))) return m;
  }
  return -1;
}

/** Can a request be sent to this candidate right now (breaker admits it, a key and a model are free)? */
export function isAvailable(w: World, c: CandidateState): boolean {
  return canExecute(c) && freeKey(w, c) >= 0 && freeModel(w, c) >= 0;
}

/** Milliseconds of sim time until an OPEN breaker half-opens, or null when it is not open. */
export function probeInMs(w: World, id: CandidateId): number | null {
  const c = candidate(w, id);
  if (c.breaker.state !== "open" || c.breaker.openedAtMs === null) return null;
  return Math.max(0, c.breaker.openedAtMs + profileOf(c).resetSeconds * 1000 - w.simMs);
}

/* ------------------------------------------------------------------------ */
/* Scoring                                                                  */
/* ------------------------------------------------------------------------ */

const LIVE_COUNT = LIVE_FACTOR_IDS.length;

function clamp01(value: number): number {
  return value > 1 ? 1 : value > 0 ? value : 0;
}

/** Σ wᵢ·mᵢ for one candidate; `jitter` perturbs the live factors (background traffic only). */
function scoreOf(w: World, s: number, ci: number, jitter: Float64Array | null): number {
  const F = w.factorIds.length;
  const base = (s * w.candidates.length + ci) * F;
  const health = HEALTH_BY_STATE[w.candidates[ci].breaker.state];
  let total = 0;
  for (let f = 0; f < F; f++) {
    const weight = w.weights[f];
    if (weight === 0) continue;
    let value = w.measure[base + f];
    if (Number.isNaN(value)) {
      value = health;
    } else if (jitter && w.liveIndex[f] >= 0) {
      value = clamp01(value + jitter[ci * LIVE_COUNT + w.liveIndex[f]]);
    }
    total += weight * value;
  }
  return clamp01(total);
}

function sortRanking(entries: RankEntry[]): RankEntry[] {
  return entries.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The auto ranking for a sample: Σ wᵢ·mᵢ with the world's weights, health from
 * live breaker state, OPEN candidates excluded, ties broken by id.
 */
export function rank(w: World, sample: SampleKey): RankEntry[] {
  const s = SAMPLE_INDEX[sample] ?? 0;
  const out: RankEntry[] = [];
  for (let ci = 0; ci < w.candidates.length; ci++) {
    if (w.candidates[ci].breaker.state === "open") continue;
    out.push({ id: w.candidates[ci].id, score: scoreOf(w, s, ci, null) });
  }
  return sortRanking(out);
}

/**
 * The measurements behind a candidate's score for a sample, in `factorIds`
 * order, with health filled in from its breaker (the rose's inner fills).
 */
export function measurements(w: World, sample: SampleKey, id: CandidateId): number[] {
  const s = SAMPLE_INDEX[sample] ?? 0;
  const ci = candidateIndex(w, id);
  const F = w.factorIds.length;
  const out = new Array<number>(F);
  if (ci < 0) return out.fill(0);
  const base = (s * w.candidates.length + ci) * F;
  const health = HEALTH_BY_STATE[w.candidates[ci].breaker.state];
  for (let f = 0; f < F; f++) {
    const value = w.measure[base + f];
    out[f] = Number.isNaN(value) ? health : value;
  }
  return out;
}

/** The order background traffic walks: one telemetry snapshot per routing instant. */
function liveOrder(w: World, s: number): CandidateId[] {
  const entries: RankEntry[] = [];
  for (let ci = 0; ci < w.candidates.length; ci++) {
    if (w.candidates[ci].breaker.state === "open") continue;
    entries.push({ id: w.candidates[ci].id, score: scoreOf(w, s, ci, w.jitter) });
  }
  return sortRanking(entries).map((e) => e.id);
}

/* ------------------------------------------------------------------------ */
/* Requests                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * The outcome of one attempt at `w.simMs`, with its side effects applied:
 * 503 when the upstream is down (provider breaker), else 401 on a revoked key
 * (connection cooldown), else 429 on a rate-limited model (model lockout),
 * else 0 (served). `probeGeneration` ≥ 0 marks the half-open probe; its result
 * only reaches the breaker if no transition happened since it started.
 */
function resolveAttempt(
  w: World,
  c: CandidateState,
  key: number,
  model: number,
  probeGeneration: number
): FailCode | 0 {
  const countsForBreaker = probeGeneration < 0 || probeGeneration === c.breaker.generation;
  if (c.upstreamDown) {
    if (countsForBreaker) recordFailure(w, c);
    return 503;
  }
  if (c.keys[key]?.revoked) {
    recordKeyFailure(w, c, key);
    return 401;
  }
  if (c.models[model]?.rateLimited) {
    recordModelLimit(w, c, model);
    return 429;
  }
  recordKeySuccess(c, key);
  if (countsForBreaker) recordSuccess(w, c);
  return 0;
}

/**
 * Pick a free key (round-robin, or `preferKey` when the session is pinned to
 * it and it is not cooling) and a free model (round-robin over unlocked ones).
 * Keys and models a request already tried on this target are excluded: account
 * and model fallback try each sibling once.
 */
function claimKeyAndModel(
  w: World,
  c: CandidateState,
  preferKey = -1,
  triedKeys = 0,
  triedModels = 0
): [number, number] | null {
  const pinnedKey = preferKey >= 0 ? c.keys[preferKey] : undefined;
  const pinned =
    pinnedKey !== undefined &&
    pinnedKey.coolingUntilMs <= w.simMs &&
    !(triedKeys & (1 << preferKey));
  const key = pinned ? preferKey : freeKey(w, c, triedKeys);
  const model = freeModel(w, c, triedModels);
  if (key < 0 || model < 0) return null;
  if (!pinned) c.keyCursor = (key + 1) % c.keys.length;
  c.modelCursor = (model + 1) % c.models.length;
  return [key, model];
}

/** Admit the attempt through the breaker; returns the probe generation or −1. */
function admit(c: CandidateState): number {
  if (c.breaker.state !== "halfOpen") return -1;
  c.breaker.probeInFlight = true;
  return c.breaker.generation;
}

function countRequest(w: World): void {
  w.rateWindowCount++;
}

function finishServed(
  w: World,
  req: {
    from: ClientId;
    sample: SampleKey;
    failed: CandidateId[];
    codes: FailCode[];
  },
  to: CandidateState,
  probe: boolean,
  featured: boolean
): void {
  to.served++;
  w.totals.routed++;
  if (req.failed.length > 0) w.totals.rerouted++;
  w.totals.fallbacks += req.failed.length;
  emit(w, {
    kind: "routed",
    from: req.from,
    sample: req.sample,
    failed: req.failed,
    codes: req.codes,
    to: to.id,
    probe,
    featured,
  });
}

function finishDropped(
  w: World,
  req: { from: ClientId; sample: SampleKey; failed: CandidateId[]; codes: FailCode[] },
  featured: boolean
): void {
  w.totals.dropped++;
  w.totals.fallbacks += req.failed.length;
  emit(w, {
    kind: "dropped",
    from: req.from,
    sample: req.sample,
    failed: req.failed,
    codes: req.codes,
    featured,
  });
}

/**
 * Start the request's next attempt along its order; false when nothing is left.
 * `sticky`: the request is part of the batch being dispatched, whose session is
 * pinned to one key per provider.
 */
function startAttempt(w: World, req: InflightRequest, sticky = false): boolean {
  while (req.cursor < req.order.length) {
    const ci = candidateIndex(w, req.order[req.cursor]);
    const c = w.candidates[ci];
    if (c && canExecute(c)) {
      const claimed = claimKeyAndModel(w, c, sticky ? w.batchKey[ci] : -1);
      if (claimed && sticky) w.batchKey[ci] = claimed[0];
      if (claimed) {
        req.to = c.id;
        req.key = claimed[0];
        req.model = claimed[1];
        req.triedKeys = 0;
        req.triedModels = 0;
        req.probeGeneration = admit(c);
        req.probe = req.probeGeneration >= 0;
        req.startedAtMs = w.simMs;
        req.doneAtMs = w.simMs + randRange(w, LATENCY_MS);
        return true;
      }
    }
    req.cursor++;
  }
  return false;
}

function releaseProbe(c: CandidateState, req: InflightRequest): void {
  if (req.probe && req.probeGeneration === c.breaker.generation) c.breaker.probeInFlight = false;
}

/** Complete an in-flight attempt; returns true when the request is finished. */
function completeAttempt(w: World, req: InflightRequest): boolean {
  const c = candidate(w, req.to);
  const code = resolveAttempt(w, c, req.key, req.model, req.probe ? req.probeGeneration : -1);
  if (code === 0) {
    finishServed(w, req, c, req.probe, false);
    return true;
  }
  if (code !== 503) {
    // Account or model fallback inside the same provider: try a sibling, keeping the probe slot.
    if (code === 401) req.triedKeys |= 1 << req.key;
    else req.triedModels |= 1 << req.model;
    const claimed = claimKeyAndModel(w, c, -1, req.triedKeys, req.triedModels);
    if (claimed) {
      req.key = claimed[0];
      req.model = claimed[1];
      req.startedAtMs = w.simMs;
      req.doneAtMs = w.simMs + randRange(w, LATENCY_MS);
      return false;
    }
  }
  // The target failed: the hub retries the next one in the ranking.
  releaseProbe(c, req);
  req.failed.push(c.id);
  req.codes.push(code);
  req.cursor++;
  req.probe = false;
  if (startAttempt(w, req)) return false;
  finishDropped(w, req, false);
  return true;
}

/** Order for one request: a half-open breaker waiting for its probe takes the next request. */
function orderFor(w: World, base: CandidateId[]): CandidateId[] {
  for (const c of w.candidates) {
    if (c.breaker.state === "halfOpen" && !c.breaker.probeInFlight && isAvailable(w, c)) {
      return [c.id, ...base.filter((id) => id !== c.id)];
    }
  }
  return base;
}

function dispatchBatch(w: World): void {
  const from = pickClient(w);
  const sample = SAMPLE_KEYS[Math.floor(rand(w) * SAMPLE_KEYS.length)];
  const size = pickBatchSize(w);
  for (let i = 0; i < w.jitter.length; i++) w.jitter[i] = (rand(w) * 2 - 1) * TELEMETRY_JITTER;
  const base = liveOrder(w, SAMPLE_INDEX[sample]);
  w.batchKey.fill(-1);
  for (let r = 0; r < size; r++) {
    const req: InflightRequest = {
      id: w.nextRequestId++,
      to: base[0] ?? w.candidates[0].id,
      key: 0,
      model: 0,
      doneAtMs: 0,
      probe: false,
      startedAtMs: w.simMs,
      from,
      sample,
      order: orderFor(w, base),
      cursor: 0,
      failed: [],
      codes: [],
      probeGeneration: -1,
      triedKeys: 0,
      triedModels: 0,
    };
    countRequest(w);
    if (startAttempt(w, req, true)) w.inflight.push(req);
    else finishDropped(w, req, false);
  }
  w.batches++;
  w.nextBatchMs += randRange(w, BATCH_GAP_MS);
}

/* ------------------------------------------------------------------------ */
/* Time                                                                     */
/* ------------------------------------------------------------------------ */

function halfOpenDueMs(c: CandidateState): number {
  if (c.breaker.state !== "open" || c.breaker.openedAtMs === null) return Infinity;
  return c.breaker.openedAtMs + profileOf(c).resetSeconds * 1000;
}

function nextDueMs(w: World): number {
  let t = w.nextBatchMs;
  for (const req of w.inflight) if (req.doneAtMs < t) t = req.doneAtMs;
  for (const c of w.candidates) {
    const due = halfOpenDueMs(c);
    if (due < t) t = due;
  }
  return t;
}

function earliestInflight(w: World, t: number): number {
  let best = -1;
  for (let i = 0; i < w.inflight.length; i++) {
    const req = w.inflight[i];
    if (req.doneAtMs > t) continue;
    if (
      best < 0 ||
      req.doneAtMs < w.inflight[best].doneAtMs ||
      (req.doneAtMs === w.inflight[best].doneAtMs && req.id < w.inflight[best].id)
    ) {
      best = i;
    }
  }
  return best;
}

function rollRate(w: World): void {
  while (w.simMs - w.rateWindowStartMs >= 1000) {
    w.rateHistory[w.rateWindowsClosed % RATE_WINDOWS] = w.rateWindowCount;
    w.rateWindowsClosed++;
    const n = Math.min(w.rateWindowsClosed, RATE_WINDOWS);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += w.rateHistory[i];
    w.reqPerSec = Math.round(sum / n);
    w.rateWindowCount = 0;
    w.rateWindowStartMs += 1000;
  }
}

/** Process every due event up to and including `end`, in time order. */
function runUntil(w: World, end: number): void {
  for (let guard = 0; guard < 1_000_000; guard++) {
    const t = nextDueMs(w);
    if (t > end) break;
    if (t > w.simMs) w.simMs = t;
    // 1. Reset timers (lazy in the real breaker; due exactly here).
    for (const c of w.candidates) {
      if (halfOpenDueMs(c) <= w.simMs) transition(w, c, "halfOpen");
    }
    // 2. Completions, oldest first.
    for (let i = earliestInflight(w, w.simMs); i >= 0; i = earliestInflight(w, w.simMs)) {
      const req = w.inflight[i];
      if (completeAttempt(w, req)) w.inflight.splice(w.inflight.indexOf(req), 1);
    }
    // 3. Arrivals.
    if (w.nextBatchMs <= w.simMs) dispatchBatch(w);
    rollRate(w);
  }
  if (end > w.simMs) w.simMs = end;
  rollRate(w);
}

/** One heartbeat step: `dtMs` real milliseconds (normally `STEP_MS`) times the speed. */
export function step(w: World, dtMs: number = STEP_MS): void {
  runUntil(w, w.simMs + Math.max(0, dtMs) * w.speed);
  w.tick++;
  w.rev++;
}

/** Advance sim time synchronously, independent of speed (reduced motion: resolve instantly). */
export function advance(w: World, simMs: number): void {
  runUntil(w, w.simMs + Math.max(0, simMs));
  w.tick++;
  w.rev++;
}

/**
 * Advance in `STEP_MS` sim chunks until `done(w)` holds or `maxSimMs` passes.
 * Returns whether the condition was met — e.g. resolve a fresh outage to OPEN
 * for a reduced-motion visitor.
 */
export function advanceUntil(w: World, done: (w: World) => boolean, maxSimMs = 120_000): boolean {
  const end = w.simMs + Math.max(0, maxSimMs);
  while (!done(w)) {
    if (w.simMs >= end) return false;
    runUntil(w, Math.min(end, w.simMs + STEP_MS));
    w.tick++;
    w.rev++;
  }
  return true;
}

/* ------------------------------------------------------------------------ */
/* The hero's featured take                                                 */
/* ------------------------------------------------------------------------ */

/**
 * The hero cadence: move to the next sample (or `sample`), rank it, and route
 * one request through the deck synchronously along that ranking — trying each
 * admissible target in turn, as the hub does — so the hero can play the exact
 * attempts (swing, ✕ 503, re-swing) its needle and header line show.
 */
export function nextTake(w: World, sample?: SampleKey): void {
  const next =
    sample ?? SAMPLE_KEYS[((SAMPLE_INDEX[w.featured.sample] ?? -1) + 1) % SAMPLE_KEYS.length];
  const ranking = rank(w, next);
  const req = {
    from: pickClient(w),
    sample: next,
    failed: [] as CandidateId[],
    codes: [] as FailCode[],
  };
  const attempts: CandidateId[] = [];
  let winner: CandidateState | null = null;
  let probeServed = false;
  countRequest(w);

  for (const entry of ranking) {
    const c = candidate(w, entry.id);
    if (!canExecute(c)) continue;
    let claimed = claimKeyAndModel(w, c);
    if (!claimed) continue;
    attempts.push(c.id);
    const generation = admit(c);
    let code: FailCode | 0 = 503;
    let triedKeys = 0;
    let triedModels = 0;
    // Sibling keys and models inside the provider, each tried once.
    while (claimed) {
      code = resolveAttempt(w, c, claimed[0], claimed[1], generation);
      if (code === 0 || code === 503) break;
      if (code === 401) triedKeys |= 1 << claimed[0];
      else triedModels |= 1 << claimed[1];
      claimed = claimKeyAndModel(w, c, -1, triedKeys, triedModels);
    }
    if (code === 0) {
      winner = c;
      probeServed = generation >= 0;
      break;
    }
    if (generation >= 0 && generation === c.breaker.generation) c.breaker.probeInFlight = false;
    req.failed.push(c.id);
    req.codes.push(code);
  }

  if (winner) finishServed(w, req, winner, probeServed, true);
  else finishDropped(w, req, true);

  w.featured = {
    take: w.featured.take + 1,
    sample: next,
    ranking,
    attempts,
    winner: winner ? winner.id : w.featured.winner,
    fallbackAttempts: req.failed.length,
    codes: req.codes,
    served: winner !== null,
  };
  w.rev++;
}

/* ------------------------------------------------------------------------ */
/* Actions                                                                  */
/* ------------------------------------------------------------------------ */

export type DeckActionData =
  | { type: "setUpstreamDown"; id: CandidateId; down: boolean }
  | { type: "setKeyRevoked"; id: CandidateId; key: number; revoked: boolean }
  | { type: "setModelRateLimited"; id: CandidateId; model: number; limited: boolean }
  | { type: "setWeight"; factorId: string; value: number }
  | { type: "resetWeights" }
  | { type: "setSpeed"; speed: Speed }
  | { type: "reset" };

export type ActionOptions = {
  /** The visitor caused it: a fault switched on counts in `session.outagesCaused`. */
  user?: boolean;
};

/**
 * An action is plain data (`type` plus its fields, for a store to inspect)
 * that is also callable: `action(world, opts)` applies it, the same as
 * `applyAction(world, action, opts)`.
 */
export type DeckAction = DeckActionData & ((w: World, opts?: ActionOptions) => void);

/** Apply an action to the world. Returns whether anything changed. */
export function applyAction(w: World, action: DeckActionData, opts: ActionOptions = {}): boolean {
  let changed = false;
  let fault = false;
  switch (action.type) {
    case "setUpstreamDown": {
      const c = candidate(w, action.id);
      changed = c.upstreamDown !== action.down;
      c.upstreamDown = action.down;
      fault = changed && action.down;
      break;
    }
    case "setKeyRevoked": {
      const k = candidate(w, action.id).keys[action.key];
      if (!k) break;
      changed = k.revoked !== action.revoked;
      k.revoked = action.revoked;
      fault = changed && action.revoked;
      break;
    }
    case "setModelRateLimited": {
      const m = candidate(w, action.id).models[action.model];
      if (!m) break;
      changed = m.rateLimited !== action.limited;
      m.rateLimited = action.limited;
      fault = changed && action.limited;
      break;
    }
    case "setWeight": {
      const index = w.factorIds.indexOf(action.factorId);
      if (index < 0) break;
      const raw = w.weights.slice();
      raw[index] = action.value;
      w.weights = normalizeWeights(raw, w.defaults);
      changed = true;
      break;
    }
    case "resetWeights": {
      w.weights = normalizeWeights(w.defaults, w.defaults);
      changed = true;
      break;
    }
    case "setSpeed": {
      if (!SPEEDS.includes(action.speed)) break;
      changed = w.speed !== action.speed;
      w.speed = action.speed;
      break;
    }
    case "reset": {
      // An operator reset (`CircuitBreaker.reset()`): every latch off, every
      // breaker closed, every key and model clear. Time, totals and weights stay.
      for (const c of w.candidates) {
        c.upstreamDown = false;
        for (const k of c.keys) {
          k.revoked = false;
          k.coolingUntilMs = 0;
          k.level = 0;
        }
        for (const m of c.models) {
          m.rateLimited = false;
          m.lockedUntilMs = 0;
        }
        c.breaker.failures = 0;
        c.breaker.openedAtMs = null;
        transition(w, c, "closed");
        c.breaker.probeInFlight = false;
      }
      changed = true;
      break;
    }
  }
  if (fault && opts.user) w.session.outagesCaused++;
  if (changed) w.rev++;
  return changed;
}

function makeAction(data: DeckActionData): DeckAction {
  const run = (w: World, opts?: ActionOptions) => {
    applyAction(w, data, opts);
  };
  return Object.assign(run, data);
}

export const act = {
  setUpstreamDown: (id: CandidateId, down: boolean) =>
    makeAction({ type: "setUpstreamDown", id, down }),
  setKeyRevoked: (id: CandidateId, key: number, revoked: boolean) =>
    makeAction({ type: "setKeyRevoked", id, key, revoked }),
  setModelRateLimited: (id: CandidateId, model: number, limited: boolean) =>
    makeAction({ type: "setModelRateLimited", id, model, limited }),
  /** Set one factor's raw weight; the vector is then re-normalized (`normalizeWeights`). */
  setWeight: (factorId: string, value: number) =>
    makeAction({ type: "setWeight", factorId, value }),
  resetWeights: () => makeAction({ type: "resetWeights" }),
  setSpeed: (speed: Speed) => makeAction({ type: "setSpeed", speed }),
  reset: () => makeAction({ type: "reset" }),
};
