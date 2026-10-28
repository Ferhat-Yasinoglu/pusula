"use client";
import { useSyncExternalStore } from "react";
import { canAnimate } from "../../runtime/heartbeat";
import type { StationId } from "../../runtime/stations";

/**
 * State shared between the nav bar, its station menu and the SimDock, which
 * the shell renders as separate siblings: whether the phone menu is open (the
 * dock steps aside while it is), and the one way every nav control travels to
 * a station.
 */

let menuOpen = false;
const listeners = new Set<() => void>();

export function setMenuOpen(open: boolean): void {
  if (open === menuOpen) return;
  menuOpen = open;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const readMenuOpen = () => menuOpen;
const readServer = () => false;

export function useMenuOpen(): boolean {
  return useSyncExternalStore(subscribe, readMenuOpen, readServer);
}

/** A landing this far off its mark (px) is corrected. */
const SETTLE_TOLERANCE_PX = 3;
/** Corrections after the first scroll, at most. */
const MAX_CORRECTIONS = 5;
/** A scroll counts as ended after this long without a scroll event (no `scrollend` in Safari). */
const SCROLL_IDLE_MS = 160;
/** Nothing moved at all (already there): check after this long. */
const NO_SCROLL_MS = 320;
/** Longest wait for one scroll to end before the landing is checked anyway. */
const SETTLE_CAP_MS = 3000;
/** A primed travel that never starts releases the forced layout after this long. */
const PRIME_RELEASE_MS = 2500;
/** Visitor input that ends the corrections: the visitor has taken the helm. */
const HELM_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
/** Root attribute that lays out every lazily rendered station for real (`nav.css`). */
const TRAVEL_ATTR = "data-nav-travel";

let travelSeq = 0;
/** `innerWidth` at which every station was last laid out for real; their sizes are remembered. */
let laidOutWidth = -1;
let primeTimer: number | undefined;

/**
 * Stations below the fold render lazily (`content-visibility: auto` with an
 * estimated 900px height), so a travel aimed at the estimate lands short once
 * the real heights arrive. While a travel is under way the root carries
 * `data-nav-travel`, which lays every station out for real (`nav.css`); the
 * stations' `contain-intrinsic-size: auto` then remembers those heights, so
 * the layout only needs forcing again after the width changes.
 */
function forceLayout(): void {
  if (laidOutWidth === window.innerWidth) return;
  document.documentElement.setAttribute(TRAVEL_ATTR, "");
}

/** Release the forced layout two frames on, once the sizes have been remembered. */
function releaseLayout(seq: number): void {
  const root = document.documentElement;
  if (!root.hasAttribute(TRAVEL_ATTR)) return;
  const width = window.innerWidth;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (seq !== travelSeq) return;
      root.removeAttribute(TRAVEL_ATTR);
      laidOutWidth = width;
    })
  );
}

/**
 * Start laying the stations out ahead of a travel that begins shortly (the
 * menu primes it on a pick, so the one-off layout overlaps its needle swing).
 */
export function primeTravel(): void {
  if (typeof window === "undefined") return;
  forceLayout();
  window.clearTimeout(primeTimer);
  const seq = travelSeq;
  primeTimer = window.setTimeout(() => {
    if (seq === travelSeq) releaseLayout(seq);
  }, PRIME_RELEASE_MS);
}

/** Calls `done` once the page has stopped scrolling; returns a canceller. */
function afterScroll(done: () => void): () => void {
  let idle = window.setTimeout(finish, NO_SCROLL_MS);
  const cap = window.setTimeout(finish, SETTLE_CAP_MS);
  const onScroll = () => {
    window.clearTimeout(idle);
    idle = window.setTimeout(finish, SCROLL_IDLE_MS);
  };
  function cancel() {
    window.clearTimeout(idle);
    window.clearTimeout(cap);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("scrollend", finish);
  }
  function finish() {
    cancel();
    done();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("scrollend", finish);
  return cancel;
}

/**
 * Travel to a station: a smooth scroll (instant under reduced motion or
 * Pause) that lands the station's top under the nav (its
 * `scroll-margin-top`).
 *
 * The stations are laid out for real first (`forceLayout`), so the first
 * scroll aims at the true position. Each time the scroll ends the landing is
 * measured again and, while it is more than 3px off (content that sized
 * itself on the way), the scroll is re-aimed, at most five times. Visitor
 * input (wheel, touch, a key, a pointer press) ends the corrections at once;
 * a newer travel supersedes this one.
 *
 * A keyboard activation (`viaKeyboard`) also moves focus to the station's
 * heading so the next Tab continues from there.
 */
export function travelTo(id: StationId, viaKeyboard = false): void {
  if (typeof window === "undefined") return;
  const target = document.getElementById(id);
  if (!target) return;
  const seq = ++travelSeq;
  window.clearTimeout(primeTimer);
  forceLayout();
  const behavior: ScrollBehavior = canAnimate() ? "smooth" : "instant";

  /** Where the page should rest: the station under the nav, clamped to the scroll range. */
  const destination = () => {
    if (id === "bridge") return 0;
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const top = window.scrollY + target.getBoundingClientRect().top - margin;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return Math.round(Math.min(Math.max(top, 0), Math.max(max, 0)));
  };

  let corrections = 0;
  let helmTaken = false;
  let cancelWait: () => void = () => {};
  const onHelm = () => {
    helmTaken = true;
  };
  for (const type of HELM_EVENTS) {
    window.addEventListener(type, onHelm, { capture: true, passive: true });
  }
  const end = () => {
    cancelWait();
    for (const type of HELM_EVENTS) window.removeEventListener(type, onHelm, { capture: true });
    releaseLayout(seq);
  };
  const check = () => {
    if (seq !== travelSeq || helmTaken) return end();
    const top = destination();
    if (Math.abs(top - window.scrollY) <= SETTLE_TOLERANCE_PX || corrections >= MAX_CORRECTIONS) {
      return end();
    }
    corrections += 1;
    window.scrollTo({ top, behavior });
    cancelWait = afterScroll(check);
  };

  window.scrollTo({ top: destination(), behavior });
  if (viaKeyboard) focusStation(id);
  cancelWait = afterScroll(check);
}

/**
 * Move keyboard focus to a station's heading without scrolling, so the next
 * Tab continues from the station a keyboard user travelled to.
 */
export function focusStation(id: StationId): void {
  if (typeof document === "undefined") return;
  const heading = document.getElementById(id)?.querySelector<HTMLElement>("h1, h2");
  if (!heading) return;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
}
