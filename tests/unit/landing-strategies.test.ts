import test from "node:test";
import assert from "node:assert/strict";
import { ROUTING_STRATEGY_VALUES } from "../../src/shared/constants/routingStrategies.ts";
import {
  FANOUT,
  HANDLED_STRATEGIES,
  createLanes,
  createStratState,
  isHandledStrategy,
  pick,
  pickTargets,
  type Lane,
  type LaneId,
  type StratPick,
} from "../../src/app/landing/sim/landingStrategies.ts";
import { mulberry32 } from "../../src/app/landing/sim/prng.ts";

function run(strategy: string, lanes: Lane[], n: number, seed = 1) {
  const st = createStratState();
  const rng = mulberry32(seed);
  const picks: StratPick[] = [];
  for (let i = 0; i < n; i++) picks.push(pick(strategy, lanes, st, rng));
  return { picks, st };
}

function singles(picks: StratPick[]): LaneId[] {
  return picks.map((p) => {
    assert.equal(p.kind, "single");
    return (p as { to: LaneId }).to;
  });
}

function fail(lanes: Lane[], id: LaneId): Lane[] {
  return lanes.map((lane) => (lane.id === id ? { ...lane, healthy: false } : lane));
}

test("strategies: every ROUTING_STRATEGY_VALUES id has its own rule (src/shared/constants/routingStrategies.ts)", () => {
  for (const id of ROUTING_STRATEGY_VALUES) {
    assert.ok(isHandledStrategy(id), `strategy "${id}" has no lane demonstration`);
    const { picks } = run(id, createLanes(), 12);
    for (const p of picks) {
      for (const target of pickTargets(p)) assert.ok(["A", "B", "C", "D"].includes(target));
    }
  }
  // No stale rules for strategies the gateway no longer ships.
  assert.deepEqual([...HANDLED_STRATEGIES].sort(), [...ROUTING_STRATEGY_VALUES].sort());
});

test("strategies: an unknown id behaves like priority (normalizeRoutingStrategy)", () => {
  const lanes = fail(createLanes(), "A");
  assert.deepEqual(
    singles(run("no-such-strategy", lanes, 5).picks),
    singles(run("priority", lanes, 5).picks)
  );
  assert.deepEqual(singles(run("no-such-strategy", lanes, 3).picks), ["B", "B", "B"]);
});

test("strategies: no rule ever picks a failed lane", () => {
  for (const id of ROUTING_STRATEGY_VALUES) {
    for (const down of ["A", "B", "C", "D"] as LaneId[]) {
      const { picks } = run(id, fail(createLanes(), down), 40, 3);
      for (const p of picks) {
        const targets = p.kind === "relay" ? [p.to] : pickTargets(p);
        assert.ok(!targets.includes(down), `${id} sent work to failed lane ${down}`);
      }
    }
  }
});

test("strategies: with every lane down the first lane is returned (the combo exhausts)", () => {
  const lanes = createLanes().map((lane) => ({ ...lane, healthy: false }));
  for (const id of ROUTING_STRATEGY_VALUES) {
    assert.deepEqual(pick(id, lanes, createStratState(), mulberry32(1)), {
      kind: "single",
      to: "A",
    });
  }
});

test("strategies: priority takes the first healthy lane; failing A moves it to B", () => {
  assert.deepEqual(singles(run("priority", createLanes(), 3).picks), ["A", "A", "A"]);
  assert.deepEqual(singles(run("priority", fail(createLanes(), "A"), 2).picks), ["B", "B"]);
});

test("strategies: weighted follows the 5:3:1:1 weights", () => {
  const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const to of singles(run("weighted", createLanes(), 10_000, 9).picks)) counts[to]++;
  assert.ok(Math.abs(counts.A / 10_000 - 0.5) < 0.03, JSON.stringify(counts));
  assert.ok(Math.abs(counts.B / 10_000 - 0.3) < 0.03, JSON.stringify(counts));
  assert.ok(Math.abs(counts.C / 10_000 - 0.1) < 0.02, JSON.stringify(counts));
  assert.ok(Math.abs(counts.D / 10_000 - 0.1) < 0.02, JSON.stringify(counts));
});

test("strategies: round-robin cycles and skips a failed lane", () => {
  assert.deepEqual(singles(run("round-robin", createLanes(), 6).picks), [
    "A",
    "B",
    "C",
    "D",
    "A",
    "B",
  ]);
  assert.deepEqual(singles(run("round-robin", fail(createLanes(), "B"), 4).picks), [
    "A",
    "C",
    "D",
    "A",
  ]);
});

test("strategies: context-relay hands the session on when its gauge is full", () => {
  const { picks, st } = run("context-relay", createLanes(), 6);
  assert.deepEqual(picks.slice(0, 4), [
    { kind: "single", to: "A" },
    { kind: "single", to: "A" },
    { kind: "single", to: "A" },
    { kind: "single", to: "A" },
  ]);
  assert.deepEqual(picks[4], { kind: "relay", from: "A", to: "B" });
  assert.deepEqual(picks[5], { kind: "single", to: "B" });
  assert.equal(st.sessionLane, "B");
  // The session's lane fails: relay straight away.
  const lanes = createLanes();
  const state = createStratState();
  pick("context-relay", lanes, state, mulberry32(1));
  assert.deepEqual(pick("context-relay", fail(lanes, "A"), state, mulberry32(1)), {
    kind: "relay",
    from: "A",
    to: "B",
  });
});

test("strategies: fill-first drains A, then B", () => {
  const lanes = createLanes();
  assert.deepEqual(singles(run("fill-first", lanes, 2).picks), ["A", "A"]);
  const drained = lanes.map((lane) => (lane.id === "A" ? { ...lane, quota: 0 } : lane));
  assert.deepEqual(singles(run("fill-first", drained, 2).picks), ["B", "B"]);
});

test("strategies: p2c keeps the less-loaded of two random lanes, never the busiest", () => {
  const lanes = createLanes(); // C carries the highest load
  const picked = singles(run("p2c", lanes, 500, 4).picks);
  assert.ok(!picked.includes("C"), "the busiest lane loses every pair it is drawn into");
  assert.ok(new Set(picked).size >= 2, "two random choices, not a fixed winner");
});

test("strategies: random reaches every healthy lane", () => {
  assert.equal(new Set(singles(run("random", createLanes(), 200, 5).picks)).size, 4);
});

test("strategies: least-used balances request counts", () => {
  const { picks, st } = run("least-used", createLanes(), 8);
  assert.deepEqual(singles(picks), ["A", "B", "C", "D", "A", "B", "C", "D"]);
  assert.deepEqual(st.counts, { A: 2, B: 2, C: 2, D: 2 });
});

test("strategies: cost-optimized, headroom, reset-aware and context-optimized read their gauge", () => {
  const lanes = createLanes();
  assert.deepEqual(singles(run("cost-optimized", lanes, 1).picks), ["C"]); // cheapest, first in order
  assert.deepEqual(singles(run("headroom", lanes, 1).picks), ["D"]); // most quota left
  assert.deepEqual(singles(run("reset-aware", lanes, 1).picks), ["C"]); // soonest reset
  assert.deepEqual(singles(run("reset-window", lanes, 1).picks), ["C"]);
  assert.deepEqual(singles(run("context-optimized", lanes, 1).picks), ["B"]); // largest window
  assert.deepEqual(singles(run("cache-optimized", lanes, 3).picks), ["B", "B", "B"]); // the cached lane
  // Expiring quota first: a lane with no quota left is not "expiring".
  const empty = lanes.map((lane) => (lane.id === "C" ? { ...lane, quota: 0 } : lane));
  assert.deepEqual(singles(run("reset-aware", empty, 1).picks), ["B"]);
});

test("strategies: quota-weighted favours quota / (load + 1)", () => {
  const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const to of singles(run("quota-weighted", createLanes(), 8000, 6).picks)) counts[to]++;
  // A .82/2 = .41, B .55/1, C .3/3 = .1, D .95/1 → D > B > A > C.
  assert.ok(
    counts.D > counts.B && counts.B > counts.A && counts.A > counts.C,
    JSON.stringify(counts)
  );
});

test("strategies: strict-random deals each lane once per deck", () => {
  const picked = singles(run("strict-random", createLanes(), 12, 2).picks);
  for (let deck = 0; deck < 3; deck++) {
    assert.deepEqual([...picked.slice(deck * 4, deck * 4 + 4)].sort(), ["A", "B", "C", "D"]);
  }
});

test("strategies: auto scores lanes with the live deck weights", () => {
  const lanes = createLanes();
  const st = createStratState();
  st.autoWeights = { factorIds: ["costInv", "quota"], weights: [1, 0] };
  assert.deepEqual(pick("auto", lanes, st, mulberry32(1)), { kind: "single", to: "C" });
  st.autoWeights = { factorIds: ["costInv", "quota"], weights: [0, 1] };
  assert.deepEqual(pick("auto", lanes, st, mulberry32(1)), { kind: "single", to: "D" });
  st.autoWeights = { factorIds: ["contextAffinity"], weights: [1] };
  assert.deepEqual(pick("auto", lanes, st, mulberry32(1)), { kind: "single", to: "B" });
});

test("strategies: lkgp sticks to the last good lane, and moves only when it fails", () => {
  const lanes = createLanes();
  const st = createStratState();
  const rng = mulberry32(1);
  assert.deepEqual(pick("lkgp", lanes, st, rng), { kind: "single", to: "A" });
  st.lastGood = "C";
  assert.deepEqual(pick("lkgp", lanes, st, rng), { kind: "single", to: "C" });
  assert.deepEqual(pick("lkgp", lanes, st, rng), { kind: "single", to: "C" });
  assert.deepEqual(pick("lkgp", fail(lanes, "C"), st, rng), { kind: "single", to: "A" });
  assert.deepEqual(
    pick("lkgp", lanes, st, rng),
    { kind: "single", to: "A" },
    "A is the new last good"
  );
});

test("strategies: fusion fans out to three with a judge; pipeline chains A→B→C", () => {
  assert.deepEqual(pick("fusion", createLanes(), createStratState(), mulberry32(1)), {
    kind: "fanout",
    to: ["A", "B", "C"],
    judge: true,
  });
  assert.equal(FANOUT, 3);
  assert.deepEqual(pick("pipeline", createLanes(), createStratState(), mulberry32(1)), {
    kind: "chain",
    to: ["A", "B", "C"],
  });
  assert.deepEqual(pick("pipeline", fail(createLanes(), "B"), createStratState(), mulberry32(1)), {
    kind: "chain",
    to: ["A", "C", "D"],
  });
});

test("strategies: picks are reproducible from the seed", () => {
  for (const id of ["random", "p2c", "weighted", "strict-random", "quota-weighted"]) {
    assert.deepEqual(run(id, createLanes(), 30, 11).picks, run(id, createLanes(), 30, 11).picks);
  }
});
