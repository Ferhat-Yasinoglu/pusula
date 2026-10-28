/**
 * The Deck's data shapes: the plain, mutable state `landingSim.ts` advances —
 * candidates with their breaker, keys and models, in-flight requests, the
 * hero's featured take, the world itself — and the `DeckEvent` log every
 * instrument on the landing page reads. Types only, no runtime code; each
 * field mirrors the gateway mechanism documented on `landingSim.ts`.
 * `landingSim.ts` re-exports all of them, so consumers import from there.
 */
import type { CandidateId, SampleKey } from "./sampleTable";

export type ProfileId = "oauth" | "apikey" | "local";
export type BreakerState = "closed" | "degraded" | "open" | "halfOpen";
export type ClientId = "ghazni" | "faizabad" | "edge0" | "edge1" | "edge2" | "edge3";
export type Speed = 1 | 5 | 10;
/** Why an attempt failed: upstream down, key revoked, model rate-limited. */
export type FailCode = 503 | 401 | 429;

export type BreakerProfile = {
  id: ProfileId;
  opensAfter: number;
  resetSeconds: number;
  /** `null` for local: its degradation threshold equals its opening one, so there is no band. */
  degradesAfter: number | null;
  cooldownBaseMs: number;
};

export type KeyState = { revoked: boolean; coolingUntilMs: number; level: number };
export type ModelState = { rateLimited: boolean; lockedUntilMs: number };

export type BreakerSnapshot = {
  state: BreakerState;
  failures: number;
  /**
   * When the breaker last opened — refreshed by a late failure that lands while
   * it is already open, exactly as the real breaker refreshes `lastFailureTime`
   * (its reset timer runs from the last failure). `null` until it first opens.
   */
  openedAtMs: number | null;
  probeInFlight: boolean;
  /** Bumped on every transition; a probe's result is discarded if it changed meanwhile. */
  generation: number;
};

export type CandidateState = {
  id: CandidateId;
  catalogId: string;
  profile: ProfileId;
  /** The "503s from upstream" latch: the hero's and the map's "make it fail". */
  upstreamDown: boolean;
  breaker: BreakerSnapshot;
  /** Three connections (indices 0–2; the page labels them #1–#3). */
  keys: KeyState[];
  /** Three models (indices 0–2). */
  models: ModelState[];
  served: number;
  /** Round-robin cursors over keys and models. */
  keyCursor: number;
  modelCursor: number;
};

export type InflightRequest = {
  id: number;
  to: CandidateId;
  key: number;
  model: number;
  doneAtMs: number;
  /** This attempt is the single request a half-open breaker admits. */
  probe: boolean;
  startedAtMs: number;
  from: ClientId;
  sample: SampleKey;
  /** The ranking the hub walks for this request. */
  order: CandidateId[];
  cursor: number;
  failed: CandidateId[];
  codes: FailCode[];
  /** Breaker generation when the probe started (−1 for ordinary attempts). */
  probeGeneration: number;
  /** Bitmasks of the keys (401) and models (429) already tried on the current target. */
  triedKeys: number;
  triedModels: number;
};

export type RankEntry = { id: CandidateId; score: number };

export type Featured = {
  take: number;
  sample: SampleKey;
  /** The ranking the take was routed by (scores before its outcome). */
  ranking: RankEntry[];
  /** Candidates actually tried, in order; the winner is last when `served`. */
  attempts: CandidateId[];
  /** Who served it. When nothing could (`served: false`) this keeps the previous winner. */
  winner: CandidateId;
  fallbackAttempts: number;
  codes: FailCode[];
  served: boolean;
};

export type World = {
  seed: number;
  tick: number;
  simMs: number;
  speed: Speed;
  factorIds: string[];
  defaults: number[];
  /** Normalized, Σ = 1. */
  weights: number[];
  candidates: CandidateState[];
  inflight: InflightRequest[];
  featured: Featured;
  totals: { routed: number; rerouted: number; fallbacks: number; dropped: number };
  session: { outagesCaused: number };
  /** Ring buffer of the last `EVENT_BUFFER` events, oldest first; `n` is monotonic. */
  events: DeckEvent[];
  /** `n` of the next event. */
  eventSeq: number;
  /** Bumped on every mutation (step, advance, nextTake, actions): a cheap change signal. */
  rev: number;
  /**
   * Requests per sim second: the rounded mean of the last `RATE_WINDOWS` full
   * sim seconds (fewer before that many have passed; 0 before the first).
   * Updated once per sim second. A single 1 s window swings 0–8 around the
   * ~4.5 req/s schedule; the 5 s mean stays within the spec's 3–6.
   */
  reqPerSec: number;
  /** Request batches dispatched so far (the dock's pulse). */
  batches: number;
  /** mulberry32 state. */
  rngState: number;
  nextBatchMs: number;
  nextRequestId: number;
  rateWindowStartMs: number;
  rateWindowCount: number;
  /** Ring of the last `RATE_WINDOWS` per-second request counts. */
  rateHistory: Uint16Array;
  /** Full sim seconds closed so far (indexes `rateHistory`). */
  rateWindowsClosed: number;
  /** `[sample][candidate][factor]` in `factorIds` order; NaN where health is derived. */
  measure: Float64Array;
  /** Per-request telemetry offsets `[candidate][live factor]`, reused. */
  jitter: Float64Array;
  /** For each factor in `factorIds`, its index in `LIVE_FACTOR_IDS`, or −1. */
  liveIndex: Int8Array;
  /** The key the current batch's session is pinned to, per candidate (−1: none yet). */
  batchKey: Int8Array;
};

export type DeckEvent =
  | {
      n: number;
      kind: "routed";
      t: number;
      from: ClientId;
      sample: SampleKey;
      /** Targets that failed before `to` served, in order. */
      failed: CandidateId[];
      /** One code per entry of `failed`. */
      codes: FailCode[];
      to: CandidateId;
      /** The serving attempt was a half-open breaker's probe. */
      probe: boolean;
      /** This was the hero's featured take. */
      featured: boolean;
    }
  | { n: number; kind: "breaker"; t: number; id: CandidateId; state: BreakerState }
  | {
      n: number;
      kind: "cooldown";
      t: number;
      id: CandidateId;
      key: number;
      /** The backoff level after this failure: 1 on the first, 2 on the next, … (cap 3). */
      level: number;
      untilMs: number;
    }
  | { n: number; kind: "ignored"; t: number; id: CandidateId; key: number }
  | { n: number; kind: "lockout"; t: number; id: CandidateId; model: number }
  | {
      n: number;
      kind: "dropped";
      t: number;
      from: ClientId;
      sample: SampleKey;
      failed: CandidateId[];
      codes: FailCode[];
      featured: boolean;
    };
