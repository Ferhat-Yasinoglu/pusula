import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WEIGHTS,
  calculateScore,
  normalizeScoringWeights,
  type ScoringFactors,
} from "../../open-sse/services/autoCombo/scoring.ts";
import { BREAKER_PROFILES, SAMPLE_CANDIDATES } from "../../src/app/landing/landingTypes.ts";
import {
  CANDIDATE_IDS,
  HEALTH_FACTOR_ID,
  SAMPLE_KEYS,
  SAMPLE_TABLE,
  TABLE_FACTOR_IDS,
  type CandidateId,
  type SampleKey,
} from "../../src/app/landing/sim/sampleTable.ts";
import {
  EVENT_BUFFER,
  HEALTH_BY_STATE,
  MODEL_LOCKOUT_MS,
  RATE_WINDOWS,
  act,
  advance,
  advanceUntil,
  applyAction,
  candidate,
  createWorld,
  measurements,
  nextTake,
  normalizeWeights,
  probeInMs,
  rank,
  recordFailure,
  recordKeyFailure,
  recordKeySuccess,
  recordSuccess,
  step,
  type DeckEvent,
  type World,
} from "../../src/app/landing/sim/landingSim.ts";

/** The factor list the page passes in: `LandingStats.scoringFactors`, weight-descending. */
const FACTORS = Object.entries(DEFAULT_WEIGHTS as unknown as Record<string, number>)
  .map(([id, weight]) => ({ id, weight }))
  .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));

function world(seed?: number): World {
  return createWorld({
    factorIds: FACTORS.map((f) => f.id),
    defaults: FACTORS.map((f) => f.weight),
    seed,
  });
}

function profile(id: "oauth" | "apikey" | "local") {
  const p = BREAKER_PROFILES.find((entry) => entry.id === id);
  assert.ok(p, `no breaker profile ${id}`);
  return p;
}

function breakerEvents(w: World, id: CandidateId) {
  return w.events.filter(
    (e): e is Extract<DeckEvent, { kind: "breaker" }> => e.kind === "breaker" && e.id === id
  );
}

/** Collect every event the world emits while `run` advances it (the ring buffer only keeps 64). */
function collect(w: World, run: () => void): DeckEvent[] {
  const seen: DeckEvent[] = [];
  const originalPush = w.events.push.bind(w.events);
  w.events.push = (...items: DeckEvent[]) => {
    seen.push(...items);
    return originalPush(...items);
  };
  try {
    run();
  } finally {
    w.events.push = originalPush;
  }
  return seen;
}

/* ------------------------------------------------------------------------ */
/* The sample table and scoring (open-sse/services/autoCombo/scoring.ts)     */
/* ------------------------------------------------------------------------ */

test("sample table: factor ids are exactly DEFAULT_WEIGHTS' keys minus health; values in [0, 1]", () => {
  const keys = Object.keys(DEFAULT_WEIGHTS).filter((key) => key !== HEALTH_FACTOR_ID);
  assert.deepEqual([...TABLE_FACTOR_IDS].sort(), [...keys].sort());
  for (const sample of SAMPLE_KEYS) {
    for (const id of CANDIDATE_IDS) {
      const row = SAMPLE_TABLE[sample][id] as Record<string, number>;
      assert.deepEqual(Object.keys(row).sort(), [...keys].sort());
      assert.equal(HEALTH_FACTOR_ID in row, false, "health is derived live, never authored");
      for (const [factor, value] of Object.entries(row)) {
        assert.ok(value >= 0 && value <= 1, `${sample}/${id}/${factor} = ${value}`);
      }
    }
  }
});

test("sample table: the deck's candidates are SAMPLE_CANDIDATES, in order", () => {
  assert.deepEqual(
    SAMPLE_CANDIDATES.map((c) => c.id),
    [...CANDIDATE_IDS]
  );
  const w = world();
  for (const c of w.candidates) {
    const source = SAMPLE_CANDIDATES.find((entry) => entry.id === c.id);
    assert.equal(c.catalogId, source?.catalogId);
    assert.equal(c.profile, source?.profile);
  }
});

test("sample table: with DEFAULT_WEIGHTS the winners are agentic→claude, cheap→cerebras, long context→gemini, local→ollama, vision→gpt", () => {
  const expected: Record<SampleKey, CandidateId> = {
    sampleAgentic: "claude",
    sampleCheap: "cerebras",
    sampleLongContext: "gemini",
    sampleLocal: "ollama",
    sampleVision: "gpt",
  };
  const w = world();
  for (const sample of SAMPLE_KEYS) {
    const ranking = rank(w, sample);
    assert.equal(ranking.length, CANDIDATE_IDS.length);
    assert.equal(ranking[0].id, expected[sample], `${sample} is won by ${ranking[0].id}`);
    // Not a coin flip: the winner leads by a visible margin.
    assert.ok(ranking[0].score - ranking[1].score > 0.01, `${sample} margin too thin`);
  }
});

test("scoring: rank() is the real calculateScore (Σ wᵢ·mᵢ) with health from the breaker", () => {
  const w = world();
  for (const sample of SAMPLE_KEYS) {
    for (const entry of rank(w, sample)) {
      const factors = {
        ...(SAMPLE_TABLE[sample][entry.id] as Record<string, number>),
        health: 1,
      } as unknown as ScoringFactors;
      const real = calculateScore(factors, DEFAULT_WEIGHTS);
      assert.ok(
        Math.abs(entry.score - real) < 1e-9,
        `${sample}/${entry.id}: ${entry.score} vs ${real}`
      );
    }
  }
  // measurements() returns the same row in factor order, with health filled in.
  const row = measurements(w, "sampleVision", "gpt");
  assert.equal(row.length, w.factorIds.length);
  assert.equal(row[w.factorIds.indexOf("health")], 1);
  assert.equal(row[w.factorIds.indexOf("taskFit")], SAMPLE_TABLE.sampleVision.gpt.taskFit);
});

test("scoring: health per breaker state mirrors calculateFactors + combo.ts (DEGRADED reads CLOSED, HALF_OPEN .5, OPEN excluded)", () => {
  assert.deepEqual(HEALTH_BY_STATE, { closed: 1, degraded: 1, halfOpen: 0.5, open: 0 });
  const w = world();
  const healthWeight = w.weights[w.factorIds.indexOf("health")];
  const score = () => rank(w, "sampleAgentic").find((e) => e.id === "claude")?.score;
  const closed = score() as number;
  const claude = candidate(w, "claude");
  claude.breaker.state = "degraded";
  assert.equal(score(), closed);
  claude.breaker.state = "halfOpen";
  assert.ok(Math.abs(closed - (score() as number) - 0.5 * healthWeight) < 1e-9);
  claude.breaker.state = "open";
  assert.equal(score(), undefined, "an open provider is not ranked at all");
});

test("weights: normalizeWeights mirrors normalizeScoringWeights (NaN/negative → 0, all-zero → defaults, Σ = 1)", () => {
  const keys = FACTORS.map((f) => f.id);
  const defaults = FACTORS.map((f) => f.weight);
  const cases: number[][] = [
    defaults,
    keys.map((_, i) => (i % 3 === 0 ? Number.NaN : i)),
    keys.map((_, i) => (i % 2 === 0 ? -1 : 0.2)),
    keys.map(() => 0),
    keys.map(() => -5),
    keys.map((_, i) => (i === 4 ? 7 : 0)),
  ];
  for (const raw of cases) {
    const ours = normalizeWeights(raw, defaults);
    const real = normalizeScoringWeights(
      Object.fromEntries(keys.map((key, i) => [key, raw[i]])) as never
    ) as unknown as Record<string, number>;
    keys.forEach((key, i) => {
      assert.ok(Math.abs(ours[i] - real[key]) < 1e-12, `${key}: ${ours[i]} vs ${real[key]}`);
    });
    assert.ok(Math.abs(ours.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  }
});

test("weights: setWeight re-proportions the vector and the deck follows the visitor's weights", () => {
  const w = world();
  assert.equal(rank(w, "sampleAgentic")[0].id, "claude");
  act.setWeight("costInv", 50)(w);
  assert.ok(Math.abs(w.weights.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(w.weights[w.factorIds.indexOf("costInv")] > 0.9);
  assert.equal(rank(w, "sampleAgentic")[0].id, "ollama", "the cheapest candidate now leads");
  act.resetWeights()(w);
  assert.deepEqual(w.weights, normalizeWeights(w.defaults, w.defaults));
  assert.equal(rank(w, "sampleAgentic")[0].id, "claude");
});

/* ------------------------------------------------------------------------ */
/* Provider breaker (src/shared/utils/circuitBreaker.ts, PROVIDER_PROFILES)  */
/* ------------------------------------------------------------------------ */

test("breaker (circuitBreaker.ts _onFailure): oauth degrades at 5 and opens at 8; apikey 7/12; local opens at 2 with no degraded band", () => {
  const cases: Array<[CandidateId, "oauth" | "apikey" | "local", number | null, number]> = [
    ["claude", "oauth", 5, 8],
    ["glm", "apikey", 7, 12],
    ["ollama", "local", null, 2],
  ];
  for (const [id, profileId, degradesAt, opensAt] of cases) {
    const p = profile(profileId);
    assert.equal(p.degradesAfter, degradesAt, `${profileId} degradesAfter`);
    assert.equal(p.opensAfter, opensAt, `${profileId} opensAfter`);
    const w = world();
    const c = candidate(w, id);
    const states: string[] = [];
    for (let i = 1; i <= opensAt; i++) {
      recordFailure(w, c);
      states.push(c.breaker.state);
    }
    for (let i = 1; i <= opensAt; i++) {
      const expected =
        i >= opensAt ? "open" : degradesAt !== null && i >= degradesAt ? "degraded" : "closed";
      assert.equal(states[i - 1], expected, `${id} after ${i} failures`);
    }
    assert.equal(c.breaker.openedAtMs, 0);
    if (degradesAt === null) {
      assert.ok(!breakerEvents(w, id).some((e) => e.state === "degraded"));
    }
  }
});

test("breaker (circuitBreaker.ts _onSuccess): a success decays one failure; DEGRADED closes at the threshold", () => {
  const w = world();
  const c = candidate(w, "claude"); // oauth: degrades at 5
  for (let i = 0; i < 7; i++) recordFailure(w, c);
  assert.equal(c.breaker.state, "degraded");
  recordSuccess(w, c);
  assert.deepEqual([c.breaker.failures, c.breaker.state], [6, "degraded"]);
  recordSuccess(w, c);
  assert.deepEqual([c.breaker.failures, c.breaker.state], [5, "closed"]);
  recordSuccess(w, c);
  assert.equal(c.breaker.failures, 4, "gradual recovery keeps counting down while closed");
  for (let i = 0; i < 9; i++) recordSuccess(w, c);
  assert.equal(c.breaker.failures, 0, "never below zero");
});

test("breaker (_refreshOpenState): OPEN → HALF_OPEN after resetSeconds of sim time, then one probe closes it", () => {
  const w = world();
  const c = candidate(w, "claude");
  const reset = profile("oauth").resetSeconds * 1000;
  for (let i = 0; i < 8; i++) recordFailure(w, c); // opened at t = 0, before any traffic
  assert.equal(probeInMs(w, "claude"), reset);
  advance(w, reset - 100);
  assert.equal(c.breaker.state, "open", "still cooling off");
  assert.equal(probeInMs(w, "claude"), 100);
  assert.equal(c.served, 0, "an open provider gets no traffic");
  assert.ok(advanceUntil(w, () => c.breaker.state === "closed", 5000));
  const states = breakerEvents(w, "claude");
  const half = states.find((e) => e.state === "halfOpen");
  assert.ok(half, "it half-opened");
  assert.equal(half.t, reset, "exactly resetSeconds after the last failure");
  assert.equal(states.at(-1)?.state, "closed");
  assert.equal(c.breaker.failures, 0, "a successful probe resets the count");
  assert.equal(probeInMs(w, "claude"), null);
});

test("breaker: HALF_OPEN admits exactly one probe; a failed probe re-opens it", () => {
  const w = world(7);
  const c = candidate(w, "claude");
  act.setUpstreamDown("claude", true)(w);
  assert.ok(advanceUntil(w, () => c.breaker.state === "open", 120_000));
  const openedAt = c.breaker.openedAtMs as number;
  assert.ok(advanceUntil(w, () => c.breaker.state === "halfOpen", 120_000));
  assert.ok(w.simMs >= openedAt + profile("oauth").resetSeconds * 1000);
  let maxProbes = 0;
  const seen = collect(w, () => {
    advanceUntil(
      w,
      (x) => {
        const probes = x.inflight.filter((r) => r.to === "claude").length;
        maxProbes = Math.max(maxProbes, probes);
        assert.ok(
          x.inflight.every((r) => r.to !== "claude" || r.probe),
          "only the probe reaches a half-open provider"
        );
        return c.breaker.state !== "halfOpen";
      },
      10_000
    );
    // The probe's request then goes to the next target (one more attempt latency).
    advance(w, 2000);
  });
  assert.equal(maxProbes, 1);
  assert.equal(c.breaker.state, "open", "the probe hit the still-failing upstream");
  const failedProbe = seen.find(
    (e) => (e.kind === "routed" || e.kind === "dropped") && e.failed.includes("claude")
  );
  assert.ok(failedProbe, "the probe's request was retried on the next target");
});

test("breaker: 401 and 429 never touch the provider breaker", () => {
  const w = world(3);
  for (const key of [0, 1, 2]) act.setKeyRevoked("claude", key, true)(w);
  for (const model of [0, 1, 2]) act.setModelRateLimited("gemini", model, true)(w);
  const seen = collect(w, () => advance(w, 90_000));
  for (const id of ["claude", "gemini"] as CandidateId[]) {
    const c = candidate(w, id);
    assert.deepEqual([c.breaker.state, c.breaker.failures], ["closed", 0], id);
    assert.ok(!seen.some((e) => e.kind === "breaker" && e.id === id), `${id} breaker moved`);
  }
  assert.ok(seen.some((e) => e.kind === "cooldown" && e.id === "claude"));
  assert.ok(seen.some((e) => e.kind === "lockout" && e.id === "gemini"));
  // Their traffic still lands elsewhere, with the real failure codes.
  const rerouted = seen.filter(
    (e): e is Extract<DeckEvent, { kind: "routed" }> =>
      e.kind === "routed" && (e.failed.includes("claude") || e.failed.includes("gemini"))
  );
  assert.ok(rerouted.length > 0);
  for (const e of rerouted) {
    e.failed.forEach((id, i) => assert.equal(e.codes[i], id === "claude" ? 401 : 429));
  }
});

/* ------------------------------------------------------------------------ */
/* Connection cooldown (src/sse/services/auth.ts markAccountUnavailable)     */
/* ------------------------------------------------------------------------ */

test("cooldown (markAccountUnavailable): base·2^level, ×2 after the lapse, capped at level 3; success clears it", () => {
  const w = world();
  const c = candidate(w, "claude");
  const base = profile("oauth").cooldownBaseMs;
  assert.equal(base, 5000);
  const at = (t: number) => {
    w.simMs = t; // primitive-level test: move the clock without traffic
  };
  recordKeyFailure(w, c, 1);
  assert.deepEqual(c.keys[1], { revoked: false, coolingUntilMs: base, level: 1 });
  at(base);
  recordKeyFailure(w, c, 1);
  assert.deepEqual([c.keys[1].coolingUntilMs, c.keys[1].level], [base + 2 * base, 2]);
  at(3 * base);
  recordKeyFailure(w, c, 1);
  assert.deepEqual([c.keys[1].coolingUntilMs, c.keys[1].level], [3 * base + 4 * base, 3]);
  at(7 * base);
  recordKeyFailure(w, c, 1);
  assert.deepEqual([c.keys[1].coolingUntilMs, c.keys[1].level], [7 * base + 8 * base, 3], "capped");
  recordKeySuccess(c, 1);
  assert.equal(c.keys[1].level, 0);
  const cooldowns = w.events
    .filter((e) => e.kind === "cooldown")
    .map((e) => (e as { level: number }).level);
  assert.deepEqual(cooldowns, [1, 2, 3, 3]);
});

test("cooldown (anti-thundering-herd guard): a failure on a key that is already cooling is ignored — no extension, no level", () => {
  const w = world();
  const c = candidate(w, "glm");
  recordKeyFailure(w, c, 2);
  const before = { ...c.keys[2] };
  w.simMs = 1200;
  recordKeyFailure(w, c, 2);
  assert.deepEqual(c.keys[2], before);
  const last = w.events.at(-1);
  assert.deepEqual(last && { kind: last.kind, id: (last as { id: string }).id }, {
    kind: "ignored",
    id: "glm",
  });
});

test("cooldown: concurrent traffic on a revoked key shows cooling ×1, ignored, then ×2 after the lapse; siblings serve", () => {
  const w = world(11);
  const c = candidate(w, "claude");
  act.setKeyRevoked("claude", 1, true)(w);
  const servedBefore = c.served;
  const seen = collect(w, () => advance(w, 120_000));
  const forKey = seen.filter(
    (e) => (e.kind === "cooldown" || e.kind === "ignored") && e.id === "claude" && e.key === 1
  );
  const levels = forKey
    .filter((e) => e.kind === "cooldown")
    .map((e) => (e as { level: number }).level);
  assert.deepEqual(levels.slice(0, 3), [1, 2, 3]);
  assert.ok(
    forKey.some((e) => e.kind === "ignored"),
    "a concurrent failure on the cooling key was ignored"
  );
  // Every ignored failure landed while the key was cooling, and did not extend it.
  let until = 0;
  for (const e of forKey) {
    if (e.kind === "cooldown") {
      assert.ok(e.t >= until, "a cooldown only starts once the previous one lapsed");
      until = e.untilMs;
    } else {
      assert.ok(e.t < until);
    }
  }
  assert.ok(c.served > servedBefore + 20, "keys #1 and #3 kept serving");
  assert.equal(c.breaker.failures, 0);
});

/* ------------------------------------------------------------------------ */
/* Model lockout (open-sse/services/accountFallback.ts lockModel)            */
/* ------------------------------------------------------------------------ */

test("lockout (lockModel): a 429 locks one model for 6 s of sim time while sibling models serve", () => {
  const w = world(5);
  const c = candidate(w, "ollama");
  act.setModelRateLimited("ollama", 1, true)(w);
  const servedBefore = c.served;
  const seen = collect(w, () => advance(w, 60_000));
  const locks = seen.filter((e) => e.kind === "lockout" && e.id === "ollama");
  assert.ok(locks.length >= 2, "the model locks, unlocks, and locks again");
  for (const e of locks) assert.equal((e as { model: number }).model, 1);
  for (let i = 1; i < locks.length; i++) {
    assert.ok(locks[i].t - locks[i - 1].t >= MODEL_LOCKOUT_MS);
  }
  assert.ok(c.served > servedBefore + 20, "models 1 and 3 kept serving");
  assert.ok(
    !seen.some((e) => (e.kind === "routed" || e.kind === "dropped") && e.failed.includes("ollama")),
    "a single locked model never fails the provider over"
  );
  assert.deepEqual([c.breaker.state, c.breaker.failures], ["closed", 0]);
});

/* ------------------------------------------------------------------------ */
/* Fallback, traffic, the featured take                                     */
/* ------------------------------------------------------------------------ */

test("fallback: a failing provider makes the hub retry the next-ranked target (X-Pusula-Fallback-Attempts: 1)", () => {
  const w = world();
  act.setUpstreamDown("claude", true)(w);
  const runnerUp = rank(w, "sampleAgentic")[1].id;
  assert.equal(runnerUp, "gpt");
  nextTake(w, "sampleAgentic");
  assert.deepEqual(w.featured.attempts, ["claude", "gpt"]);
  assert.equal(w.featured.winner, "gpt");
  assert.equal(w.featured.fallbackAttempts, 1);
  assert.deepEqual(w.featured.codes, [503]);
  assert.equal(w.featured.ranking[0].id, "claude", "the take shows the ranking it was routed by");
  const routed = w.events.at(-1);
  assert.ok(routed && routed.kind === "routed");
  assert.deepEqual(
    [routed.failed, routed.codes, routed.to, routed.featured],
    [["claude"], [503], "gpt", true]
  );
  assert.equal(w.totals.rerouted, 1);
  assert.equal(w.totals.fallbacks, 1);
  assert.equal(candidate(w, "claude").breaker.failures, 1);
});

test("fallback: once OPEN, the needle stops visiting the provider", () => {
  const w = world();
  act.setUpstreamDown("claude", true)(w);
  for (let i = 0; i < 8; i++) nextTake(w, "sampleAgentic");
  assert.equal(candidate(w, "claude").breaker.state, "open");
  nextTake(w, "sampleAgentic");
  assert.ok(!w.featured.ranking.some((e) => e.id === "claude"));
  assert.deepEqual(w.featured.attempts, ["gpt"]);
  assert.equal(w.featured.fallbackAttempts, 0);
});

test("featured take: cycles through the five samples and is routed by rank()", () => {
  const w = world();
  assert.equal(w.featured.sample, "sampleAgentic");
  assert.equal(w.featured.winner, "claude", "tick 0 (SSR) shows agentic → claude");
  const seen: SampleKey[] = [];
  for (let i = 0; i < SAMPLE_KEYS.length; i++) {
    const expected = rank(w, SAMPLE_KEYS[(i + 1) % SAMPLE_KEYS.length]);
    nextTake(w);
    seen.push(w.featured.sample);
    assert.deepEqual(w.featured.ranking, expected);
    assert.equal(w.featured.winner, expected[0].id);
    assert.equal(w.featured.take, i + 1);
  }
  assert.deepEqual(seen, [...SAMPLE_KEYS.slice(1), SAMPLE_KEYS[0]]);
});

test("featured take: with every provider down nothing is served and the request is dropped", () => {
  const w = world();
  for (const id of CANDIDATE_IDS) act.setUpstreamDown(id, true)(w);
  const previous = w.featured.winner;
  nextTake(w, "sampleCheap");
  assert.equal(w.featured.served, false);
  assert.equal(w.featured.winner, previous);
  assert.equal(w.featured.attempts.length, CANDIDATE_IDS.length);
  assert.equal(w.events.at(-1)?.kind, "dropped");
});

test("traffic: 3–6 requests per second, clients ghazni 45% / faizabad 35% / edge 20%, every provider served", () => {
  const w = world(21);
  const seen = collect(w, () => advance(w, 300_000));
  const requests = seen.filter((e) => e.kind === "routed" || e.kind === "dropped");
  const perSecond = requests.length / 300;
  assert.ok(perSecond >= 3 && perSecond <= 6, `${perSecond} req/s`);
  const share = (pred: (from: string) => boolean) =>
    requests.filter((e) => pred((e as { from: string }).from)).length / requests.length;
  assert.ok(Math.abs(share((f) => f === "ghazni") - 0.45) < 0.08);
  assert.ok(Math.abs(share((f) => f === "faizabad") - 0.35) < 0.08);
  assert.ok(Math.abs(share((f) => f.startsWith("edge")) - 0.2) < 0.08);
  for (const c of w.candidates) {
    assert.ok(c.served / w.totals.routed > 0.05, `${c.id} served only ${c.served}`);
  }
  assert.equal(w.totals.rerouted, 0, "no failures, no reroutes");
  assert.ok(w.reqPerSec > 0);
});

test("traffic: the dock's req/s is a rolling mean that reads 3–6, not one noisy second", () => {
  // A single 1 s window swings 0–8 around the ~4.5 req/s schedule; the SimDock
  // shows `reqPerSec`, so it is the rounded mean of the last RATE_WINDOWS seconds.
  for (const seed of [undefined, 21]) {
    const w = world(seed);
    assert.equal(w.reqPerSec, 0, "0 before the first full sim second (the SSR value)");
    const readings: number[] = [];
    let second = 0;
    while (w.simMs < 180_000) {
      step(w);
      const s = Math.floor(w.simMs / 1000);
      if (s !== second) {
        second = s;
        if (s > RATE_WINDOWS) readings.push(w.reqPerSec);
      }
    }
    assert.ok(Number.isInteger(readings[0]));
    assert.ok(
      readings.every((r) => r >= 2 && r <= 7),
      `out of band: ${readings.join(",")}`
    );
    const inBand = readings.filter((r) => r >= 3 && r <= 6).length / readings.length;
    assert.ok(inBand >= 0.97, `${(inBand * 100).toFixed(1)}% of readings in 3–6`);
  }
});

test("traffic: every provider's outage resolves to OPEN under its own profile (reduced motion: advanceUntil)", () => {
  for (const id of CANDIDATE_IDS) {
    const w = world(4);
    act.setUpstreamDown(id, true)(w);
    const c = candidate(w, id);
    assert.ok(
      advanceUntil(w, () => c.breaker.state === "open", 120_000),
      `${id} never opened`
    );
    advance(w, 2000); // the failed requests' retries land
    assert.ok(w.totals.rerouted > 0, `${id}'s traffic was rerouted`);
  }
});

test("speed: ×5 and ×10 compress sim time per heartbeat step; invalid speeds are ignored", () => {
  const w = world();
  step(w, 100);
  assert.equal(w.simMs, 100);
  act.setSpeed(5)(w);
  step(w, 100);
  assert.equal(w.simMs, 600);
  act.setSpeed(10)(w);
  step(w);
  assert.equal(w.simMs, 1600);
  applyAction(w, { type: "setSpeed", speed: 3 as never });
  assert.equal(w.speed, 10);
});

test("actions: user faults count in session.outagesCaused; reset clears every latch and closes every breaker", () => {
  const w = world();
  act.setUpstreamDown("claude", true)(w, { user: true });
  assert.equal(w.session.outagesCaused, 1);
  assert.equal(applyAction(w, act.setUpstreamDown("claude", true), { user: true }), false);
  assert.equal(w.session.outagesCaused, 1, "re-applying an active fault is not a new outage");
  act.setKeyRevoked("glm", 1, true)(w);
  assert.equal(w.session.outagesCaused, 1, "the page's own autoplay is not the visitor");
  act.setModelRateLimited("gpt", 2, true)(w, { user: true });
  assert.equal(w.session.outagesCaused, 2);
  // Actions are data too, for a store to inspect.
  const action = act.setUpstreamDown("gemini", true);
  assert.equal(action.type, "setUpstreamDown");
  assert.equal((action as { id: string }).id, "gemini");

  advanceUntil(w, () => candidate(w, "claude").breaker.state === "open");
  act.reset()(w);
  for (const c of w.candidates) {
    assert.equal(c.upstreamDown, false);
    assert.equal(c.breaker.state, "closed");
    assert.equal(c.breaker.failures, 0);
    assert.ok(c.keys.every((k) => !k.revoked && k.level === 0 && k.coolingUntilMs === 0));
    assert.ok(c.models.every((m) => !m.rateLimited && m.lockedUntilMs === 0));
  }
  assert.ok(w.totals.routed > 0, "reset keeps the visit's totals");
});

test("events: a ring buffer of 64 with monotonically numbered events", () => {
  const w = world();
  advance(w, 60_000);
  assert.equal(w.events.length, EVENT_BUFFER);
  for (let i = 1; i < w.events.length; i++) assert.equal(w.events[i].n, w.events[i - 1].n + 1);
  assert.equal(w.events.at(-1)?.n, w.eventSeq - 1);
});

test("determinism: same seed and same actions give identical event logs; another seed does not", () => {
  const script = (w: World) =>
    collect(w, () => {
      for (let i = 0; i < 50; i++) step(w);
      act.setUpstreamDown("claude", true)(w, { user: true });
      for (let i = 0; i < 300; i++) {
        step(w);
        if (i % 36 === 0) nextTake(w);
      }
      act.setKeyRevoked("gemini", 1, true)(w);
      act.setModelRateLimited("ollama", 2, true)(w);
      act.setSpeed(5)(w);
      for (let i = 0; i < 400; i++) step(w);
      act.setWeight("latencyInv", 0.6)(w);
      advance(w, 30_000);
    });
  assert.deepEqual(world(), world(), "createWorld is deterministic (SSR = first client world)");
  const a = world(99);
  const b = world(99);
  const logA = script(a);
  const logB = script(b);
  assert.ok(logA.length > 500);
  assert.deepEqual(logA, logB);
  assert.deepEqual(a.totals, b.totals);
  assert.deepEqual(a.featured, b.featured);
  const c = world(100);
  assert.notDeepEqual(script(c), logA);
});
