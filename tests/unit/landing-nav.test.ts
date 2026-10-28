import test from "node:test";
import assert from "node:assert/strict";
import {
  DOCK_LIFT_GAP_PX,
  FAILING_REPEAT_MS,
  TAPE_MAX_DEG,
  TAPE_MIN_DEG,
  TAPE_PX_PER_DEG,
  TAPE_STRIP_WIDTH,
  angleDelta,
  buildTapeNumerals,
  buildTapeTicks,
  createToastGate,
  dockClearance,
  navBearingText,
  nearestWaypoint,
  nextSpeed,
  progressShare,
  pushToast,
  tapeOffsetPx,
  tapeX,
  waypointCopies,
  type ToastEntry,
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

test("toasts: a provider's state updates in place, the stack stays at two", () => {
  const failing: ToastEntry = {
    key: 1,
    spec: { kind: "failing", id: "claude", fallback: "gpt" },
    leaving: false,
  };
  const degraded: ToastEntry = {
    key: 2,
    spec: { kind: "state", id: "claude", state: "degraded" },
    leaving: false,
  };
  const open: ToastEntry = {
    key: 3,
    spec: { kind: "state", id: "claude", state: "open" },
    leaving: false,
  };
  let list = pushToast([], failing, 2);
  list = pushToast(list, degraded, 2);
  list = pushToast(list, open, 2);
  assert.deepEqual(
    list.map((toast) => toast.key),
    [1, 3]
  );
  const other: ToastEntry = {
    key: 4,
    spec: { kind: "state", id: "gemini", state: "open" },
    leaving: false,
  };
  list = pushToast(list, other, 2);
  assert.deepEqual(
    list.map((toast) => toast.key),
    [3, 4]
  );
  // A leaving toast is never reused.
  const leaving = list.map((toast) => ({ ...toast, leaving: true }));
  assert.equal(pushToast(leaving, { ...open, key: 5 }, 2).length, 2);
});
