"use client";
import {
  Fragment,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { RTL_LOCALES } from "@/i18n/config";
import { CITIES, MAP_HEIGHT, MAP_WIDTH, type CityId } from "../../landingGeometry";
import { BREAKER_PROFILES, HEADER, SAMPLE_CANDIDATES } from "../../landingTypes";
import { usePrefersReducedMotion } from "../../landingMotion";
import {
  act,
  candidate as candidateOf,
  type BreakerState,
  type CandidateId,
  type ClientId,
  type FailCode,
  type World,
} from "../../sim/landingSim";
import { dispatch, getWorld, subscribeEvents, useDeck } from "../../runtime/deckStore";
import { canAnimate } from "../../runtime/heartbeat";
import { useCanvasStage, type StageDraw } from "../../runtime/useCanvasStage";
import { useDomLoop } from "../../runtime/useDomLoop";
import { useScrollProgress } from "../../runtime/scrollProgress";
import { LiveNumber, SimBadge, Station, type LiveNumberHandle } from "../primitives";
import { cx, numberFormat } from "../primitives/primitiveKit";
import type { FlightEvent, MapInput } from "./mapRender";
import {
  CANDIDATE_OF_CITY,
  CATALOG_ID,
  CITY_COUNT,
  HUB_CITY,
  HUB_INDEX,
  LABEL_GAP_PX,
  LABEL_SIDE,
  MAP_CANDIDATES,
  NODE_POINTS,
  PROVIDER_CITY,
  STATE_KEY,
  cityAt,
  cityIndex,
  cityRole,
  fitMap,
  flatNodePoint,
  labelOpacity,
  logKind,
  packCandidate,
  PIN_TRACK_VH,
  plateShift,
  providerNode,
  shortHeader,
  unpackDown,
  unpackState,
  type MapLayout,
} from "./mapRoles";
import "./map.css";

/**
 * Network: the Afghanistan map (spec §6.3). It opens on the reference image
 * (a gold dot-matrix Afghanistan, glowing city nodes, thin gold arcs from
 * Kabul) and becomes the operations theatre of the page's one simulation:
 * every request the deck routes flies here, client → Kabul → provider, and a
 * failing provider is visibly retried by the hub.
 *
 * - Desktop (≥1024): a 140vh pinned track; its first 60% tilts the map into
 *   3D (pillars of light, lifted arcs), the rest is free play. The stage's
 *   bottom is the section's: the next station follows the released map.
 *   Title top-left, legend top-right (Afghanistan's open corners, never
 *   mirrored), flight board at the bottom inline-end corner (the SimDock owns
 *   the bottom inline-start one).
 * - Phone: not pinned; the map tilts once, time-based, on first sight.
 * - Tap a provider city (or its name) to cut its road
 *   (`act.setUpstreamDown`), the same latch the hero and the resilience rail
 *   show.
 * - Labels follow the camera on the heartbeat's dom lane, and are placed at
 *   once after any frame drawn outside it (first paint, resize, Pause), so a
 *   still frame never shows unplaced plates. Every plate is kept inside the
 *   page gutter (`plateShift`), measured by a ResizeObserver, not per frame.
 *
 * Counters and the flight board count what this map has shown since it came
 * on screen (no backlog), and render 0 on the server.
 */

type RendererModule = typeof import("./mapRender");

const PIN_MIN_WIDTH = 1024;
const PIN_QUERY = `(min-width: ${PIN_MIN_WIDTH}px)`;
const LOG_LENGTH = 5;
const LOG_FLUSH_MS = 250;
const ANNOUNCE_GAP_MS = 3000;

type LogEntry = {
  id: number;
  from: ClientId;
  failed: readonly CandidateId[];
  codes: readonly FailCode[];
  to: CandidateId | null;
};

type FlightLogHandle = {
  /** Log a finished flight; `now` flushes at once (no animation running). */
  push: (event: FlightEvent, now: boolean) => void;
};

/**
 * The station's mutable, non-React state: renderer input, counters, label
 * bookkeeping and pointer geometry. Created once, lazily, on first use in an
 * effect or a handler (never during render, never re-allocated per render).
 */
type Scene = {
  /** Read by the canvas every frame. */
  input: MapInput;
  /** Figure size (ResizeObserver) and page offset (refreshed lazily after a scroll). */
  box: { w: number; h: number; left: number; top: number; stale: boolean };
  labelEls: (HTMLSpanElement | null)[];
  /** Each label's plate (`.netmap-lbody`), its measured width and its last written x shift. */
  bodyEls: (HTMLSpanElement | null)[];
  plateW: Float32Array;
  plateShift: Float32Array;
  /** The page gutter (`--gutter`), read on resize: plates stay inside it. */
  gutter: number;
  /** Per label: last written x, y, opacity. */
  labelPos: Float32Array;
  /** Node positions at pitch 0 (no live canvas). */
  flatScreen: Float32Array;
  cityCounters: (LiveNumberHandle | null)[];
  counts: { city: Int32Array; routed: number; rerouted: number };
  visible: boolean;
  pointer: { x: number; y: number };
  tipFlip: { x: boolean; y: boolean };
  /** The renderer frame the labels were last placed for (−1: place again). */
  lastFrame: number;
  /** `data-placed` is on the label layer (set once, after the first placement). */
  placed: boolean;
};

function createScene(progress: { current: number }): Scene {
  return {
    input: { layout: "flow", progress, revealed: false, parallax: 0, hover: -1, rtl: false },
    box: { w: 0, h: 0, left: 0, top: 0, stale: true },
    labelEls: [],
    bodyEls: [],
    plateW: new Float32Array(CITY_COUNT),
    plateShift: new Float32Array(CITY_COUNT),
    gutter: 16,
    labelPos: new Float32Array(CITY_COUNT * 3).fill(-1),
    flatScreen: new Float32Array(CITY_COUNT * 4),
    cityCounters: [],
    counts: { city: new Int32Array(CITY_COUNT), routed: 0, rerouted: 0 },
    visible: false,
    pointer: { x: 0, y: 0 },
    tipFlip: { x: false, y: false },
    lastFrame: -1,
    placed: false,
  };
}

/* ------------------------------------------------------------------------ */
/* Deck selectors (module level: stable identity)                           */
/* ------------------------------------------------------------------------ */

/** Upstream latch and breaker state of every candidate, packed in one number. */
const selectMapState = (w: World): number => {
  let packed = 0;
  for (let i = 0; i < w.candidates.length; i++) {
    const c = w.candidates[i];
    packed |= packCandidate(i, c.upstreamDown, c.breaker.state);
  }
  return packed;
};

/* ------------------------------------------------------------------------ */
/* Media query                                                              */
/* ------------------------------------------------------------------------ */

function subscribePin(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(PIN_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const readPin = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(PIN_QUERY).matches
    : false;
const readPinOnServer = () => false;

/** The provider city a DOM target belongs to (a tappable label), or −1. */
function cityOfTarget(target: EventTarget | null): number {
  if (!(target instanceof Element)) return -1;
  const el = target.closest<HTMLElement>("[data-city]");
  if (!el) return -1;
  const city = Number(el.dataset.city);
  return Number.isInteger(city) ? city : -1;
}

/* ------------------------------------------------------------------------ */
/* Station                                                                  */
/* ------------------------------------------------------------------------ */

export default function NetworkMap({ poster }: { poster: ReactNode }) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const rtl = (RTL_LOCALES as readonly string[]).includes(locale);
  const reduced = usePrefersReducedMotion();
  const pinned = useSyncExternalStore(subscribePin, readPin, readPinOnServer);
  const packed = useDeck(selectMapState);

  const trackRef = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(trackRef, { mode: "pin", minWidth: PIN_MIN_WIDTH });
  const figureRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const tipCountRef = useRef<LiveNumberHandle>(null);
  const routedRef = useRef<LiveNumberHandle>(null);
  const reroutedRef = useRef<LiveNumberHandle>(null);
  const logRef = useRef<FlightLogHandle>(null);
  const rendererRef = useRef<RendererModule | null>(null);

  const sceneRef = useRef<Scene | null>(null);
  const scene = useCallback((): Scene => (sceneRef.current ??= createScene(progress)), [progress]);

  const [renderer, setRenderer] = useState<RendererModule | null>(null);
  const [hover, setHover] = useState(-1);
  const [hoverCount, setHoverCount] = useState(0);
  const [tapped, setTapped] = useState(-1);
  const [announcement, setAnnouncement] = useState("");

  const cityName = useCallback((id: CityId) => t(`mapCity_${id}`), [t]);
  const providerName = useCallback((id: CandidateId) => t(`mapCity_${PROVIDER_CITY[id]}`), [t]);

  /* ---- renderer: loaded once the map is within 600px, never under reduced motion ---- */
  useEffect(() => {
    if (reduced) return;
    const node = figureRef.current;
    if (!node) return;
    let cancelled = false;
    const load = () => {
      import("./mapRender")
        .then((mod) => {
          if (cancelled) return;
          rendererRef.current = mod;
          setRenderer(mod);
        })
        .catch((error: unknown) => {
          // The poster simply stays.
          console.error("[landing] network map renderer failed to load", error);
        });
    };
    if (typeof IntersectionObserver === "undefined") {
      load();
      return () => {
        cancelled = true;
      };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [reduced]);

  useEffect(() => {
    const { input } = scene();
    input.layout = pinned ? "pin" : "flow";
    input.rtl = rtl;
  }, [scene, pinned, rtl]);

  /* ---- counters ---- */
  /** One more request at a city: its counter label (and the open card's). */
  const bumpCity = useCallback(
    (index: number) => {
      const { counts, cityCounters, input } = scene();
      counts.city[index]++;
      cityCounters[index]?.set(counts.city[index]);
      if (index === input.hover) tipCountRef.current?.set(counts.city[index]);
    },
    [scene]
  );

  /** The request reached Kabul: count its client and the hub. */
  const reachHub = useCallback(
    (event: FlightEvent) => {
      bumpCity(HUB_INDEX);
      if (event.from === "ghazni" || event.from === "faizabad") bumpCity(cityIndex(event.from));
    },
    [bumpCity]
  );

  /** The flight is over: count the serving city and the totals, and log it. */
  const finish = useCallback(
    (event: FlightEvent, now = false) => {
      const { counts } = scene();
      if (event.kind === "routed") {
        bumpCity(cityIndex(PROVIDER_CITY[event.to]));
        counts.routed++;
        routedRef.current?.set(counts.routed);
        if (event.failed.length > 0) {
          counts.rerouted++;
          reroutedRef.current?.set(counts.rerouted);
        }
      }
      logRef.current?.push(event, now);
    },
    [bumpCity, scene]
  );

  /* ---- the hover card sits beside its city, flipped away from the stage edges ---- */
  const placeTip = useCallback(
    (x: number, y: number) => {
      const tip = tipRef.current;
      if (!tip) return;
      const { box: figureBox, tipFlip } = scene();
      tip.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      const flipX = figureBox.w > 0 && x > figureBox.w - 340;
      const flipY = figureBox.h > 0 && y > figureBox.h * 0.5;
      if (flipX !== tipFlip.x) {
        tipFlip.x = flipX;
        if (flipX) tip.setAttribute("data-flipx", "on");
        else tip.removeAttribute("data-flipx");
      }
      if (flipY !== tipFlip.y) {
        tipFlip.y = flipY;
        if (flipY) tip.setAttribute("data-flipy", "on");
        else tip.removeAttribute("data-flipy");
      }
    },
    [scene]
  );

  /**
   * Put every label on its node as the renderer last drew it, its plate slid
   * inside the gutter. Writes only transform/opacity, and only what changed;
   * a no-op until the renderer has drawn, and for a frame already placed.
   */
  const placeLabels = useCallback(() => {
    const mod = rendererRef.current;
    if (!mod) return;
    const frame = mod.getFrameCount();
    const s = scene();
    if (frame === 0 || frame === s.lastFrame) return;
    s.lastFrame = frame;
    const { labelEls, bodyEls, labelPos, plateW, plateShift: shifts, box: figureBox } = s;
    const layout = s.input.layout;
    const sides = LABEL_SIDE[layout];
    const gap = LABEL_GAP_PX[layout];
    const screen = mod.nodeScreen;
    for (let i = 0; i < CITY_COUNT; i++) {
      const el = labelEls[i];
      if (!el) continue;
      const x = screen[i * 4];
      const y = screen[i * 4 + 1];
      if (Math.abs(x - labelPos[i * 3]) > 0.25 || Math.abs(y - labelPos[i * 3 + 1]) > 0.25) {
        labelPos[i * 3] = x;
        labelPos[i * 3 + 1] = y;
        el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      }
      const opacity = labelOpacity(screen[i * 4 + 3]);
      if (Math.abs(opacity - labelPos[i * 3 + 2]) > 0.02) {
        labelPos[i * 3 + 2] = opacity;
        el.style.opacity = opacity.toFixed(2);
      }
      const body = bodyEls[i];
      if (!body) continue;
      const shift = plateShift(x, plateW[i], sides[CITIES[i].id], gap, figureBox.w, s.gutter);
      if (Math.abs(shift - shifts[i]) > 0.25) {
        shifts[i] = shift;
        body.style.transform = shift === 0 ? "" : `translateX(${shift.toFixed(1)}px)`;
      }
    }
    if (!s.placed) {
      s.placed = true;
      labelsRef.current?.setAttribute("data-placed", "on");
    }
    const hovered = s.input.hover;
    if (hovered >= 0) placeTip(screen[hovered * 4], screen[hovered * 4 + 1]);
  }, [scene, placeTip]);

  /* ---- the canvas ---- */
  /**
   * A frame drawn outside a running heartbeat (first paint, resize, a redraw
   * while paused) comes with dt 0: the dom lane may never tick after it, so
   * its labels are placed here and then.
   */
  const drawMap = useCallback<StageDraw>(
    (ctx, size, dt) => {
      const mod = rendererRef.current;
      if (!mod) return;
      mod.draw(ctx, size, dt);
      if (dt === 0) placeLabels();
    },
    [placeLabels]
  );

  const { wrapRef, canvasRef, requestDraw } = useCanvasStage({
    id: "network-map",
    priority: 1,
    enabled: renderer !== null,
    setup: renderer?.setup,
    draw: renderer ? drawMap : undefined,
  });

  /* ---- Pause (or a hidden heartbeat): a cut, a reset or a hover still shows on the still frame ---- */
  useEffect(() => {
    if (!canAnimate()) requestDraw();
  }, [packed, hover, requestDraw]);

  /* ---- renderer binding ---- */
  useEffect(() => {
    if (!renderer) return;
    return renderer.bind(scene().input, { onHub: reachHub, onLand: (event) => finish(event) });
  }, [renderer, scene, reachHub, finish]);

  /* ---- visibility: no backlog, and the phone tilt starts at 40% on screen ---- */
  useEffect(() => {
    const node = figureRef.current;
    const s = scene();
    if (!node || typeof IntersectionObserver === "undefined") {
      s.visible = true;
      s.input.revealed = true;
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        s.visible = entry.isIntersecting;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.4) s.input.revealed = true;
      },
      { threshold: [0, 0.4] }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [scene]);

  /* ---- figure geometry, without layout reads in pointer handlers or loops ---- */
  useEffect(() => {
    const node = figureRef.current;
    if (!node) return;
    const s = scene();
    const figureBox = s.box;
    const markStale = () => {
      figureBox.stale = true;
    };
    window.addEventListener("scroll", markStale, { passive: true });
    window.addEventListener("resize", markStale);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        figureBox.w = entry.contentRect.width;
        figureBox.h = entry.contentRect.height;
        figureBox.stale = true;
        const gutter = parseFloat(getComputedStyle(node).getPropertyValue("--gutter"));
        if (gutter >= 0) s.gutter = gutter;
        // The plates' room changed: place them again (now, if no frame is coming).
        s.lastFrame = -1;
        if (!canAnimate()) placeLabels();
      });
      observer.observe(node);
    }
    return () => {
      window.removeEventListener("scroll", markStale);
      window.removeEventListener("resize", markStale);
      observer?.disconnect();
    };
  }, [scene, placeLabels]);

  /* ---- label plates: their widths, measured only when their text changes ---- */
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const s = scene();
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const i = s.bodyEls.indexOf(entry.target as HTMLSpanElement);
        if (i < 0) continue;
        const size = entry.borderBoxSize?.[0];
        s.plateW[i] = size ? size.inlineSize : (entry.target as HTMLElement).offsetWidth;
      }
      s.lastFrame = -1;
      if (!canAnimate()) placeLabels();
    });
    for (const el of s.bodyEls) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [scene, placeLabels]);

  /* ---- announcements: user-caused breaker changes, politely, ≤ 1 per 3 s ---- */
  const announceRef = useRef({ text: "", last: -Infinity, timer: 0 });
  const announce = useCallback((text: string) => {
    const a = announceRef.current;
    a.text = text;
    if (a.timer) return;
    const wait = Math.max(0, a.last + ANNOUNCE_GAP_MS - performance.now());
    a.timer = window.setTimeout(() => {
      a.timer = 0;
      a.last = performance.now();
      setAnnouncement(a.text);
    }, wait);
  }, []);
  useEffect(() => {
    const a = announceRef.current;
    return () => {
      if (a.timer) window.clearTimeout(a.timer);
      a.timer = 0;
    };
  }, []);

  /* ---- deck events ---- */
  useEffect(
    () =>
      subscribeEvents((event, meta) => {
        if (event.kind === "breaker") {
          rendererRef.current?.breakerChanged(event.id, event.state);
          if (meta.user) {
            announce(
              `${providerName(event.id)} → ${CATALOG_ID[event.id]} · ${t(STATE_KEY[event.state])}`
            );
          }
          return;
        }
        if (event.kind !== "routed" && event.kind !== "dropped") return;
        if (!scene().visible) return;
        const mod = rendererRef.current;
        const live = wrapRef.current?.getAttribute("data-live") === "on";
        if (mod && live && canAnimate() && mod.launch(event)) return;
        // No flight (reduced motion, Pause, or 16 already in the air): count it at once.
        reachHub(event);
        finish(event, true);
      }),
    [announce, finish, providerName, reachHub, scene, wrapRef, t]
  );

  /* ---- labels follow the camera (dom lane, after the canvas lane) ---- */
  useDomLoop("network-labels", () => placeLabels(), {
    target: figureRef,
    enabled: renderer !== null && !reduced,
  });

  /* ---- pointer: hover, parallax, tap to cut a road ---- */
  const layout: MapLayout = pinned ? "pin" : "flow";

  /** The pointer in figure coordinates, into `scene().pointer` (one rect read per scroll, not per move). */
  const locate = (event: ReactMouseEvent<HTMLElement>): void => {
    const { box: figureBox, pointer } = scene();
    if (figureBox.stale) {
      const figure = figureRef.current;
      if (figure) {
        const rect = figure.getBoundingClientRect();
        figureBox.left = rect.left;
        figureBox.top = rect.top;
        figureBox.stale = false;
      }
    }
    pointer.x = event.clientX - figureBox.left;
    pointer.y = event.clientY - figureBox.top;
  };

  /** Current node positions: the live frame's, or the poster's (pitch 0) without a canvas. */
  const nodeScreen = (): Float32Array => {
    const mod = rendererRef.current;
    if (mod && wrapRef.current?.getAttribute("data-live") === "on") return mod.nodeScreen;
    const { box: figureBox, flatScreen } = scene();
    const frame = fitMap(figureBox.w, figureBox.h, layout, rtl);
    for (let i = 0; i < CITY_COUNT; i++) {
      const p = flatNodePoint(i, frame);
      flatScreen[i * 4] = p.x;
      flatScreen[i * 4 + 1] = p.y;
    }
    return flatScreen;
  };

  /**
   * The city an event points at: a provider's name label, else a provider
   * node within 24px, else (hover only) the hub or a client within 12px.
   */
  const cityOf = (event: ReactMouseEvent<HTMLElement>, passive: boolean): number => {
    const labelled = cityOfTarget(event.target);
    if (labelled >= 0) return labelled;
    const { pointer } = scene();
    return cityAt(nodeScreen(), pointer.x, pointer.y, passive);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") return;
    locate(event);
    const city = cityOf(event, true);
    const { box: figureBox, pointer, input, counts } = scene();
    if (pinned && figureBox.w > 0) {
      input.parallax = Math.max(-1, Math.min(1, (pointer.x / figureBox.w - 0.5) * 2));
    }
    if (city !== input.hover) {
      input.hover = city;
      setHoverCount(city >= 0 ? counts.city[city] : 0);
      setHover(city);
      // No dom lane to follow (no renderer yet, or a still frame): place the card now.
      if (city >= 0 && (rendererRef.current === null || !canAnimate())) {
        const screen = nodeScreen();
        placeTip(screen[city * 4], screen[city * 4 + 1]);
      }
    }
  };

  const onPointerLeave = () => {
    const { input } = scene();
    input.parallax = 0;
    input.hover = -1;
    setHover(-1);
  };

  const toggle = useCallback((id: CandidateId) => {
    const down = candidateOf(getWorld(), id).upstreamDown;
    dispatch(act.setUpstreamDown(id, !down), { user: true });
  }, []);

  const onClick = (event: ReactMouseEvent<HTMLElement>) => {
    locate(event);
    const city = cityOf(event, false);
    if (city < 0) return;
    const candidate = CANDIDATE_OF_CITY[CITIES[city].id];
    if (!candidate) return;
    toggle(candidate);
    setTapped(city);
  };

  const anyTrouble = packed !== 0;
  const hoverCandidate = hover >= 0 ? CANDIDATE_OF_CITY[CITIES[hover].id] : undefined;
  const hoverIndex = hoverCandidate ? MAP_CANDIDATES.indexOf(hoverCandidate) : -1;
  const hoverState: BreakerState = hoverIndex >= 0 ? unpackState(packed, hoverIndex) : "closed";
  const hoverDown = hoverIndex >= 0 && unpackDown(packed, hoverIndex);
  const arrow = <Arrow />;
  const reset = () => dispatch(act.reset());

  return (
    <Station
      id="network"
      title={t("mapTitle")}
      lead={t("mapLead")}
      pin={{ minWidth: PIN_MIN_WIDTH, vh: PIN_TRACK_VH }}
      trackRef={trackRef}
      className="netmap"
    >
      <div className="netmap-deck">
        <figure
          ref={figureRef}
          className="netmap-figure"
          dir="ltr"
          role="img"
          aria-label={t("mapAria")}
          data-hover={hoverCandidate ? "provider" : undefined}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onClick={onClick}
        >
          <div ref={wrapRef} className="stage netmap-canvas">
            <div className="stage-poster">{poster}</div>
            <canvas ref={canvasRef} aria-hidden="true" />
          </div>
          <div ref={labelsRef} className="netmap-labels" aria-hidden="true">
            {CITIES.map((city, i) => {
              const role = cityRole(city.id);
              const candidate = CANDIDATE_OF_CITY[city.id];
              const ci = candidate ? MAP_CANDIDATES.indexOf(candidate) : -1;
              const state: BreakerState = ci >= 0 ? unpackState(packed, ci) : "closed";
              const down = ci >= 0 && unpackDown(packed, ci);
              const trouble = down || state !== "closed";
              return (
                <span
                  key={city.id}
                  ref={(el) => {
                    scene().labelEls[i] = el;
                  }}
                  className="netmap-label"
                  data-role={role}
                  data-city={candidate ? i : undefined}
                  data-pin={LABEL_SIDE.pin[city.id]}
                  data-flow={LABEL_SIDE.flow[city.id]}
                  data-open={tapped === i || hover === i ? "on" : undefined}
                  data-trouble={down || state === "open" ? "on" : undefined}
                >
                  <span
                    ref={(el) => {
                      scene().bodyEls[i] = el;
                    }}
                    className="netmap-lbody"
                  >
                    <span className="netmap-lname">
                      {cityName(city.id)}
                      <LiveNumber
                        ref={(handle) => {
                          scene().cityCounters[i] = handle;
                        }}
                        value={0}
                        mode="tick"
                        className="netmap-lcount"
                      />
                    </span>
                    {candidate ? (
                      <span className="netmap-lrole">
                        <span className="netmap-lid" dir="ltr">
                          → {CATALOG_ID[candidate]}
                        </span>
                        {trouble ? (
                          <span className="netmap-lstate" data-state={state}>
                            <span className="netmap-lsep">{" · "}</span>
                            <TroubleText down={down} state={state} />
                          </span>
                        ) : null}
                      </span>
                    ) : role === "hub" ? (
                      <span className="netmap-lrole">{t("mapHub")}</span>
                    ) : null}
                  </span>
                </span>
              );
            })}
          </div>
          {/* Without a live canvas (reduced motion), a cut road still shows on the poster. */}
          <div className="netmap-fit netmap-cuts" aria-hidden="true">
            {MAP_CANDIDATES.map((id, i) => {
              const state = unpackState(packed, i);
              if (!unpackDown(packed, i) && state !== "open") return null;
              const p = NODE_POINTS[providerNode(id)];
              return (
                <span
                  key={id}
                  className="netmap-cut"
                  style={{
                    left: `${((p.x / MAP_WIDTH) * 100).toFixed(2)}%`,
                    top: `${((p.y / MAP_HEIGHT) * 100).toFixed(2)}%`,
                  }}
                >
                  <span className="netmap-cut-x">✕</span>
                  <span className="netmap-cut-state">{t(STATE_KEY[state])}</span>
                </span>
              );
            })}
          </div>
          <div
            ref={tipRef}
            className="netmap-tip"
            aria-hidden="true"
            data-open={hover >= 0 ? "on" : undefined}
          >
            {hover >= 0 ? (
              <CityTip
                key={hover}
                city={CITIES[hover].id}
                state={hoverState}
                down={hoverDown}
                count={hoverCount}
                countRef={tipCountRef}
                rtl={rtl}
              />
            ) : null}
          </div>
        </figure>

        <div className="netmap-board">
          <SimBadge note={t("mapSimNote")} className="netmap-badge" />
          <button
            type="button"
            className="netmap-reset netmap-reset-board"
            onClick={reset}
            disabled={!anyTrouble}
          >
            {t("reset")}
          </button>
          <dl className="netmap-counts" aria-live="off">
            <div className="netmap-count">
              <dt>{t("mapTotal")}</dt>
              <dd>
                <LiveNumber ref={routedRef} value={0} mode="tick" className="netmap-num" />
              </dd>
            </div>
            <div className="netmap-count">
              <dt>{t("mapRerouted")}</dt>
              <dd>
                <LiveNumber ref={reroutedRef} value={0} mode="tick" className="netmap-num" />
              </dd>
            </div>
          </dl>
          <FlightLog ref={logRef} />
        </div>

        <div className="netmap-legend">
          <ul className="netmap-glyphs">
            <li>
              <LegendGlyph kind="hub" />
              {t("mapHub")}
            </li>
            <li>
              <LegendGlyph kind="provider" />
              {t("resilienceProvider")}
            </li>
            <li>
              <LegendGlyph kind="client" />
              {t("instrumentRequest")}
            </li>
          </ul>
          <p className="netmap-sample">
            {t("mapSampleLegend")}
            <span className="netmap-mapping">
              {MAP_CANDIDATES.map((id, k) => (
                <Fragment key={id}>
                  {k === 0 ? ": " : " · "}
                  {providerName(id)}
                  {arrow}
                  <span dir="ltr">{CATALOG_ID[id]}</span>
                </Fragment>
              ))}
            </span>
          </p>
          {/* Keyboard twins of the six provider cities: hidden until one takes focus. */}
          <ul className="netmap-keys" aria-label={t("mapCloseHint")}>
            {MAP_CANDIDATES.map((id, i) => (
              <li key={id}>
                <button
                  type="button"
                  className="netmap-key"
                  aria-pressed={unpackDown(packed, i)}
                  onClick={() => toggle(id)}
                >
                  {t("heroToggleAria", {
                    down: "false",
                    provider: `${providerName(id)} (${CATALOG_ID[id]})`,
                  })}
                </button>
              </li>
            ))}
          </ul>
          <div className="netmap-hintrow">
            <p className="netmap-hint">{t("mapCloseHint")}</p>
            <button
              type="button"
              className="netmap-reset netmap-reset-legend"
              onClick={reset}
              disabled={!anyTrouble}
            >
              {t("reset")}
            </button>
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </div>
    </Station>
  );
}

/* ------------------------------------------------------------------------ */
/* Pieces                                                                   */
/* ------------------------------------------------------------------------ */

function Arrow() {
  return (
    <span className="netmap-arrow" aria-hidden="true">
      →
    </span>
  );
}

/**
 * What a troubled road says on its label: the latch ("✕ 503") and any
 * non-closed breaker state. Below 1024px a latched road shows the latch alone
 * (`data-latched` hides the word in map.css): the plate must fit beside its
 * city on a phone, and the flight log and the dock's toasts say the rest.
 */
function TroubleText({ down, state }: { down: boolean; state: BreakerState }) {
  const t = useTranslations("landing");
  return (
    <>
      {down ? (
        <span className="netmap-latch">
          ✕ <span dir="ltr">503</span>
        </span>
      ) : null}
      {state !== "closed" ? (
        <span className="netmap-lword" data-latched={down ? "on" : undefined}>
          {down ? " · " : null}
          {t(STATE_KEY[state])}
        </span>
      ) : null}
    </>
  );
}

/**
 * The last flights (5; 3 on a phone). Its own component, so the 250ms log
 * flushes re-render only these lines, never the station's labels.
 */
function FlightLog({ ref }: { ref: Ref<FlightLogHandle> }) {
  const t = useTranslations("landing");
  const [lines, setLines] = useState<LogEntry[]>([]);
  const queueRef = useRef<{ items: LogEntry[]; timer: number; id: number } | null>(null);
  const getQueue = useCallback(() => (queueRef.current ??= { items: [], timer: 0, id: 0 }), []);

  const flush = useCallback(() => {
    const queue = getQueue();
    if (queue.timer) window.clearTimeout(queue.timer);
    queue.timer = 0;
    if (queue.items.length === 0) return;
    const fresh = queue.items.splice(0, queue.items.length).reverse();
    setLines((previous) => [...fresh, ...previous].slice(0, LOG_LENGTH));
  }, [getQueue]);

  useImperativeHandle(
    ref,
    () => ({
      push(event, now) {
        const queue = getQueue();
        queue.items.push({
          id: ++queue.id,
          from: event.from,
          failed: event.failed,
          codes: event.codes,
          to: event.kind === "routed" ? event.to : null,
        });
        if (now) flush();
        else if (!queue.timer) queue.timer = window.setTimeout(flush, LOG_FLUSH_MS);
      },
    }),
    [flush, getQueue]
  );
  useEffect(
    () => () => {
      const queue = queueRef.current;
      if (queue?.timer) window.clearTimeout(queue.timer);
      if (queue) queue.timer = 0;
    },
    []
  );

  const city = (id: CityId) => t(`mapCity_${id}`);
  const provider = (id: CandidateId) => t(`mapCity_${PROVIDER_CITY[id]}`);
  const arrow = <Arrow />;
  const fallbackLabel = shortHeader(HEADER.fallbackAttempts);
  const notServed = t("mapDropped");

  return (
    <ol className="netmap-log">
      {lines.length === 0 ? (
        <li className="netmap-logline" data-kind="idle">
          {city(HUB_CITY)} · {t("mapHub")}
        </li>
      ) : (
        lines.map((entry) => {
          const kind = logKind(entry.failed.length, entry.to !== null);
          const client =
            entry.from === "ghazni" || entry.from === "faizabad" ? (
              <>
                {city(entry.from)}
                {arrow}
              </>
            ) : null;
          return (
            <li key={entry.id} className="netmap-logline" data-kind={kind}>
              {entry.failed.length === 0 ? (
                <>
                  {client}
                  {city(HUB_CITY)}
                </>
              ) : (
                entry.failed.map((id, k) => (
                  <Fragment key={`${id}-${k}`}>
                    {k > 0 ? arrow : null}
                    {provider(id)}{" "}
                    <span className="netmap-x">
                      ✕ <span dir="ltr">{entry.codes[k] ?? 503}</span>
                    </span>
                  </Fragment>
                ))
              )}
              {entry.to ? (
                <>
                  {arrow}
                  <b>{provider(entry.to)}</b>
                </>
              ) : (
                <span className="netmap-drop">{` · ✕ ${notServed}`}</span>
              )}
              {kind === "fallback" ? (
                <span className="netmap-hdr">
                  <span className="netmap-hdrsep">{" · "}</span>
                  <span dir="ltr">
                    {fallbackLabel}: {entry.failed.length}
                  </span>
                </span>
              ) : null}
            </li>
          );
        })
      )}
    </ol>
  );
}

function LegendGlyph({ kind }: { kind: "hub" | "provider" | "client" }) {
  return (
    <svg className="netmap-glyph" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      {kind === "hub" ? (
        <>
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeDasharray="2.5 2.5"
          />
          <circle cx="10" cy="10" r="4" fill="#040405" stroke="#ffd36e" strokeWidth="1.4" />
          <circle cx="10" cy="10" r="1.8" fill="#fff1c9" />
        </>
      ) : kind === "provider" ? (
        <>
          <circle cx="10" cy="10" r="7.5" fill="none" stroke="#8c6a1e" strokeWidth="1.4" />
          <circle cx="10" cy="10" r="3.6" fill="#040405" stroke="#ffd36e" strokeWidth="1.4" />
          <circle cx="10" cy="10" r="1.5" fill="#ffd36e" />
        </>
      ) : (
        <path
          d="M10 5.5L14.5 10L10 14.5L5.5 10Z"
          fill="#040405"
          stroke="#d4a840"
          strokeWidth="1.4"
        />
      )}
    </svg>
  );
}

/**
 * The hover card of one city: role, the requests this map has shown it serve
 * (the same count as its label, kept live through `countRef`), the upstream
 * latch when its road is cut, the breaker state (with the breaker-ring mark,
 * so "closed" never reads as "road closed") and its profile's thresholds.
 * Its text takes the page direction; only the figure geometry stays LTR.
 */
function CityTip({
  city,
  state,
  down,
  count,
  countRef,
  rtl,
}: {
  city: CityId;
  state: BreakerState;
  down: boolean;
  count: number;
  countRef: Ref<LiveNumberHandle>;
  rtl: boolean;
}) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const fmt = numberFormat(locale);
  const candidate = CANDIDATE_OF_CITY[city];
  const role = cityRole(city);
  const profile = candidate ? profileOf(candidate) : null;

  return (
    <div className="netmap-tipbody" dir={rtl ? "rtl" : "ltr"}>
      <p className="netmap-tipname">
        {t(`mapCity_${city}`)}
        <span className="netmap-tiprole">
          {candidate ? (
            <span dir="ltr">→ {CATALOG_ID[candidate]}</span>
          ) : role === "hub" ? (
            t("mapHub")
          ) : (
            t("instrumentRequest")
          )}
        </span>
      </p>
      {role !== "client" ? (
        <p className="netmap-tipline netmap-tipcount">
          <span>{t("mapTotal")}</span>
          <LiveNumber ref={countRef} value={count} mode="tick" className="netmap-tipnum" />
        </p>
      ) : null}
      {candidate && profile ? (
        <>
          {down ? (
            <p className="netmap-tipline netmap-tipwarn">
              <span aria-hidden="true">✕ </span>
              {t("faultProvider")}
            </p>
          ) : null}
          <p
            className={cx("netmap-tipline netmap-tipstate", state !== "closed" && "netmap-tipwarn")}
          >
            <BreakerMark state={state} />
            {t(STATE_KEY[state])}
          </p>
          <p className="netmap-tipline netmap-tipdim">
            {t("resilienceColOpens")}{" "}
            {t("resilienceOpensAfter", { count: fmt.format(profile.opensAfter) })}
          </p>
          <p className="netmap-tipline netmap-tipdim">
            {t("resilienceColProbe")}{" "}
            {t("resilienceProbeAfter", { seconds: fmt.format(profile.resetSeconds) })}
          </p>
        </>
      ) : null}
    </div>
  );
}

/** A small breaker ring, as drawn around the provider cities: dashed ember when open. */
function BreakerMark({ state }: { state: BreakerState }) {
  const open = state === "open";
  return (
    <svg className="netmap-tipring" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle
        cx="7"
        cy="7"
        r="5"
        fill="none"
        stroke={open ? "#ff7a45" : state === "closed" ? "#8c6a1e" : "#ffd36e"}
        strokeWidth="1.6"
        strokeDasharray={open ? "2.2 1.8" : "4.2 1.04"}
      />
      {open ? <path d="M5 5L9 9M9 5L5 9" stroke="#ff7a45" strokeWidth="1.4" /> : null}
    </svg>
  );
}

function profileOf(id: CandidateId): { opensAfter: number; resetSeconds: number } {
  const profile = SAMPLE_CANDIDATES.find((entry) => entry.id === id)?.profile ?? "apikey";
  return PROFILE_LIMITS[profile];
}

const PROFILE_LIMITS = Object.fromEntries(
  BREAKER_PROFILES.map((p) => [p.id, { opensAfter: p.opensAfter, resetSeconds: p.resetSeconds }])
) as Record<(typeof BREAKER_PROFILES)[number]["id"], { opensAfter: number; resetSeconds: number }>;
