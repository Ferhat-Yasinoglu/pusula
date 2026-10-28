"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
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
import { useDomLoop } from "../../runtime/useDomLoop";
import Toggle from "../primitives/Toggle";
import { numberFormat } from "../primitives/primitiveKit";
import {
  DOCK_BAND_PX,
  DOCK_PULSE_MIN_GAP_S,
  DOCK_PULSE_S,
  STATE_KEY,
  TOAST_LIMIT,
  TOAST_MS,
  createToastGate,
  dockClearance,
  nextSpeed,
  pushToast,
  type DockClearance,
  type ToastEntry,
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
 * simulated rate; the Pause toggle (shown engaged under reduced motion); and
 * a time-lapse chip cycling ×1 → ×5 → ×10.
 *
 * Toasts stack above it, at most two, four seconds each, in a polite live
 * region, for visitor-caused events only (a fault the visitor switched on):
 * "{provider} is failing, traffic rerouted to {fallback}" and
 * "{provider} · {state}", de-duplicated per outage episode (`navModel`).
 *
 * It steps aside during the intro (the CSS gate hides it; it arrives 600ms
 * after the hand-off, `dock-arrive`), while the phone menu is open, and near
 * the launch station's calls to action and the footer (`[data-dock-avoid]`,
 * `footer`). It never sits on the hero's board of real figures
 * (`[data-dock-clear]`) while the board rests in its band at the bottom of
 * the viewport: it climbs the short desktop board and steps aside for the
 * tall phone one. Under reduced motion the deck never steps, so the
 * time-lapse chip is disabled alongside the engaged Pause.
 */

const TOAST_LEAVE_MS = 240;
/** Targets the dock never covers: it hides while one is near. */
const AVOID_SELECTOR = "[data-dock-avoid]";
/** Short bands the dock climbs over while they rest at the bottom of the viewport. */
const CLEAR_SELECTOR = "[data-dock-clear], #bridge .almanac";

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
    const observers: IntersectionObserver[] = [];
    if (targets.length > 0) {
      const observer = new IntersectionObserver(onChange);
      for (const target of targets) observer.observe(target);
      observers.push(observer);
    }
    if (footer) {
      // The launch CTA row sits right above the footer: step aside a little early.
      const observer = new IntersectionObserver(onChange, { rootMargin: "0px 0px 25% 0px" });
      observer.observe(footer);
      observers.push(observer);
    }
    return () => {
      for (const observer of observers) observer.disconnect();
    };
  }, []);
  return near;
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
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const toastKey = useRef(0);
  const pingRef = useRef<HTMLSpanElement>(null);
  const pulse = useRef({ batches: -1, t: DOCK_PULSE_S, written: false });

  // Visitor-caused events become toasts (at most two on screen).
  const removeToast = useCallback((key: number) => {
    setToasts((list) => list.filter((toast) => toast.key !== key));
  }, []);
  useEffect(() => {
    const gate = createToastGate();
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };
    const unsubscribe = subscribeEvents((event, meta) => {
      const spec = gate.accept(event, meta.user, performance.now());
      if (!spec) return;
      const key = ++toastKey.current;
      setToasts((list) => pushToast(list, { key, spec, leaving: false }, TOAST_LIMIT));
      later(() => {
        setToasts((list) =>
          list.map((toast) => (toast.key === key ? { ...toast, leaving: true } : toast))
        );
        later(() => removeToast(key), TOAST_LEAVE_MS);
      }, TOAST_MS);
    });
    return () => {
      unsubscribe();
      for (const id of timers) window.clearTimeout(id);
    };
  }, [removeToast]);

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
  const paceFactor = numberFormat(locale).format(speed);
  const pauseShown = paused || reduced;

  const toastText = (spec: ToastSpec) => {
    if (spec.kind === "failing") {
      return t("simToastFailing", {
        provider: providerName(spec.id),
        fallback: providerName(spec.fallback),
      });
    }
    return `${providerName(spec.id)} · ${t(STATE_KEY[spec.state])}`;
  };

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
      <div className="dock-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <p
            key={toast.key}
            className="dock-toast"
            data-kind={toast.spec.kind}
            data-state={toast.spec.kind === "state" ? toast.spec.state : undefined}
            data-leaving={toast.leaving ? "on" : undefined}
          >
            <span className="dock-toast-mark" aria-hidden="true" />
            <span>{toastText(toast.spec)}</span>
          </p>
        ))}
      </div>
      <div className="dock-pill">
        <span className="dock-status">
          <span className="dock-dot" aria-hidden="true">
            <span ref={pingRef} className="dock-ping" />
          </span>
          <span className="dock-word">{t("simBadge")}</span>
          <span className="sr-only">{t("simDockLabel")}</span>
        </span>
        <span className="dock-rate" aria-hidden="true">
          <span className="dock-rate-n">{numberFormat(locale).format(rate)}</span>
          <span className="dock-rate-unit" dir="ltr">
            req/s
          </span>
        </span>
        <Toggle
          className="dock-pause"
          pressed={pauseShown}
          disabled={reduced}
          onChange={(next) => setPaused(next)}
          label={t("simPause")}
          glyph={pauseShown ? "play" : "pause"}
          hideLabel
          title={t("simPause")}
        />
        <button
          type="button"
          className="dock-pace"
          data-fast={speed > 1 && !reduced ? "on" : undefined}
          aria-pressed={speed > 1 && !reduced}
          disabled={reduced}
          onClick={() => dispatch(act.setSpeed(nextSpeed(speed, SPEEDS)))}
        >
          {t("simTimelapse", { factor: paceFactor })}
        </button>
      </div>
    </div>
  );
}
