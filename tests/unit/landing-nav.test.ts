import test from "node:test";
import assert from "node:assert/strict";
import {
  DOCK_LIFT_GAP_PX,
  FAILING_REPEAT_MS,
  TOAST_GAP_MS,
  TOAST_SOURCE_WINDOW_MS,
  TAPE_MAX_DEG,
  TAPE_SEAM,
  TAPE_MIN_DEG,
  TAPE_PX_PER_DEG,
  TAPE_STRIP_WIDTH,
  angleDelta,
  buildTapeNumerals,
  buildTapeTicks,
  createSourceLedger,
  createToastGate,
  createToastPacer,
  dockClearance,
  homeHeading,
  navBearingText,
  nearestWaypoint,
  nextSpeed,
  progressShare,
  tapeHeading,
  tapeOffsetPx,
  tapeX,
  toastTone,
  viewCoverage,
  waypointCopies,
} from "../../src/app/landing/components/nav/navModel";
import { SPEEDS, type DeckEvent } from "../../src/app/landing/sim/landingSim";

const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];

test("tape strip spans −180..540 at 3px per degree", () => {
  assert.equal(TAPE_STRIP_WIDTH, (TAPE_MAX_DEG - TAPE_MIN_DEG) * TAPE_PX_PER_DEG);
  assert.equal(tapeX(TAPE_MIN_DEG), 0);
  assert.equal(tapeX(0), 180 * TAPE_PX_PER_DEG);
  assert.equal(tapeX(TAPE_MAX_DEG), TAPE_STRIP_WIDTH);
});

test("tape offset puts the heading under the caret and clamps", () => {
  assert.equal(tapeOffsetPx(0), -540);
  assert.equal(tapeOffsetPx(45), -675);
  assert.equal(tapeOffsetPx(360), -1620);
  assert.equal(tapeOffsetPx(9999), -TAPE_STRIP_WIDTH);
  assert.equal(tapeOffsetPx(-9999), -0);
  // Monotonic: a later heading always slides the strip further left.
  for (let h = 0; h < 360; h += 7) assert.ok(tapeOffsetPx(h + 1) < tapeOffsetPx(h));
});

test("ticks every 5°, majors every 15°, none on the 45° waypoints", () => {
  const ticks = buildTapeTicks();
  for (const tick of ticks) {
    assert.equal(Math.abs(tick.deg % 5), 0);
    assert.notEqual(Math.abs(tick.deg % 45), 0);
    assert.equal(tick.kind, Math.abs(tick.deg % 15) === 0 ? "major" : "minor");
    assert.equal(tick.x, tapeX(tick.deg));
  }
  // 145 five-degree marks across 720°, minus the 17 waypoint positions.
  assert.equal(ticks.length, 145 - 17);
  const numerals = buildTapeNumerals();
  assert.equal(numerals[0], -180);
  assert.equal(numerals[numerals.length - 1], 540);
  assert.equal(numerals.length, 17);
});

test("waypoint copies keep the tape continuous at both ends", () => {
  assert.deepEqual(waypointCopies(0), [0, 360]);
  assert.deepEqual(waypointCopies(45), [45, 405]);
  assert.deepEqual(waypointCopies(180), [180, -180, 540]);
  assert.deepEqual(waypointCopies(315), [315, -45]);
  for (const bearing of BEARINGS) {
    for (const deg of waypointCopies(bearing)) {
      assert.ok(deg >= TAPE_MIN_DEG && deg <= TAPE_MAX_DEG);
      assert.equal(((deg % 360) + 360) % 360, bearing);
    }
  }
});

test("the waypoint under the caret is the circularly nearest one", () => {
  assert.equal(angleDelta(350, 10), 20);
  assert.equal(angleDelta(10, 350), -20);
  assert.equal(angleDelta(0, 180), 180);
  assert.equal(nearestWaypoint(0, BEARINGS), 0);
  assert.equal(nearestWaypoint(22, BEARINGS), 0);
  assert.equal(nearestWaypoint(23, BEARINGS), 1);
  assert.equal(nearestWaypoint(140, BEARINGS), 3);
  assert.equal(nearestWaypoint(350, BEARINGS), 0); // back to north
  assert.equal(nearestWaypoint(360, BEARINGS), 0);
  assert.equal(nearestWaypoint(22.5, BEARINGS), 0); // ties go to the lower index
  assert.equal(nearestWaypoint(10, []), -1);
});

test("the tape holds each station's bearing and turns across the seams", () => {
  // The voyage starts at north without a turn.
  assert.equal(tapeHeading(0), 0);
  assert.equal(tapeHeading(-4), 0);
  assert.equal(tapeHeading(Number.NaN), 0);
  assert.equal(tapeHeading(10), 0);
  // Held while a station fills the middle of the viewport.
  for (const bearing of BEARINGS.slice(1, -1)) {
    for (const f of [TAPE_SEAM + 0.01, 0.5, 1 - TAPE_SEAM - 0.01]) {
      assert.equal(tapeHeading(bearing + 45 * f), bearing, `${bearing} at ${f}`);
    }
  }
  // Without a measured footer the last station turns home over the end of its span.
  for (const f of [TAPE_SEAM + 0.01, 0.5, 1 - 2 * TAPE_SEAM - 0.01]) {
    assert.equal(tapeHeading(315 + 45 * f), 315, `315 at ${f}`);
  }
  // Each turn is centred on a boundary: half-way exactly as the next station arrives.
  for (const bearing of BEARINGS.slice(1)) {
    assert.ok(Math.abs(tapeHeading(bearing) - (bearing - 22.5)) < 1e-9, `boundary ${bearing}`);
  }
  // Continuous and monotonic across the whole voyage.
  let previous = tapeHeading(0);
  for (let h = 0.05; h <= 360; h += 0.05) {
    const next = tapeHeading(h);
    assert.ok(next >= previous - 1e-9, `monotonic at ${h}`);
    assert.ok(next - previous < 3, `continuous at ${h}`);
    previous = next;
  }
  // The very bottom is home (north again).
  assert.equal(tapeHeading(360), 360);
  assert.equal(tapeHeading(400), 360);
});

test("the lit waypoint changes exactly as the next station reaches the middle", () => {
  for (let i = 1; i < BEARINGS.length; i++) {
    assert.equal(nearestWaypoint(tapeHeading(BEARINGS[i] - 0.01), BEARINGS), i - 1);
    assert.equal(nearestWaypoint(tapeHeading(BEARINGS[i] + 0.01), BEARINGS), i);
  }
  // The launch station stays lit until the footer arrives, then north.
  const home = 345;
  assert.equal(nearestWaypoint(tapeHeading(home - 0.01, home), BEARINGS), 7);
  assert.equal(nearestWaypoint(tapeHeading(home + 0.01, home), BEARINGS), 0);
  assert.equal(nearestWaypoint(tapeHeading(359, home), BEARINGS), 0);
  assert.equal(tapeHeading(360, home), 360);
  // A footer arriving late still finishes the turn by 360°; an early one waits for the turn in.
  assert.equal(tapeHeading(360, 360), 360);
  assert.equal(nearestWaypoint(tapeHeading(350, 360), BEARINGS), 7);
  assert.equal(tapeHeading(315 + 45 * TAPE_SEAM, 300), 315);
});

test("home heading: where the footer's top crosses the middle line", () => {
  // Launch top at 10000, footer top at 11500, 900px viewport, max scroll 11771.
  const at = homeHeading(10000, 11500, 900, 11771);
  const from = 10000 - 450;
  assert.ok(Math.abs(at - (315 + (45 * (11500 - 450 - from)) / (11771 - from))) < 1e-9);
  assert.ok(at > 315 && at < 360);
  assert.equal(homeHeading(10000, 99999, 900, 11771), 360);
  assert.equal(homeHeading(10000, 0, 900, 11771), 315);
  assert.equal(homeHeading(10000, 11500, 900, 0), 360);
});

test("progress line share", () => {
  assert.equal(progressShare(0), 0);
  assert.equal(progressShare(-5), 0);
  assert.equal(progressShare(Number.NaN), 0);
  assert.equal(progressShare(180), 0.5);
  assert.equal(progressShare(360), 1);
  assert.equal(progressShare(400), 1);
});

test("time-lapse cycles ×1 → ×5 → ×10 → ×1", () => {
  assert.equal(nextSpeed(1, SPEEDS), 5);
  assert.equal(nextSpeed(5, SPEEDS), 10);
  assert.equal(nextSpeed(10, SPEEDS), 1);
  assert.equal(nextSpeed(3, SPEEDS), 1);
});

test("the dock climbs a short board and steps aside for a tall one", () => {
  assert.deepEqual(dockClearance(88, 900), { lift: 88 + DOCK_LIFT_GAP_PX, hide: false });
  // The board on a phone: too tall to climb, so the dock never sits on real figures.
  assert.deepEqual(dockClearance(380, 844), { lift: 0, hide: true });
  assert.deepEqual(dockClearance(0, 900), { lift: 0, hide: false });
  assert.deepEqual(dockClearance(88, 0), { lift: 0, hide: false });
});

test("nav bearings stay padded, except a dotted-zero north", () => {
  assert.equal(navBearingText("000"), "000");
  assert.equal(navBearingText("045"), "045");
  assert.equal(navBearingText("\u06F0\u06F0\u06F0"), "\u06F0"); // Persian ۰۰۰ → ۰
  assert.equal(navBearingText("\u0660\u0660\u0660"), "\u0660"); // Arabic-Indic
  assert.equal(navBearingText("\u06F0\u06F4\u06F5"), "\u06F0\u06F4\u06F5"); // ۰۴۵ stays
  assert.equal(
    navBearingText(new Intl.NumberFormat("fa", { minimumIntegerDigits: 3 }).format(0)),
    new Intl.NumberFormat("fa").format(0)
  );
});

let n = 0;
const routed = (failed: string[], to: string): DeckEvent =>
  ({
    n: ++n,
    t: 0,
    kind: "routed",
    from: "ghazni",
    sample: "sampleAgentic",
    failed,
    codes: failed.map(() => 503),
    to,
    probe: false,
    featured: false,
  }) as DeckEvent;
const breaker = (id: string, state: string): DeckEvent =>
  ({ n: ++n, t: 0, kind: "breaker", id, state }) as DeckEvent;

test("toast gate: visitor-caused only, one failing toast per beat", () => {
  const gate = createToastGate();
  assert.equal(gate.accept(routed(["claude"], "gpt"), false, 0), null);
  assert.deepEqual(gate.accept(routed(["claude"], "gpt"), true, 0), {
    kind: "failing",
    id: "claude",
    code: 503,
    fallback: "gpt",
  });
  assert.equal(gate.accept(routed(["claude"], "gpt"), true, 1000), null);
  assert.equal(gate.accept(routed([], "gpt"), true, 1000), null);
  const probe = { ...routed(["gemini"], "gpt"), probe: true } as DeckEvent;
  assert.equal(gate.accept(probe, true, 1000), null);
  assert.equal(gate.accept(routed(["claude"], "gpt"), true, FAILING_REPEAT_MS)?.kind, "failing");
});

test("toast gate: each breaker state once per episode, recovery closes it", () => {
  const gate = createToastGate();
  assert.equal(gate.accept(breaker("claude", "closed"), true, 0), null);
  assert.deepEqual(gate.accept(breaker("claude", "degraded"), true, 0), {
    kind: "state",
    id: "claude",
    state: "degraded",
  });
  assert.equal(gate.accept(breaker("claude", "open"), true, 0)?.kind, "state");
  assert.equal(gate.accept(breaker("claude", "halfOpen"), true, 0)?.kind, "state");
  // The open ↔ half-open probe cycle does not toast every probe.
  assert.equal(gate.accept(breaker("claude", "open"), true, 0), null);
  assert.equal(gate.accept(breaker("claude", "halfOpen"), true, 0), null);
  assert.deepEqual(gate.accept(breaker("claude", "closed"), true, 0), {
    kind: "state",
    id: "claude",
    state: "closed",
  });
  // A new episode toasts again, and the failing toast is re-armed.
  assert.equal(gate.accept(breaker("claude", "degraded"), true, 0)?.kind, "state");
  assert.equal(gate.accept(breaker("gpt", "open"), false, 0), null);
  gate.reset();
  assert.equal(gate.accept(breaker("claude", "degraded"), true, 0)?.kind, "state");
});

test("messages: at most one per gap, the next one told when to come back", () => {
  const pacer = createToastPacer();
  assert.equal(pacer.wait(0), 0);
  assert.equal(pacer.allow(1000), true);
  assert.equal(pacer.wait(1000), TOAST_GAP_MS);
  assert.equal(pacer.wait(1000 + TOAST_GAP_MS - 1), 1);
  assert.equal(pacer.wait(1000 + TOAST_GAP_MS + 50), 0);
  assert.equal(pacer.allow(1000 + TOAST_GAP_MS - 1), false);
  // A refused message does not push the next slot back.
  assert.equal(pacer.allow(1000 + TOAST_GAP_MS), true);
  assert.equal(pacer.allow(1000 + TOAST_GAP_MS + 10), false);
  pacer.reset();
  assert.equal(pacer.allow(1000 + TOAST_GAP_MS + 10), true);
  const quick = createToastPacer(100);
  assert.equal(quick.allow(0), true);
  assert.equal(quick.allow(100), true);
});

test("an outage keeps the station it came from until its breaker closes", () => {
  const ledger = createSourceLedger<string>();
  // No press yet: unknown source.
  assert.equal(ledger.sourceOf("gemini", 0), null);
  ledger.touch("bridge", 1000);
  assert.equal(ledger.sourceOf("claude", 2500), "bridge");
  // Later presses elsewhere do not move an outage that already has its source.
  ledger.touch("tools", 3000);
  assert.equal(ledger.sourceOf("claude", 20000), "bridge");
  // A first message too long after the last press has no source.
  assert.equal(ledger.sourceOf("glm", 3000 + TOAST_SOURCE_WINDOW_MS + 1), null);
  // The unknown source sticks for the whole outage too.
  ledger.touch("network", 30000);
  assert.equal(ledger.sourceOf("gemini", 30001), null);
  // Recovery ends the outage; the next one is attributed afresh.
  ledger.end("claude");
  assert.equal(ledger.sourceOf("claude", 30500), "network");
});

test("view coverage: the share of the viewport a station fills", () => {
  assert.equal(viewCoverage(0, 900, 900), 1);
  assert.equal(viewCoverage(-2000, 3000, 900), 1);
  assert.equal(viewCoverage(450, 3000, 900), 0.5);
  assert.equal(viewCoverage(-500, 90, 900), 0.1);
  assert.equal(viewCoverage(900, 1500, 900), 0);
  assert.equal(viewCoverage(-900, -10, 900), 0);
  assert.equal(viewCoverage(0, 900, 0), 0);
});

test("the dock dot's tone follows the message", () => {
  assert.equal(toastTone({ kind: "failing", id: "claude", code: 503, fallback: "gpt" }), "fail");
  assert.equal(toastTone({ kind: "state", id: "claude", state: "open" }), "fail");
  assert.equal(toastTone({ kind: "state", id: "claude", state: "degraded" }), "warn");
  assert.equal(toastTone({ kind: "state", id: "claude", state: "halfOpen" }), "warn");
  assert.equal(toastTone({ kind: "state", id: "claude", state: "closed" }), "ok");
});
