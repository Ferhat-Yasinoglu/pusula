import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  INTRO_GATE,
  INTRO_GATE_TIMER,
  INTRO_PAUSED_KEY,
  INTRO_STORAGE_KEY,
  introGateDecision,
  type IntroGateEnv,
} from "../../src/app/landing/components/intro/introGate.ts";
import {
  BOOT_COMMAND,
  INTRO_T,
  NEEDLE_SPIN,
  PARTICLE_STRIDE,
  P_HIDDEN,
  P_SHELL_BACK,
  arcProgress,
  buildIntroLayout,
  cityLabel,
  introScalars,
  needleSpinAt,
  providerParticle,
  retimeStarfield,
  skipTo,
  writeParticles,
  type IntroLayout,
} from "../../src/app/landing/components/intro/introTimeline.ts";
import {
  GYRO_F,
  GYRO_TILT_DEG,
  DEG,
  HORIZON_FRONT_PATH,
  aimCamera,
  bearingTo,
  createGyroScene,
  gyroPitch,
  gyroState,
  horizonScaleY,
  projectStars,
  setFactorWeights,
  starPhase,
  stepGyro,
} from "../../src/app/landing/components/hero/gyro.ts";
import {
  ATTEMPT_MS,
  TAKE_FIRST_MS,
  beginTake,
  createTakeFx,
  glowSlot,
  needleSlot,
  sequenceMs,
} from "../../src/app/landing/components/hero/heroFx.ts";
import {
  LABEL_ABOVE,
  LABEL_FLIP,
  LABEL_HIDDEN,
  LABEL_KEEP,
  LABEL_STRIDE,
  L_AX,
  L_AY,
  L_FLAGS,
  L_H,
  L_PRIO,
  L_W,
  L_X,
  L_Y,
  SIDE_GAP,
  resolveLabels,
} from "../../src/app/landing/components/hero/labelLayout.ts";
import { PAUSED_STORAGE_KEY } from "../../src/app/landing/runtime/heartbeat.ts";
import { INTRO_HANDOFF_EVENT } from "../../src/app/landing/components/primitives/primitiveKit.ts";
import { buildDotGrid } from "../../src/app/landing/landingGeometry.ts";

/* ---- Gate (§5.1) ---------------------------------------------------------- */

const FIRST_VISIT: IntroGateEnv = {
  storedIntro: null,
  storedPaused: null,
  reducedMotion: false,
  hash: "",
  scrollY: 0,
  hidden: false,
};

test("intro gate: plays only on a genuine first visit", () => {
  assert.equal(introGateDecision(FIRST_VISIT), true);
  assert.equal(introGateDecision({ ...FIRST_VISIT, storedIntro: "1" }), false);
  assert.equal(introGateDecision({ ...FIRST_VISIT, storedPaused: "1" }), false);
  assert.equal(introGateDecision({ ...FIRST_VISIT, storedPaused: "0" }), true);
  assert.equal(introGateDecision({ ...FIRST_VISIT, reducedMotion: true }), false);
  assert.equal(introGateDecision({ ...FIRST_VISIT, hash: "#network" }), false);
  assert.equal(introGateDecision({ ...FIRST_VISIT, scrollY: 120 }), false);
  assert.equal(introGateDecision({ ...FIRST_VISIT, hidden: true }), false);
});

test("intro gate: the inline script checks every condition the mirror does", () => {
  assert.match(INTRO_GATE, new RegExp(`sessionStorage\\.getItem\\('${INTRO_STORAGE_KEY}'\\)`));
  assert.match(INTRO_GATE, new RegExp(`localStorage\\.getItem\\('${INTRO_PAUSED_KEY}'\\)`));
  assert.ok(INTRO_GATE.includes("p!=='1'"));
  assert.ok(INTRO_GATE.includes("matchMedia('(prefers-reduced-motion: reduce)').matches"));
  assert.ok(INTRO_GATE.includes("!location.hash"));
  assert.ok(INTRO_GATE.includes("!(window.scrollY>0)"));
  assert.ok(INTRO_GATE.includes("!document.hidden"));
  assert.ok(INTRO_GATE.includes("d.setAttribute('data-intro','play')"));
  // Its own failsafe hands off if the page's script never does.
  assert.ok(INTRO_GATE.includes(`window.${INTRO_GATE_TIMER}=setTimeout(`));
  assert.ok(INTRO_GATE.includes(`new Event('${INTRO_HANDOFF_EVENT}')`));
  // Wrapped in try/catch, so a blocked API can never break the page.
  assert.ok(INTRO_GATE.startsWith("(function(){try{"));
  assert.ok(INTRO_GATE.endsWith("}catch(e){}})();"));
  // Balanced braces and parentheses (a cheap syntax guard without evaluating it).
  const count = (ch: string) => INTRO_GATE.split(ch).length - 1;
  assert.equal(count("{"), count("}"));
  assert.equal(count("("), count(")"));
});

test("intro gate: the paused key is the heartbeat's", () => {
  assert.equal(INTRO_PAUSED_KEY, PAUSED_STORAGE_KEY);
});

/* ---- Timeline (§5.4) ------------------------------------------------------ */

const DIAL = { cx: 893, cy: 406, R: 285 };

function layout(vw = 1440, vh = 900, stars = 358): IntroLayout {
  return buildIntroLayout({
    vw,
    vh,
    dial: DIAL,
    stars,
    pitch: gyroPitch(0, 0),
    F: GYRO_F,
    free: new Uint8Array(stars).map((_, i) => (i % 3 === 0 ? 1 : 0)),
  });
}

test("intro layout: the spec's dot grids and provider-star mapping", () => {
  assert.equal(layout().n, buildDotGrid(12).length);
  assert.equal(layout(390, 844).n, buildDotGrid(14).length);
  const L = layout();
  // j = floor((i + .5) · nDots / providers), each provider exactly once.
  let providers = 0;
  for (let j = 0; j < L.n; j++) if (L.provider[j] >= 0) providers++;
  assert.equal(providers, 358);
  assert.equal(L.provider[providerParticle(0, L.n, 358)], 0);
  assert.equal(L.provider[providerParticle(357, L.n, 358)], 357);
});

test("intro landfall sweeps west to east and is never mirrored", () => {
  const L = layout();
  let west = 0;
  let east = 0;
  for (let j = 1; j < L.n; j++) {
    if (L.dotX[j] < L.dotX[west]) west = j;
    if (L.dotX[j] > L.dotX[east]) east = j;
  }
  assert.ok(L.landAt[west] < L.landAt[east]);
  assert.equal(L.landAt[west], INTRO_T.land);
  for (let j = 0; j < L.n; j++) {
    assert.ok(L.landAt[j] >= INTRO_T.land && L.landAt[j] + INTRO_T.landDur <= 1500 + 1e-6);
  }
});

test("intro converges: from the hand-off on, no free particles remain", () => {
  const L = layout();
  const out = new Float32Array(L.n * PARTICLE_STRIDE);
  for (const t of [2350, 2400, 2600, 4000]) {
    assert.equal(writeParticles(L, t, out), 0, `t=${t}`);
    for (let j = 0; j < L.n; j++) assert.equal(out[j * PARTICLE_STRIDE + 4], P_HIDDEN);
  }
  // A skip lands on that same converged frame.
  assert.equal(skipTo(900), INTRO_T.handoff);
  assert.equal(skipTo(2500), 2500);
});

test("intro converges: provider stars stand on their shell positions just before the hand-off", () => {
  const L = layout();
  const out = new Float32Array(L.n * PARTICLE_STRIDE);
  writeParticles(L, INTRO_T.handoff - 1, out);
  // The hero's own projection at gyro clock 0, yaw 0.
  const catalog = Array.from({ length: 358 }, (_, i) => ({ id: `p${i}`, free: i % 3 === 0 }));
  const scene = createGyroScene(catalog, []);
  aimCamera(scene, DIAL, 0, gyroPitch(0, 0));
  projectStars(scene);
  for (let j = 0; j < L.n; j++) {
    const p = L.provider[j];
    if (p < 0) continue;
    const o = j * PARTICLE_STRIDE;
    assert.ok(Math.abs(out[o] - scene.proj[p * 4]) < 0.5, `star ${p} x`);
    assert.ok(Math.abs(out[o + 1] - scene.proj[p * 4 + 1]) < 0.5, `star ${p} y`);
    if (scene.proj[p * 4 + 3] >= 0) assert.equal(out[o + 4], P_SHELL_BACK);
  }
});

test("intro scalars are monotonic inside their windows", () => {
  const prev = introScalars(0);
  let last = { ...prev };
  for (let t = 0; t <= 3200; t += 10) {
    const s = { ...introScalars(t) };
    assert.ok(s.curtain <= last.curtain + 1e-9, `curtain at ${t}`);
    assert.ok(s.typed >= last.typed && s.boot >= last.boot, `boot log at ${t}`);
    if (t > INTRO_T.ringsIn[0] && t <= INTRO_T.ringsIn[1]) assert.ok(s.rings >= last.rings);
    if (t > INTRO_T.border[0] && t <= INTRO_T.border[1]) assert.ok(s.border >= last.border);
    if (t > INTRO_T.rhumbs[0] && t <= INTRO_T.rhumbs[1]) assert.ok(s.rhumbs >= last.rhumbs);
    if (t > INTRO_T.mapOut[0]) assert.ok(s.arcsA <= last.arcsA + 1e-9);
    if (t > INTRO_T.needle && t <= INTRO_T.needleSpring)
      assert.ok(s.needleScale >= last.needleScale);
    last = s;
  }
  const end = introScalars(INTRO_T.done);
  assert.equal(end.curtain, 0);
  assert.equal(end.stars, 1);
  assert.equal(end.rings, 1);
  assert.equal(end.flash, 0);
  assert.equal(end.labelsA, 0);
  assert.equal(end.bootLog, 0);
  assert.equal(introScalars(INTRO_T.handoff).curtain, 1);
  assert.equal(introScalars(INTRO_T.handoff).gyroClock, 0);
});

test("intro arcs and city labels arrive in order and leave together", () => {
  for (let c = 0; c < 9; c++) {
    assert.equal(arcProgress(1349, c), 0);
    assert.equal(cityLabel(INTRO_T.labelsOut[1], c), 0);
  }
  const kabul = 0;
  assert.equal(arcProgress(1700, kabul), 0);
  for (let c = 1; c < 9; c++) assert.equal(arcProgress(1760, c), 1);
});

test("intro needle: the closed-form spin hands the spring its exact state", () => {
  const start = needleSpinAt(INTRO_T.needle);
  assert.equal(start.angle, NEEDLE_SPIN.from);
  assert.equal(start.velocity, 1080);
  const end = needleSpinAt(INTRO_T.needleSpring);
  assert.ok(Math.abs(end.angle - NEEDLE_SPIN.at) < 1e-9);
  assert.ok(Math.abs(end.velocity - NEEDLE_SPIN.v) < 1e-9);
});

/* ---- CSS ignition (alive from first paint) -------------------------------- */

const INTRO_CSS = readFileSync(
  new URL("../../src/app/landing/components/intro/intro.css", import.meta.url),
  "utf8"
);

test("intro ignition: the CSS keyframes play the timeline's own 0–480ms", () => {
  const ms = (re: RegExp) => Number(re.exec(INTRO_CSS)?.[1]);
  // Typing: one character per `1000 / typeCps` ms, the whole command by the hold.
  const typing = /intro-ig-type (\d+)ms steps\((\d+), end\)/.exec(INTRO_CSS);
  assert.ok(typing, "typing keyframe");
  assert.equal(Number(typing[2]), BOOT_COMMAND.length);
  assert.equal(Number(typing[1]), (BOOT_COMMAND.length * 1000) / INTRO_T.typeCps);
  assert.equal(Number(typing[1]), INTRO_T.cssHold);
  assert.match(INTRO_CSS, new RegExp(`translateX\\(${BOOT_COMMAND.length}ch\\)`));
  assert.match(INTRO_CSS, new RegExp(`inline-size: calc\\(${BOOT_COMMAND.length}ch \\+ 2em\\)`));
  assert.equal(introScalars(INTRO_T.cssHold).typed, BOOT_COMMAND.length);
  // Glow, crosshair, point and brand on the scalars' windows.
  assert.equal(ms(/intro-ig-glow (\d+)ms/), INTRO_T.igniteEnd);
  assert.equal(ms(/intro-ig-grow (\d+)ms/), INTRO_T.igniteEnd);
  assert.equal(ms(/intro-ig-span-x (\d+)ms/), INTRO_T.igniteEnd);
  assert.equal(ms(/intro-ig-breathe \d+ms ease-in-out (\d+)ms/), INTRO_T.cssHold);
  assert.equal(ms(/\.intro-brand \{\s*animation: intro-ig-in (\d+)ms/), INTRO_T.hudIn);
  const mid = introScalars(INTRO_T.igniteEnd / 2);
  const end = introScalars(INTRO_T.igniteEnd);
  assert.ok(Math.abs(mid.glow - 0.9) < 1e-9 && Math.abs(end.glow - 0.35) < 1e-9);
  assert.ok(
    /50% \{\s*opacity: 0\.9;/.test(INTRO_CSS) && /100% \{\s*opacity: 0\.35;/.test(INTRO_CSS)
  );
  assert.equal(end.glowR, 120);
  assert.match(INTRO_CSS, /inline-size: 240px/);
  assert.match(INTRO_CSS, /to \{\s*opacity: 0\.35;/);
  // The held frame is the timeline's: nothing in the scalars moves from the
  // ignition's end to the hold (so the canvas resumes on the same pixels).
  const held = introScalars(INTRO_T.cssHold);
  for (const key of ["glow", "glowR", "point", "cross", "crossLen", "hud"] as const) {
    assert.ok(Math.abs(held[key] - end[key]) < 1e-9, key);
  }
  // Boot lines and the map only start after the hold.
  assert.ok(INTRO_T.boot > INTRO_T.cssHold && INTRO_T.land > INTRO_T.cssHold);
});

test("intro ignition: resuming late retimes the starfield so no star pops in", () => {
  const L = layout(390, 844);
  const out = new Float32Array(L.n * PARTICLE_STRIDE);
  const original = Float32Array.from(L.fadeAt);
  // At or before the starfield's start the storyboard is untouched.
  retimeStarfield(L, 0);
  assert.deepEqual(Array.from(L.fadeAt), Array.from(original));
  for (const from of [200, 300, INTRO_T.cssHold]) {
    retimeStarfield(L, from);
    // One frame after the resume, every star is at most one frame into its fade.
    writeParticles(L, from + 16, out);
    let max = 0;
    for (let j = 0; j < L.n; j++) max = Math.max(max, out[j * PARTICLE_STRIDE + 3]);
    assert.ok(max <= 16 / INTRO_T.starFade + 1e-6, `from ${from}: alpha ${max}`);
    // Order is kept and all have started before the first dot lands.
    for (let j = 0; j < L.n; j++) {
      assert.ok(L.fadeAt[j] >= from && L.fadeAt[j] <= INTRO_T.starfield + INTRO_T.starfieldSpread);
    }
    for (let j = 1; j < L.n; j++) {
      assert.equal(original[j] < original[0], L.fadeAt[j] < L.fadeAt[0]);
    }
  }
});

/* ---- Gyro geometry (§6.2) ------------------------------------------------- */

test("gyro: compass bearings, nutation factor and factor weights", () => {
  assert.equal(bearingTo(DIAL, DIAL.cx, DIAL.cy - 10), 0);
  assert.equal(bearingTo(DIAL, DIAL.cx + 10, DIAL.cy), 90);
  assert.equal(bearingTo(DIAL, DIAL.cx - 10, DIAL.cy), -90);
  assert.ok(Math.abs(horizonScaleY(GYRO_TILT_DEG * DEG) - 1) < 1e-12);
  assert.ok(horizonScaleY((GYRO_TILT_DEG + 4) * DEG) > 1);
  assert.ok(HORIZON_FRONT_PATH.startsWith("M"));
  assert.equal(starPhase(7), starPhase(7));

  const scene = createGyroScene([{ id: "a", free: false }], []);
  setFactorWeights(scene.look, [0.1, 0, 0.3, 0.6, Number.NaN]);
  assert.equal(scene.look.factorCount, 5);
  const w = Array.from(scene.look.factorWeights.slice(0, 5));
  assert.deepEqual(
    w.map((v) => Math.round(v * 100) / 100),
    [0.6, 0.3, 0.1, 0, 0]
  );
});

test("gyro: candidate stars are found by catalog id in alphabetical order", () => {
  const catalog = [
    { id: "anthropic", free: false },
    { id: "claude", free: false },
    { id: "openai", free: true },
  ];
  const scene = createGyroScene(catalog, ["openai", "claude", "missing"]);
  assert.deepEqual(Array.from(scene.candStar), [2, 1, -1]);
  assert.equal(scene.free[2], 1);
});

/* ---- Take sequencing ------------------------------------------------------ */

test("hero take: the needle visits the deck's attempts in order, then rests on the winner", () => {
  const fx = createTakeFx();
  const slots: Record<string, number> = { claude: 0, gpt: 1, gemini: 2 };
  const slotOf = (id: string) => slots[id] ?? -1;
  beginTake(
    fx,
    { take: 0, attempts: ["claude"], codes: [], winner: "claude", served: true },
    slotOf,
    0,
    false,
    false
  );
  assert.equal(fx.winner, 0);
  assert.equal(needleSlot(fx, 10), 0);

  beginTake(
    fx,
    { take: 1, attempts: ["claude", "gpt"], codes: [503], winner: "gpt", served: true },
    slotOf,
    1000,
    true,
    false
  );
  assert.equal(needleSlot(fx, 1000 + TAKE_FIRST_MS - 1), 0, "holds the previous winner");
  assert.equal(needleSlot(fx, 1000 + TAKE_FIRST_MS + 10), 0, "tries claude first");
  assert.equal(needleSlot(fx, 1000 + TAKE_FIRST_MS + ATTEMPT_MS + 10), 1, "then falls back to gpt");
  assert.equal(glowSlot(fx, 1000 + TAKE_FIRST_MS + 10), -1, "no winner glow while deciding");
  assert.equal(glowSlot(fx, 1000 + sequenceMs(2)), 1);
  assert.equal(sequenceMs(2), TAKE_FIRST_MS + ATTEMPT_MS + 300);
  // The comet always enters from the inline-start side.
  assert.ok(fx.comet > 180 && fx.comet < 360);
  beginTake(
    fx,
    { take: 2, attempts: ["gemini"], codes: [], winner: "gemini", served: true },
    slotOf,
    9000,
    true,
    true
  );
  assert.ok(fx.comet > 0 && fx.comet < 180);
});

/* ---- Label layout --------------------------------------------------------- */

const STAGE = new Float32Array([0, 0, 1000, 800]);

function label(buf: Float32Array, i: number, ax: number, ay: number, prio: number, flags = 0) {
  const o = i * LABEL_STRIDE;
  buf[o + L_AX] = ax;
  buf[o + L_AY] = ay;
  buf[o + L_W] = 80;
  buf[o + L_H] = 26;
  buf[o + L_PRIO] = prio;
  buf[o + L_FLAGS] = flags;
}

function zone(x: number, y: number, w: number, h: number, soft = false): number[] {
  return [x, y, w, h, soft ? 1 : 0];
}

const at = (buf: Float32Array, i: number, field: number) => buf[i * LABEL_STRIDE + field];
const hidden = (buf: Float32Array, i: number) => (at(buf, i, L_FLAGS) & LABEL_HIDDEN) !== 0;

test("labels: beside the star, never overlapping, the higher priority keeps its place", () => {
  const boxes = new Float32Array(3 * LABEL_STRIDE);
  label(boxes, 0, 100, 110, 1);
  label(boxes, 1, 110, 115, 5); // higher priority: stays beside its star
  label(boxes, 2, 600, 400, 1, LABEL_FLIP);
  resolveLabels(boxes, 3, new Float32Array(0), 0, new Int8Array(3), STAGE);
  assert.equal(at(boxes, 1, L_X), 110 + SIDE_GAP);
  assert.equal(at(boxes, 1, L_Y), 115 - 13);
  assert.ok(Math.abs(at(boxes, 0, L_Y) - at(boxes, 1, L_Y)) >= 26, "pushed clear");
  // A flipped label sits on its star's left.
  assert.equal(at(boxes, 2, L_X), 600 - SIDE_GAP - 80);
  assert.ok(at(boxes, 2, L_FLAGS) & LABEL_FLIP);
  for (let i = 0; i < 3; i++) assert.ok(!hidden(boxes, i));
});

test("labels: the touch gap keeps crowded plates a thumb apart", () => {
  // Four stars bunched within 20px: on touch every pair of plates that shares
  // columns ends at least 10px apart (the mouse default packs them at 4px).
  for (const gap of [4, 10]) {
    const boxes = new Float32Array(4 * LABEL_STRIDE);
    label(boxes, 0, 300, 300, 4);
    label(boxes, 1, 305, 308, 3);
    label(boxes, 2, 298, 316, 2);
    label(boxes, 3, 310, 296, 1);
    resolveLabels(boxes, 4, new Float32Array(0), 0, new Int8Array(4), STAGE, gap);
    for (let i = 0; i < 4; i++) {
      assert.ok(!hidden(boxes, i), `label ${i} shown at gap ${gap}`);
      for (let j = i + 1; j < 4; j++) {
        const xi = at(boxes, i, L_X);
        const xj = at(boxes, j, L_X);
        if (xi + 80 + gap <= xj || xj + 80 + gap <= xi) continue;
        const yi = at(boxes, i, L_Y);
        const yj = at(boxes, j, L_Y);
        const apart = Math.max(yj - (yi + 26), yi - (yj + 26));
        assert.ok(apart >= gap - 1e-6, `gap ${gap}: labels ${i},${j} are ${apart}px apart`);
      }
    }
  }
});

test("labels: a blocked side tries the other side, then above and below, before hiding", () => {
  const boxes = new Float32Array(2 * LABEL_STRIDE);
  // Star at (300, 300); a hard zone covers its right side only.
  label(boxes, 0, 300, 300, 1);
  const right = new Float32Array(zone(305, 200, 300, 200));
  resolveLabels(boxes, 1, right, 1, new Int8Array(1), STAGE);
  assert.ok(!hidden(boxes, 0));
  assert.ok(at(boxes, 0, L_FLAGS) & LABEL_FLIP, "moved to the left side");

  // Both sides blocked: above the star.
  label(boxes, 0, 300, 300, 1);
  const sides = new Float32Array([...zone(150, 290, 140, 20), ...zone(310, 290, 140, 20)]);
  resolveLabels(boxes, 1, sides, 2, new Int8Array(1), STAGE);
  assert.ok(!hidden(boxes, 0));
  assert.ok(at(boxes, 0, L_FLAGS) & LABEL_ABOVE);
  assert.ok(at(boxes, 0, L_Y) + 26 <= 300);

  // Everything blocked: an ordinary label hides.
  label(boxes, 0, 300, 300, 1);
  const all = new Float32Array(zone(0, 150, 1000, 300));
  resolveLabels(boxes, 1, all, 1, new Int8Array(1), STAGE);
  assert.ok(hidden(boxes, 0));
});

test("labels: the needle's provider is never hidden, it moves just outside the zone", () => {
  const boxes = new Float32Array(2 * LABEL_STRIDE);
  // The phone case: everything below the headline's top is out of bounds for labels.
  label(boxes, 0, 300, 520, 1, LABEL_KEEP);
  label(boxes, 1, 320, 530, 1);
  const below = new Float32Array(zone(-1e4, 480, 2e4, 1e5));
  resolveLabels(boxes, 2, below, 1, new Int8Array(2), STAGE);
  assert.ok(!hidden(boxes, 0), "kept");
  assert.ok(at(boxes, 0, L_Y) + 26 <= 480, "lifted above the zone");
  assert.ok(hidden(boxes, 1), "the other one hides");
});

test("labels: soft zones (cardinals) are avoided when another place is clear, never a reason to hide", () => {
  const boxes = new Float32Array(LABEL_STRIDE);
  label(boxes, 0, 300, 300, 1);
  const soft = new Float32Array(zone(320, 290, 16, 17, true));
  resolveLabels(boxes, 1, soft, 1, new Int8Array(1), STAGE);
  assert.ok(!hidden(boxes, 0));
  assert.ok(at(boxes, 0, L_FLAGS) & LABEL_FLIP, "stepped to the free side");
  // Soft zones everywhere: it stays visible on its preferred side.
  label(boxes, 0, 300, 300, 1);
  const softAll = new Float32Array(zone(0, 0, 1000, 800, true));
  resolveLabels(boxes, 1, softAll, 1, new Int8Array(1), STAGE);
  assert.ok(!hidden(boxes, 0));
  assert.equal(at(boxes, 0, L_X), 300 + SIDE_GAP);
});

test("labels: a side that leaves the stage is never used", () => {
  const boxes = new Float32Array(LABEL_STRIDE);
  label(boxes, 0, 960, 300, 1);
  resolveLabels(boxes, 1, new Float32Array(0), 0, new Int8Array(1), STAGE);
  assert.ok(at(boxes, 0, L_X) + 80 <= 1000);
  assert.ok(at(boxes, 0, L_FLAGS) & LABEL_FLIP);
});

/* ---- Gyro motion ------------------------------------------------------------ */

test("gyro: a held drag owns the yaw; release keeps the fling", () => {
  const state = { ...gyroState, yaw: 1, spin: 2, clock: 0 };
  stepGyro(state, 0.1, true);
  assert.equal(state.yaw, 1, "no idle spin or inertia under the finger");
  assert.ok(state.spin < 2 && state.spin > 0, "the velocity estimate decays");
  const spin = state.spin;
  stepGyro(state, 0.1, false);
  assert.ok(state.yaw > 1 + spin * 0.1 * 0.5, "released: inertia and idle spin move it");
});
