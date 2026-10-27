"use client";
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

/**
 * Motion helpers shared by the landing page's animated pieces. Every animation
 * on the page goes through `usePrefersReducedMotion` so a visitor who asked
 * their OS for less motion gets a still, fully readable page.
 */

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Listens for the OS reduced-motion setting changing. Exported for the
 * runtime (`runtime/heartbeat.ts`), which has to stop its loop outside React.
 */
export function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Non-hook read of the reduced-motion preference, safe to call anywhere:
 * `false` on the server and wherever `matchMedia` is missing.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return readReducedMotion();
}

/** Server snapshot: assume motion is fine; the client corrects it before paint. */
function readReducedMotionOnServer(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, readReducedMotion, readReducedMotionOnServer);
}

/**
 * True while the element is on screen. Animation loops use it to stop drawing
 * when scrolled away, so an idle tab costs nothing.
 */
export function useInView<T extends Element>(rootMargin = "0px"): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  return [ref, inView];
}

/**
 * Runs `frame(dt, now)` on every animation frame while `active` is true.
 * `dt` is seconds since the previous frame. The latest `frame` is always
 * called, so callers can close over fresh props without restarting the loop.
 */
export function useAnimationFrame(frame: (dt: number, now: number) => void, active: boolean): void {
  const frameRef = useRef(frame);
  useEffect(() => {
    frameRef.current = frame;
  });

  useEffect(() => {
    if (!active) return;
    let id = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      frameRef.current(dt, now);
      id = window.requestAnimationFrame(tick);
    };
    id = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(id);
  }, [active]);
}

/**
 * Adds `is-revealed` to every `.reveal` element as it scrolls into view. The
 * hidden starting state only applies once `data-reveal="on"` is set on the
 * root, which happens here on the client, so the page is fully visible
 * without JavaScript and for reduced-motion visitors.
 */
export function useScrollReveal(root: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const node = root.current;
    if (!node || !enabled || typeof IntersectionObserver === "undefined") return;
    node.setAttribute("data-reveal", "on");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    node.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      node.removeAttribute("data-reveal");
    };
  }, [root, enabled]);
}
