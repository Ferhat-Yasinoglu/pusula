"use client";
import { useSyncExternalStore } from "react";
import { canAnimate } from "../../runtime/heartbeat";
import { isStationId, type StationId } from "../../runtime/stations";

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
/** Visitor input that ends the corrections: the visitor has taken the helm. */
const HELM_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

let travelSeq = 0;

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
 * Every station is laid out for real (none renders lazily), so the first
 * scroll aims at the true position. Each time the scroll ends the landing is
 * measured again and, while it is more than 3px off (content that sized
 * itself on the way), the scroll is re-aimed, at most five times. Visitor
 * input (wheel, touch, a key, a pointer press) ends the corrections at once;
 * a newer travel supersedes this one.
 *
 * A keyboard activation (`viaKeyboard`) also moves focus to the station's
 * heading so the next Tab continues from there. `instant` skips the smooth
 * scroll (an arrival by deep link).
 */
export function travelTo(id: StationId, viaKeyboard = false, instant = false): void {
  if (typeof window === "undefined") return;
  const target = document.getElementById(id);
  if (!target) return;
  const seq = ++travelSeq;
  const behavior: ScrollBehavior = !instant && canAnimate() ? "smooth" : "instant";

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
 * A deep link (`/landing#routing`) lands on its station. The page streams in
 * behind the app's loading boundary, so the browser's own fragment scroll can
 * run before the stations are revealed and leave the page at the top; once
 * the nav has mounted the page arrives there at once, with the same landing
 * corrections as any travel.
 */
export function landOnHash(): void {
  if (typeof window === "undefined") return;
  let id = "";
  try {
    id = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return;
  }
  if (!isStationId(id) || id === "bridge") return;
  travelTo(id, false, true);
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
