"use client";
import { useCallback, useState, useSyncExternalStore } from "react";
import { BREAKER_PROFILES, type LandingStats } from "../landingTypes";
import {
  advanceUntil,
  createWorld,
  nextTake,
  step,
  type ActionOptions,
  type CandidateId,
  type CandidateState,
  type DeckEvent,
  type World,
} from "../sim/landingSim";
import { canAnimate, register } from "./heartbeat";

/**
 * The Deck: the page's one seeded simulation of the gateway, shared by every
 * instrument (hero needle, map flights, breaker rail, tools terminal,
 * logbook), so a failure caused anywhere shows everywhere.
 *
 * - `primeDeck(stats)`: render-safe and idempotent. Builds the tick-0 world
 *   from the real scoring factors. Call it at the top of the client shell's
 *   render (LandingPage) so the server render and hydration select from the
 *   same tick-0 world; on the server it only builds that snapshot.
 * - `initDeck(stats)`: client-only, idempotent, call from an effect
 *   (`useEffect(() => initDeck(stats), [stats])`). Primes, then puts the
 *   deck on the heartbeat's `sim` lane: it steps 100 ms at a time whenever
 *   the tab is visible and not paused, even with no consumer on screen, so
 *   the logbook stays honest. Returns a disposer (ref-counted).
 * - `getWorld()`: the live, mutable world for loops. Read it each frame; do
 *   not cache sub-objects across frames. Never mutate it directly: go through
 *   `dispatch` so consumers are notified.
 * - `dispatch(action, { user })`: applies an `act.*(…)` action from the sim
 *   (or any `(world) => void`, e.g. `(w) => nextTake(w)` for a manual take).
 *   `user: true` is passed to the action, which counts a fault it switches on
 *   in `session.outagesCaused`; the deck's events about that candidate are
 *   then flagged user-caused (toasts) until it is healthy again. When the
 *   loop cannot animate (reduced motion or Pause), a fault change is resolved
 *   at once (`advanceUntil` the breaker settles: OPEN while down, CLOSED once
 *   restored), so the visitor sees the outcome without a running clock.
 * - `useDeck(selector, isEqual?)`: `useSyncExternalStore` over the deck with
 *   commits capped at 10 Hz. The server snapshot is the tick-0 world. The
 *   component re-renders only when `isEqual` (default `Object.is`) says the
 *   selection changed, so select primitives or pass `shallowEqual`.
 * - `subscribeEvents(cb)`: each new `DeckEvent` exactly once, in order, with
 *   `{ user }` meta. Called inside the sim step: keep callbacks cheap.
 *
 * Featured takes: the deck runs `nextTake` itself every `TAKE_INTERVAL_MS`
 * of real time (the first `FIRST_TAKE_MS` after init, the intro's "first
 * take" beat), so the featured winner keeps moving for the catalog echo, the
 * rose and the tools terminal while the hero is off screen. When anyone else
 * takes (the hero on its own cadence, a HUD click through `dispatch`), the
 * deck notices and yields, waiting a longer interval before its next take.
 */

/** Real-time cadence of featured takes. */
export const TAKE_INTERVAL_MS = 3600;
/** First automatic take after `initDeck`, matching the intro storyboard (§5.4, t = 2800). */
export const FIRST_TAKE_MS = 2800;
/** After somebody else takes, the deck waits this long before taking itself. */
const YIELD_INTERVAL_MS = TAKE_INTERVAL_MS * 1.25;
/** React notifications are capped at 10 Hz. */
export const NOTIFY_INTERVAL_MS = 100;
/** Resolving a fault instantly always shows at least this much traffic (sim ms). */
export const RESOLVE_MIN_MS = 3000;
/**
 * Upper bound (sim ms) for instant resolution: twice the longest breaker
 * reset, enough for the slowest breaker to open, wait out its reset and
 * probe. A candidate that never gets traffic simply stops there.
 */
export const RESOLVE_MAX_MS = Math.max(...BREAKER_PROFILES.map((p) => p.resetSeconds)) * 2000;

/** Anything `dispatch` accepts: a sim action (`act.*`) or a plain world mutator. */
export type DeckActionLike = (world: World, options?: ActionOptions) => unknown;
export type DispatchOptions = {
  /** The visitor caused this (toasts, `session.outagesCaused`). */
  user?: boolean;
  /** Resolve a fault change instantly. Default: when the loop cannot animate. */
  resolve?: boolean;
  /** Upper bound (sim ms) when resolving. Default `RESOLVE_MAX_MS`. */
  resolveMaxMs?: number;
};
export type DeckEventMeta = { readonly user: boolean };
export type DeckEventListener = (event: DeckEvent, meta: DeckEventMeta) => void;
export type DeckInitOptions = { autoTake?: boolean };

type FactorInput = { factorIds: string[]; defaults: number[] };

const USER_META: DeckEventMeta = Object.freeze({ user: true });
const SIM_META: DeckEventMeta = Object.freeze({ user: false });
const EMPTY_INPUT: FactorInput = { factorIds: [], defaults: [] };

let primedKey: string | null = null;
/** Tick-0 world: the server snapshot. Never stepped, never mutated. */
let seedWorld: World | null = null;
/** Client-only live world; a stable object (priming replaces its contents in place). */
let liveWorld: World | null = null;
let fallbackSeed: World | null = null;

let version = 0;
let dirty = false;
let lastNotifyAt = -Infinity;
let notifyTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const eventListeners = new Set<DeckEventListener>();

let lastDeliveredN = -1;
const pending: DeckEvent[] = [];
/** Candidates whose current trouble the visitor caused; their events are flagged `user`. */
const userCandidates = new Set<CandidateId>();

let initCount = 0;
let unregisterSim: (() => void) | null = null;
let autoTake = true;
let takeClockMs = 0;
let nextTakeInMs = FIRST_TAKE_MS;
let lastSeenTake = 0;

const noop = () => {};

function factorInput(stats: Pick<LandingStats, "scoringFactors">): FactorInput {
  return {
    factorIds: stats.scoringFactors.map((factor) => factor.id),
    defaults: stats.scoringFactors.map((factor) => factor.weight),
  };
}

function getSeed(): World {
  if (seedWorld) return seedWorld;
  fallbackSeed ??= createWorld(EMPTY_INPUT);
  return fallbackSeed;
}

function adoptWorld(world: World): void {
  lastDeliveredN = world.eventSeq - 1;
  lastSeenTake = world.featured.take;
  takeClockMs = 0;
  nextTakeInMs = FIRST_TAKE_MS;
  userCandidates.clear();
}

function ensureLiveWorld(): World {
  if (!liveWorld) {
    liveWorld = createWorld(EMPTY_INPUT);
    adoptWorld(liveWorld);
  }
  return liveWorld;
}

function notifyAll(): void {
  for (const listener of listeners) listener();
}

function flushNotify(): void {
  notifyTimer = null;
  if (!dirty) return;
  dirty = false;
  version += 1;
  lastNotifyAt = performance.now();
  notifyAll();
}

/** Mark the world changed; React hears about it at most every 100 ms (trailing edge kept). */
function markChanged(): void {
  dirty = true;
  if (notifyTimer !== null) return;
  const wait = NOTIFY_INTERVAL_MS - (performance.now() - lastNotifyAt);
  if (wait <= 0) flushNotify();
  else notifyTimer = setTimeout(flushNotify, wait);
}

/** Bit mask of a candidate's fault latches: upstream, then each key, then each model. */
function latchMask(candidate: CandidateState): number {
  let mask = candidate.upstreamDown ? 1 : 0;
  let bit = 2;
  for (const key of candidate.keys) {
    if (key.revoked) mask |= bit;
    bit *= 2;
  }
  for (const model of candidate.models) {
    if (model.rateLimited) mask |= bit;
    bit *= 2;
  }
  return mask;
}

function countBits(mask: number): number {
  let count = 0;
  for (let rest = mask; rest > 0; rest = Math.floor(rest / 2)) count += rest % 2;
  return count;
}

function findCandidate(world: World, id: CandidateId): CandidateState | undefined {
  for (const candidate of world.candidates) if (candidate.id === id) return candidate;
  return undefined;
}

function isUserEvent(event: DeckEvent): boolean {
  if (userCandidates.size === 0) return false;
  if (event.kind === "routed" || event.kind === "dropped") {
    for (const id of event.failed) if (userCandidates.has(id)) return true;
    return false;
  }
  return userCandidates.has(event.id);
}

function deliverEvents(world: World): void {
  if (world.eventSeq - 1 <= lastDeliveredN) return;
  const events = world.events;
  let ordered = true;
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (!event || event.n <= lastDeliveredN) continue;
    if (pending.length > 0 && event.n < pending[pending.length - 1].n) ordered = false;
    pending.push(event);
  }
  // Anything older than the ring buffer is gone; never deliver it later.
  lastDeliveredN = world.eventSeq - 1;
  if (pending.length === 0) return;
  if (!ordered) pending.sort((a, b) => a.n - b.n);

  for (let i = 0; i < pending.length; i++) {
    const event = pending[i];
    const meta = isUserEvent(event) ? USER_META : SIM_META;
    for (const listener of eventListeners) {
      try {
        listener(event, meta);
      } catch (error) {
        console.error("[landing] deck event listener threw", error);
      }
    }
    // A visitor-caused episode ends when the breaker is closed and nothing is latched.
    if (event.kind === "breaker" && event.state === "closed" && userCandidates.has(event.id)) {
      const candidate = findCandidate(world, event.id);
      if (!candidate || latchMask(candidate) === 0) userCandidates.delete(event.id);
    }
  }
  pending.length = 0;
}

/** True (and the clock yields) when somebody other than the deck took since last seen. */
function syncTakeClock(world: World): boolean {
  if (world.featured.take === lastSeenTake) return false;
  lastSeenTake = world.featured.take;
  takeClockMs = 0;
  nextTakeInMs = YIELD_INTERVAL_MS;
  return true;
}

function deckTick(dt: number): void {
  const world = liveWorld;
  if (!world) return;
  const ms = Math.round(dt * 1000);
  step(world, ms);

  if (autoTake && !syncTakeClock(world)) {
    takeClockMs += ms;
    if (takeClockMs >= nextTakeInMs) {
      nextTake(world);
      lastSeenTake = world.featured.take;
      takeClockMs = 0;
      nextTakeInMs = TAKE_INTERVAL_MS;
    }
  }

  deliverEvents(world);
  markChanged();
}

/** Each changed candidate's breaker has settled for its latch: OPEN while down, CLOSED once up. */
function settled(world: World, ids: readonly CandidateId[]): boolean {
  for (const id of ids) {
    const candidate = findCandidate(world, id);
    if (!candidate) continue;
    const target = candidate.upstreamDown ? "open" : "closed";
    if (candidate.breaker.state !== target) return false;
  }
  return true;
}

/* ------------------------------------------------------------------------ */
/* Lifecycle                                                                */
/* ------------------------------------------------------------------------ */

/**
 * Build the tick-0 world for these stats (render-safe, idempotent). On the
 * client it also (re)seeds the live world in place, so references obtained
 * from `getWorld()` stay valid.
 */
export function primeDeck(stats: Pick<LandingStats, "scoringFactors">): void {
  const input = factorInput(stats);
  const key = `${input.factorIds.join(",")}|${input.defaults.join(",")}`;
  if (key === primedKey) return;
  primedKey = key;
  seedWorld = createWorld(input);
  if (typeof window === "undefined") return; // the server only needs the snapshot

  const fresh = createWorld(input);
  if (liveWorld) Object.assign(liveWorld, fresh);
  else liveWorld = fresh;
  adoptWorld(liveWorld);
  // May run during render: change the version now (React re-checks
  // snapshots before commit) but notify subscribers outside render.
  version += 1;
  if (listeners.size > 0) queueMicrotask(notifyAll);
}

/** Start stepping the deck on the heartbeat. Client-only; returns a ref-counted disposer. */
export function initDeck(
  stats: Pick<LandingStats, "scoringFactors">,
  options: DeckInitOptions = {}
): () => void {
  if (typeof window === "undefined") return noop;
  primeDeck(stats);
  if (options.autoTake !== undefined) autoTake = options.autoTake;
  initCount += 1;
  unregisterSim ??= register({ id: "deck", lane: "sim", tick: deckTick });
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    initCount -= 1;
    if (initCount === 0) {
      unregisterSim?.();
      unregisterSim = null;
    }
  };
}

/** The live world for loops (on the server: the tick-0 world, read-only). */
export function getWorld(): World {
  if (typeof window === "undefined") return getSeed();
  return ensureLiveWorld();
}

/** The tick-0 world (read-only): what the server rendered. */
export function getSeedWorld(): World {
  return getSeed();
}

/** Apply an action to the live world and notify consumers. Client-only. */
export function dispatch(action: DeckActionLike, options: DispatchOptions = {}): void {
  if (typeof window === "undefined") return;
  const world = ensureLiveWorld();
  const user = options.user === true;
  const revBefore = world.rev;
  const before = new Map<CandidateId, number>();
  for (const candidate of world.candidates) before.set(candidate.id, latchMask(candidate));

  action(world, { user });

  // Sim actions (`act.*`, callable data with a `type`) count the visitor's
  // outages themselves; a plain mutator is counted here from its latch diff.
  const countsItself = typeof (action as { type?: unknown }).type === "string";
  const changed: CandidateId[] = [];
  for (const candidate of world.candidates) {
    const was = before.get(candidate.id) ?? 0;
    const now = latchMask(candidate);
    if (was === now) continue;
    changed.push(candidate.id);
    if (user) {
      if (!countsItself) world.session.outagesCaused += countBits(now & ~was);
      userCandidates.add(candidate.id);
    } else {
      userCandidates.delete(candidate.id);
    }
  }
  syncTakeClock(world);

  const resolve = options.resolve ?? !canAnimate();
  if (resolve && changed.length > 0) {
    const start = world.simMs;
    advanceUntil(
      world,
      (w) => w.simMs - start >= RESOLVE_MIN_MS && settled(w, changed),
      options.resolveMaxMs ?? RESOLVE_MAX_MS
    );
  }

  deliverEvents(world);
  if (world.rev !== revBefore || changed.length > 0) markChanged();
}

/** Every new deck event, once, in order. Returns the unsubscribe function. */
export function subscribeEvents(listener: DeckEventListener): () => void {
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

/* ------------------------------------------------------------------------ */
/* React                                                                    */
/* ------------------------------------------------------------------------ */

function subscribeDeck(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

type SelectionCache<T> = {
  has: boolean;
  version: number;
  selector: unknown;
  value: T | undefined;
  serverHas: boolean;
  serverSelector: unknown;
  serverValue: T | undefined;
};

function createSelectionCache<T>(): SelectionCache<T> {
  return {
    has: false,
    version: -1,
    selector: null,
    value: undefined,
    serverHas: false,
    serverSelector: null,
    serverValue: undefined,
  };
}

/**
 * Memoised selection: recomputed only when the deck version or the selector
 * changes, and the previous value is kept when `isEqual` says nothing
 * changed, so `useSyncExternalStore` sees a stable snapshot.
 */
function readSelection<T>(
  cache: SelectionCache<T>,
  selector: (world: World) => T,
  isEqual: (a: T, b: T) => boolean
): T {
  if (cache.has && cache.version === version && cache.selector === selector) {
    return cache.value as T;
  }
  const next = selector(liveWorld ?? getSeed());
  cache.version = version;
  cache.selector = selector;
  if (cache.has && isEqual(cache.value as T, next)) return cache.value as T;
  cache.value = next;
  cache.has = true;
  return next;
}

function readServerSelection<T>(
  cache: SelectionCache<T>,
  selector: (world: World) => T,
  isEqual: (a: T, b: T) => boolean
): T {
  if (cache.serverHas && cache.serverSelector === selector) return cache.serverValue as T;
  const next = selector(getSeed());
  cache.serverSelector = selector;
  if (cache.serverHas && isEqual(cache.serverValue as T, next)) return cache.serverValue as T;
  cache.serverValue = next;
  cache.serverHas = true;
  return next;
}

/**
 * Select from the deck. Commits at most 10 times a second, and only when the
 * selection changes per `isEqual`. Server and hydration select from the
 * tick-0 world.
 */
export function useDeck<T>(
  selector: (world: World) => T,
  isEqual: (a: T, b: T) => boolean = Object.is
): T {
  const [cache] = useState(createSelectionCache<T>);
  const getSnapshot = useCallback(
    () => readSelection(cache, selector, isEqual),
    [cache, selector, isEqual]
  );
  const getServerSnapshot = useCallback(
    () => readServerSelection(cache, selector, isEqual),
    [cache, selector, isEqual]
  );
  return useSyncExternalStore(subscribeDeck, getSnapshot, getServerSnapshot);
}

const selectReqPerSec = (world: World) => world.reqPerSec;

/** The deck's request rate (requests per simulated second, `world.reqPerSec`) for the SimDock. Server: 0. */
export function useReqPerSec(): number {
  return useDeck(selectReqPerSec);
}

/** Shallow equality for array or object selections, e.g. `useDeck((w) => [a, b], shallowEqual)`. */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    ) {
      return false;
    }
  }
  return true;
}
