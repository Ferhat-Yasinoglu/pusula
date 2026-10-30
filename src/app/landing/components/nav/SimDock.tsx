"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { SAMPLE_CANDIDATES } from "../../landingTypes";
import { usePrefersReducedMotion } from "../../landingMotion";
import { SPEEDS, act, type CandidateId, type World } from "../../sim/landingSim";
import {
  dispatch,
  getWorld,
  subscribeEvents,
  useDeck,
  useReqPerSec,
} from "../../runtime/deckStore";
import { setPaused, usePaused } from "../../runtime/heartbeat";
import { isStationId, type StationId } from "../../runtime/stations";
import { useDomLoop } from "../../runtime/useDomLoop";
import Glyph from "../primitives/Glyph";
import { numberFormat } from "../primitives/primitiveKit";
import {
  DOCK_BAND_PX,
  DOCK_PULSE_MIN_GAP_S,
  DOCK_PULSE_S,
  STATE_KEY,
  TOAST_MS,
  TOAST_MS_COMPACT,
  TOAST_SOURCE_COVER,
  createSourceLedger,
  createToastGate,
  createToastPacer,
  dockClearance,
  nextSpeed,
  toastTone,
  viewCoverage,
  type DockClearance,
  type ToastSpec,
} from "./navModel";
import { useMenuOpen } from "./navState";
import "./nav.css";

/**
 * The SimDock (spec §6.1): the page-wide motion control and the standing
 * disclosure that the traffic on this page is a simulation.
 *
 * A glass pill at the bottom-start corner: an ember dot that pulses with each
 * simulated request batch and the word "Simulation"; on desktop the live
 * simulated rate (0 while paused); one Pause button (⏸, ▶ once engaged;
 * engaged under reduced motion); and a time-lapse chip (» ×1 → ×5 → ×10).
 *
 * Below 1024px the pill folds to its dot and Pause while the page scrolls
 * down (it would sit over whatever passes beneath it) and unfolds on a scroll
 * back up, a press on the pill, or keyboard focus.
 *
 * Visitor-caused events (a fault the visitor switched on) are told inside the
 * pill itself: the word "Simulation" gives way to the message, the dot takes
 * its tone, for four seconds on desktop ("{provider} is failing, traffic
 * rerouted to {fallback}", "{provider} · {state}") and three below 1024px
 * (the deck's own short form, "claude × 503 → openai"). One message at a
 * time, at most one per five seconds (one that comes sooner waits its turn;
 * the newest waiting one wins), de-duplicated per outage episode, and none
 * while the station that caused it is on screen and already shows it
 * (`navModel`). Each is read out from a polite live region. Nothing ever
 * stacks over the page above the pill.
 *
 * It steps aside during the intro (the CSS gate hides it; it arrives 600ms
 * after the hand-off, `dock-arrive`), while the phone menu is open, and near
 * the launch station's calls to action and the footer (`[data-dock-avoid]`,
 * `footer`). It never sits on the hero's board of real figures
 * (`[data-dock-clear]`) while the board rests in its band at the bottom of
 * the viewport: it climbs the short desktop board and steps aside for the
 * tall phone one. Under reduced motion the deck never steps, so the
 * time-lapse chip is disabled alongside the engaged Pause.
 *
 * Its footprint is published as CSS custom properties on the page root
 * (`--dock-clear-block`, `--dock-clear-inline`; landing.css), the latter
 * refined here from the pill's measured width.
 */

const TOAST_LEAVE_MS = 240;
const DESKTOP_QUERY = "(min-width: 1024px)";
/** Scroll this far one way (px) before the phone pill folds or unfolds. */
const FOLD_TRAVEL_PX = 48;
/** Near the top of the page the phone pill stays unfolded. */
const FOLD_MIN_Y = 240;
/** Presses that may switch a fault on; they name the station an outage came from. */
const PRESS_EVENTS = ["click", "keydown"] as const;
/** Targets the dock never covers: it hides while one is near. */
const AVOID_SELECTOR = "[data-dock-avoid]";
/** Short bands the dock climbs over while they rest at the bottom of the viewport. */
const CLEAR_SELECTOR = "[data-dock-clear]";
/** An avoid-target this close below the viewport already hides the dock (px). */
const AVOID_AHEAD_PX = 80;

const selectSpeed = (w: World) => w.speed;

const CATALOG_ID = new Map<CandidateId, string>(
  SAMPLE_CANDIDATES.map((candidate) => [candidate.id as CandidateId, candidate.catalogId])
);
const providerName = (id: CandidateId) => CATALOG_ID.get(id) ?? id;

/** Hide while any avoid-target is on (or about to come on) screen. */
function useAvoidTargets(): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const root = document.querySelector(".pusula-landing") ?? document.body;
    const targets = Array.from(root.querySelectorAll(AVOID_SELECTOR));
    const footer = root.querySelector("footer");
    const visible = new Set<Element>();
    const onChange = (entries: IntersectionObserverEntry[]) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      setNear(visible.size > 0);
    };
    // Step aside before a target reaches the dock's band at the bottom of the viewport.
    const observer = new IntersectionObserver(onChange, {
      rootMargin: `0px 0px ${AVOID_AHEAD_PX}px 0px`,
    });
    for (const target of targets) observer.observe(target);
    if (footer) observer.observe(footer);
    return () => observer.disconnect();
  }, []);
  return near;
}

/**
 * Publish the pill's reach from the viewport's inline-start edge (plus air) as
 * `--dock-clear-inline` on the page root; landing.css holds an estimate for
 * the server render. Measured on resize only, never per frame.
 */
function usePublishedReach(pillRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const pill = pillRef.current;
    const root = pill?.closest<HTMLElement>(".pusula-landing");
    if (!pill || !root || typeof ResizeObserver === "undefined") return;
    const publish = () => {
      // A message widens the pill for a few seconds and the phone pill folds while
      // the page scrolls down: the footprint is the pill at rest, unfolded.
      if (pill.hasAttribute("data-msg") || pill.hasAttribute("data-folded")) return;
      const rect = pill.getBoundingClientRect();
      const rtl = getComputedStyle(pill).direction === "rtl";
      const reach = rtl ? window.innerWidth - rect.left : rect.right;
      const air = parseFloat(getComputedStyle(root).getPropertyValue("--dock-air")) || 0;
      root.style.setProperty("--dock-clear-inline", `${Math.ceil(reach + air)}px`);
    };
    const observer = new ResizeObserver(publish);
    observer.observe(pill);
    window.addEventListener("resize", publish);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", publish);
      root.style.removeProperty("--dock-clear-inline");
    };
  }, [pillRef]);
}

/**
 * How the dock clears the board of real figures while the board rests in the
 * dock's band at the bottom of the viewport: it climbs a short board
 * (desktop) and steps aside for a tall one (phone). At rest otherwise.
 */
function useClearance(): DockClearance {
  const [clearance, setClearance] = useState<DockClearance>(() => dockClearance(0, 0));
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const target = document.querySelector(CLEAR_SELECTOR);
    if (!target) return;
    let height = 0;
    let inBand = false;
    let observer: IntersectionObserver | null = null;
    const update = () => {
      const next = inBand ? dockClearance(height, window.innerHeight) : dockClearance(0, 0);
      setClearance((current) =>
        current.lift === next.lift && current.hide === next.hide ? current : next
      );
    };
    const watchBand = () => {
      observer?.disconnect();
      const top = Math.max(0, window.innerHeight - DOCK_BAND_PX);
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (!entry) return;
          inBand = entry.isIntersecting;
          height = entry.boundingClientRect.height;
          update();
        },
        { rootMargin: `-${top}px 0px 0px 0px` }
      );
      observer.observe(target);
    };
    watchBand();
    let resizeTimer: number | undefined;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(watchBand, 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
      observer?.disconnect();
    };
  }, []);
  return clearance;
}

/**
 * Below 1024px the pill folds to its dot and Pause while the visitor scrolls
 * down the page (it sits over whatever passes beneath it) and unfolds when
 * they scroll back up, press the pill, or move keyboard focus into it.
 */
function useFolded(): [boolean, () => void] {
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    let lastY = window.scrollY;
    let travel = 0;
    let current = false;
    const set = (next: boolean) => {
      if (next === current) return;
      current = next;
      setFolded(next);
    };
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (query.matches) return set(false);
      if (y <= FOLD_MIN_Y) {
        travel = 0;
        return set(false);
      }
      if (dy === 0) return;
      if (Math.sign(dy) !== Math.sign(travel)) travel = 0;
      travel += dy;
      if (travel > FOLD_TRAVEL_PX) set(true);
      else if (travel < -FOLD_TRAVEL_PX) set(false);
    };
    const onLayout = () => {
      if (query.matches) set(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    query.addEventListener("change", onLayout);
    return () => {
      window.removeEventListener("scroll", onScroll);
      query.removeEventListener("change", onLayout);
    };
  }, []);
  const unfold = useCallback(() => setFolded(false), []);
  return [folded, unfold];
}

/** The station's share of the viewport, read once per message (never per frame). */
function onScreen(id: StationId): boolean {
  const station = document.getElementById(id);
  if (!station) return false;
  const rect = station.getBoundingClientRect();
  return viewCoverage(rect.top, rect.bottom, window.innerHeight) >= TOAST_SOURCE_COVER;
}

type DockMessage = { readonly key: number; readonly spec: ToastSpec; readonly leaving: boolean };

/** The fast-forward mark of the time-lapse chip. */
function PaceMark() {
  return (
    <svg
      className="dock-pace-mark"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1.5 2.5L5.5 6L1.5 9.5M6.5 2.5L10.5 6L6.5 9.5" />
    </svg>
  );
}

export default function SimDock() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const speed = useDeck(selectSpeed);
  const rate = useReqPerSec();
  const menuOpen = useMenuOpen();
  const avoid = useAvoidTargets();
  const { lift, hide: clearHide } = useClearance();
  const [message, setMessage] = useState<DockMessage | null>(null);
  const [folded, unfold] = useFolded();
  const toastKey = useRef(0);
  const pingRef = useRef<HTMLSpanElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  usePublishedReach(pillRef);
  const pulse = useRef({ batches: -1, t: DOCK_PULSE_S, written: false });

  // Visitor-caused events become one message at a time, inside the pill.
  const settle = useCallback((key: number, next: DockMessage | null) => {
    setMessage((current) => (current && current.key === key ? next : current));
  }, []);
  useEffect(() => {
    const gate = createToastGate();
    const pacer = createToastPacer();
    const ledger = createSourceLedger<StationId>();
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };
    const onPress = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      const station = target?.closest("[data-station]");
      if (station && isStationId(station.id)) ledger.touch(station.id, performance.now());
    };
    for (const type of PRESS_EVENTS) {
      document.addEventListener(type, onPress, { capture: true, passive: true });
    }
    /** The newest message that came too soon, and its timer. */
    let held: { spec: ToastSpec; source: StationId | null } | null = null;
    let heldTimer = 0;
    const show = (spec: ToastSpec, source: StationId | null) => {
      // The station that caused it is on screen and already shows it.
      if (source !== null && onScreen(source)) return;
      const now = performance.now();
      if (!pacer.allow(now)) {
        held = { spec, source };
        if (!heldTimer) {
          heldTimer = window.setTimeout(
            () => {
              heldTimer = 0;
              const next = held;
              held = null;
              if (next) show(next.spec, next.source);
            },
            pacer.wait(now) + 1
          );
        }
        return;
      }
      const key = ++toastKey.current;
      const hold = window.matchMedia(DESKTOP_QUERY).matches ? TOAST_MS : TOAST_MS_COMPACT;
      setMessage({ key, spec, leaving: false });
      later(() => {
        settle(key, { key, spec, leaving: true });
        later(() => settle(key, null), TOAST_LEAVE_MS);
      }, hold);
    };
    const unsubscribe = subscribeEvents((event, meta) => {
      const now = performance.now();
      const spec = gate.accept(event, meta.user, now);
      if (!spec) return;
      const source = ledger.sourceOf(spec.id, now);
      if (spec.kind === "state" && spec.state === "closed") ledger.end(spec.id);
      // Out of the sim step: the on-screen check reads layout.
      later(() => show(spec, source), 0);
    });
    return () => {
      unsubscribe();
      for (const type of PRESS_EVENTS) {
        document.removeEventListener(type, onPress, { capture: true });
      }
      for (const id of timers) window.clearTimeout(id);
      window.clearTimeout(heldTimer);
    };
  }, [settle]);

  // The dot pulses with each simulated request batch (≤ 3 restarts a second).
  useDomLoop(
    "sim-dock",
    (dt) => {
      const state = pulse.current;
      const batches = getWorld().batches;
      if (batches !== state.batches) {
        const first = state.batches < 0;
        state.batches = batches;
        if (!first && state.t >= DOCK_PULSE_MIN_GAP_S) state.t = 0;
      }
      if (state.t >= DOCK_PULSE_S) {
        if (state.written) {
          state.written = false;
          if (pingRef.current) pingRef.current.style.opacity = "0";
        }
        return;
      }
      state.t += dt;
      const u = Math.min(state.t / DOCK_PULSE_S, 1);
      const ping = pingRef.current;
      if (!ping) return;
      state.written = true;
      ping.style.transform = `scale(${(1 + 1.8 * u).toFixed(3)})`;
      ping.style.opacity = ((1 - u) * 0.85).toFixed(3);
    },
    { enabled: !reduced && !paused }
  );

  const hidden = menuOpen || avoid;
  const format = numberFormat(locale);
  const fast = speed > 1 && !reduced;
  const pauseShown = paused || reduced;
  const paceLabel = t("simTimelapse", { factor: format.format(speed) });

  const toastText = (spec: ToastSpec) => {
    if (spec.kind === "failing") {
      return t("simToastFailing", {
        provider: providerName(spec.id),
        fallback: providerName(spec.fallback),
      });
    }
    return `${providerName(spec.id)} · ${t(STATE_KEY[spec.state])}`;
  };
  const spec = message?.spec;

  return (
    <div
      className="sim-dock"
      role="group"
      aria-label={t("simDockLabel")}
      title={t("simDockLabel")}
      data-hidden={hidden ? "on" : undefined}
      data-stowed={clearHide ? "on" : undefined}
      style={lift > 0 ? ({ "--dock-lift": `${lift}px` } as CSSProperties) : undefined}
    >
      <p className="sr-only" role="status" aria-live="polite">
        {message && !message.leaving ? toastText(message.spec) : ""}
      </p>
      <div
        ref={pillRef}
        className="dock-pill"
        data-msg={message ? (message.leaving ? "leave" : "show") : undefined}
        data-tone={spec ? toastTone(spec) : undefined}
        data-folded={folded ? "on" : undefined}
        onClick={folded ? unfold : undefined}
        onFocus={folded ? unfold : undefined}
      >
        <span className="dock-status">
          <span className="dock-dot" aria-hidden="true">
            <span ref={pingRef} className="dock-ping" />
          </span>
          <span className="dock-say">
            <span className="dock-word">{t("simBadge")}</span>
            {message && spec ? (
              <span key={message.key} className="dock-msg" aria-hidden="true">
                <span className="dock-msg-long">{toastText(spec)}</span>
                {spec.kind === "failing" ? (
                  <span className="dock-msg-short" dir="ltr">
                    {providerName(spec.id)} <span className="dock-msg-x">× {spec.code}</span> →{" "}
                    <span className="dock-msg-to">{providerName(spec.fallback)}</span>
                  </span>
                ) : null}
              </span>
            ) : null}
          </span>
          <span className="sr-only">{t("simDockLabel")}</span>
        </span>
        <span className="dock-rate" aria-hidden="true" data-paused={pauseShown ? "on" : undefined}>
          <span className="dock-rate-n">{format.format(pauseShown ? 0 : rate)}</span>
          <span className="dock-rate-unit" dir="ltr">
            req/s
          </span>
        </span>
        <button
          type="button"
          className="dock-pause"
          aria-pressed={pauseShown}
          aria-label={t("simPause")}
          title={t("simPause")}
          disabled={reduced}
          onClick={() => setPaused(!paused)}
        >
          <Glyph name={pauseShown ? "play" : "pause"} size={16} tone="current" />
        </button>
        <button
          type="button"
          className="dock-pace"
          data-fast={fast ? "on" : undefined}
          aria-pressed={fast}
          aria-label={paceLabel}
          title={paceLabel}
          disabled={reduced}
          onClick={() => dispatch(act.setSpeed(nextSpeed(speed, SPEEDS)))}
        >
          <PaceMark />
          <span aria-hidden="true">×{format.format(speed)}</span>
        </button>
      </div>
    </div>
  );
}
