import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROUTING_STRATEGY_VALUES } from "../../src/shared/constants/routingStrategies.ts";
import { DEFAULT_WEIGHTS } from "../../open-sse/services/autoCombo/scoring.ts";
import { normalizeWeights } from "../../src/app/landing/sim/landingSim.ts";
import {
  HOP_POINTS,
  MAX_SHARE,
  ROSE_BASE_AT,
  ROSE_DISC,
  ROSE_MIN,
  ROSE_R,
  busBearing,
  busOrder,
  cardDoor,
  clamp01,
  clampTo,
  factorKey,
  fillAt,
  fillTransform,
  framePercent,
  growAt,
  hopArc,
  isShortHop,
  kitePoints,
  labelAnchor,
  laneHitSpan,
  pinnedReveal,
  laneLayout,
  nearestIndex,
  pointBearing,
  pointRadius,
  polylineAt,
  polylineLength,
  ratioForDistance,
  rawWeightForRatio,
  rawWeightForShare,
  strategyKey,
  tunerCell,
  weightRatios,
  weightedScore,
  wrapIndex,
} from "../../src/app/landing/components/routing/routingKit.ts";

const LOCALES = ["en", "tr", "de", "fa"] as const;
function landingMessages(locale: string): Record<string, string> {
  const url = new URL(`../../src/i18n/messages/${locale}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")).landing;
}

const SHIPPED = Object.entries(DEFAULT_WEIGHTS as unknown as Record<string, number>)
  .map(([id, weight]) => ({ id, weight }))
  .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
const SHIPPED_W = SHIPPED.map((f) => f.weight);

test("routing: every strategy and factor id has its description key in all four locales", () => {
  for (const locale of LOCALES) {
    const m = landingMessages(locale);
    for (const id of ROUTING_STRATEGY_VALUES) {
      assert.ok(m[strategyKey(id)], `${locale}: missing ${strategyKey(id)}`);
    }
    for (const { id } of SHIPPED)
      assert.ok(m[factorKey(id)], `${locale}: missing ${factorKey(id)}`);
  }
  assert.equal(strategyKey("round-robin"), "strategy_round_robin");
  assert.equal(strategyKey("auto"), "strategy_auto");
  assert.equal(factorKey("costInv"), "factor_costInv");
});

test("routing: the rose is sized by the real weights (heaviest point reaches R)", () => {
  const ratios = weightRatios(SHIPPED_W);
  assert.equal(SHIPPED.length, 16);
  assert.equal(ratios[0], 1);
  assert.equal(pointRadius(ratios[0]), ROSE_R);
  // A weightless factor sits at .28R; ratios are monotone like the weights.
  assert.equal(pointRadius(0), ROSE_MIN * ROSE_R);
  for (let i = 1; i < ratios.length; i++) assert.ok(ratios[i] <= ratios[i - 1]);
  assert.deepEqual(weightRatios([0, 0]), [0, 0]);
  // 16 points, 22.5° apart, clockwise from north.
  assert.equal(pointBearing(0, 16), 0);
  assert.equal(pointBearing(1, 16), 22.5);
  assert.equal(pointBearing(15, 16), 337.5);
});

test("routing: ratioForDistance inverts pointRadius", () => {
  for (const q of [0, 0.1, 0.33, 0.5, 0.9, 1]) {
    assert.ok(Math.abs(ratioForDistance(pointRadius(q)) - q) < 1e-9);
  }
  assert.equal(ratioForDistance(0), 0);
  assert.ok(ratioForDistance(ROSE_R * 1.2) > 1);
});

test("routing: kite polygons put the tip on the axis and the base at .18R ± .11R", () => {
  const k = kitePoints(150);
  const full = k.full.split(" ").map((p) => p.split(",").map(Number));
  assert.deepEqual(full[0], [0, 0]);
  assert.deepEqual(full[2], [0, -150]);
  assert.equal(full[1][1], -ROSE_BASE_AT * ROSE_R);
  assert.equal(full[1][0], -full[3][0]);
  assert.ok(k.hi.startsWith("0,0 -"));
  assert.ok(k.lo.endsWith(`${full[3][0]},${full[3][1]}`));
});

test("routing: the fill is the kite scaled about the disc edge", () => {
  const d = ROSE_DISC * ROSE_R;
  assert.equal(fillTransform(0.5), `translate(0 ${-d}) scale(0.5) translate(0 ${d})`);
  assert.ok(fillTransform(2).includes("scale(1)"));
  assert.ok(fillTransform(-1).includes("scale(0)"));
});

test("routing: a drag ratio becomes exactly that share of the largest other weight", () => {
  const defaults = SHIPPED_W;
  const w = normalizeWeights(defaults, defaults);
  for (const index of [2, 9, 14]) {
    for (const ratio of [0, 0.25, 0.8]) {
      const raw = w.slice();
      raw[index] = rawWeightForRatio(w, index, ratio);
      const next = normalizeWeights(raw, defaults);
      const maxOthers = Math.max(...next.filter((_, i) => i !== index));
      assert.ok(Math.abs(next[index] / maxOthers - ratio) < 1e-9, `${index} @ ${ratio}`);
      assert.ok(Math.abs(next.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    }
  }
  // Past the largest other weight it becomes the largest (the point then reaches R).
  const raw = w.slice();
  raw[5] = rawWeightForRatio(w, 5, 1.3);
  const next = normalizeWeights(raw, defaults);
  assert.equal(weightRatios(next)[5], 1);
});

test("routing: keyboard and range steps land on the exact normalised share", () => {
  const defaults = SHIPPED_W;
  const w = normalizeWeights(defaults, defaults);
  for (const [index, share] of [
    [0, 0.25],
    [13, 0.01],
    [15, 0.4],
    [3, 0],
  ] as const) {
    const raw = w.slice();
    raw[index] = rawWeightForShare(w, index, share);
    const next = normalizeWeights(raw, defaults);
    assert.ok(Math.abs(next[index] - share) < 1e-9, `${index} → ${share}`);
  }
  // Clamped to MAX_SHARE.
  const raw = w.slice();
  raw[0] = rawWeightForShare(w, 0, 2);
  assert.ok(Math.abs(normalizeWeights(raw, defaults)[0] - MAX_SHARE) < 1e-9);
});

test("routing: weightedScore is Σ wᵢ·xᵢ", () => {
  assert.equal(weightedScore([0.5, 0.25, 0.25], [1, 0.4, 0]), 0.6);
  assert.equal(weightedScore([], []), 0);
});

test("routing: labels hang off the anchor by bearing, never by locale", () => {
  assert.deepEqual(labelAnchor(0), { h: "middle", v: "bottom" });
  assert.deepEqual(labelAnchor(90), { h: "start", v: "middle" });
  assert.deepEqual(labelAnchor(180), { h: "middle", v: "top" });
  assert.deepEqual(labelAnchor(270), { h: "end", v: "middle" });
  assert.deepEqual(labelAnchor(22.5), { h: "start", v: "bottom" });
  assert.deepEqual(labelAnchor(202.5), { h: "end", v: "top" });
  const north = framePercent(0, 100, 400, 400);
  assert.deepEqual(north, { left: 50, top: 25 });
  const east = framePercent(90, 100, 400, 400);
  assert.equal(east.left, 75);
  assert.ok(Math.abs(east.top - 50) < 1e-9);
});

test("routing: the reveal grows every point to full, then fills each to its value", () => {
  for (let i = 0; i < 16; i++) {
    assert.equal(growAt(0, i, 16), 0);
    assert.equal(growAt(0.35, i, 16), 1);
    assert.equal(fillAt(0.35, i, 16), 0);
    assert.equal(fillAt(0.9, i, 16), 1);
    assert.equal(fillAt(1, i, 16), 1);
  }
  // Weight order: the heaviest point grows first.
  assert.ok(growAt(0.1, 0, 16) > growAt(0.1, 15, 16));
  assert.ok(fillAt(0.5, 0, 16) > fillAt(0.5, 15, 16));
  let prev = -1;
  for (let s = 0; s <= 1.0001; s += 0.05) {
    const g = growAt(s, 7, 16);
    assert.ok(g >= prev);
    prev = g;
  }
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(Number.NaN), 0);
  assert.equal(clamp01(3), 1);
});

test("routing: the pinned reveal runs from a half-visible stage to 85% of the pin", () => {
  // 1440×900: a 643px stage centred below a 56px nav, in a stage + 450px track.
  const g = { trackH: 643 + 450, stageH: 643, vh: 900, top: 156.5 };
  const at = (scrolled: number) => pinnedReveal(scrolled / (g.trackH + g.vh), g);
  assert.equal(at(0), 0);
  assert.equal(at(643 / 2), 0); // half the stage on screen: it starts
  assert.ok(at(500) > 0 && at(500) < 0.35);
  const pinStart = g.vh - g.top;
  assert.ok(at(pinStart) > 0.35 && at(pinStart) < 1);
  assert.equal(at(pinStart + 450 * 0.85), 1); // done while still stuck
  assert.equal(at(pinStart + 450), 1);
  // Monotone in scroll; 0 until measured.
  let prev = 0;
  for (let d = 0; d < 2000; d += 25) {
    const v = at(d);
    assert.ok(v >= prev);
    prev = v;
  }
  assert.equal(pinnedReveal(0.5, { trackH: 0, stageH: 0, vh: 0, top: 0 }), 0);
});

test("routing: the bus lists the ranking first, then what it excludes (open breakers)", () => {
  assert.deepEqual(busOrder([0, 1, 3, 2, 4, 5], 6), [0, 1, 3, 2, 4, 5]);
  // claude (0) is OPEN and left out of the ranking: it drops to the end.
  assert.deepEqual(busOrder([1, 3, 4, 2, 5], 6), [1, 3, 4, 2, 5, 0]);
  // Junk and repeats are ignored; every candidate appears exactly once.
  assert.deepEqual(busOrder([2, 2, -1, 9, 1.5], 4), [2, 0, 1, 3]);
  assert.deepEqual(busOrder([], 3), [0, 1, 2]);
});

test("routing: the bus needle points at its row and mirrors in RTL", () => {
  // Column: the middle of six rows is due east (inline end) of the needle.
  const top = busBearing(0, "column", false);
  const bottom = busBearing(5, "column", false);
  assert.ok(top < 90 && bottom > 90, `${top} ${bottom}`);
  assert.equal(top + bottom, 180);
  assert.equal(busBearing(0, "column", true), 360 - top);
  // Rows go down the ranking: each one further clockwise (column) …
  for (let r = 1; r < 6; r++)
    assert.ok(busBearing(r, "column", false) > busBearing(r - 1, "column", false));
  // … and in the 2×3 grid the first row is above the needle, the last below.
  assert.ok(busBearing(0, "grid", false) < 90 && busBearing(4, "grid", false) > 90);
  assert.equal(busBearing(2, "grid", true), (360 - busBearing(2, "grid", false)) % 360);
  for (let i = 0; i < 6; i++) {
    for (const layout of ["column", "grid"] as const) {
      const b = busBearing(i, layout, false);
      assert.ok(b >= 0 && b < 360);
    }
  }
});

test("routing: tuner cells interleave two rows; long jumps are damped; picker nearest", () => {
  // Two rows: even ids above, odd below; id i spans columns i+1 and i+2.
  assert.deepEqual(tunerCell(0), { row: 1, col: 1 });
  assert.deepEqual(tunerCell(1), { row: 2, col: 2 });
  assert.deepEqual(tunerCell(19), { row: 2, col: 20 });
  // Same-row neighbours never share a column (no overlap at any width).
  for (let i = 0; i + 2 < 20; i++) {
    const a = tunerCell(i);
    const b = tunerCell(i + 2);
    assert.equal(a.row, b.row);
    assert.ok(a.col + 2 <= b.col);
  }
  assert.ok(isShortHop(4, 5) && isShortHop(5, 3));
  assert.ok(!isShortHop(19, 0) && !isShortHop(0, 19) && !isShortHop(2, 9));
  // The drawn needle is held between the first and the last id.
  assert.equal(clampTo(-217, 30, 1300), 30);
  assert.equal(clampTo(1656, 30, 1300), 1300);
  assert.equal(clampTo(500, 30, 1300), 500);
  assert.equal(clampTo(5, 10, 0), 10);
  assert.equal(wrapIndex(19, 1, 20), 0);
  assert.equal(wrapIndex(0, -1, 20), 19);
  assert.equal(nearestIndex([10, 50, 120], 70), 1);
  assert.equal(nearestIndex([10, 50, 120], 100), 2);
  assert.equal(nearestIndex(new Float32Array(0), 4), 0);
});

test("routing: the lanes figure is a process flow that mirrors in RTL", () => {
  for (const compact of [false, true]) {
    const ltr = laneLayout(compact, false);
    const rtl = laneLayout(compact, true);
    assert.equal(ltr.w, compact ? 358 : 560);
    assert.ok(ltr.source.x < ltr.judge.x && ltr.judge.x < ltr.trackStart);
    assert.ok(ltr.trackStart < ltr.trackEnd && ltr.trackEnd < cardDoor(ltr));
    assert.equal(rtl.source.x, ltr.w - ltr.source.x);
    assert.equal(rtl.cardX, ltr.w - ltr.cardX - ltr.cardW);
    assert.equal(cardDoor(rtl), ltr.w - cardDoor(ltr));
    // Every lane row is at least a 44px tap target at 1:1.
    assert.ok(ltr.laneY[1] - ltr.laneY[0] >= 44);
    assert.ok(ltr.laneY[3] + ltr.cardH / 2 <= ltr.h);
    // A lane's tap target covers its track and card, never the source or the hub.
    const hit = laneHitSpan(ltr);
    const ring = compact ? 13 : 15;
    assert.ok(hit.x >= ltr.judge.x + ring && hit.x < ltr.trackStart, `${hit.x}`);
    assert.equal(hit.x + hit.w, ltr.cardX + ltr.cardW);
    const hitR = laneHitSpan(rtl);
    assert.equal(hitR.x, rtl.cardX);
    assert.ok(hitR.x + hitR.w <= rtl.judge.x - ring);
    assert.ok(Math.abs(hitR.w - hit.w) < 1e-9);
  }
});

test("routing: a hand-off arc leaves one card door and enters the next, bulging to the source", () => {
  for (const rtl of [false, true]) {
    const layout = laneLayout(false, rtl);
    const door = cardDoor(layout);
    const out = new Float32Array(HOP_POINTS * 2);
    const d = hopArc(layout, 0, 1, out);
    assert.ok(d.startsWith(`M${door} ${layout.laneY[0]}C`));
    assert.equal(out[0], door);
    assert.equal(out[1], layout.laneY[0]);
    assert.equal(out[(HOP_POINTS - 1) * 2], door);
    assert.equal(out[(HOP_POINTS - 1) * 2 + 1], layout.laneY[1]);
    // The middle of the arc is a visible way out of the cards, towards the source.
    const mid = out[Math.floor(HOP_POINTS / 2) * 2];
    const bulge = rtl ? mid - door : door - mid;
    assert.ok(bulge >= 25, `bulge ${bulge}`);
  }
});

test("routing: polylines are walked by arc length", () => {
  const pts = new Float32Array([0, 0, 10, 0, 10, 10]);
  const out = new Float32Array(2);
  assert.equal(polylineLength(pts, 0, 3), 20);
  polylineAt(pts, 0, 3, 0.25, out);
  assert.deepEqual([...out], [5, 0]);
  polylineAt(pts, 0, 3, 0.75, out);
  assert.deepEqual([...out], [10, 5]);
  polylineAt(pts, 0, 3, 2, out);
  assert.deepEqual([...out], [10, 10]);
});
