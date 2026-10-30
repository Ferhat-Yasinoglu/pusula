/**
 * Pure maths of the compass nav and the SimDock (spec §6.1): the heading
 * tape's geometry, which waypoint sits under the caret, the time-lapse cycle,
 * the dock's lift over a short band at the bottom of the viewport, and the
 * toast gate, pacer and source ledger that turn visitor-caused deck events
 * into at most one message per outage beat.
 *
 * No React, no DOM, no clock: everything takes its inputs as arguments so it
 * is unit-tested (`tests/unit/landing-nav.test.ts`) and SSR-safe.
 */
import type { BreakerState, CandidateId, DeckEvent, FailCode, Speed } from "../../sim/landingSim";

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

/**
 * Share of a station's span of the page heading spent turning the tape at
 * each seam, on either side of the boundary between two stations.
 */
export const TAPE_SEAM = 0.12;
/** Bearing of the last station, after which the voyage turns home to 360°. */
const LAST_BEARING = 360 - TAPE_WAYPOINT_DEG;

function smoothstep(x: number): number {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * The tape's heading for a page heading: stepped, so the tape holds each
 * station's bearing while that station covers the middle of the viewport and
 * turns to the next one only across the seam between them.
 *
 * The page heading (`runtime/stations.ts`) reaches a station's bearing as the
 * station's top crosses the middle of the viewport and is linear in between,
 * so the fraction of each 45° span is how far the station above has passed
 * that line. Each turn is centred on a boundary (`seam` of a span on either
 * side), so the waypoint nearest the tape's heading changes exactly as the
 * next station's top crosses the middle: the lit waypoint always names the
 * station under the middle of the viewport.
 *
 * The voyage starts at north without a turn. The last turn, home to north,
 * is centred on `homeAt` (the page heading at which the footer's top crosses
 * the middle, `homeHeading`) and always ends by 360°, where the page heading
 * arrives only at the very bottom of the page.
 */
export function tapeHeading(heading: number, homeAt = 360, seam = TAPE_SEAM): number {
  if (!(heading > 0)) return 0;
  const h = Math.min(heading, 360);
  const w = Math.min(Math.max(seam, 0.01), 1 / 3);
  const k = Math.min(Math.floor(h / TAPE_WAYPOINT_DEG), LAST_BEARING / TAPE_WAYPOINT_DEG);
  const base = k * TAPE_WAYPOINT_DEG;
  const f = (h - base) / TAPE_WAYPOINT_DEG;
  // The second half of the turn into this station.
  if (k >= 1 && f < w) return base + TAPE_WAYPOINT_DEG * (smoothstep((f + w) / (2 * w)) - 1);
  if (base < LAST_BEARING) {
    // The first half of the turn into the next station.
    if (f > 1 - w) return base + TAPE_WAYPOINT_DEG * smoothstep((f - (1 - w)) / (2 * w));
    return base;
  }
  // Home: centred where the footer arrives, clear of the turn in, finished by 360°.
  const centre = Number.isFinite(homeAt) ? (homeAt - LAST_BEARING) / TAPE_WAYPOINT_DEG : 1;
  const start = Math.min(Math.max(centre - w, w), 1 - 2 * w);
  return base + TAPE_WAYPOINT_DEG * smoothstep((f - start) / (2 * w));
}

/**
 * The page heading at which the footer's top crosses the middle of the
 * viewport, given document offsets: the heading runs linearly from the last
 * station's bearing (its top at the middle line) to 360° at the maximum
 * scroll (`buildHeadingKnots`). 360 when the layout gives no span.
 */
export function homeHeading(
  lastTop: number,
  footerTop: number,
  viewportHeight: number,
  maxScroll: number,
  anchor = 0.5
): number {
  const from = lastTop - viewportHeight * anchor;
  const span = maxScroll - from;
  if (!(span > 0) || !Number.isFinite(footerTop)) return 360;
  const share = Math.min(Math.max((footerTop - viewportHeight * anchor - from) / span, 0), 1);
  return LAST_BEARING + TAPE_WAYPOINT_DEG * share;
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

/*
 * Visitor-caused events are told in the dock's own pill (its word
 * "Simulation" gives way to the message for a few seconds), one at a time,
 * never more often than every `TOAST_GAP_MS` (a message that comes too soon
 * waits for its turn, and the newest waiting one wins), and not at all while
 * the station that caused them is on screen and already shows them (the
 * hero's HUD, the map's roads, the resilience console).
 */

/** How long a message holds the pill: desktop, and below 1024px. */
export const TOAST_MS = 4000;
export const TOAST_MS_COMPACT = 3000;
/** Shortest gap between two messages. */
export const TOAST_GAP_MS = 5000;
/** A provider's "is failing" toast repeats at most this often while its outage lasts. */
export const FAILING_REPEAT_MS = 15000;
/** A station covering at least this share of the viewport is "on screen" for its own events. */
export const TOAST_SOURCE_COVER = 0.35;
/** A visitor's press this long before an outage's first message names the station that caused it. */
export const TOAST_SOURCE_WINDOW_MS = 6000;

export type ToastSpec =
  | {
      readonly kind: "failing";
      readonly id: CandidateId;
      readonly code: FailCode;
      readonly fallback: CandidateId;
    }
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
        return { kind: "failing", id, code: event.codes[0] ?? 503, fallback: event.to };
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

export type ToastPacer = {
  /** True (and the slot is taken) when at least `gapMs` has passed since the last message. */
  allow(nowMs: number): boolean;
  /** ms until the next message may show (0: now). */
  wait(nowMs: number): number;
  reset(): void;
};

/**
 * At most one message per `gapMs`. The caller holds back a refused message
 * (only the newest: a later beat of an outage supersedes an earlier one) and
 * offers it again after `wait()`.
 */
export function createToastPacer(gapMs: number = TOAST_GAP_MS): ToastPacer {
  let last = -Infinity;
  return {
    allow(nowMs) {
      if (nowMs - last < gapMs) return false;
      last = nowMs;
      return true;
    },
    wait(nowMs) {
      return Math.max(0, last + gapMs - nowMs);
    },
    reset() {
      last = -Infinity;
    },
  };
}

export type SourceLedger<S extends string> = {
  /** A visitor pressed something inside `station`. */
  touch(station: S, nowMs: number): void;
  /**
   * The station that caused a provider's current outage: fixed by its first
   * message, from the last press within `windowMs` before it (null if none).
   */
  sourceOf(id: CandidateId, nowMs: number): S | null;
  /** The outage is over (its breaker closed). */
  end(id: CandidateId): void;
};

export function createSourceLedger<S extends string>(
  windowMs: number = TOAST_SOURCE_WINDOW_MS
): SourceLedger<S> {
  let lastStation: S | null = null;
  let lastAt = -Infinity;
  const sources = new Map<CandidateId, S | null>();
  return {
    touch(station, nowMs) {
      lastStation = station;
      lastAt = nowMs;
    },
    sourceOf(id, nowMs) {
      const known = sources.get(id);
      if (known !== undefined) return known;
      const source = lastStation !== null && nowMs - lastAt <= windowMs ? lastStation : null;
      sources.set(id, source);
      return source;
    },
    end(id) {
      sources.delete(id);
    },
  };
}

/** Share (0..1) of a viewport `viewportHeight` tall that a box from `top` to `bottom` covers. */
export function viewCoverage(top: number, bottom: number, viewportHeight: number): number {
  if (!(viewportHeight > 0)) return 0;
  const visible = Math.min(bottom, viewportHeight) - Math.max(top, 0);
  return visible > 0 ? Math.min(visible / viewportHeight, 1) : 0;
}

/** The dock dot's tone while a message holds the pill. */
export type ToastTone = "fail" | "warn" | "ok";

export function toastTone(spec: ToastSpec): ToastTone {
  if (spec.kind === "failing" || spec.state === "open") return "fail";
  return spec.state === "closed" ? "ok" : "warn";
}

/** `landing.*` key of each breaker state's word. */
export const STATE_KEY = {
  closed: "stateClosed",
  degraded: "stateDegraded",
  open: "stateOpen",
  halfOpen: "stateHalfOpen",
} as const satisfies Record<BreakerState, string>;
