"use client";
import { useEffect, useSyncExternalStore, type RefObject } from "react";

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

/** How far outside the viewport a station still counts as on screen. */
const OFFSCREEN_MARGIN = "25% 0px";

/**
 * Marks the elements under `node` that run an endless CSS loop (`data-loop`),
 * so landing.css can pause exactly those. Finished one-shots are left alone:
 * pausing every animation would turn each settled entrance (hundreds of
 * words and names) back into an active, paused animation, and the
 * compositor then pays for all of them on every frame.
 */
function markLoops(node: Element): void {
  if (typeof node.getAnimations !== "function" || typeof CSSAnimation === "undefined") return;
  for (const animation of node.getAnimations({ subtree: true })) {
    if (!(animation instanceof CSSAnimation)) continue;
    const effect = animation.effect;
    if (!(effect instanceof KeyframeEffect) || !effect.target) continue;
    if (Number.isFinite(effect.getComputedTiming().endTime)) continue;
    if (!effect.target.hasAttribute("data-loop")) effect.target.setAttribute("data-loop", "");
  }
}

/**
 * Pauses the CSS loops of every station that is off screen (§7.6): one
 * IntersectionObserver watches each station (`main [data-station]`) and the
 * footer. As one moves more than a quarter of a viewport away it is marked
 * `data-offscreen` and its endless loops `data-loop`; landing.css pauses the
 * marked loops until it comes near again. The fixed chrome (nav, SimDock) is
 * always on screen and never marked.
 */
export function useOffscreenPause(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const targets = Array.from(
      node.querySelectorAll<HTMLElement>(":scope > main [data-station], :scope > footer")
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.removeAttribute("data-offscreen");
          } else {
            markLoops(entry.target);
            entry.target.setAttribute("data-offscreen", "");
          }
        }
      },
      { rootMargin: OFFSCREEN_MARGIN }
    );
    for (const target of targets) observer.observe(target);
    return () => {
      observer.disconnect();
      for (const target of targets) target.removeAttribute("data-offscreen");
    };
  }, [root]);
}
