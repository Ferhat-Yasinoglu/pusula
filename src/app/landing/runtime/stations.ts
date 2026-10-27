"use client";
import { useEffect, useSyncExternalStore, type MutableRefObject } from "react";

/**
 * The compass spine of the page: eight stations on the eight principal winds,
 * and two trackers that turn scroll position into compass language.
 *
 * - `useHeading()` / `useHeadingRef()`: the page heading in degrees, 0 at the
 *   top (north), each station's bearing as it reaches the middle of the
 *   viewport, and 360 (north again) at the very bottom, under the footer.
 *   It is piecewise-linear over the stations' document offsets, which are
 *   measured by a ResizeObserver on `<main>` (and on window resize), never
 *   per scroll event; a scroll event only interpolates over the cached
 *   offsets.
 * - `useActiveStation()`: the station crossing the middle band of the
 *   viewport, from ONE shared IntersectionObserver with
 *   `rootMargin "-45% 0px -45% 0px"`.
 *
 * Stations are found in the DOM as `main [data-station]` elements whose `id`
 * is a `StationId` (the `Station` primitive renders exactly that).
 */

export type StationId =
  "bridge" | "network" | "catalog" | "routing" | "resilience" | "tools" | "engine" | "launch";

export type WindPoint = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

/** `landing.*` i18n key of each station's nav label (§4). */
export type StationNavKey =
  | "brandName"
  | "navMap"
  | "navCatalog"
  | "navRouting"
  | "navResilience"
  | "navTools"
  | "navUnderTheHood"
  | "navDashboard";

export type Station = {
  readonly id: StationId;
  /** Page order, 0..7. */
  readonly index: number;
  /** Compass bearing in degrees: 0, 45, …, 315. */
  readonly bearing: number;
  readonly point: WindPoint;
  readonly navKey: StationNavKey;
};

export const STATIONS: readonly Station[] = [
  { id: "bridge", index: 0, bearing: 0, point: "N", navKey: "brandName" },
  { id: "network", index: 1, bearing: 45, point: "NE", navKey: "navMap" },
  { id: "catalog", index: 2, bearing: 90, point: "E", navKey: "navCatalog" },
  { id: "routing", index: 3, bearing: 135, point: "SE", navKey: "navRouting" },
  { id: "resilience", index: 4, bearing: 180, point: "S", navKey: "navResilience" },
  { id: "tools", index: 5, bearing: 225, point: "SW", navKey: "navTools" },
  { id: "engine", index: 6, bearing: 270, point: "W", navKey: "navUnderTheHood" },
  { id: "launch", index: 7, bearing: 315, point: "NW", navKey: "navDashboard" },
];

export const STATION_IDS: readonly StationId[] = STATIONS.map((station) => station.id);

const STATION_BY_ID = new Map<string, Station>(STATIONS.map((station) => [station.id, station]));

export function isStationId(value: string): value is StationId {
  return STATION_BY_ID.has(value);
}

export function getStation(id: StationId): Station {
  return STATION_BY_ID.get(id) ?? STATIONS[0];
}

/* ------------------------------------------------------------------------ */
/* Heading maths (pure, unit-tested)                                        */
/* ------------------------------------------------------------------------ */

/** Viewport fraction at which a station "arrives": the same middle line the active-station band uses. */
export const HEADING_ANCHOR = 0.5;

/** Knots of the heading curve as flat pairs `[scrollY0, deg0, scrollY1, deg1, …]`, scrollY strictly increasing. */
export type HeadingKnots = Float64Array;

/**
 * Build the heading curve from measured station tops (document px, page
 * order) and their bearings: the first station's bearing at scroll 0, each
 * later station's bearing when its top reaches the anchor line, and 360°
 * (back to north) at the maximum scroll. Knots are forced strictly
 * increasing so short or reordered layouts still give a monotonic curve.
 */
export function buildHeadingKnots(
  tops: readonly number[],
  bearings: readonly number[],
  viewportHeight: number,
  maxScroll: number
): HeadingKnots {
  const count = Math.min(tops.length, bearings.length);
  if (count === 0) return new Float64Array([0, 0]);
  const knots = new Float64Array((count + 1) * 2);
  let previous = 0;
  knots[0] = 0;
  knots[1] = bearings[0];
  for (let i = 1; i < count; i++) {
    const y = Math.max(previous + 1, tops[i] - viewportHeight * HEADING_ANCHOR);
    knots[i * 2] = y;
    knots[i * 2 + 1] = bearings[i];
    previous = y;
  }
  knots[count * 2] = Math.max(previous + 1, maxScroll);
  knots[count * 2 + 1] = 360;
  return knots;
}

/** Heading (0..360) at `scrollY`, linear between knots and clamped at both ends. */
export function headingAt(knots: HeadingKnots, scrollY: number): number {
  const pairs = knots.length / 2;
  if (pairs === 0) return 0;
  if (scrollY <= knots[0] || pairs === 1) return knots[1];
  for (let i = 1; i < pairs; i++) {
    const y1 = knots[i * 2];
    if (scrollY < y1) {
      const y0 = knots[i * 2 - 2];
      const d0 = knots[i * 2 - 1];
      const d1 = knots[i * 2 + 1];
      return d0 + ((d1 - d0) * (scrollY - y0)) / (y1 - y0);
    }
  }
  return knots[pairs * 2 - 1];
}

/**
 * Of the stations currently inside the middle band, the one furthest down
 * the page wins (at a boundary both can intersect for a moment); with none,
 * the previous answer stands, so the footer keeps the last station.
 */
export function pickActiveStation(
  intersecting: ReadonlySet<StationId>,
  previous: StationId
): StationId {
  let best: Station | null = null;
  for (const id of intersecting) {
    const station = STATION_BY_ID.get(id);
    if (station && (!best || station.index > best.index)) best = station;
  }
  return best ? best.id : previous;
}

/* ------------------------------------------------------------------------ */
/* Shared DOM tracker                                                       */
/* ------------------------------------------------------------------------ */

/** React commits for the numeric heading are capped at this rate. */
const HEADING_NOTIFY_MS = 100;
/** Changes smaller than this (degrees) are not worth a React commit. */
const HEADING_EPSILON = 0.05;

const headingRef: MutableRefObject<number> = { current: 0 };
let headingSnapshot = 0;
let activeStation: StationId = "bridge";

const headingListeners = new Set<() => void>();
const activeListeners = new Set<() => void>();

let users = 0;
let knots: HeadingKnots = new Float64Array([0, 0]);
let mainObserver: ResizeObserver | null = null;
let bandObserver: IntersectionObserver | null = null;
let observedStations: Element[] = [];
const intersecting = new Set<StationId>();
let notifyTimer: ReturnType<typeof setTimeout> | null = null;
let lastNotifyAt = 0;

function findMain(): HTMLElement | null {
  return document.getElementById("main-content") ?? document.querySelector("main");
}

function stationElements(): Element[] {
  const root = findMain() ?? document.body;
  return Array.from(root.querySelectorAll("[data-station]")).filter((element) =>
    isStationId(element.id)
  );
}

function flushHeading(): void {
  notifyTimer = null;
  lastNotifyAt = performance.now();
  if (Math.abs(headingRef.current - headingSnapshot) < HEADING_EPSILON) return;
  headingSnapshot = headingRef.current;
  for (const listener of headingListeners) listener();
}

function scheduleHeadingNotify(): void {
  if (headingListeners.size === 0 || notifyTimer !== null) return;
  const wait = HEADING_NOTIFY_MS - (performance.now() - lastNotifyAt);
  if (wait <= 0) flushHeading();
  else notifyTimer = setTimeout(flushHeading, wait);
}

function updateHeading(): void {
  headingRef.current = headingAt(knots, window.scrollY);
  scheduleHeadingNotify();
}

function observeBand(elements: Element[]): void {
  const same =
    elements.length === observedStations.length &&
    elements.every((element, i) => element === observedStations[i]);
  if (same || !bandObserver) return;
  bandObserver.disconnect();
  intersecting.clear();
  observedStations = elements;
  for (const element of elements) bandObserver.observe(element);
}

/** Layout changed: re-measure station offsets (the only layout reads here). */
function measure(): void {
  const elements = stationElements();
  observeBand(elements);
  const scrollY = window.scrollY;
  const tops: number[] = [];
  const bearings: number[] = [];
  for (const element of elements) {
    tops.push(element.getBoundingClientRect().top + scrollY);
    bearings.push(getStation(element.id as StationId).bearing);
  }
  const viewportHeight = window.innerHeight;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewportHeight);
  knots = buildHeadingKnots(tops, bearings, viewportHeight, maxScroll);
  updateHeading();
}

function onBandChange(entries: IntersectionObserverEntry[]): void {
  for (const entry of entries) {
    if (!isStationId(entry.target.id)) continue;
    if (entry.isIntersecting) intersecting.add(entry.target.id);
    else intersecting.delete(entry.target.id);
  }
  const next = pickActiveStation(intersecting, activeStation);
  if (next === activeStation) return;
  activeStation = next;
  for (const listener of activeListeners) listener();
}

function startTracking(): void {
  users += 1;
  if (users > 1) return;
  if (typeof IntersectionObserver !== "undefined") {
    bandObserver = new IntersectionObserver(onBandChange, { rootMargin: "-45% 0px -45% 0px" });
  }
  if (typeof ResizeObserver !== "undefined") {
    mainObserver = new ResizeObserver(measure);
    // The footer lives outside <main>; the body catches its size changes too.
    mainObserver.observe(findMain() ?? document.body);
    mainObserver.observe(document.body);
  }
  window.addEventListener("scroll", updateHeading, { passive: true });
  window.addEventListener("resize", measure);
  measure();
}

function stopTracking(): void {
  users = Math.max(0, users - 1);
  if (users > 0) return;
  window.removeEventListener("scroll", updateHeading);
  window.removeEventListener("resize", measure);
  mainObserver?.disconnect();
  mainObserver = null;
  bandObserver?.disconnect();
  bandObserver = null;
  observedStations = [];
  intersecting.clear();
  if (notifyTimer !== null) clearTimeout(notifyTimer);
  notifyTimer = null;
}

function subscribeHeading(listener: () => void): () => void {
  headingListeners.add(listener);
  startTracking();
  // Tracking may already have been running for `useHeadingRef` callers, which
  // never refresh the React snapshot; catch it up now.
  if (Math.abs(headingRef.current - headingSnapshot) >= HEADING_EPSILON) {
    headingSnapshot = headingRef.current;
    listener();
  }
  return () => {
    headingListeners.delete(listener);
    stopTracking();
  };
}

function subscribeActive(listener: () => void): () => void {
  activeListeners.add(listener);
  startTracking();
  return () => {
    activeListeners.delete(listener);
    stopTracking();
  };
}

const readHeading = () => headingSnapshot;
const readHeadingOnServer = () => 0;
const readActive = () => activeStation;
const readActiveOnServer = (): StationId => "bridge";

/**
 * The page heading in degrees (0..360) as React state, committed at most
 * 10 times a second. Server and hydration render 0. Loops (the tape, the
 * logo needle) should use `useHeadingRef()` instead.
 */
export function useHeading(): number {
  return useSyncExternalStore(subscribeHeading, readHeading, readHeadingOnServer);
}

/**
 * The page heading as a shared, always-current ref (updated on every scroll
 * event from cached offsets), for `Needle angleRef` and dom-lane loops. The
 * ref object is the same for every caller; tracking runs while any caller is
 * mounted.
 */
export function useHeadingRef(): MutableRefObject<number> {
  useEffect(() => {
    startTracking();
    return stopTracking;
  }, []);
  return headingRef;
}

/** The station in the middle band of the viewport. Server and hydration render "bridge". */
export function useActiveStation(): StationId {
  return useSyncExternalStore(subscribeActive, readActive, readActiveOnServer);
}
