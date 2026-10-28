import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

/*
 * The deck store drives one shared simulation from the page heartbeat. These
 * tests run it against the real sim in a minimal fake browser (manual rAF,
 * matchMedia, localStorage), in order, because the store is a page singleton.
 */

type FrameCallback = (now: number) => void;
const frames = new Map<number, FrameCallback>();
let frameSeq = 0;
let reducedMotion = false;
const motionListeners = new Set<() => void>();
const storage = new Map<string, string>();

const fakeGlobals = globalThis as unknown as Record<string, unknown>;
fakeGlobals.window = globalThis;
fakeGlobals.requestAnimationFrame = (callback: FrameCallback) => {
  frames.set(++frameSeq, callback);
  return frameSeq;
};
fakeGlobals.cancelAnimationFrame = (handle: number) => {
  frames.delete(handle);
};
fakeGlobals.document = { hidden: false, addEventListener() {}, querySelectorAll: () => [] };
fakeGlobals.matchMedia = (query: string) => ({
  get matches() {
    return query.includes("reduce") ? reducedMotion : false;
  },
  addEventListener: (_type: string, listener: () => void) => motionListeners.add(listener),
  removeEventListener: (_type: string, listener: () => void) => motionListeners.delete(listener),
});
fakeGlobals.localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
};

let clock = 0;
function runFor(ms: number, interval = 16): void {
  const end = clock + ms;
  while (clock < end) {
    clock += interval;
    const due = [...frames.values()];
    frames.clear();
    for (const callback of due) callback(clock);
  }
}

function setReducedMotion(value: boolean): void {
  reducedMotion = value;
  for (const listener of motionListeners) listener();
}

const { DEFAULT_WEIGHTS } = await import("../../open-sse/services/autoCombo/scoring.ts");
const deck = await import("../../src/app/landing/runtime/deckStore.ts");
const heartbeat = await import("../../src/app/landing/runtime/heartbeat.ts");
const { act, nextTake } = await import("../../src/app/landing/sim/landingSim.ts");

const stats = {
  scoringFactors: Object.entries(DEFAULT_WEIGHTS as unknown as Record<string, number>)
    .map(([id, weight]) => ({ id, weight }))
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id)),
};

const seen: number[] = [];
let userFlagged = 0;
deck.subscribeEvents((event, meta) => {
  seen.push(event.n);
  if (meta.user) userFlagged += 1;
});

function candidate(id: string) {
  const found = deck.getWorld().candidates.find((c) => c.id === id);
  assert.ok(found, `no candidate ${id}`);
  return found;
}

test("deck: the server snapshot is the tick-0 world", () => {
  deck.primeDeck(stats);
  deck.primeDeck(stats); // idempotent
  const seed = deck.getSeedWorld();
  assert.equal(seed.tick, 0);
  function Probe() {
    const winner = deck.useDeck((w) => w.featured.winner);
    const routed = deck.useDeck((w) => w.totals.routed);
    return createElement("p", null, `${winner}:${routed}`);
  }
  assert.equal(renderToString(createElement(Probe)), `<p>${seed.featured.winner}:0</p>`);
});

let disposeFirstOwner: () => void = () => {};

test("deck: steps 100 ms at a time on the heartbeat and takes on its own cadence", () => {
  disposeFirstOwner = deck.initDeck(stats);
  runFor(10_000);
  const world = deck.getWorld();
  assert.ok(world.tick >= 95 && world.tick <= 101, `tick ${world.tick} after 10 s`);
  assert.ok(world.totals.routed > 0);
  // First take at 2.8 s, then every 3.6 s.
  assert.ok(world.featured.take >= 2, `takes ${world.featured.take}`);
});

test("deck: events are delivered once each, in order", () => {
  assert.ok(seen.length > 0);
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] > seen[i - 1], `event ${seen[i]}`);
  assert.equal(userFlagged, 0, "nothing is user-caused yet");
});

test("deck: a visitor's outage counts once and flags that provider's events", () => {
  const world = deck.getWorld();
  deck.dispatch(act.setUpstreamDown("claude", true), { user: true });
  assert.equal(world.session.outagesCaused, 1);
  assert.equal(candidate("claude").breaker.state, "closed", "a running loop resolves over time");
  runFor(40_000);
  assert.equal(candidate("claude").breaker.state, "open");
  assert.ok(userFlagged > 0);
});

test("deck: a manual take through dispatch is honoured", () => {
  const before = deck.getWorld().featured.take;
  deck.dispatch((world) => nextTake(world));
  assert.equal(deck.getWorld().featured.take, before + 1);
});

test("deck: under reduced motion the loop stops and faults resolve instantly", () => {
  const world = deck.getWorld();
  setReducedMotion(true);
  const tick = world.tick;
  runFor(2000);
  assert.equal(world.tick, tick, "no stepping under reduced motion");

  deck.dispatch(act.setUpstreamDown("ollama", true), { user: true });
  assert.equal(candidate("ollama").breaker.state, "open");
  assert.equal(world.session.outagesCaused, 2);

  deck.dispatch(act.setUpstreamDown("ollama", false), { user: true });
  assert.equal(candidate("ollama").breaker.state, "closed");
  assert.equal(world.session.outagesCaused, 2, "restoring is not an outage");

  const simMs = world.simMs;
  deck.dispatch(act.setWeight(stats.scoringFactors[0].id, 0.5), { user: true });
  assert.equal(world.simMs, simMs, "a weight change never advances time");
  setReducedMotion(false);
});

test("deck: Pause stops stepping and persists", () => {
  const world = deck.getWorld();
  heartbeat.setPaused(true);
  const tick = world.tick;
  runFor(3000);
  assert.equal(world.tick, tick);
  assert.equal(storage.get(heartbeat.PAUSED_STORAGE_KEY), "1");
  heartbeat.setPaused(false);
  runFor(1000);
  assert.ok(world.tick > tick);
});

test("deck: the deck leaves the heartbeat only when its last owner disposes", () => {
  const world = deck.getWorld();
  const second = deck.initDeck(stats); // e.g. a StrictMode re-mount
  second();
  second(); // idempotent
  let tick = world.tick;
  runFor(1000);
  assert.ok(world.tick > tick, "the first owner still runs it");

  disposeFirstOwner();
  tick = world.tick;
  runFor(1000);
  assert.equal(world.tick, tick, "no owner: no stepping");
});
