/**
 * Pure maths of the compass nav and the SimDock (spec §6.1): the heading
 * tape's geometry, which waypoint sits under the caret, the time-lapse cycle,
 * the dock's lift over a short band at the bottom of the viewport, and the
 * toast gate that turns visitor-caused deck events into at most one toast per
 * outage beat.
 *
 * No React, no DOM, no clock: everything takes its inputs as arguments so it
 * is unit-tested (`tests/unit/landing-nav.test.ts`) and SSR-safe.
 */
import type { BreakerState, CandidateId, DeckEvent, Speed } from "../../sim/landingSim";

/* ------------------------------------------------------------------------ */
/* Heading tape                                                             */
/* ------------------------------------------------------------------------ */

/** Horizontal scale of the tape: 45° between waypoints is 135px. */
export const TAPE_PX_PER_DEG = 3;
/** The tape strip spans −180°..540°, so ±90° around any heading in 0..360 is drawn. */
export const TAPE_MIN_DEG = -180;
export const TAPE_MAX_DEG = 540;
export const TAPE_STRIP_WIDTH = (TAPE_MAX_DEG - TAPE_MIN_DEG) * TAPE_PX_PER_DEG;
export const TAPE_HEIGHT = 36;
/** Degrees between ticks; every 3rd tick (15°) is taller; numerals every 45°. */
export const TAPE_TICK_DEG = 5;
export const TAPE_MAJOR_DEG = 15;
export const TAPE_WAYPOINT_DEG = 45;

export type TapeTickKind = "minor" | "major";
export type TapeTick = { readonly deg: number; readonly x: number; readonly kind: TapeTickKind };

/** x (px from the strip's start) of a bearing on the tape strip. */
export function tapeX(deg: number): number {
  return (deg - TAPE_MIN_DEG) * TAPE_PX_PER_DEG;
}

/**
 * The strip's `translateX` (px) that puts `heading` under the caret. The strip
 * is anchored with its start at the tape's centre line, so the offset is just
 * minus the heading's x. Headings are clamped to the drawn range.
 */
export function tapeOffsetPx(heading: number): number {
  const h = Math.min(Math.max(heading, TAPE_MIN_DEG), TAPE_MAX_DEG);
  return -tapeX(h);
}

/**
 * Tick marks every 5° across the strip. Waypoint bearings (every 45°) carry a
 * numeral instead of a line, so they are left out.
 */
export function buildTapeTicks(): TapeTick[] {
  const ticks: TapeTick[] = [];
  for (let deg = TAPE_MIN_DEG; deg <= TAPE_MAX_DEG; deg += TAPE_TICK_DEG) {
    if (deg % TAPE_WAYPOINT_DEG === 0) continue;
    ticks.push({ deg, x: tapeX(deg), kind: deg % TAPE_MAJOR_DEG === 0 ? "major" : "minor" });
  }
  return ticks;
}

/** Every 45° numeral position on the strip (−180..540). */
export function buildTapeNumerals(): number[] {
  const out: number[] = [];
  for (let deg = TAPE_MIN_DEG; deg <= TAPE_MAX_DEG; deg += TAPE_WAYPOINT_DEG) out.push(deg);
  return out;
}

/**
 * The copies of a bearing that fall on the strip, canonical one first
 * (`bearing` itself, 0..315), then the ±360° repeats that keep the tape
 * continuous at both ends (north again at 360°, the footer's "back to north").
 */
export function waypointCopies(bearing: number): number[] {
  const copies = [bearing];
  for (const shift of [-360, 360]) {
    const deg = bearing + shift;
    if (deg >= TAPE_MIN_DEG && deg <= TAPE_MAX_DEG) copies.push(deg);
  }
  return copies;
}

/** Signed shortest difference `b − a` in degrees, in (−180, 180]. */
export function angleDelta(a: number, b: number): number {
  let d = (((b - a) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/**
 * Index of the waypoint nearest the caret (circular distance, so 350° is
 * nearest north). Ties go to the lower index. -1 with no bearings.
 */
export function nearestWaypoint(heading: number, bearings: readonly number[]): number {
  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < bearings.length; i++) {
    const distance = Math.abs(angleDelta(heading, bearings[i]));
    if (distance < bestDistance - 1e-9) {
      best = i;
      bestDistance = distance;
    }
  }
  return best;
}

/** Share of the voyage (0..1) for the phone progress line. */
export function progressShare(heading: number): number {
  if (!(heading > 0)) return 0;
  return Math.min(heading / 360, 1);
}

/**
 * A bearing numeral for the nav: zero-padded like the station kickers
 * ("045°"), except north in a script whose zero is a dot. Persian "۰۰۰" reads
 * as an ellipsis, so north there is the single zero "۰".
 */
export function navBearingText(padded: string): string {
  return /^([\u06F0\u0660])\1\1$/.test(padded) ? padded[0] : padded;
}

/* ------------------------------------------------------------------------ */
/* SimDock                                                                  */
/* ------------------------------------------------------------------------ */

/** ×1 → ×5 → ×10 → ×1. An unknown speed restarts the cycle at ×1. */
export function nextSpeed(speed: number, speeds: readonly Speed[]): Speed {
  const i = speeds.indexOf(speed as Speed);
  return speeds[(i + 1) % speeds.length] ?? speeds[0];
}

/** The dock lives in this band at the bottom of the viewport (inset + height + air). */
export const DOCK_BAND_PX = 84;
/** A target taller than this share of the viewport is not climbed: the dock steps aside. */
export const DOCK_LIFT_MAX_SHARE = 0.2;
export const DOCK_LIFT_GAP_PX = 12;

export type DockClearance = {
  /** px the dock rises to sit above the band. */
  readonly lift: number;
  /** The band is too tall to climb: the dock steps aside while it is under it. */
  readonly hide: boolean;
};

const DOCK_AT_REST: DockClearance = { lift: 0, hide: false };

/**
 * How the dock clears the board of real figures (the hero's almanac board)
 * while it rests in the dock's band at the bottom of the viewport. A short
 * board (desktop, one row) is climbed: the dock lifts to sit just above it.
 * A tall one (the board on a phone) cannot be climbed without covering the
 * hero, and the "Simulation" pill must never sit on real figures, so the
 * dock steps aside until the board has scrolled out of its band.
 */
export function dockClearance(targetHeight: number, viewportHeight: number): DockClearance {
  if (!(targetHeight > 0) || !(viewportHeight > 0)) return DOCK_AT_REST;
  if (targetHeight > viewportHeight * DOCK_LIFT_MAX_SHARE) return { lift: 0, hide: true };
  return { lift: Math.round(targetHeight + DOCK_LIFT_GAP_PX), hide: false };
}

/** Pulse length of the dock dot's ring, and the shortest gap between restarts (≤ 3 per second). */
export const DOCK_PULSE_S = 0.6;
export const DOCK_PULSE_MIN_GAP_S = 0.34;

/* ------------------------------------------------------------------------ */
/* Toasts                                                                   */
/* ------------------------------------------------------------------------ */

export const TOAST_LIMIT = 2;
export const TOAST_MS = 4000;
/** A provider's "is failing" toast repeats at most this often while its outage lasts. */
export const FAILING_REPEAT_MS = 15000;

export type ToastSpec =
  | { readonly kind: "failing"; readonly id: CandidateId; readonly fallback: CandidateId }
  | { readonly kind: "state"; readonly id: CandidateId; readonly state: BreakerState };

export type ToastGate = {
  /** The toast this event deserves, or null. `nowMs` is any monotonic clock. */
  accept(event: DeckEvent, user: boolean, nowMs: number): ToastSpec | null;
  reset(): void;
};

/**
 * Turns deck events into toasts, visitor-caused only, de-duplicated per
 * outage episode:
 * - "{provider} is failing, traffic rerouted to {fallback}" once when a
 *   visitor-caused failure first makes the hub retry the next target, and at
 *   most every `FAILING_REPEAT_MS` after that;
 * - "{provider} · {state}" for each breaker state at most once per episode
 *   (an open ↔ half-open probe cycle does not toast every probe);
 * - an episode ends when that provider's breaker closes again.
 */
export function createToastGate(): ToastGate {
  const failingAt = new Map<CandidateId, number>();
  const statesSeen = new Map<CandidateId, Set<BreakerState>>();

  return {
    accept(event, user, nowMs) {
      if (!user) return null;
      if (event.kind === "routed") {
        if (event.probe || event.failed.length === 0) return null;
        const id = event.failed[0];
        if (id === event.to) return null;
        const last = failingAt.get(id);
        if (last !== undefined && nowMs - last < FAILING_REPEAT_MS) return null;
        failingAt.set(id, nowMs);
        return { kind: "failing", id, fallback: event.to };
      }
      if (event.kind === "breaker") {
        let seen = statesSeen.get(event.id);
        if (event.state === "closed") {
          // Recovery closes the episode; toast it only if the episode toasted anything.
          const toasted = seen !== undefined && seen.size > 0;
          statesSeen.delete(event.id);
          failingAt.delete(event.id);
          return toasted ? { kind: "state", id: event.id, state: "closed" } : null;
        }
        if (!seen) {
          seen = new Set();
          statesSeen.set(event.id, seen);
        }
        if (seen.has(event.state)) return null;
        seen.add(event.state);
        return { kind: "state", id: event.id, state: event.state };
      }
      return null;
    },
    reset() {
      failingAt.clear();
      statesSeen.clear();
    },
  };
}

export type ToastEntry = {
  readonly key: number;
  readonly spec: ToastSpec;
  readonly leaving: boolean;
};

/**
 * Add a toast to the stack (oldest first). A provider's breaker-state toast
 * is updated in place (degraded → open → half-open) instead of stacking, so
 * the headline "is failing, rerouted" toast is not pushed out by the states
 * that follow it; otherwise the oldest toasts beyond `limit` leave.
 */
export function pushToast(
  list: readonly ToastEntry[],
  entry: ToastEntry,
  limit: number = TOAST_LIMIT
): ToastEntry[] {
  const spec = entry.spec;
  if (spec.kind === "state") {
    const i = list.findIndex(
      (toast) => !toast.leaving && toast.spec.kind === "state" && toast.spec.id === spec.id
    );
    if (i >= 0) {
      const next = list.slice();
      next[i] = entry;
      return next;
    }
  }
  return [...list, entry].slice(-limit);
}

/** `landing.*` key of each breaker state's word. */
export const STATE_KEY = {
  closed: "stateClosed",
  degraded: "stateDegraded",
  open: "stateOpen",
  halfOpen: "stateHalfOpen",
} as const satisfies Record<BreakerState, string>;
