"use client";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { BREAKER_PROFILES, type LandingStats } from "../../landingTypes";
import { usePrefersReducedMotion } from "../../landingMotion";
import {
  CANDIDATE_IDS,
  act,
  advanceUntil,
  candidate,
  probeInMs,
  type BreakerState,
  type CandidateId,
  type ProfileId,
  type World,
} from "../../sim/landingSim";
import {
  dispatch,
  getWorld,
  shallowEqual,
  subscribeEvents,
  useDeck,
} from "../../runtime/deckStore";
import { canAnimate, usePaused } from "../../runtime/heartbeat";
import { useCanvasStage } from "../../runtime/useCanvasStage";
import { useDomLoop } from "../../runtime/useDomLoop";
import {
  Glyph,
  LiveNumber,
  Segmented,
  SimBadge,
  Station,
  Toggle,
  type LiveNumberHandle,
} from "../primitives";
import { cx, numberFormat, watchView } from "../primitives/primitiveKit";
import type { StormInput } from "./stormRender";
import {
  AUTOPLAY_COOLOFF_S,
  AUTOPLAY_SPEED,
  FAULT_KEY,
  FAULT_MODEL,
  LATCH_RESOLVE_MAX_MS,
  PROFILE_FOCUS,
  PROFILE_IDS,
  RAIL_COMPACT,
  RAIL_WIDE,
  STATE_KEY,
  STATE_ORDER,
  autoplayMayStart,
  autoplayTargets,
  ceilSeconds,
  createAutoplay,
  latchShown,
  lowestBit,
  meterLevel,
  stepAutoplay,
  tenthSeconds,
  type LatchKind,
  type RailMetrics,
} from "./stormModel";
import "./resilience.css";

/**
 * Station S, 180°: the storm rail (spec §6.6). Fault injection you can feel.
 *
 * The provider's three nested scopes are a horizontal process rail: requests
 * leave the hub (source), cross the provider band in one of three connection
 * lanes (keys #1–#3), pass one of three model gates and reach the upstream.
 * The breaker cells along the band's top edge fill at the shipped threshold
 * of the focused profile (`BREAKER_PROFILES`), and the dashed fallback rail
 * below is the hub retrying the next target in the combo.
 *
 * - DOM frame (server-rendered, always visible): band, lanes, gates, cells,
 *   labels and every state the deck reports, so reduced motion gets a
 *   complete, resolved diagram. The canvas (`stormRender.ts`, loaded on
 *   demand) only adds what moves: comets per request, bolts, rings, sweeps.
 * - Console: the profile picks the candidate (claude, glm, ollama): a
 *   segmented control below 1024px, the defaults table's own rows above it
 *   (the active row is the choice). Three latches act on the page's one deck,
 *   so a fault caused here shows on the hero star and the map road too; DOM
 *   readouts mirror the breaker.
 * - Autoplay: a moment after the rail comes into view, a ×5 time-lapse walks
 *   429 → 401 → 503 and back to CLOSED (`stormModel.ts`). Using a control
 *   stops it for 20 s; scrolling past does not.
 */

type RendererModule = typeof import("./stormRender");

const PROFILE_LABEL: Readonly<
  Record<ProfileId, "resilienceProfileOauth" | "resilienceProfileApiKey" | "resilienceProfileLocal">
> = {
  oauth: "resilienceProfileOauth",
  apikey: "resilienceProfileApiKey",
  local: "resilienceProfileLocal",
};

const PROFILE_OF = new Map(BREAKER_PROFILES.map((p) => [p.id as ProfileId, p]));
const profileOf = (id: ProfileId) => PROFILE_OF.get(id) ?? BREAKER_PROFILES[0];

/** The scopes, outermost first, with their i18n keys. */
const SCOPES = [
  ["provider", "resilienceProvider", "resilienceProviderDesc"],
  ["connection", "resilienceConnection", "resilienceConnectionDesc"],
  ["model", "resilienceModel", "resilienceModelDesc"],
] as const;

/** The provider-level statuses that trip the breaker (`AGENTS.md` → Provider Circuit Breaker). */
const BREAKER_CODES = "408 · 500 · 502 · 503 · 504";

/* ------------------------------------------------------------------------ */
/* Deck selectors (module level, one per candidate: stable identities)     */
/* ------------------------------------------------------------------------ */

/** What the rail frame shows: state flags only, so it re-renders on change, not every tick. */
type RailView = {
  state: BreakerState;
  failures: number;
  down: boolean;
  revoked: number;
  cooling: number;
  limited: number;
  locked: number;
  levels: number;
  speed: number;
};

/** The console's countdowns (≤ 10 Hz while something is counting down). */
type ClockView = { probeS: number; coolKey: number; coolLevel: number; coolTenths: number };

function railView(w: World, id: CandidateId): RailView {
  const c = candidate(w, id);
  let revoked = 0;
  let cooling = 0;
  let limited = 0;
  let locked = 0;
  let levels = 0;
  for (let k = 0; k < c.keys.length; k++) {
    if (c.keys[k].revoked) revoked |= 1 << k;
    if (c.keys[k].coolingUntilMs > w.simMs) cooling |= 1 << k;
    levels += c.keys[k].level * 4 ** k;
  }
  for (let m = 0; m < c.models.length; m++) {
    if (c.models[m].rateLimited) limited |= 1 << m;
    if (c.models[m].lockedUntilMs > w.simMs) locked |= 1 << m;
  }
  return {
    state: c.breaker.state,
    failures: c.breaker.failures,
    down: c.upstreamDown,
    revoked,
    cooling,
    limited,
    locked,
    levels,
    speed: w.speed,
  };
}

function clockView(w: World, id: CandidateId): ClockView {
  const c = candidate(w, id);
  let coolKey = -1;
  let until = 0;
  for (let k = 0; k < c.keys.length; k++) {
    if (c.keys[k].coolingUntilMs > Math.max(w.simMs, until)) {
      coolKey = k;
      until = c.keys[k].coolingUntilMs;
    }
  }
  const probe = probeInMs(w, id);
  return {
    probeS: probe === null ? -1 : ceilSeconds(probe),
    coolKey,
    coolLevel: coolKey >= 0 ? c.keys[coolKey].level : 0,
    coolTenths: coolKey >= 0 ? tenthSeconds(until - w.simMs) : 0,
  };
}

const RAIL_SELECTORS = new Map(
  CANDIDATE_IDS.map((id) => [id, (w: World) => railView(w, id)] as const)
);
const CLOCK_SELECTORS = new Map(
  CANDIDATE_IDS.map((id) => [id, (w: World) => clockView(w, id)] as const)
);
const selectRail = (id: CandidateId) => RAIL_SELECTORS.get(id) ?? ((w: World) => railView(w, id));
const selectClock = (id: CandidateId) =>
  CLOCK_SELECTORS.get(id) ?? ((w: World) => clockView(w, id));

const FOCUS_IDS = PROFILE_IDS.map((p) => PROFILE_FOCUS[p]);

/** Every breaker the rail can show is CLOSED. */
function allClosed(w: World): boolean {
  for (const id of FOCUS_IDS) if (candidate(w, id).breaker.state !== "closed") return false;
  return true;
}

/** Any fault latched on one of the rail's three candidates (autoplay never runs over a visitor's fault). */
function anyLatch(w: World): boolean {
  for (const id of FOCUS_IDS) {
    const c = candidate(w, id);
    if (c.upstreamDown) return true;
    for (const k of c.keys) if (k.revoked) return true;
    for (const m of c.models) if (m.rateLimited) return true;
  }
  return false;
}

/* ------------------------------------------------------------------------ */
/* Static fans (SVG): fixed-size, anchored to the band's start or end       */
/* ------------------------------------------------------------------------ */

function laneMid(m: RailMetrics, k: number) {
  return m.laneTop[k] + m.laneH / 2;
}
function slotMid(m: RailMetrics, k: number, s: number) {
  return m.laneTop[k] + s * (m.slotH + m.slotGap) + m.slotH / 2;
}

function FanIn({ m, className }: { m: RailMetrics; className: string }) {
  const width = m.laneX0 - m.bandX0;
  return (
    <svg
      className={cx("res-fan res-fan-in", className)}
      width={width}
      height={m.h}
      viewBox={`0 0 ${width} ${m.h}`}
      aria-hidden="true"
      focusable="false"
    >
      {[0, 1, 2].map((k) => (
        <line key={k} x1={0} y1={m.mid} x2={width} y2={laneMid(m, k)} />
      ))}
    </svg>
  );
}

function FanOut({ m, className }: { m: RailMetrics; className: string }) {
  const width = m.gateOff + m.fanW;
  const lines: ReactNode[] = [];
  for (let k = 0; k < 3; k++) {
    for (let s = 0; s < 3; s++) {
      const y = slotMid(m, k, s);
      lines.push(<line key={`a${k}${s}`} x1={0} y1={laneMid(m, k)} x2={m.fanW} y2={y} />);
      lines.push(
        <line
          key={`b${k}${s}`}
          x1={m.fanW + m.gateW}
          y1={y}
          x2={width}
          y2={m.mid}
          className="res-fan-exit"
        />
      );
    }
  }
  return (
    <svg
      className={cx("res-fan res-fan-out", className)}
      width={width}
      height={m.h}
      viewBox={`0 0 ${width} ${m.h}`}
      aria-hidden="true"
      focusable="false"
    >
      {lines}
    </svg>
  );
}

/** Wrap the first occurrence of a formatted number in a translated string, for emphasis. */
function emphasize(text: string, value: string): ReactNode {
  const at = value ? text.indexOf(value) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="res-n">{value}</span>
      {text.slice(at + value.length)}
    </>
  );
}

/**
 * A formatted duration with its number in the readout face and its unit in the
 * text face ("27" + "s", "۲۷" + " ثانیه"): a mono font has no Persian joins,
 * and a smaller unit reads better beside a big number.
 */
function Seconds({ text, num, className }: { text: string; num: string; className?: string }) {
  const at = num ? text.indexOf(num) : -1;
  if (at < 0) return <span className={className}>{text}</span>;
  const before = text.slice(0, at);
  const after = text.slice(at + num.length);
  return (
    <span className={className}>
      {before ? <span className="res-unit">{before}</span> : null}
      <span className="res-sec">{num}</span>
      {after ? <span className="res-unit">{after}</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Served counter                                                           */
/* ------------------------------------------------------------------------ */

const SERVED_SELECTORS = new Map(
  CANDIDATE_IDS.map((id) => [id, (w: World) => candidate(w, id).served] as const)
);
const selectNothing = () => 0;

/**
 * Requests the focused provider served (simulated, this visit), captioned with
 * the provider so a profile switch reads as another counter, not a reset.
 * Ticked from the dom lane while motion runs; under reduced motion the deck
 * only moves on a latch change, so the value comes from a deck selection.
 */
function ServedCount({ focus, reduced }: { focus: CandidateId; reduced: boolean }) {
  const ref = useRef<LiveNumberHandle>(null);
  const hostRef = useRef<HTMLSpanElement>(null);
  const settled = useDeck(reduced ? (SERVED_SELECTORS.get(focus) ?? selectNothing) : selectNothing);
  useDomLoop("resilience-served", () => ref.current?.set(candidate(getWorld(), focus).served), {
    target: hostRef,
    enabled: !reduced,
  });
  return (
    <span ref={hostRef} className="res-served">
      <span className="res-served-id readout">{focus}</span>
      <LiveNumber ref={ref} value={settled} mode="tick" className="res-served-n readout" />
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Station                                                                  */
/* ------------------------------------------------------------------------ */

export default function ResilienceStation({ stats }: { stats: LandingStats }) {
  void stats;
  const t = useTranslations("landing");
  const locale = useLocale();
  const rtl = locale === "fa";
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const fmt = useMemo(() => numberFormat(locale), [locale]);
  // Persian reads "۵ ثانیه"; the narrow unit would mix scripts ("۵s").
  const unitDisplay = locale === "fa" ? "short" : "narrow";
  const secFmt = useMemo(
    () => numberFormat(locale, { style: "unit", unit: "second", unitDisplay }),
    [locale, unitDisplay]
  );
  const tenthFmt = useMemo(
    () =>
      numberFormat(locale, {
        style: "unit",
        unit: "second",
        unitDisplay,
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [locale, unitDisplay]
  );
  const tenthNum = useMemo(
    () => numberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [locale]
  );
  const radioName = useId();
  const defaultsId = useId();
  const scopesId = useId();

  const [profile, setProfile] = useState<ProfileId>("oauth");
  const focus = PROFILE_FOCUS[profile];
  const spec = profileOf(profile);
  const view = useDeck(selectRail(focus), shallowEqual);
  const clock = useDeck(selectClock(focus), shallowEqual);

  const railRef = useRef<HTMLElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const ignoredRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [inView, setInView] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [staticIgnored, setStaticIgnored] = useState(-1);
  /** Phone: which fold under the console is open (the defaults table or the scope descriptions). */
  const [fold, setFold] = useState<"defaults" | "scopes" | null>(null);
  const toggleFold = (next: "defaults" | "scopes") =>
    setFold((open) => (open === next ? null : next));

  /* ---- renderer: loaded near the viewport, never under reduced motion ---- */
  const [renderer, setRenderer] = useState<RendererModule | null>(null);
  const input = useRef<StormInput>({ focus, rtl, flash: null, rail: null });
  useEffect(() => {
    input.current.focus = focus;
    input.current.rtl = rtl;
    input.current.flash = flashRef.current;
    input.current.rail = railRef.current;
  }, [focus, rtl]);

  useEffect(() => {
    if (reduced) return;
    const node = railRef.current;
    if (!node) return;
    let cancelled = false;
    let started = false;
    const load = () => {
      if (started) return;
      started = true;
      import("./stormRender")
        .then((mod) => {
          if (!cancelled) setRenderer(mod);
        })
        .catch((error: unknown) => {
          // The DOM rail stays: it is complete without the canvas.
          console.error("[landing] storm rail renderer failed to load", error);
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

  const { wrapRef, canvasRef } = useCanvasStage({
    id: "storm-rail",
    priority: 1,
    enabled: renderer !== null,
    setup: (ctx, s) => renderer?.setup(ctx, s, input.current),
    draw: (ctx, s, dt, now) => renderer?.draw(ctx, s, dt, now, input.current),
  });

  /*
   * ---- power-on: armed below the fold, lit when the rail scrolls in ----
   * A pure presentation attribute, written straight to the DOM (React never
   * renders it): the server HTML shows the rail fully drawn.
   */
  useEffect(() => {
    const node = railRef.current;
    if (!node) return;
    if (reduced) {
      node.removeAttribute("data-power");
    } else if (node.getBoundingClientRect().top > window.innerHeight) {
      node.setAttribute("data-power", "armed");
    }
    return watchView(node, {
      onEnter: () => {
        if (node.hasAttribute("data-power")) node.setAttribute("data-power", "on");
        setInView(true);
      },
      onExit: () => setInView(false),
      enterThreshold: 0.15,
    });
  }, [reduced]);

  /* ---- events: the ignored flash, and polite announcements of visitor-caused changes ---- */
  const lastAnnounce = useRef(0);
  useEffect(() => {
    return subscribeEvents((event, meta) => {
      if (event.kind === "routed" || event.kind === "dropped") return;
      if (event.id !== input.current.focus) return;
      if (event.kind === "ignored") {
        if (!canAnimate()) {
          setStaticIgnored(event.key);
          return;
        }
        const el = ignoredRefs.current[event.key];
        if (el && typeof el.animate === "function") {
          el.animate(
            [
              { opacity: 0, transform: "translateY(3px)" },
              { opacity: 1, transform: "none", offset: 0.15 },
              { opacity: 1, transform: "none", offset: 0.75 },
              { opacity: 0, transform: "none" },
            ],
            { duration: 600, easing: "linear" }
          );
        }
        return;
      }
      if (!meta.user || event.kind !== "breaker") return;
      const now = performance.now();
      if (now - lastAnnounce.current < 800) return;
      lastAnnounce.current = now;
      setAnnouncement(`${event.id} · ${t(STATE_KEY[event.state])}`);
    });
  }, [t]);

  /* ---- autoplay ---- */
  const auto = useRef({
    running: false,
    st: createAutoplay(),
    idle: 0,
    sinceInput: AUTOPLAY_COOLOFF_S,
    ownSpeed: false,
    latched: null as CandidateId | null,
  });
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const clearAutoLatches = useCallback(() => {
    const a = auto.current;
    const id = a.latched;
    if (!id) return;
    a.latched = null;
    const c = candidate(getWorld(), id);
    if (c.models[FAULT_MODEL]?.rateLimited)
      dispatch(act.setModelRateLimited(id, FAULT_MODEL, false));
    if (c.keys[FAULT_KEY]?.revoked) dispatch(act.setKeyRevoked(id, FAULT_KEY, false));
    if (c.upstreamDown) dispatch(act.setUpstreamDown(id, false));
  }, []);

  /**
   * The rail engages a ×5 time-lapse (badge shown) for autoplay and while a
   * visitor's fault from this console plays out: at the real pace the focused
   * provider sees about one request every two seconds, so a breaker would
   * take ten seconds to trip. It is handed back (×1) once everything here is
   * healthy again, or when the rail leaves the screen. The rail only takes the
   * speed from ×1 and gives up its claim as soon as anyone else changes the
   * speed (the dock), so a visitor's pick is never undone.
   */
  const boostSpeed = useCallback(() => {
    if (!canAnimate() || getWorld().speed !== 1) return;
    dispatch(act.setSpeed(AUTOPLAY_SPEED));
    auto.current.ownSpeed = true;
  }, []);
  const restoreSpeed = useCallback(() => {
    const a = auto.current;
    if (a.ownSpeed && getWorld().speed === AUTOPLAY_SPEED) dispatch(act.setSpeed(1));
    a.ownSpeed = false;
  }, []);

  const stopAutoplay = useCallback(() => {
    const a = auto.current;
    a.idle = 0;
    if (!a.running) return;
    a.running = false;
    clearAutoLatches();
    restoreSpeed();
  }, [clearAutoLatches, restoreSpeed]);

  /** A visitor used a control: autoplay stops and stays off for the cool-off. */
  const noteInput = useCallback(() => {
    auto.current.sinceInput = 0;
    stopAutoplay();
  }, [stopAutoplay]);

  useEffect(() => {
    if (inView && !reduced && !paused) return;
    stopAutoplay();
    restoreSpeed();
  }, [inView, reduced, paused, stopAutoplay, restoreSpeed]);
  useEffect(
    () => () => {
      stopAutoplay();
      restoreSpeed();
    },
    [stopAutoplay, restoreSpeed]
  );

  useDomLoop(
    "resilience-autoplay",
    (dt) => {
      const a = auto.current;
      const w = getWorld();
      // Someone else (the dock) changed the speed: it is theirs now.
      if (a.ownSpeed && w.speed !== AUTOPLAY_SPEED) a.ownSpeed = false;
      if (!a.running) {
        a.idle += dt;
        a.sinceInput += dt;
        const latched = anyLatch(w);
        // A visitor's storm has blown over: hand the speed back.
        if (a.ownSpeed && !latched && allClosed(w)) restoreSpeed();
        if (!autoplayMayStart(a.idle, a.sinceInput, latched)) return;
        a.running = true;
        a.st = createAutoplay();
        boostSpeed();
      }
      const before = a.st.phase;
      const focusNow = PROFILE_FOCUS[autoplayTargets(before).profile];
      stepAutoplay(a.st, dt, candidate(w, focusNow).breaker.state);
      const want = autoplayTargets(a.st.phase);
      if (want.profile !== profileRef.current) {
        clearAutoLatches();
        profileRef.current = want.profile;
        setProfile(want.profile);
      }
      const id = PROFILE_FOCUS[want.profile];
      const c = candidate(w, id);
      if (want.model || want.key || want.provider) a.latched = id;
      if (c.models[FAULT_MODEL].rateLimited !== want.model) {
        dispatch(act.setModelRateLimited(id, FAULT_MODEL, want.model));
      }
      if (c.keys[FAULT_KEY].revoked !== want.key) {
        dispatch(act.setKeyRevoked(id, FAULT_KEY, want.key));
      }
      if (c.upstreamDown !== want.provider) dispatch(act.setUpstreamDown(id, want.provider));
    },
    { enabled: inView && !reduced && !paused }
  );

  /* ---- visitor controls (each one counts as input: touch scrolling does not) ---- */
  const chooseProfile = (next: string) => {
    if (next !== "oauth" && next !== "apikey" && next !== "local") return;
    noteInput();
    setStaticIgnored(-1);
    setProfile(next);
  };
  const setFault = (kind: LatchKind, on: boolean) => {
    noteInput();
    setStaticIgnored(-1);
    if (on) boostSpeed();
    const id = focus;
    if (kind === "model") dispatch(act.setModelRateLimited(id, FAULT_MODEL, on), { user: true });
    else if (kind === "key") dispatch(act.setKeyRevoked(id, FAULT_KEY, on), { user: true });
    else dispatch(act.setUpstreamDown(id, on), { user: true });
    // Reduced motion or Pause: nothing steps on its own, and `dispatch` only
    // settles the breaker. A lock or cooldown needs a request on that model or
    // key, so run the deck on until the result (or its lapse) shows.
    if (!canAnimate() && kind !== "provider" && !latchShown(getWorld(), id, kind, on)) {
      dispatch((w: World) => {
        advanceUntil(w, (x) => latchShown(x, id, kind, on), LATCH_RESOLVE_MAX_MS);
      });
    }
  };

  /* ---- derived ---- */
  const opensAfter = spec.opensAfter;
  const degradesAfter = spec.degradesAfter;
  const filled = Math.min(view.failures, opensAfter);
  const meter = meterLevel(view.failures, view.state, degradesAfter, opensAfter);
  const modelLatched = (view.limited & (1 << FAULT_MODEL)) !== 0;
  const keyLatched = (view.revoked & (1 << FAULT_KEY)) !== 0;
  const lapse = view.speed > 1 ? t("simTimelapse", { factor: fmt.format(view.speed) }) : null;
  const level = (k: number) => Math.floor(view.levels / 4 ** k) % 4;
  const lockedModel = view.locked & (1 << FAULT_MODEL) ? FAULT_MODEL : lowestBit(view.locked);
  const keyTag = (k: number) => `#${fmt.format(k + 1)}`;
  const opensText = (n: number) => t("resilienceOpensAfter", { count: fmt.format(n) });

  const keyStatus =
    clock.coolKey >= 0 ? (
      <>
        <span className="readout">{keyTag(clock.coolKey)}</span>
        {" · "}
        {t("stateCooling", { n: fmt.format(clock.coolLevel) })}
        {" · "}
        <Seconds
          className="res-num"
          text={tenthFmt.format(clock.coolTenths)}
          num={tenthNum.format(clock.coolTenths)}
        />
      </>
    ) : (
      <span className="readout">{keyTag(FAULT_KEY)}</span>
    );
  const modelStatus = (
    <>
      {t("resilienceModel")}{" "}
      <span className="readout">
        {fmt.format((lockedModel >= 0 ? lockedModel : FAULT_MODEL) + 1)}
      </span>
      {lockedModel >= 0 ? (
        <>
          {" · "}
          {t("stateLocked")}
        </>
      ) : null}
    </>
  );

  const latches: {
    kind: LatchKind;
    scope: "resilienceModel" | "resilienceConnection" | "resilienceProvider";
    label: "faultModel" | "faultKey" | "faultProvider";
    pressed: boolean;
    alert: boolean;
    status: ReactNode;
  }[] = [
    {
      kind: "model",
      scope: "resilienceModel",
      label: "faultModel",
      pressed: modelLatched,
      alert: lockedModel >= 0,
      status: modelStatus,
    },
    {
      kind: "key",
      scope: "resilienceConnection",
      label: "faultKey",
      pressed: keyLatched,
      alert: clock.coolKey >= 0,
      status: keyStatus,
    },
    {
      kind: "provider",
      scope: "resilienceProvider",
      label: "faultProvider",
      pressed: view.down,
      alert: view.state !== "closed",
      status: (
        <>
          <span className="readout">{focus}</span>
          {" · "}
          {t(STATE_KEY[view.state])}
        </>
      ),
    },
  ];

  return (
    <Station
      id="resilience"
      className="res-station"
      title={t("resilienceTitle")}
      lead={t("resilienceLead")}
    >
      <div className="station-inner res-body">
        {/* ---------------- the rail ---------------- */}
        <figure
          ref={railRef}
          className="res-rail"
          aria-label={t("resilienceDiagramAria")}
          data-state={view.state}
          data-profile={profile}
          data-rtl={rtl ? "" : undefined}
          data-padlock="0"
        >
          <div ref={wrapRef} className="stage res-stage" aria-hidden="true">
            <div className="res-frame">
              <span className="res-line res-arrive" />
              <span className="res-line res-entry" />
              <span className="res-src">
                <span className="res-src-core" />
              </span>
              <span className="res-drop" />
              <span className="res-fb" />
              <span className="res-fb-tip">
                <Glyph name="chevron" size={16} />
              </span>
              <span className="res-band">
                <span className="res-band-shade" />
                <span className="res-band-breathe" />
                <span className="res-band-alarm" />
                <span className="res-band-trace" data-edge="top" />
                <span className="res-band-trace" data-edge="bottom" />
              </span>
              {[0, 1, 2].map((k) => (
                <span
                  key={k}
                  className="res-lane"
                  data-cool={view.cooling & (1 << k) ? "" : undefined}
                  style={{ "--k": k } as CSSProperties}
                >
                  <span className="res-lane-line" />
                </span>
              ))}
              <FanIn m={RAIL_WIDE} className="res-wide" />
              <FanIn m={RAIL_COMPACT} className="res-compact" />
              <FanOut m={RAIL_WIDE} className="res-wide" />
              <FanOut m={RAIL_COMPACT} className="res-compact" />
              {[0, 1, 2].map((k) => (
                <span
                  key={k}
                  className="res-gates"
                  data-k={k}
                  style={{ "--k": k } as CSSProperties}
                >
                  {[0, 1, 2].map((s) => (
                    <span
                      key={s}
                      className="res-slot"
                      data-locked={view.locked & (1 << s) ? "" : undefined}
                    >
                      <Glyph name="lock" size={16} className="res-lock" />
                    </span>
                  ))}
                </span>
              ))}
              <span className="res-line res-exit" />
              <span className="res-up">
                <Glyph name="check" size={16} />
              </span>
              <span className="res-barrier">
                <Glyph name="close" size={16} />
              </span>
            </div>
            <canvas ref={canvasRef} aria-hidden="true" />
            <div className="res-overlay">
              <span className="res-tag res-tag-provider">{t("resilienceProvider")}</span>
              <span className="res-cells">
                {Array.from({ length: opensAfter }, (_, i) => (
                  <span
                    key={`${profile}-${i}`}
                    className="res-cell"
                    data-on={i < filled ? "" : undefined}
                    data-hot={degradesAfter !== null && i >= degradesAfter - 1 ? "" : undefined}
                    data-trip={i === opensAfter - 1 ? "" : undefined}
                    style={{ "--i": i } as CSSProperties}
                  />
                ))}
              </span>
              {[0, 1, 2].map((k) => (
                <span
                  key={k}
                  className="res-lane-tag readout"
                  data-cool={view.cooling & (1 << k) ? "" : undefined}
                  data-revoked={view.revoked & (1 << k) ? "" : undefined}
                  style={{ "--k": k } as CSSProperties}
                >
                  {keyTag(k)}
                </span>
              ))}
              {[0, 1, 2].map((k) => (
                <span
                  key={k}
                  className="res-lane-note"
                  style={{ "--k": k } as CSSProperties}
                  data-on={view.cooling & (1 << k) ? "" : undefined}
                >
                  {t("stateCooling", { n: fmt.format(Math.max(1, level(k))) })}
                </span>
              ))}
              {[0, 1, 2].map((k) => (
                <span
                  key={k}
                  ref={(node) => {
                    ignoredRefs.current[k] = node;
                  }}
                  className="res-lane-ignored"
                  data-static={staticIgnored === k ? "" : undefined}
                  style={{ "--k": k } as CSSProperties}
                >
                  {t("stateIgnored")}
                </span>
              ))}
              <span className="res-tag res-tag-connection">{t("resilienceConnection")}</span>
              <span className="res-tag res-tag-model">{t("resilienceModel")}</span>
              <ServedCount focus={focus} reduced={reduced} />
              <span className="res-tag res-tag-next">{t("resilienceNextTarget")}</span>
            </div>
            <div ref={flashRef} className="res-flash" />
          </div>
          {/* Over the stage's top edge, outside its aria-hidden subtree. */}
          <div className="res-rail-head">
            <SimBadge />
            {lapse ? <span className="res-lapse readout">{lapse}</span> : null}
          </div>
          {/* The compact rail has no room up there: its time-lapse chip sits under the fallback rail. */}
          {lapse ? (
            <span className="res-lapse res-lapse-low readout" aria-hidden="true">
              {lapse}
            </span>
          ) : null}
        </figure>

        {/* ---------------- scopes, under the rail (≥ 640px) ---------------- */}
        <dl className="res-scopes">
          {SCOPES.map(([scope, name, desc]) => (
            <div key={scope} className="res-scope" data-scope={scope}>
              <dt className="res-scope-name">
                <span>{t(name)}</span>
                {scope === "provider" ? (
                  <span className="res-codes readout" dir="ltr">
                    {BREAKER_CODES}
                  </span>
                ) : null}
              </dt>
              <dd className="res-scope-desc">{t(desc)}</dd>
            </div>
          ))}
        </dl>

        {/* ---------------- console ---------------- */}
        <div className="res-console panel bracketed">
          {/* Profile, below 1024px: the segmented control. */}
          <div className="res-col res-col-profile">
            <p className="res-col-title" id={`${radioName}-label`}>
              {t("resilienceColProfile")}
            </p>
            <Segmented
              className="res-profile"
              aria-labelledby={`${radioName}-label`}
              value={profile}
              onChange={chooseProfile}
              options={PROFILE_IDS.map((id) => ({
                id,
                label: (
                  <span className="res-opt">
                    <span className="res-opt-name">{t(PROFILE_LABEL[id])}</span>
                    <span className="sr-only"> · </span>
                    <span className="res-opt-id readout">{PROFILE_FOCUS[id]}</span>
                  </span>
                ),
              }))}
            />
          </div>

          {/*
            Breaker defaults. From 1024px its rows are the profile choice (a
            radio per row, the active row lit); on a phone it folds away under
            the console (it holds nothing focusable there, so the tab order
            still follows the page).
          */}
          <div
            id={`${defaultsId}-panel`}
            className="res-col res-col-defaults"
            data-open={fold === "defaults" ? "" : undefined}
          >
            <h3 className="res-defaults-title" id={`${defaultsId}-title`}>
              {t("resilienceDefaultsTitle")}
            </h3>
            <div className="res-defaults-panel">
              <table className="res-table" aria-labelledby={`${defaultsId}-title`}>
                <thead>
                  <tr>
                    <th scope="col">{t("resilienceColProfile")}</th>
                    <th scope="col">{t("resilienceColDegrades")}</th>
                    <th scope="col">{t("resilienceColOpens")}</th>
                    <th scope="col">{t("resilienceColProbe")}</th>
                    <th scope="col">{t("resilienceColCooldown")}</th>
                  </tr>
                </thead>
                <tbody>
                  {BREAKER_PROFILES.map((p) => {
                    const id = p.id as ProfileId;
                    return (
                      <tr key={id} data-active={id === profile ? "" : undefined}>
                        <th scope="row">
                          <label className="res-pick">
                            <input
                              type="radio"
                              className="res-radio"
                              name={radioName}
                              value={id}
                              checked={id === profile}
                              onChange={() => chooseProfile(id)}
                            />
                            <span className="res-pick-name">{t(PROFILE_LABEL[id])}</span>
                            <span className="sr-only"> · </span>
                            <span className="res-pick-id readout">{PROFILE_FOCUS[id]}</span>
                          </label>
                        </th>
                        <td>
                          {p.degradesAfter === null
                            ? "—"
                            : emphasize(opensText(p.degradesAfter), fmt.format(p.degradesAfter))}
                        </td>
                        <td>{emphasize(opensText(p.opensAfter), fmt.format(p.opensAfter))}</td>
                        <td>
                          {emphasize(
                            t("resilienceProbeAfter", { seconds: fmt.format(p.resetSeconds) }),
                            fmt.format(p.resetSeconds)
                          )}
                        </td>
                        <td>
                          {emphasize(
                            secFmt.format(p.cooldownBaseMs / 1000),
                            fmt.format(p.cooldownBaseMs / 1000)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="res-note">{t("resilienceDefaultsNote")}</p>
            </div>
          </div>

          <div className="res-col res-col-faults">
            <ul className="res-latches">
              {latches.map((latch) => (
                <li key={latch.kind} className="res-latch" data-scope={latch.kind}>
                  <span className="res-latch-scope">{t(latch.scope)}</span>
                  <Toggle
                    pressed={latch.pressed}
                    onChange={(on) => setFault(latch.kind, on)}
                    label={t(latch.label)}
                  />
                  <span className="res-status" data-alert={latch.alert ? "" : undefined}>
                    {latch.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="res-col res-col-breaker">
            <p className="res-col-title">
              {t("resilienceProvider")} · <span className="res-col-id readout">{focus}</span>
            </p>
            <div className="res-breaker">
              <ul className="res-ann">
                {STATE_ORDER.map((s) => {
                  const none = s === "degraded" && degradesAfter === null;
                  const on = !none && view.state === s;
                  return (
                    <li
                      key={s}
                      className="res-ann-tile"
                      data-state={s}
                      data-on={on ? "" : undefined}
                      data-none={none ? "" : undefined}
                      aria-current={on ? "true" : undefined}
                    >
                      <span className="res-led" aria-hidden="true" />
                      {none ? (
                        <>
                          <span className="res-ann-label" aria-hidden="true">
                            —
                          </span>
                          <span className="sr-only">{t(STATE_KEY[s])} —</span>
                        </>
                      ) : (
                        <span className="res-ann-label">{t(STATE_KEY[s])}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="res-gauge res-gauge-meter">
                <p className="res-meter readout" data-level={meter}>
                  <span className="res-meter-v" dir="ltr">
                    <span className="res-meter-n">{fmt.format(filled)}</span>
                    <span className="res-meter-of"> / {fmt.format(opensAfter)}</span>
                  </span>
                </p>
                <span className="res-mini" aria-hidden="true">
                  {Array.from({ length: opensAfter }, (_, i) => (
                    <span
                      key={`${profile}-${i}`}
                      data-on={i < filled ? "" : undefined}
                      data-hot={degradesAfter !== null && i >= degradesAfter - 1 ? "" : undefined}
                    />
                  ))}
                </span>
                <p className="res-caption">{opensText(opensAfter)}</p>
              </div>
              <div className="res-gauge res-gauge-probe">
                <p className="res-probe readout" data-idle={clock.probeS < 0 ? "" : undefined}>
                  {clock.probeS >= 0 ? (
                    <Seconds text={secFmt.format(clock.probeS)} num={fmt.format(clock.probeS)} />
                  ) : (
                    "—"
                  )}
                </p>
                <p className="res-caption">{t("resilienceColProbe")}</p>
              </div>
              {lapse ? <span className="res-lapse res-breaker-lapse readout">{lapse}</span> : null}
            </div>
            <p className="sr-only" role="status" aria-live="polite">
              {announcement}
            </p>
          </div>

          {/* Phone: two folds under the console, the defaults table and the scope descriptions. */}
          <div className="res-col res-folds">
            <button
              type="button"
              className="res-disclose"
              aria-expanded={fold === "defaults"}
              aria-controls={`${defaultsId}-panel`}
              onClick={() => toggleFold("defaults")}
            >
              <span>{t("resilienceDefaultsTitle")}</span>
              <Glyph name="chevron" size={16} className="res-disclose-chev" />
            </button>
            <button
              type="button"
              className="res-disclose"
              aria-expanded={fold === "scopes"}
              aria-controls={scopesId}
              onClick={() => toggleFold("scopes")}
            >
              <span>
                {t("resilienceProvider")} · {t("resilienceConnection")} · {t("resilienceModel")}
              </span>
              <Glyph name="chevron" size={16} className="res-disclose-chev" />
            </button>
          </div>
          <dl
            id={scopesId}
            className="res-col res-scope-dl"
            data-open={fold === "scopes" ? "" : undefined}
          >
            {SCOPES.map(([scope, name, desc]) => (
              <div key={scope} className="res-scope-item">
                <dt className="res-scope-name">
                  <span>{t(name)}</span>
                  {scope === "provider" ? (
                    <span className="res-codes readout" dir="ltr">
                      {BREAKER_CODES}
                    </span>
                  ) : null}
                </dt>
                <dd className="res-scope-desc">{t(desc)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Station>
  );
}
