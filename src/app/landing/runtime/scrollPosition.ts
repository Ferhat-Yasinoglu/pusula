"use client";

/**
 * The page's scroll position, read once per scroll event instead of once per
 * reader per frame.
 *
 * Reading `window.scrollY` makes the browser bring style and layout up to
 * date first. Scroll-linked readers that run in the heartbeat's lanes, after
 * other entries have written styles (`--p`, transforms, attributes), would
 * each force that work again: a dozen trackers turned every scrolled frame
 * into write-read thrash. Instead one passive capture listener on `window`
 * reads the position when the document scrolls. Scroll events are dispatched
 * at the start of a rendering step, before any `requestAnimationFrame`
 * callback, so the cached value is current when the lanes run, and it is
 * read before this frame's writes.
 *
 * `retainScrollPosition()` starts the listener (reference counted);
 * `scrollPosition()` returns the cached value; `refreshScrollPosition()`
 * reads it now, for measure paths (resize, ResizeObserver) where layout is
 * already clean.
 */

let cached = 0;
let users = 0;

function onScroll(event: Event): void {
  // The capture listener also sees nested scrollers' (non-bubbling) events.
  if (event.target !== document && event.target !== window) return;
  cached = window.scrollY;
}

function onResize(): void {
  cached = window.scrollY;
}

/** The document's scroll offset as of the last scroll event (or refresh). */
export function scrollPosition(): number {
  return cached;
}

/** Read the scroll offset now (forces layout if it is stale) and cache it. */
export function refreshScrollPosition(): number {
  if (typeof window !== "undefined") cached = window.scrollY;
  return cached;
}

/** Keep the cache current while the caller needs it; returns the release. */
export function retainScrollPosition(): () => void {
  if (typeof window === "undefined") return () => {};
  if (users === 0) {
    cached = window.scrollY;
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onResize, { passive: true });
  }
  users += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    users -= 1;
    if (users > 0) return;
    window.removeEventListener("scroll", onScroll, { capture: true });
    window.removeEventListener("resize", onResize);
  };
}
