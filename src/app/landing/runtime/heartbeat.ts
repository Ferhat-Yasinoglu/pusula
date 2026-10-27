"use client";
import { useSyncExternalStore } from "react";
import { REDUCED_MOTION_QUERY, subscribeReducedMotion } from "../landingMotion";

/**
 * The landing page's heartbeat: the ONE `requestAnimationFrame` loop on the
 * page. Every simulation step, canvas frame and imperative DOM write goes
 * through `register()`, so the page never runs competing loops, everything
 * stops together (hidden tab, Pause, reduced motion), and the cost of a frame
 * can be measured in one place.
 *
 * Lanes run in a fixed order each frame:
 *   1. `sim`: a fixed 100 ms step from an accumulator, at most 5 catch-up
 *      steps per frame (a stalled device slows the simulation down instead of
 *      bursting through seconds of traffic at once);
 *   2. `canvas`: only the `MAX_LIVE_CANVASES` entries with the highest
 *      `visibility × (1 + priority)` tick; the others freeze on their last
 *      frame (two full-viewport canvases is the phone GPU budget);
 *   3. `dom`: every entry, every frame.
 *
 * The loop is started and stopped by state, never by a timer: it runs only
 * while something is registered, the tab is visible, the visitor has not
 * paused and the OS does not ask for reduced motion. Under reduced motion it
 * never starts at all; interactive controls resolve instantly instead
 * (`deckStore.dispatch` → `advance()`).
 *
 * The core is `createHeartbeat(host)`, which takes the browser as an
 * injectable host so `tests/unit/landing-runtime.test.ts` can drive frames
 * deterministically. The exported functions below operate on a lazily created
 * browser singleton and are inert on the server.
 */

/** `dt` in seconds (clamped to ≤ 1/20 for canvas and DOM lanes); `now` is the rAF timestamp in ms. */
export type Tick = (dt: number, now: number) => void;

export type HeartbeatLane = "sim" | "canvas" | "dom";

export type HeartbeatEntry = {
  /** Shown in the console if the tick throws; need not be unique. */
  id: string;
  lane: HeartbeatLane;
  tick: Tick;
  /** Canvas lane only: 0..1 on-screen share. Entries at 0 never tick. Defaults to 1. */
  visibility?: () => number;
  /** Canvas lane only: ≥ 0, multiplies visibility by `1 + priority`. Defaults to 0. */
  priority?: number;
};

export type QualityTier = 0 | 1 | 2;

/** At most this many canvases draw per frame, page-wide. */
export const MAX_LIVE_CANVASES = 2;
/** The simulation lane always advances in steps of exactly this much real time. */
export const SIM_STEP_MS = 100;
/** Most sim steps one frame may run to catch up; any further backlog is dropped. */
export const MAX_SIM_CATCH_UP = 5;
/** Upper bound for the `dt` handed to canvas and DOM ticks (seconds). */
export const MAX_FRAME_DT = 1 / 20;
/** localStorage key that remembers the Pause toggle across visits. */
export const PAUSED_STORAGE_KEY = "pusula.landing.paused";
/** Class toggled on every `.pusula-landing` root while paused (CSS stops keyframes with it). */
export const PAUSED_CLASS = "is-paused";

/** Rolling window, in frames, for the quality tier. */
export const QUALITY_WINDOW = 60;
/** A window mean above this frame interval (ms) raises the tier by one. */
export const QUALITY_RAISE_MS = 20;
/** The tier drops back by one after the mean stays under this (ms) ... */
export const QUALITY_RELAX_MS = 12;
/** ... for this long (ms). */
export const QUALITY_RELAX_HOLD_MS = 5000;
/**
 * Frame intervals longer than this are stalls (a tab switch, a GC pause, a
 * breakpoint) rather than evidence of load, and are left out of the mean.
 */
const QUALITY_MAX_SAMPLE_MS = 250;

/** The browser surface the heartbeat needs; swapped for a fake in tests. */
export type HeartbeatHost = {
  requestFrame(callback: (now: number) => void): number;
  cancelFrame(handle: number): void;
  isHidden(): boolean;
  isReducedMotion(): boolean;
  readPaused(): boolean;
  /** Persist the toggle and reflect it on the page roots. */
  writePaused(paused: boolean): void;
  /** Re-apply the paused state to page roots that mounted after the last toggle. */
  syncPaused(paused: boolean): void;
  reportError(id: string, error: unknown): void;
};

export type Heartbeat = {
  register(entry: HeartbeatEntry): () => void;
  setPaused(paused: boolean): void;
  isPaused(): boolean;
  getQualityTier(): QualityTier;
  /** True while a frame is scheduled. */
  isRunning(): boolean;
  /** Re-evaluate whether the loop should run (visibility or motion preference changed). */
  refresh(): void;
  /** Notified when the paused state or the quality tier changes. */
  subscribe(listener: () => void): () => void;
};

type Slot = { entry: HeartbeatEntry; alive: boolean };

function clampVisibility(value: number): number {
  if (!(value > 0)) return 0; // also catches NaN
  return value > 1 ? 1 : value;
}

export function createHeartbeat(host: HeartbeatHost): Heartbeat {
  // Lanes are copy-on-write: registering is rare (mount, scroll into view) and
  // a frame iterates the array it started with, so a tick that registers or
  // unregisters something never disturbs the iteration in progress.
  let simLane: Slot[] = [];
  let canvasLane: Slot[] = [];
  let domLane: Slot[] = [];

  let paused = host.readPaused();
  let tier: QualityTier = 0;
  let running = false;
  let handle = 0;
  let lastNow = -1;
  let simAccumulatorMs = 0;

  // Quality tier: a ring buffer of frame intervals, allocation-free per frame.
  const samples = new Float64Array(QUALITY_WINDOW);
  let sampleCount = 0;
  let sampleIndex = 0;
  let sampleSum = 0;
  let relaxSince = -1;

  // Canvas selection scratch, reused every frame.
  const picks = new Int32Array(MAX_LIVE_CANVASES);
  const pickScores = new Float64Array(MAX_LIVE_CANVASES);

  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        host.reportError("heartbeat:listener", error);
      }
    }
  };

  const entryCount = () => simLane.length + canvasLane.length + domLane.length;

  const shouldRun = () =>
    entryCount() > 0 && !paused && !host.isHidden() && !host.isReducedMotion();

  const removeSlot = (slot: Slot) => {
    const without = (lane: Slot[]) => lane.filter((candidate) => candidate !== slot);
    if (slot.entry.lane === "sim") simLane = without(simLane);
    else if (slot.entry.lane === "canvas") canvasLane = without(canvasLane);
    else domLane = without(domLane);
  };

  const runSlot = (slot: Slot, dt: number, now: number) => {
    if (!slot.alive) return;
    try {
      slot.entry.tick(dt, now);
    } catch (error) {
      // One broken instrument must not stop the page; it is dropped and reported.
      slot.alive = false;
      removeSlot(slot);
      host.reportError(slot.entry.id, error);
    }
  };

  const canvasScore = (slot: Slot): number => {
    if (!slot.alive) return 0;
    const { visibility, priority } = slot.entry;
    let share = 1;
    if (visibility) {
      try {
        share = clampVisibility(visibility());
      } catch (error) {
        host.reportError(slot.entry.id, error);
        share = 0;
      }
    }
    const boost = priority !== undefined && priority > 0 ? priority : 0;
    return share * (1 + boost);
  };

  const resetSamples = () => {
    sampleCount = 0;
    sampleIndex = 0;
    sampleSum = 0;
  };

  const sampleQuality = (intervalMs: number, now: number) => {
    if (!(intervalMs > 0) || intervalMs > QUALITY_MAX_SAMPLE_MS) return;
    if (sampleCount === QUALITY_WINDOW) sampleSum -= samples[sampleIndex];
    else sampleCount += 1;
    samples[sampleIndex] = intervalMs;
    sampleSum += intervalMs;
    sampleIndex = (sampleIndex + 1) % QUALITY_WINDOW;
    if (sampleCount < QUALITY_WINDOW) return;

    const mean = sampleSum / QUALITY_WINDOW;
    if (mean > QUALITY_RAISE_MS) {
      relaxSince = -1;
      if (tier < 2) {
        tier = (tier + 1) as QualityTier;
        // The lighter tier gets a fresh window before it can be judged again.
        resetSamples();
        emit();
      }
      return;
    }
    if (mean < QUALITY_RELAX_MS && tier > 0) {
      if (relaxSince < 0) {
        relaxSince = now;
      } else if (now - relaxSince >= QUALITY_RELAX_HOLD_MS) {
        tier = (tier - 1) as QualityTier;
        relaxSince = now;
        emit();
      }
      return;
    }
    relaxSince = -1;
  };

  const frame = (now: number) => {
    handle = 0;
    if (!running) return;
    if (!shouldRun()) {
      running = false;
      return;
    }

    const elapsedMs = lastNow < 0 ? 0 : Math.max(0, now - lastNow);
    lastNow = now;
    const dt = Math.min(elapsedMs / 1000, MAX_FRAME_DT);

    // 1. sim: fixed steps of real time, bounded catch-up.
    simAccumulatorMs += elapsedMs;
    let steps = 0;
    while (simAccumulatorMs >= SIM_STEP_MS && steps < MAX_SIM_CATCH_UP) {
      simAccumulatorMs -= SIM_STEP_MS;
      steps += 1;
      const lane = simLane;
      for (let i = 0; i < lane.length; i++) runSlot(lane[i], SIM_STEP_MS / 1000, now);
    }
    if (simAccumulatorMs >= SIM_STEP_MS) simAccumulatorMs %= SIM_STEP_MS;

    // 2. canvas: the top MAX_LIVE_CANVASES by visibility × (1 + priority).
    // Strictly-greater comparisons keep ties in registration order, so two
    // equal canvases never flicker between ticking and frozen.
    const canvases = canvasLane;
    let picked = 0;
    for (let i = 0; i < canvases.length; i++) {
      const score = canvasScore(canvases[i]);
      if (score <= 0) continue;
      let at = picked;
      while (at > 0 && score > pickScores[at - 1]) at -= 1;
      if (at >= MAX_LIVE_CANVASES) continue;
      const last = picked < MAX_LIVE_CANVASES ? picked : MAX_LIVE_CANVASES - 1;
      for (let j = last; j > at; j--) {
        picks[j] = picks[j - 1];
        pickScores[j] = pickScores[j - 1];
      }
      picks[at] = i;
      pickScores[at] = score;
      if (picked < MAX_LIVE_CANVASES) picked += 1;
    }
    for (let k = 0; k < picked; k++) runSlot(canvases[picks[k]], dt, now);

    // 3. dom
    const doms = domLane;
    for (let i = 0; i < doms.length; i++) runSlot(doms[i], dt, now);

    sampleQuality(elapsedMs, now);

    // A tick may have paused the page or unregistered the last entry.
    if (running && shouldRun()) handle = host.requestFrame(frame);
    else running = false;
  };

  const start = () => {
    running = true;
    lastNow = -1;
    simAccumulatorMs = 0;
    resetSamples();
    relaxSince = -1;
    handle = host.requestFrame(frame);
  };

  const stop = () => {
    running = false;
    if (handle) host.cancelFrame(handle);
    handle = 0;
  };

  const refresh = () => {
    const want = shouldRun();
    if (want && !running) start();
    else if (!want && running) stop();
  };

  return {
    register(entry) {
      const slot: Slot = { entry, alive: true };
      if (entry.lane === "sim") simLane = [...simLane, slot];
      else if (entry.lane === "canvas") canvasLane = [...canvasLane, slot];
      else domLane = [...domLane, slot];
      host.syncPaused(paused);
      refresh();
      return () => {
        if (!slot.alive) return;
        slot.alive = false;
        removeSlot(slot);
        refresh();
      };
    },
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      host.writePaused(next);
      refresh();
      emit();
    },
    isPaused: () => paused,
    getQualityTier: () => tier,
    isRunning: () => running,
    refresh,
    subscribe(listener) {
      listeners.add(listener);
      host.syncPaused(paused);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Browser singleton                                                        */
/* ------------------------------------------------------------------------ */

function readStoredPaused(): boolean {
  try {
    return window.localStorage.getItem(PAUSED_STORAGE_KEY) === "1";
  } catch {
    // Private mode, blocked storage or a sandboxed preview: default to playing.
    return false;
  }
}

function storePaused(paused: boolean): void {
  try {
    window.localStorage.setItem(PAUSED_STORAGE_KEY, paused ? "1" : "0");
  } catch {
    // Storage is a convenience; the toggle still works for this visit.
  }
}

function syncPausedClass(paused: boolean): void {
  const roots = document.querySelectorAll(".pusula-landing");
  for (let i = 0; i < roots.length; i++) roots[i].classList.toggle(PAUSED_CLASS, paused);
}

function createBrowserHost(): HeartbeatHost {
  const motionQuery =
    typeof window.matchMedia === "function" ? window.matchMedia(REDUCED_MOTION_QUERY) : null;
  return {
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (frameHandle) => window.cancelAnimationFrame(frameHandle),
    isHidden: () => document.hidden === true,
    isReducedMotion: () => motionQuery?.matches === true,
    readPaused: readStoredPaused,
    writePaused: (paused) => {
      storePaused(paused);
      syncPausedClass(paused);
    },
    syncPaused: syncPausedClass,
    reportError: (id, error) => {
      console.error(`[landing] heartbeat entry "${id}" threw and was stopped`, error);
    },
  };
}

let browserHeartbeat: Heartbeat | null = null;

function getHeartbeat(): Heartbeat | null {
  if (browserHeartbeat) return browserHeartbeat;
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    return null;
  }
  const heartbeat = createHeartbeat(createBrowserHost());
  browserHeartbeat = heartbeat;
  document.addEventListener("visibilitychange", () => heartbeat.refresh());
  subscribeReducedMotion(() => heartbeat.refresh());
  return heartbeat;
}

const noop = () => {};

/**
 * Add a tick to one lane. Returns the unregister function (idempotent). Safe
 * to call on the server, where it does nothing. Call it from an effect, never
 * during render.
 */
export function register(entry: HeartbeatEntry): () => void {
  return getHeartbeat()?.register(entry) ?? noop;
}

/** Pause or resume every loop on the page; persisted and mirrored as `.is-paused`. */
export function setPaused(paused: boolean): void {
  getHeartbeat()?.setPaused(paused);
}

/** Non-hook read of the Pause toggle (false on the server). */
export function isPaused(): boolean {
  return getHeartbeat()?.isPaused() ?? false;
}

/** Non-hook read of the quality tier, for renderers deciding what to draw inside a frame. */
export function getQualityTier(): QualityTier {
  return getHeartbeat()?.getQualityTier() ?? 0;
}

/**
 * Whether the loop is allowed to animate: no reduced-motion preference and no
 * Pause. When false, interactions must resolve instantly instead of over time.
 * Always false on the server.
 */
export function canAnimate(): boolean {
  if (typeof window === "undefined") return false;
  const reduced =
    typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches;
  return !reduced && !isPaused();
}

function subscribeHeartbeat(listener: () => void): () => void {
  return getHeartbeat()?.subscribe(listener) ?? noop;
}

const serverFalse = () => false;
const serverTier = (): QualityTier => 0;

/** The Pause toggle as React state. Server and hydration render `false`. */
export function usePaused(): boolean {
  return useSyncExternalStore(subscribeHeartbeat, isPaused, serverFalse);
}

/** 0 = full quality; 1 and 2 = progressively lighter rendering. Server renders 0. */
export function useQualityTier(): QualityTier {
  return useSyncExternalStore(subscribeHeartbeat, getQualityTier, serverTier);
}
