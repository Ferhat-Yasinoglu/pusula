import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_WEIGHTS } from "../../open-sse/services/autoCombo/scoring.ts";
import { BREAKER_PROFILES, SAMPLE_CANDIDATES } from "../../src/app/landing/landingTypes.ts";
import {
  act,
  advanceUntil,
  candidate,
  createWorld,
  step,
  type World,
} from "../../src/app/landing/sim/landingSim.ts";
import {
  AUTOPLAY_BEATS,
  AUTOPLAY_COOLOFF_S,
  AUTOPLAY_IDLE_S,
  AUTOPLAY_SPEED,
  COMPACT_MAX_WIDTH,
  FAULT_KEY,
  FAULT_MODEL,
  LATCH_RESOLVE_MAX_MS,
  PROFILE_FOCUS,
  PROFILE_IDS,
  RAIL_COMPACT,
  RAIL_WIDE,
  autoplayMayStart,
  autoplayTargets,
  bandPerimeter,
  ceilSeconds,
  cellCenterX,
  createAutoplay,
  decayShare,
  latchShown,
  lowestBit,
  meterLevel,
  railGeometry,
  railMetrics,
  shareOf,
  stepAutoplay,
  tenthSeconds,
  type AutoplayPhase,
  type RailMetrics,
} from "../../src/app/landing/components/resilience/stormModel.ts";

const CSS = readFileSync(
  new URL("../../src/app/landing/components/resilience/resilience.css", import.meta.url),
  "utf8"
);

/** Custom properties of the first `.pusula-landing .res-stage { … }` block after `from`. */
function stageVars(from: number): Map<string, number> {
  const start = CSS.indexOf(".pusula-landing .res-stage {", from);
  assert.ok(start >= 0, "res-stage block not found");
  const end = CSS.indexOf("}", start);
  const out = new Map<string, number>();
  for (const match of CSS.slice(start, end).matchAll(/(--rail-[a-z0-9-]+):\s*([0-9.]+)px/g)) {
    out.set(match[1], Number(match[2]));
  }
  return out;
}

function expectedVars(m: RailMetrics): Record<string, number> {
  return {
    "--rail-h": m.h,
    "--rail-mid": m.mid,
    "--rail-src-x": m.srcX,
    "--rail-src-r": m.srcR,
    "--rail-drop-x": m.dropX,
    "--rail-band-x0": m.bandX0,
    "--rail-band-end": m.bandEnd,
    "--rail-band-y0": m.bandY0,
    "--rail-band-y1": m.bandY1,
    "--rail-band-r": m.bandR,
    "--rail-lane-t0": m.laneTop[0],
    "--rail-lane-step": m.laneTop[1] - m.laneTop[0],
    "--rail-lane-h": m.laneH,
    "--rail-lane-x0": m.laneX0,
    "--rail-gate-off": m.gateOff,
    "--rail-gate-w": m.gateW,
    "--rail-slot-h": m.slotH,
    "--rail-slot-gap": m.slotGap,
    "--rail-fan-w": m.fanW,
    "--rail-up-end": m.upEnd,
    "--rail-up-r": m.upR,
    "--rail-fb-y": m.fbY,
    "--rail-fb-end": m.fbEnd,
    "--rail-cell-w": m.cellW,
    "--rail-cell-h": m.cellH,
    "--rail-cell-gap": m.cellGap,
  };
}

const FACTORS = Object.entries(DEFAULT_WEIGHTS as unknown as Record<string, number>)
  .map(([id, weight]) => ({ id, weight }))
  .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));

function world(): World {
  return createWorld({
    factorIds: FACTORS.map((f) => f.id),
    defaults: FACTORS.map((f) => f.weight),
  });
}

/* ------------------------------------------------------------------------ */
/* Geometry                                                                 */
/* ------------------------------------------------------------------------ */

test("resilience.css repeats the wide rail metrics", () => {
  const vars = stageVars(0);
  for (const [name, value] of Object.entries(expectedVars(RAIL_WIDE))) {
    assert.equal(vars.get(name), value, name);
  }
});

test("resilience.css repeats the compact rail metrics inside the container query", () => {
  const at = CSS.indexOf(`@container res-rail (max-width: ${COMPACT_MAX_WIDTH - 0.02}px)`);
  assert.ok(at >= 0, "compact container query not found");
  const vars = stageVars(at);
  for (const [name, value] of Object.entries(expectedVars(RAIL_COMPACT))) {
    assert.equal(vars.get(name), value, name);
  }
});

test("lane tops are evenly spaced (the CSS places lanes with one step)", () => {
  for (const m of [RAIL_WIDE, RAIL_COMPACT]) {
    assert.equal(m.laneTop[1] - m.laneTop[0], m.laneTop[2] - m.laneTop[1]);
  }
});

test("the compact rail is used below 640px of stage width", () => {
  assert.equal(railMetrics(390), RAIL_COMPACT);
  assert.equal(railMetrics(639), RAIL_COMPACT);
  assert.equal(railMetrics(640), RAIL_WIDE);
  assert.equal(railGeometry(358).compact, true);
  assert.equal(railGeometry(1360).compact, false);
});

test("every rail fits its stage and nests: lanes in the band, slots in the lanes", () => {
  for (const width of [320, 358, 390, 639, 640, 720, 960, 1216, 1360]) {
    const g = railGeometry(width);
    const where = `width ${width}`;
    assert.ok(g.srcX + g.srcR < g.dropX && g.dropX < g.bandX0, `${where}: source, drop, band`);
    assert.ok(g.bandX0 < g.laneX0 && g.laneX0 < g.laneEndX, `${where}: lane run`);
    assert.ok(g.laneEndX < g.gateX0 && g.gateX1 < g.bandX1, `${where}: gates inside the band`);
    assert.ok(g.bandX1 < g.upX - g.upR && g.upX + g.upR <= g.w, `${where}: upstream node`);
    assert.ok(g.fbX1 <= g.w && g.fbY > g.bandY1 && g.fbY < g.h, `${where}: fallback rail`);
    assert.equal(g.mid, (g.bandY0 + g.bandY1) / 2, `${where}: mid`);
    for (let k = 0; k < 3; k++) {
      assert.ok(
        g.laneTop[k] > g.bandY0 && g.laneTop[k] + g.laneH < g.bandY1,
        `${where}: lane ${k}`
      );
      for (let s = 0; s < 3; s++) {
        const y = g.slotMid[k * 3 + s];
        assert.ok(y - g.slotH / 2 >= g.laneTop[k] - 1e-9, `${where}: slot ${k}/${s} top`);
        assert.ok(
          y + g.slotH / 2 <= g.laneTop[k] + g.laneH + 1e-9,
          `${where}: slot ${k}/${s} bottom`
        );
      }
    }
    assert.ok(g.bandY0 - g.cellH / 2 > 16, `${where}: room for the provider label and bolts`);
  }
});

test("breaker cells are centred on the band and fit it for every profile", () => {
  for (const width of [390, 1360]) {
    const g = railGeometry(width);
    const centre = (g.bandX0 + g.bandX1) / 2;
    for (const p of BREAKER_PROFILES) {
      const first = cellCenterX(g, 0, p.opensAfter);
      const last = cellCenterX(g, p.opensAfter - 1, p.opensAfter);
      assert.ok(Math.abs((first + last) / 2 - centre) < 1e-9, `${p.id} centred`);
      assert.ok(first - g.cellW / 2 > g.bandX0 && last + g.cellW / 2 < g.bandX1, `${p.id} fits`);
    }
  }
});

test("the band perimeter is a rounded rectangle's", () => {
  const g = railGeometry(1000);
  const w = g.bandX1 - g.bandX0;
  const h = g.bandY1 - g.bandY0;
  const expected = 2 * (w + h) - 8 * g.bandR + 2 * Math.PI * g.bandR;
  assert.ok(Math.abs(bandPerimeter(g) - expected) < 1e-9);
});

/* ------------------------------------------------------------------------ */
/* Profiles                                                                 */
/* ------------------------------------------------------------------------ */

test("each profile focuses a sample candidate that runs on that breaker profile", () => {
  assert.deepEqual(
    [...PROFILE_IDS],
    BREAKER_PROFILES.map((p) => p.id)
  );
  for (const id of PROFILE_IDS) {
    const entry = SAMPLE_CANDIDATES.find((c) => c.id === PROFILE_FOCUS[id]);
    assert.ok(entry, `${id} focuses a sample candidate`);
    assert.equal(entry.profile, id);
  }
  assert.equal(FAULT_MODEL, 1, "model 2");
  assert.equal(FAULT_KEY, 1, "key 2");
});

/* ------------------------------------------------------------------------ */
/* Autoplay                                                                 */
/* ------------------------------------------------------------------------ */

test("autoplay waits for idle time, the cool-off and a clean deck", () => {
  assert.equal(autoplayMayStart(AUTOPLAY_IDLE_S, AUTOPLAY_COOLOFF_S, false), true);
  assert.equal(autoplayMayStart(AUTOPLAY_IDLE_S - 0.1, AUTOPLAY_COOLOFF_S, false), false);
  assert.equal(autoplayMayStart(AUTOPLAY_IDLE_S, AUTOPLAY_COOLOFF_S - 0.1, false), false);
  assert.equal(autoplayMayStart(60, 60, true), false, "never over a visitor's fault");
  assert.equal(AUTOPLAY_COOLOFF_S, 20);
  assert.equal(AUTOPLAY_SPEED, 5);
});

test("autoplay starts within a second of the rail coming into view", () => {
  // At ×1 the focused provider sees about one request every two seconds: a
  // visitor scrolling past must not meet an empty rail.
  assert.ok(AUTOPLAY_IDLE_S > 0 && AUTOPLAY_IDLE_S <= 1, `${AUTOPLAY_IDLE_S}`);
  assert.equal(autoplayMayStart(AUTOPLAY_IDLE_S, AUTOPLAY_COOLOFF_S, false), true);
});

test("the timed beats follow the script: 429 (0–4 s), rest, 401 (5–10 s), rest, then 503", () => {
  const st = createAutoplay();
  const seen: [AutoplayPhase, number][] = [];
  let t = 0;
  for (let i = 0; i < 115; i++) {
    stepAutoplay(st, 0.1, "closed");
    t = Math.round((t + 0.1) * 10) / 10;
    if (seen.length === 0 || seen[seen.length - 1][0] !== st.phase) seen.push([st.phase, t]);
  }
  assert.deepEqual(
    seen.map(([phase]) => phase),
    ["model", "modelRest", "key", "keyRest", "provider"]
  );
  assert.deepEqual(
    seen.slice(1).map(([, at]) => at),
    [4, 5, 10, 11]
  );
  assert.deepEqual(autoplayTargets("model"), {
    profile: "oauth",
    model: true,
    key: false,
    provider: false,
  });
  assert.deepEqual(autoplayTargets("key"), {
    profile: "oauth",
    model: false,
    key: true,
    provider: false,
  });
  assert.equal(autoplayTargets("provider").profile, "apikey");
  assert.equal(autoplayTargets("provider").provider, true);
  for (const phase of ["modelRest", "keyRest", "recover", "hold"] as const) {
    const want = autoplayTargets(phase);
    assert.equal(want.model || want.key || want.provider, false, `${phase} latches nothing`);
  }
});

test("the provider beat waits for the real breaker: off soon after OPEN, then held until CLOSED", () => {
  const st = createAutoplay();
  st.phase = "provider";
  stepAutoplay(st, 0.1, "degraded");
  assert.equal(st.phase, "provider");
  stepAutoplay(st, 0.1, "open");
  assert.equal(st.phase, "providerOpen");
  stepAutoplay(st, AUTOPLAY_BEATS.providerOpen, "open");
  assert.equal(st.phase, "recover");
  stepAutoplay(st, 1, "open");
  stepAutoplay(st, 1, "halfOpen");
  assert.equal(st.phase, "recover");
  stepAutoplay(st, 0.1, "closed");
  assert.equal(st.phase, "hold");
  stepAutoplay(st, AUTOPLAY_BEATS.hold, "closed");
  assert.equal(st.phase, "model", "loops");
});

test("against the real deck at ×5, the script trips the API-key breaker and sees it close again", () => {
  const w = world();
  act.setSpeed(AUTOPLAY_SPEED)(w);
  const st = createAutoplay();
  const states = new Set<string>();
  let looped = false;
  let maxFailures = 0;
  // Real time in 100 ms frames, as the heartbeat runs it; at most 60 s.
  for (let frame = 0; frame < 600 && !looped; frame++) {
    const before = st.phase;
    const focus = PROFILE_FOCUS[autoplayTargets(before).profile];
    stepAutoplay(st, 0.1, candidate(w, focus).breaker.state);
    const want = autoplayTargets(st.phase);
    const id = PROFILE_FOCUS[want.profile];
    act.setModelRateLimited(id, FAULT_MODEL, want.model)(w);
    act.setKeyRevoked(id, FAULT_KEY, want.key)(w);
    act.setUpstreamDown(id, want.provider)(w);
    step(w, 100);
    if (want.profile === "apikey") {
      const c = candidate(w, "glm");
      states.add(c.breaker.state);
      maxFailures = Math.max(maxFailures, c.breaker.failures);
    }
    if (before === "hold" && st.phase === "model") looped = true;
  }
  const apikey = BREAKER_PROFILES.find((p) => p.id === "apikey");
  assert.ok(apikey);
  assert.ok(looped, "the loop completes");
  assert.ok(states.has("open"), "the breaker opened");
  assert.ok(states.has("halfOpen"), "it half-opened for a probe");
  assert.equal(candidate(w, "glm").breaker.state, "closed", "and closed again");
  assert.ok(maxFailures >= apikey.opensAfter, "it opened at the shipped threshold");
  assert.equal(candidate(w, "glm").upstreamDown, false, "no latch is left behind");
});

/* ------------------------------------------------------------------------ */
/* Reduced motion: latches resolved at once                                 */
/* ------------------------------------------------------------------------ */

test("a reduced-motion toggle can run the deck until the lock or the cooldown shows", () => {
  const w = world();
  const id = PROFILE_FOCUS.oauth;
  // The latch alone shows nothing until a request uses that model or key.
  act.setModelRateLimited(id, FAULT_MODEL, true)(w);
  act.setKeyRevoked(id, FAULT_KEY, true)(w);
  assert.equal(latchShown(w, id, "model", true), false);
  assert.equal(latchShown(w, id, "key", true), false);
  assert.ok(advanceUntil(w, (x) => latchShown(x, id, "model", true), LATCH_RESOLVE_MAX_MS));
  assert.ok(candidate(w, id).models[FAULT_MODEL].lockedUntilMs > w.simMs, "model 2 is locked");
  assert.ok(advanceUntil(w, (x) => latchShown(x, id, "key", true), LATCH_RESOLVE_MAX_MS));
  assert.ok(candidate(w, id).keys[FAULT_KEY].coolingUntilMs > w.simMs, "key 2 is cooling");
  assert.equal(candidate(w, id).breaker.state, "closed", "neither touches the breaker");
  // Off: the lock and the cooldown lapse within the resolve budget.
  act.setModelRateLimited(id, FAULT_MODEL, false)(w);
  act.setKeyRevoked(id, FAULT_KEY, false)(w);
  assert.ok(advanceUntil(w, (x) => latchShown(x, id, "model", false), LATCH_RESOLVE_MAX_MS));
  assert.ok(advanceUntil(w, (x) => latchShown(x, id, "key", false), LATCH_RESOLVE_MAX_MS));
  assert.equal(latchShown(w, id, "provider", false), true);
});

test("the failure meter reads idle, counting, hot from the degraded threshold, open at the trip", () => {
  assert.equal(meterLevel(0, "closed", 5, 8), "idle");
  assert.equal(meterLevel(3, "closed", 5, 8), "count");
  assert.equal(meterLevel(5, "degraded", 5, 8), "hot");
  assert.equal(meterLevel(8, "open", 5, 8), "open");
  assert.equal(meterLevel(1, "closed", null, 2), "count", "local has no degraded band");
  assert.equal(meterLevel(2, "open", null, 2), "open");
});

/* ------------------------------------------------------------------------ */
/* Readout helpers                                                          */
/* ------------------------------------------------------------------------ */

test("countdowns round up and never go negative", () => {
  assert.equal(ceilSeconds(29_001), 30);
  assert.equal(ceilSeconds(30_000), 30);
  assert.equal(ceilSeconds(0), 0);
  assert.equal(ceilSeconds(-5), 0);
  assert.equal(tenthSeconds(2_401), 2.5);
  assert.equal(tenthSeconds(-1), 0);
});

test("lowestBit finds the first locked model", () => {
  assert.equal(lowestBit(0), -1);
  assert.equal(lowestBit(0b100), 2);
  assert.equal(lowestBit(0b110), 1);
});

test("the divert share tracks the focused provider's recent share, within bounds", () => {
  const meter = { focus: 0, total: 0 };
  assert.ok(Math.abs(shareOf(meter) - 1 / 6) < 1e-9, "prior before any traffic");
  meter.focus = 2;
  meter.total = 10;
  assert.ok(Math.abs(shareOf(meter) - 0.2) < 1e-9);
  meter.focus = 0;
  assert.equal(shareOf(meter), 0.05, "floor");
  meter.focus = 10;
  assert.equal(shareOf(meter), 0.6, "cap");
  const decaying = { focus: 4, total: 8 };
  decayShare(decaying, 8);
  assert.ok(Math.abs(decaying.focus - 2) < 1e-9 && Math.abs(decaying.total - 4) < 1e-9);
});
