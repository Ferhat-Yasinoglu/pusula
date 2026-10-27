"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { register, type Tick } from "./heartbeat";

/**
 * Runs `tick(dt, now)` on the heartbeat's `dom` lane: SVG needles, imperative
 * counters, pulses. A registration keeps the page loop alive, so it exists
 * only while the element is in view: either pass `enabled` from your own
 * visibility signal, or pass `target` and the hook watches it with an
 * IntersectionObserver (`rootMargin`, default 100px).
 *
 * The latest `tick` is always called, so it may close over fresh props
 * without re-registering. Writes inside `tick` should be `transform`,
 * `opacity`, attributes or `textContent`, never layout reads.
 */
export type DomLoopOptions = {
  /** Default true. Combined (AND) with `target` visibility when both are given. */
  enabled?: boolean;
  /** Element whose on-screen presence gates the registration. */
  target?: RefObject<Element | null>;
  /** IntersectionObserver margin for `target`. */
  rootMargin?: string;
};

const HAS_INTERSECTION_OBSERVER = typeof IntersectionObserver !== "undefined";

export function useDomLoop(id: string, tick: Tick, options: DomLoopOptions = {}): void {
  const { enabled = true, target, rootMargin = "100px" } = options;
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });

  // Without a target the caller's `enabled` is the whole story.
  const [targetInView, setTargetInView] = useState(false);
  useEffect(() => {
    if (!target || !HAS_INTERSECTION_OBSERVER) return;
    const node = target.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setTargetInView(entry.isIntersecting);
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      setTargetInView(false);
    };
  }, [target, rootMargin]);

  // Only effects read `active`, so the server/client difference in observer
  // support cannot cause a hydration mismatch.
  const active = enabled && (target && HAS_INTERSECTION_OBSERVER ? targetInView : true);

  useEffect(() => {
    if (!active) return;
    return register({ id, lane: "dom", tick: (dt, now) => tickRef.current(dt, now) });
  }, [id, active]);
}
