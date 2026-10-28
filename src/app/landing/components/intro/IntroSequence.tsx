"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CITIES } from "../../landingGeometry";
import { DEFAULT_PORT, SAMPLE_CANDIDATES, type LandingStats } from "../../landingTypes";
import { canAnimate, getQualityTier, register } from "../../runtime/heartbeat";
import { getStageDpr } from "../../runtime/useCanvasStage";
import { getWorld } from "../../runtime/deckStore";
import { INTRO_NEEDLE, stepSpring } from "../../runtime/springs";
import Glyph from "../primitives/Glyph";
import LiveNumber from "../primitives/LiveNumber";
import { INTRO_HANDOFF_EVENT, numberFormat } from "../primitives/primitiveKit";
import {
  CAND_CLOSED,
  CAND_DEGRADED,
  CAND_HALF_OPEN,
  CAND_OPEN,
  DEG,
  GYRO_BEZEL_RATE_DEG,
  GYRO_F,
  GYRO_R_RATIO,
  GYRO_YAW_RATE_DEG,
  createGyroScene,
  gyroPitch,
  gyroState,
  horizonBackY,
  horizonFrontY,
  resetLook,
  setFactorWeights,
} from "../hero/gyro";
import { INTRO_GATE_TIMER, INTRO_STORAGE_KEY } from "./introGate";
import {
  BOOT_COMMAND,
  INTRO_T,
  NEEDLE_SPIN,
  buildIntroLayout,
  cityLabel,
  createScalars,
  introScalars,
  needleSpinAt,
  skipTo,
} from "./introTimeline";
import { aimIntroGyro, createIntroCanvas, renderIntro, type IntroCanvas } from "./introRender";
import "./intro.css";

/**
 * "Landfall", the first-visit intro (spec §5): stars fall into the gold
 * dot-matrix Afghanistan, Kabul fires its routes, and the map winds itself
 * into the hero's gyro-compass, whose needle locks north before the curtain
 * lifts over the live page.
 *
 * - Plays only when the inline gate (`introGate.ts`) set `data-intro="play"`
 *   before first paint. Everything is server-rendered (the layers are
 *   `display: none` without the gate) and the hero underneath is complete.
 * - One canvas on the heartbeat's canvas lane (top priority while it runs),
 *   a closed-form timeline, and the hero's own `drawGyro` for the last
 *   quarter second, so the hand-off is seamless.
 * - Skippable by any input; a 4s failsafe forces the end; a slow device skips
 *   to the hand-off (the median of 10 frame intervals over 34ms, sampled
 *   after the first 3, which carry hydration's one-off stalls).
 * - A late mount (slow network: the visitor has already waited behind the
 *   curtain) starts at the transmutation, or at the hand-off when very late.
 * - 2350–2600ms: the bridge rises above the intro layers and its overlays
 *   fade in with the curtain's lift (`data-handoff`, `--handoff` on
 *   `#bridge`); the intro canvas keeps only its lock effects underneath.
 * - At 2600ms: `data-intro="done"` and `pusula:intro-handoff`, then the
 *   layers unmount (the attribute store below re-renders to nothing).
 */

const CANDIDATE_IDS: readonly string[] = SAMPLE_CANDIDATES.map((c) => c.catalogId);
const STATE_CODE = {
  closed: CAND_CLOSED,
  degraded: CAND_DEGRADED,
  open: CAND_OPEN,
  halfOpen: CAND_HALF_OPEN,
};
/**
 * Mounts this late (ms after navigation start) mean the visitor already
 * waited behind the curtain: the first shortens the intro to its last act
 * (the map winding into the compass), the second goes straight to the
 * hand-off.
 */
const LATE_MOUNT_MS = 2400;
const VERY_LATE_MOUNT_MS = 3800;
/** Frame intervals ignored before sampling (hydration and first-paint stalls). */
const SAFETY_WARMUP = 3;
const SAFETY_FRAMES = 10;
const SAFETY_MEDIAN_MS = 34;

/* `html[data-intro]` as an external store: the layers exist only while it reads "play". */
function subscribeIntro(onChange: () => void): () => void {
  if (typeof MutationObserver === "undefined") return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-intro"] });
  return () => observer.disconnect();
}
const readIntro = () => document.documentElement.getAttribute("data-intro") ?? "";
const serverIntro = () => "ssr";

const CARDINALS = ["N", "E", "S", "W"] as const;

export default function IntroSequence({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const fmt = useMemo(() => numberFormat(locale), [locale]);
  const intro = useSyncExternalStore(subscribeIntro, readIntro, serverIntro);
  const [boot, setBoot] = useState(0);

  const curtainRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLParagraphElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const cmdRef = useRef<HTMLSpanElement>(null);
  const runningRef = useRef<HTMLParagraphElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const cityRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const cardRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const emberRef = useRef<HTMLElement | null>(null);
  const skipNow = useRef<() => void>(() => {});
  const mountedRef = useRef(false);

  const bootLines = [
    { value: stats.providers, label: t("statProviders") },
    { value: stats.freeProviders, label: t("statFree") },
    { value: stats.strategies.length, label: t("statStrategies") },
    { value: stats.scoringFactors.length, label: t("boardFactors") },
    { value: stats.cliTools.length, label: t("statTools") },
    { value: stats.mcpTools, label: t("boardMcpTools") },
  ];

  // Leaving the page (client navigation) must not leave the gate attribute behind.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.setTimeout(() => {
        if (!mountedRef.current) document.documentElement.removeAttribute("data-intro");
      }, 0);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-intro") !== "play") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    const win = window as unknown as Record<string, number | undefined>;
    // The intro runs now: the gate's own failsafe stands down.
    if (win[INTRO_GATE_TIMER] !== undefined) window.clearTimeout(win[INTRO_GATE_TIMER]);
    try {
      sessionStorage.setItem(INTRO_STORAGE_KEY, "1");
    } catch {
      // Storage blocked: the intro may play again next visit; harmless.
    }
    // Restart the CSS failsafe from now (the JS one below is the primary guard).
    for (const el of [curtainRef.current, canvas, hudRef.current, skipRef.current]) {
      el?.setAttribute("data-armed", "");
    }

    let done = false;
    let unregister: (() => void) | null = null;
    const bridge = document.getElementById("bridge");
    let handoffShown = -1;
    const clearHandoff = () => {
      bridge?.removeAttribute("data-handoff");
      bridge?.style.removeProperty("--handoff");
    };
    let failsafe = 0;
    const listeners: (() => void)[] = [];

    const finish = (converged: boolean) => {
      if (done) return;
      done = true;
      unregister?.();
      unregister = null;
      window.clearTimeout(failsafe);
      for (const off of listeners) off();
      gyroState.driver = "hero";
      gyroState.introT = Infinity;
      clearHandoff();
      if (!converged) {
        // Never reached the lock: the hero simply shows its winner.
        gyroState.needleMode = "route";
        gyroState.needle.angle = 0;
        gyroState.needle.velocity = 0;
      }
      root.setAttribute("data-intro", "done");
      window.dispatchEvent(new Event(INTRO_HANDOFF_EVENT));
    };

    if (!ctx || !canvas || !canAnimate()) {
      finish(false);
      return;
    }

    const scene = createGyroScene(stats.catalog, CANDIDATE_IDS);
    let view: IntroCanvas | null = null;

    const measure = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      const dpr = getStageDpr();
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const dialEl = document.querySelector<HTMLElement>("[data-hero-dial]");
      const rect = dialEl?.getBoundingClientRect();
      const side = rect && rect.width > 0 ? rect.width : Math.min(w, h) * 0.8;
      const geom = {
        cx: rect && rect.width > 0 ? rect.left + rect.width / 2 : w / 2,
        cy: rect && rect.width > 0 ? rect.top + rect.height / 2 : h / 2,
        R: side * GYRO_R_RATIO,
      };
      const skyEl = dialEl?.parentElement?.querySelector<HTMLElement>(".bridge-stage");
      const skyRect = skyEl?.getBoundingClientRect();
      const sky = skyRect
        ? { x: skyRect.left, y: skyRect.top, w: skyRect.width, h: skyRect.height }
        : { x: 0, y: 0, w, h };
      const layout = buildIntroLayout({
        vw: w,
        vh: h,
        dial: geom,
        stars: stats.catalog.length,
        pitch: gyroPitch(0, 0),
        F: GYRO_F,
        free: scene.free,
      });
      view = createIntroCanvas(ctx, { w, h, dpr }, layout, scene, geom, sky);

      // City labels sit beside their markers (map px, never mirrored).
      CITIES.forEach((city, c) => {
        const el = cityRefs.current[c];
        if (!el) return;
        const x = layout.cityX[c];
        const y = layout.cityY[c];
        el.dataset.side = city.label;
        el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      });
      // Cardinals on the horizon ring at the hand-off tilt.
      const pitch = gyroPitch(0, 0);
      const pos = [
        [geom.cx, geom.cy + geom.R * horizonBackY(pitch)],
        [geom.cx + geom.R, geom.cy],
        [geom.cx, geom.cy + geom.R * horizonFrontY(pitch)],
        [geom.cx - geom.R, geom.cy],
      ];
      cardRefs.current.forEach((el, k) => {
        if (el) el.style.transform = `translate3d(${pos[k][0]}px, ${pos[k][1]}px, 0)`;
      });
      emberRef.current =
        cardRefs.current[0]?.querySelector<HTMLElement>(".intro-cardinal-ember") ?? null;
    };
    measure();

    // The intro drives the shared gyro until the hand-off.
    gyroState.driver = "intro";
    gyroState.needleMode = "north";
    gyroState.clock = 0;
    gyroState.yaw = 0;
    gyroState.spin = 0;
    gyroState.bezel = 0;
    gyroState.parallaxX.angle = 0;
    gyroState.parallaxX.velocity = 0;
    gyroState.parallaxY.angle = 0;
    gyroState.parallaxY.velocity = 0;
    gyroState.needle.angle = NEEDLE_SPIN.from;
    gyroState.needle.velocity = 0;
    gyroState.introT = 0;

    const S = createScalars();
    let t0 = -1;
    const mountedAt = performance.now();
    let offset =
      mountedAt > VERY_LATE_MOUNT_MS
        ? INTRO_T.handoff
        : mountedAt > LATE_MOUNT_MS
          ? INTRO_T.trans
          : 0;
    let springOn = offset >= INTRO_T.handoff;
    if (springOn) {
      gyroState.needle.angle = 0;
      gyroState.needle.velocity = 0;
    }
    let lastNow = -1;
    let frames = 0;
    const intervals = new Float64Array(SAFETY_FRAMES);
    let shownBoot = -1;
    let shownTyped = -1;
    const shown = new Float32Array(16).fill(-1);
    let lastT = 0;

    const skip = () => {
      if (done || lastT >= INTRO_T.handoff) return;
      offset += skipTo(lastT) - lastT;
      springOn = true;
      gyroState.needle.angle = 0;
      gyroState.needle.velocity = 0;
    };
    skipNow.current = skip;

    const setOpacity = (slot: number, el: HTMLElement | null, value: number) => {
      const v = Math.round(value * 100) / 100;
      if (!el || shown[slot] === v) return;
      shown[slot] = v;
      el.style.opacity = String(v);
    };

    const tick = (dt: number, now: number) => {
      if (done || !view) return;
      if (t0 < 0) t0 = now;
      // Safety valve: a device that cannot hold ~30fps skips to the hand-off.
      // The first intervals are ignored (hydration's one-off stalls) and the
      // median of the next ten decides, so a single long frame never trips it.
      if (lastNow >= 0 && frames < SAFETY_WARMUP + SAFETY_FRAMES) {
        if (frames >= SAFETY_WARMUP) intervals[frames - SAFETY_WARMUP] = now - lastNow;
        frames++;
        if (frames === SAFETY_WARMUP + SAFETY_FRAMES) {
          intervals.sort();
          const median = (intervals[SAFETY_FRAMES / 2 - 1] + intervals[SAFETY_FRAMES / 2]) / 2;
          if (median > SAFETY_MEDIAN_MS) skip();
        }
      }
      lastNow = now;
      const t = now - t0 + offset;
      lastT = t;
      gyroState.introT = t;
      introScalars(t, S);

      // Needle: closed-form spin-in, then the INTRO_NEEDLE spring locks it north.
      if (t < INTRO_T.needleSpring && !springOn) {
        const spin = needleSpinAt(t);
        gyroState.needle.angle = spin.angle;
        gyroState.needle.velocity = spin.velocity;
      } else if (!springOn) {
        springOn = true;
        gyroState.needle.angle = NEEDLE_SPIN.at;
        gyroState.needle.velocity = NEEDLE_SPIN.v;
        stepSpring(gyroState.needle, 0, (t - INTRO_T.needleSpring) / 1000, INTRO_NEEDLE);
      } else {
        stepSpring(gyroState.needle, 0, dt, INTRO_NEEDLE);
      }
      // Gyro time starts at the hand-off; until then the shell holds still at yaw 0.
      gyroState.clock = S.gyroClock;
      gyroState.yaw = GYRO_YAW_RATE_DEG * DEG * S.gyroClock;
      gyroState.bezel = GYRO_BEZEL_RATE_DEG * S.gyroClock;

      // The gyro's look, exactly as the hero fills it.
      const look = resetLook(view.scene.look);
      const world = getWorld();
      for (let c = 0; c < world.candidates.length && c < look.candState.length; c++) {
        look.candState[c] = STATE_CODE[world.candidates[c].breaker.state];
      }
      setFactorWeights(look, world.weights);
      look.rings = S.rings;
      look.stars = S.stars;
      look.needle = S.needle;
      look.needleScale = S.needleScale;
      look.flash = S.flash;
      look.horizonFront = S.curtain;
      look.winner = -1;
      aimIntroGyro(view);
      renderIntro(view, S, t, now, getQualityTier());

      // DOM: curtain, HUD, boot log, labels, cardinals.
      setOpacity(0, curtainRef.current, S.curtain);
      setOpacity(1, brandRef.current, S.hud);
      setOpacity(2, logRef.current, S.bootLog);
      setOpacity(3, runningRef.current, S.running);
      setOpacity(4, skipRef.current, S.curtain);
      setOpacity(5, cardRefs.current[0], S.cardinals * S.curtain);
      for (let k = 1; k < 4; k++) setOpacity(5 + k, cardRefs.current[k], S.cardinals * S.curtain);
      setOpacity(9, emberRef.current, S.north);
      for (let c = 0; c < CITIES.length; c++) {
        const el = cityRefs.current[c];
        const v = Math.round(cityLabel(t, c) * 100) / 100;
        if (el && el.style.opacity !== String(v)) el.style.opacity = String(v);
      }
      if (S.typed !== shownTyped && cmdRef.current) {
        shownTyped = S.typed;
        cmdRef.current.textContent = BOOT_COMMAND.slice(0, S.typed);
      }
      if (S.boot !== shownBoot) {
        shownBoot = S.boot;
        setBoot(S.boot);
      }
      // The hand-off: the bridge rises over the intro and fades in with the curtain's lift.
      if (bridge && t >= INTRO_T.handoff) {
        const v = Math.round((1 - S.curtain) * 100) / 100;
        if (handoffShown < 0) bridge.setAttribute("data-handoff", "");
        if (v !== handoffShown) {
          handoffShown = v;
          bridge.style.setProperty("--handoff", String(v));
        }
      }

      if (t >= INTRO_T.done) finish(true);
    };

    unregister = register({ id: "intro", lane: "canvas", tick, priority: 10 });

    const onInput = () => skipNow.current();
    const onVisibility = () => {
      if (document.hidden) skipNow.current();
    };
    const opts = { passive: true } as const;
    window.addEventListener("pointerdown", onInput, opts);
    window.addEventListener("wheel", onInput, opts);
    window.addEventListener("touchmove", onInput, opts);
    window.addEventListener("keydown", onInput);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", measure);
    listeners.push(() => {
      window.removeEventListener("pointerdown", onInput);
      window.removeEventListener("wheel", onInput);
      window.removeEventListener("touchmove", onInput);
      window.removeEventListener("keydown", onInput);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", measure);
    });
    failsafe = window.setTimeout(() => finish(true), INTRO_T.failsafe);

    return () => {
      // Unmounted mid-intro (StrictMode re-mount, navigation): stop, without
      // deciding the attribute here; the effect above (or a re-mount) does.
      if (done) return;
      done = true;
      unregister?.();
      window.clearTimeout(failsafe);
      for (const off of listeners) off();
      gyroState.driver = "hero";
      gyroState.introT = Infinity;
      clearHandoff();
    };
  }, [stats.catalog]);

  if (intro !== "play" && intro !== "ssr") return null;

  return (
    <>
      <div ref={curtainRef} className="intro-layer intro-curtain" aria-hidden="true" />
      <canvas ref={canvasRef} className="intro-layer intro-canvas" aria-hidden="true" />
      <div ref={hudRef} className="intro-layer intro-hud" aria-hidden="true">
        <p ref={brandRef} className="intro-brand">
          PUSULA · v{stats.version}
        </p>
        <div className="intro-cities" dir="ltr">
          {CITIES.map((city, c) => (
            <span
              key={city.id}
              ref={(el) => {
                cityRefs.current[c] = el;
              }}
              className="intro-city"
              data-side={city.label}
              data-hub={city.hub ? "1" : undefined}
            >
              <span className="intro-city-in">
                <i className="intro-city-rule" />
                <span className="intro-city-name">{t(`mapCity_${city.id}`)}</span>
              </span>
            </span>
          ))}
        </div>
        <div className="intro-cardinals" dir="ltr">
          {CARDINALS.map((c, k) => (
            <span
              key={c}
              ref={(el) => {
                cardRefs.current[k] = el;
              }}
              className="intro-cardinal"
              data-c={c}
            >
              <span className="intro-cardinal-in">
                {c}
                {c === "N" ? <span className="intro-cardinal-ember">N</span> : null}
              </span>
            </span>
          ))}
        </div>
        <div ref={logRef} className="intro-log">
          {/* Empty until the timeline types it: the first beat never un-types. */}
          <p className="intro-cmd" dir="ltr">
            <span ref={cmdRef} />
            <span className="intro-caret" />
          </p>
          {bootLines.map((line, k) => (
            <p key={k} className="intro-boot" data-on={k < boot ? "1" : undefined}>
              <span className="intro-boot-n">
                {k < boot ? (
                  <LiveNumber value={line.value} mode="roll" startOn="view" duration={260} />
                ) : (
                  fmt.format(line.value)
                )}
              </span>{" "}
              <span className="intro-boot-label">{line.label}</span>
            </p>
          ))}
          <p ref={runningRef} className="intro-running">
            <span aria-hidden="true">● </span>
            {t("startRunning")} · <span dir="ltr">:{DEFAULT_PORT}</span>
          </p>
        </div>
      </div>
      <button
        ref={skipRef}
        type="button"
        className="intro-layer intro-skip"
        onClick={() => skipNow.current()}
      >
        <span>{t("skipIntro")}</span>
        <Glyph name="star4" size={16} />
      </button>
    </>
  );
}
