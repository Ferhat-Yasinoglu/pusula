/**
 * Four-lane demonstrations of every routing strategy, for the strategy band's
 * lanes figure. Each rule is a deliberately small picture of the real ordering
 * in `open-sse/services/combo/applyStrategyOrdering.ts` (and the auto engine in
 * `open-sse/services/autoCombo/`): which of lanes A–D the next request goes to,
 * or — for fusion, pipeline and context-relay — the shape of the hand-off.
 *
 * Every id in `ROUTING_STRATEGY_VALUES` (`src/shared/constants/routingStrategies.ts`)
 * has a rule here; an unknown id behaves like `priority`, as
 * `normalizeRoutingStrategy` does. Coverage is pinned by
 * `tests/unit/landing-strategies.test.ts`, which iterates the real list.
 *
 * Pure: `pick` only advances the strategy's own state (`StratState`) and draws
 * from the rng it is given. Unhealthy lanes are never picked; with every lane
 * down, the first lane is returned and the request fails there, as a combo
 * whose targets are exhausted does.
 */
import { shuffle, weightedIndex, type Rng } from "./prng";

export type LaneId = "A" | "B" | "C" | "D";

export type Lane = {
  id: LaneId;
  /** Quota left, 0..1. */
  quota: number;
  /** Requests currently on the lane. */
  load: number;
  /** $ / $$ / $$$. */
  cost: 1 | 2 | 3;
  /** Context window, in thousands of tokens. */
  ctx: number;
  healthy: boolean;
  /** Holds the session's prompt-cache prefix. */
  cached: boolean;
  /** Until its quota window resets. */
  resetInMs: number;
  /** Configured weight (weighted strategy). */
  weight: number;
};

export type StratPick =
  | { kind: "single"; to: LaneId }
  | { kind: "fanout"; to: LaneId[]; judge: true }
  | { kind: "chain"; to: LaneId[] }
  | { kind: "relay"; from: LaneId; to: LaneId };

export type StratState = {
  /** Round-robin cursor. */
  rr: number;
  /** Requests sent to each lane, by lane id (least-used). */
  counts: Record<LaneId, number>;
  /** Last lane that served (lkgp). */
  lastGood: LaneId | null;
  /** Lanes left in the current strict-random deck. */
  deck: LaneId[];
  /** The lane holding the session (context-relay). */
  sessionLane: LaneId | null;
  /** The session's context gauge, 0..1 (context-relay relays at 1). */
  session: number;
  /**
   * The live deck's scoring weights for `auto` (`World.factorIds`/`weights`).
   * Without them, quota, health, cost and latency vote equally.
   */
  autoWeights: { factorIds: readonly string[]; weights: readonly number[] } | null;
};

/** How much one request fills the context-relay session gauge. */
export const RELAY_STEP = 0.25;
/** How many lanes fusion fans out to, and pipeline chains through. */
export const FANOUT = 3;
/** The demo's four lanes: weights 5:3:1:1, costs, windows and resets that make each rule visible. */
export function createLanes(): Lane[] {
  return [
    {
      id: "A",
      quota: 0.82,
      load: 1,
      cost: 3,
      ctx: 200,
      healthy: true,
      cached: false,
      resetInMs: 5 * 3600_000,
      weight: 5,
    },
    {
      id: "B",
      quota: 0.55,
      load: 0,
      cost: 2,
      ctx: 1000,
      healthy: true,
      cached: true,
      resetInMs: 40 * 60_000,
      weight: 3,
    },
    {
      id: "C",
      quota: 0.3,
      load: 2,
      cost: 1,
      ctx: 128,
      healthy: true,
      cached: false,
      resetInMs: 12 * 60_000,
      weight: 1,
    },
    {
      id: "D",
      quota: 0.95,
      load: 0,
      cost: 1,
      ctx: 32,
      healthy: true,
      cached: false,
      resetInMs: 24 * 3600_000,
      weight: 1,
    },
  ];
}

export function createStratState(): StratState {
  return {
    rr: 0,
    counts: { A: 0, B: 0, C: 0, D: 0 },
    lastGood: null,
    deck: [],
    sessionLane: null,
    session: 0,
    autoWeights: null,
  };
}

/* ------------------------------------------------------------------------ */
/* Helpers                                                                  */
/* ------------------------------------------------------------------------ */

function healthy(lanes: readonly Lane[]): Lane[] {
  return lanes.filter((lane) => lane.healthy);
}

function single(to: LaneId): StratPick {
  return { kind: "single", to };
}

/** Lane with the best `key` (ties keep lane order). */
function best(lanes: readonly Lane[], key: (lane: Lane) => number): Lane {
  let winner = lanes[0];
  for (let i = 1; i < lanes.length; i++) if (key(lanes[i]) > key(winner)) winner = lanes[i];
  return winner;
}

function first(lanes: readonly Lane[]): LaneId {
  return (lanes.find((lane) => lane.healthy) ?? lanes[0]).id;
}

/** Score a lane the way the auto engine scores a candidate: Σ wᵢ·mᵢ over its gauges. */
function laneMeasure(factorId: string, lane: Lane, lanes: readonly Lane[]): number {
  switch (factorId) {
    case "quota":
      return lane.quota;
    case "health":
      return lane.healthy ? 1 : 0;
    case "costInv":
      return (3 - lane.cost) / 2;
    case "latencyInv":
      return 1 / (1 + lane.load);
    case "contextAffinity": {
      const max = Math.max(...lanes.map((l) => l.ctx), 1);
      return lane.ctx / max;
    }
    case "cacheAffinity":
      return lane.cached ? 1 : 0;
    case "resetWindowAffinity": {
      const max = Math.max(...lanes.map((l) => l.resetInMs), 1);
      return 1 - lane.resetInMs / max;
    }
    default:
      // A factor the lane gauges do not show votes neutrally.
      return 0.5;
  }
}

const AUTO_FALLBACK = {
  factorIds: ["quota", "health", "costInv", "latencyInv"],
  weights: [0.25, 0.25, 0.25, 0.25],
};

export function autoScore(lane: Lane, lanes: readonly Lane[], st: StratState): number {
  const source = st.autoWeights ?? AUTO_FALLBACK;
  let total = 0;
  for (let i = 0; i < source.factorIds.length; i++) {
    const weight = source.weights[i] ?? 0;
    if (weight > 0) total += weight * laneMeasure(source.factorIds[i], lane, lanes);
  }
  return total;
}

/* ------------------------------------------------------------------------ */
/* Rules                                                                    */
/* ------------------------------------------------------------------------ */

type Rule = (lanes: readonly Lane[], up: Lane[], st: StratState, rng: Rng) => StratPick;

const priority: Rule = (lanes) => single(first(lanes));

const RULES: Record<string, Rule> = {
  priority,

  weighted: (_lanes, up, _st, rng) => {
    const i = weightedIndex(
      rng,
      up.map((lane) => lane.weight)
    );
    return single((up[i] ?? up[0]).id);
  },

  "round-robin": (lanes, _up, st) => {
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[(st.rr + i) % lanes.length];
      if (lane.healthy) {
        st.rr = (st.rr + i + 1) % lanes.length;
        return single(lane.id);
      }
    }
    return single(lanes[0].id);
  },

  "context-relay": (lanes, up, st) => {
    const current = up.find((lane) => lane.id === st.sessionLane);
    if (!current) {
      // No session yet, or its lane went down: open one on the first healthy lane.
      const previous = st.sessionLane;
      st.sessionLane = first(lanes);
      st.session = RELAY_STEP;
      return previous && previous !== st.sessionLane
        ? { kind: "relay", from: previous, to: st.sessionLane }
        : single(st.sessionLane);
    }
    if (st.session + RELAY_STEP > 1 + 1e-9) {
      // The gauge is full: summarise and hand the session to the next healthy lane.
      const at = up.indexOf(current);
      const next = up[(at + 1) % up.length];
      st.sessionLane = next.id;
      st.session = RELAY_STEP;
      return next.id === current.id
        ? single(current.id)
        : { kind: "relay", from: current.id, to: next.id };
    }
    st.session += RELAY_STEP;
    return single(current.id);
  },

  "fill-first": (lanes, up) => {
    const withQuota = up.find((lane) => lane.quota > 0.02);
    return single((withQuota ?? up[0] ?? lanes[0]).id);
  },

  p2c: (_lanes, up, _st, rng) => {
    if (up.length < 2) return single(up[0].id);
    const a = Math.floor(rng() * up.length);
    let b = Math.floor(rng() * (up.length - 1));
    if (b >= a) b++;
    const [x, y] = a < b ? [up[a], up[b]] : [up[b], up[a]];
    return single((y.load < x.load ? y : x).id);
  },

  random: (_lanes, up, _st, rng) => single(up[Math.floor(rng() * up.length)].id),

  "least-used": (_lanes, up, st) => single(best(up, (lane) => -st.counts[lane.id]).id),

  "cost-optimized": (_lanes, up) => single(best(up, (lane) => -lane.cost).id),

  "reset-aware": (_lanes, up) => {
    const withQuota = up.filter((lane) => lane.quota > 0.02);
    return single(best(withQuota.length > 0 ? withQuota : up, (lane) => -lane.resetInMs).id);
  },

  headroom: (_lanes, up) => single(best(up, (lane) => lane.quota).id),

  "quota-weighted": (_lanes, up, _st, rng) => {
    const i = weightedIndex(
      rng,
      up.map((lane) => lane.quota / (lane.load + 1))
    );
    return single((up[i] ?? up[0]).id);
  },

  "strict-random": (_lanes, up, st, rng) => {
    // Deal each lane once, then reshuffle; a lane that went down is discarded from the deck.
    const upIds = new Set(up.map((lane) => lane.id));
    let next = st.deck.shift();
    while (next && !upIds.has(next)) next = st.deck.shift();
    if (!next) {
      st.deck = shuffle(
        rng,
        up.map((lane) => lane.id)
      );
      next = st.deck.shift() ?? up[0].id;
    }
    return single(next);
  },

  auto: (lanes, up, st) => single(best(up, (lane) => autoScore(lane, lanes, st)).id),

  lkgp: (lanes, up, st) => {
    const sticky = up.find((lane) => lane.id === st.lastGood);
    return single(sticky ? sticky.id : first(lanes));
  },

  "context-optimized": (_lanes, up) => single(best(up, (lane) => lane.ctx).id),

  "cache-optimized": (lanes, up) =>
    single((up.find((lane) => lane.cached) ?? up[0] ?? lanes[0]).id),

  fusion: (_lanes, up) => ({
    kind: "fanout",
    to: up.slice(0, FANOUT).map((lane) => lane.id),
    judge: true,
  }),

  pipeline: (_lanes, up) => ({ kind: "chain", to: up.slice(0, FANOUT).map((lane) => lane.id) }),
};
// Same rule, two names (`reset-window` orders by the same expiring-quota-first idea).
RULES["reset-window"] = RULES["reset-aware"];

/** The strategy ids this module has a dedicated rule for. */
export const HANDLED_STRATEGIES: readonly string[] = Object.keys(RULES);

export function isHandledStrategy(strategy: string): boolean {
  return Object.prototype.hasOwnProperty.call(RULES, strategy);
}

/** Lanes a pick sends work to (the relay's destination, every fan-out and chain lane). */
export function pickTargets(result: StratPick): LaneId[] {
  if (result.kind === "single") return [result.to];
  if (result.kind === "relay") return [result.to];
  return result.to;
}

/**
 * Where the next request goes under `strategy`. Advances the strategy's own
 * state (cursor, deck, session gauge, request counts, last good lane); never
 * mutates the lanes. Unknown ids behave like `priority`.
 */
export function pick(
  strategy: string,
  lanes: readonly Lane[],
  st: StratState,
  rng: Rng
): StratPick {
  if (lanes.length === 0) throw new Error("pick: no lanes");
  const up = healthy(lanes);
  const rule = isHandledStrategy(strategy) ? RULES[strategy] : priority;
  const result = up.length === 0 ? single(lanes[0].id) : rule(lanes, up, st, rng);
  for (const id of pickTargets(result)) {
    st.counts[id] = (st.counts[id] ?? 0) + 1;
    // Healthy lanes always serve in the demo, so the last pick is the last good lane.
    if (up.some((lane) => lane.id === id)) st.lastGood = id;
  }
  return result;
}
