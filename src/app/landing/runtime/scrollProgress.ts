"use client";
import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { register } from "./heartbeat";

/**
 * Scroll-linked progress for one element, without layout reads per scroll.
 *
 * - `pin`: progress through a pinned track (a tall element whose child is
 *   `position: sticky`): `p = (scrollY − top) / (height − innerHeight)`.
 *   It only applies while `innerWidth ≥ minWidth`; below that (phone) the
 *   section is not pinned and the hook falls back to `traverse`.
 * - `traverse`: how far the element has crossed the viewport, from its top
 *   entering at the bottom (0) to its bottom leaving at the top (1):
 *   `p = (innerHeight − rect.top) / (innerHeight + rect.height)`.
 *
 * The element's document offset and size are cached and refreshed by a
 * ResizeObserver and window resizes. The passive scroll listener only marks
 * the state dirty; the heartbeat's `dom` lane computes `p` (clamped to 0..1),
 * stores it in the returned ref and writes `--p` (4 decimals) plus
 * `data-active="on"` (while 0 < p < 1) on the element, only when they change.
 * The lane is registered only while the element is near the viewport.
 *
 * Like every loop on the page it rests while paused, hidden or under reduced
 * motion; sections must not depend on `--p` in those states.
 */

export type ScrollProgressMode = "pin" | "traverse";
export type ScrollProgressOptions = { mode: ScrollProgressMode; minWidth?: number };

export function clamp01(value: number): number {
  if (!(value > 0)) return 0; // also catches NaN
  return value > 1 ? 1 : value;
}

/** Progress through a pinned track whose document top is `top`. */
export function pinProgress(
  scrollY: number,
  top: number,
  height: number,
  viewportHeight: number
): number {
  const travel = height - viewportHeight;
  if (travel <= 0) return scrollY >= top ? 1 : 0;
  return clamp01((scrollY - top) / travel);
}

/** Progress of an element crossing the viewport. */
export function traverseProgress(
  scrollY: number,
  top: number,
  height: number,
  viewportHeight: number
): number {
  const span = viewportHeight + height;
  if (span <= 0) return 0;
  const rectTop = top - scrollY;
  return clamp01((viewportHeight - rectTop) / span);
}

/** Whether `pin` mode applies at this viewport width. */
export function pinApplies(mode: ScrollProgressMode, viewportWidth: number, minWidth = 0): boolean {
  return mode === "pin" && viewportWidth >= minWidth;
}

type Tracker = {
  measure(): void;
  markDirty(): void;
};

/* One scroll listener, one resize listener and one ResizeObserver serve every tracker. */
const trackers = new Set<Tracker>();
let sharedObserver: ResizeObserver | null = null;

const onScroll = () => {
  for (const tracker of trackers) tracker.markDirty();
};
const remeasureAll = () => {
  for (const tracker of trackers) tracker.measure();
};

function attachShared(tracker: Tracker, node: Element): void {
  if (trackers.size === 0) {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", remeasureAll);
    if (typeof ResizeObserver !== "undefined") {
      sharedObserver = new ResizeObserver(remeasureAll);
      // Content above a tracked element changing height moves it without
      // resizing it; observing the body catches that.
      sharedObserver.observe(document.body);
    }
  }
  trackers.add(tracker);
  sharedObserver?.observe(node);
}

function detachShared(tracker: Tracker, node: Element): void {
  trackers.delete(tracker);
  sharedObserver?.unobserve(node);
  if (trackers.size === 0) {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", remeasureAll);
    sharedObserver?.disconnect();
    sharedObserver = null;
  }
}

/**
 * Imperative core of `useScrollProgress`; returns its teardown. Exported for
 * non-React callers (an intro or a renderer that owns its element).
 */
export function trackScrollProgress(
  node: HTMLElement,
  options: ScrollProgressOptions,
  out: MutableRefObject<number>
): () => void {
  const { mode, minWidth = 0 } = options;
  let top = 0;
  let height = 0;
  let viewportHeight = 1;
  let viewportWidth = 0;
  let dirty = true;
  let lastText = "";
  let lastActive = false;
  let unregister: (() => void) | null = null;

  const compute = () => {
    dirty = false;
    const scrollY = window.scrollY;
    const p = pinApplies(mode, viewportWidth, minWidth)
      ? pinProgress(scrollY, top, height, viewportHeight)
      : traverseProgress(scrollY, top, height, viewportHeight);
    out.current = p;
    const text = p.toFixed(4);
    if (text !== lastText) {
      node.style.setProperty("--p", text);
      lastText = text;
    }
    const active = p > 0 && p < 1;
    if (active !== lastActive) {
      if (active) node.setAttribute("data-active", "on");
      else node.removeAttribute("data-active");
      lastActive = active;
    }
  };

  const tracker: Tracker = {
    measure() {
      const rect = node.getBoundingClientRect();
      top = rect.top + window.scrollY;
      height = rect.height;
      viewportHeight = window.innerHeight || 1;
      viewportWidth = window.innerWidth;
      dirty = true;
    },
    markDirty() {
      dirty = true;
    },
  };

  const tick = () => {
    if (dirty) compute();
  };

  tracker.measure();
  attachShared(tracker, node);

  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== "undefined") {
    // Half a viewport of lead so progress is current before the element shows.
    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        if (entry.isIntersecting) {
          unregister ??= register({ id: "scroll-progress", lane: "dom", tick });
        } else {
          // Settle at 0 or 1 on the way out (a fast fling can skip frames).
          compute();
          unregister?.();
          unregister = null;
        }
      },
      { rootMargin: "50% 0px" }
    );
    observer.observe(node);
  } else {
    unregister = register({ id: "scroll-progress", lane: "dom", tick });
  }

  return () => {
    observer?.disconnect();
    unregister?.();
    unregister = null;
    detachShared(tracker, node);
  };
}

/**
 * Scroll progress of `ref`'s element as a ref (0..1), for loops to read each
 * frame without re-rendering. Server and first render: 0.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  options: ScrollProgressOptions
): MutableRefObject<number> {
  const progress = useRef(0);
  const { mode, minWidth = 0 } = options;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    return trackScrollProgress(node, { mode, minWidth }, progress);
  }, [ref, mode, minWidth]);
  return progress;
}
