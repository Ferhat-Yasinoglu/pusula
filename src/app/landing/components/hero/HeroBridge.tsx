"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  BREAKER_PROFILES,
  HEADER,
  INSTALL_COMMAND,
  SAMPLE_CANDIDATES,
  type CatalogKind,
  type LandingStats,
} from "../../landingTypes";
import { round2 } from "../../landingGeometry";
import { usePrefersReducedMotion } from "../../landingMotion";
import { canAnimate, getQualityTier } from "../../runtime/heartbeat";
import { useCanvasStage, type StageSize } from "../../runtime/useCanvasStage";
import { useDomLoop } from "../../runtime/useDomLoop";
import { useScrollProgress } from "../../runtime/scrollProgress";
import {
  dispatch,
  getWorld,
  shallowEqual,
  subscribeEvents,
  useDeck,
} from "../../runtime/deckStore";
import { CAMERA, INTRO_NEEDLE, NEEDLE, stepSpring } from "../../runtime/springs";
import {
  SAMPLES,
  SAMPLE_KEYS,
  act,
  nextTake,
  rank,
  type BreakerState,
  type Featured,
  type SampleKey,
  type World,
} from "../../sim/landingSim";
import { PROJECTED_STRIDE } from "../../sim/landingProjection";
import CopyChip from "../primitives/CopyChip";
import Glyph from "../primitives/Glyph";
import MagneticButton from "../primitives/MagneticButton";
import SimBadge from "../primitives/SimBadge";
import TypeLine, { type TypeToken } from "../primitives/TypeLine";
import WordReveal from "../primitives/WordReveal";
import { hasFinePointer, numberFormat } from "../primitives/primitiveKit";
import {
  CAND_CLOSED,
  CAND_DEGRADED,
  CAND_HALF_OPEN,
  CAND_OPEN,
  DEG,
  GYRO_R_RATIO,
  HORIZON_FRONT_PATH,
  HORIZON_TICKS_PATH,
  PARALLAX_MAX_DEG,
  POSTER_BOX,
  RHUMB_COUNT,
  aimFromState,
  drawGyroBack,
  drawGyroFront,
  getGyroScene,
  gyroPitch,
  gyroState,
  horizonBackY,
  horizonFrontY,
  horizonScaleY,
  posterStars,
  projectStars,
  resetLook,
  setFactorWeights,
  starBearing,
  stepGyro,
  type GyroGeometry,
} from "./gyro";
import {
  beginTake,
  createProbeFx,
  createTakeFx,
  drawProbes,
  drawTakeComet,
  drawTakeMid,
  endProbe,
  factorLit,
  glowSlot,
  needleSlot,
  sequenceMs,
  startProbe,
} from "./heroFx";
import AlmanacBoard from "./AlmanacBoard";
import {
  BOUNDS_SIZE,
  LABEL_ABOVE,
  LABEL_BELOW,
  LABEL_FLIP,
  LABEL_FRONT,
  LABEL_HIDDEN,
  LABEL_KEEP,
  LABEL_STRIDE,
  L_AX,
  L_AY,
  L_FLAGS,
  L_H,
  L_PRIO,
  L_W,
  L_X,
  L_Y,
  SIDE_GAP,
  ZONE_STRIDE,
  resolveLabels,
} from "./labelLayout";
import "./hero.css";

/**
 * The bridge (spec §6.2): the "where have I landed" moment. A 3D gyro-compass
 * whose celestial shell holds one star per real catalog provider makes a
 * routing decision every 3.6s, driven by the page's one simulation (the
 * deck). Visitors can spin it, hover a star for its provider, and tap a
 * candidate to make it fail: the needle then plays the real fallback.
 *
 * Layers (z): rhumbs 0 · canvas 1 · copy 2 · front arc 3 · labels 4 · HUD 5.
 * The canvas rings pass behind the headline and the static front arc passes
 * in front of it (the sandwich).
 */

const CANDIDATES = SAMPLE_CANDIDATES;
const CANDIDATE_IDS: readonly string[] = CANDIDATES.map((c) => c.id);
const CATALOG_IDS: readonly string[] = CANDIDATES.map((c) => c.catalogId);
const slotOf = (id: string) => CANDIDATE_IDS.indexOf(id);

const STATE_CODE: Record<BreakerState, number> = {
  closed: CAND_CLOSED,
  degraded: CAND_DEGRADED,
  open: CAND_OPEN,
  halfOpen: CAND_HALF_OPEN,
};
const STATE_KEY = ["stateClosed", "stateDegraded", "stateOpen", "stateHalfOpen"] as const;
const STATE_NAME = ["closed", "degraded", "open", "halfOpen"] as const;

const KIND_KEY: Record<CatalogKind, string> = {
  llm: "catalogKindLlm",
  webSearch: "catalogKindSearch",
  imageToText: "catalogKindImageToText",
  webFetch: "catalogKindWebFetch",
  embedding: "catalogKindEmbedding",
  video: "catalogKindVideo",
  other: "catalogKindOther",
};

const selectFeatured = (w: World) => w.featured;
/** [down, state, failures] per candidate, flat, for `shallowEqual`. */
const selectBreakers = (w: World): number[] => {
  const out: number[] = [];
  for (const c of w.candidates) {
    out.push(c.upstreamDown ? 1 : 0, STATE_CODE[c.breaker.state], c.breaker.failures);
  }
  return out;
};

const OPENS_AFTER = CANDIDATES.map(
  (c) => BREAKER_PROFILES.find((p) => p.id === c.profile)?.opensAfter ?? 1
);

/** Label gap from its star, CSS px (the SSR anchors; `labelLayout` owns it after that). */
const LABEL_GAP = SIDE_GAP;
/** Hover radius for stars (fine pointer / touch). */
const HIT_FINE = 14;
const HIT_TOUCH = 22;
/** A pointer that moves this far horizontally is spinning the sphere, not clicking. */
const DRAG_SLOP = 6;
/** A label keeps its side until its star is this far past the sphere's centre line. */
const SIDE_HYSTERESIS = 18;

type Geometry = GyroGeometry & {
  /** Dial square side and its top-left corner, in stage coordinates. */
  S: number;
  dialX: number;
  dialY: number;
  w: number;
  h: number;
  /** The fixed nav's height: labels stay below it. */
  navH: number;
};

const SCORE_FORMAT: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};
const TOKENS_FORMAT: Intl.NumberFormatOptions = {
  notation: "compact",
  maximumFractionDigits: 1,
};

/** Static keep-out zones (copy, HUD, caption) plus four soft ones for the cardinal letters. */
const MAX_STATIC_ZONES = 10;
const MAX_ZONES = MAX_STATIC_ZONES + 4;

function writeZone(
  zones: Float32Array,
  n: number,
  x: number,
  y: number,
  w: number,
  h: number,
  soft: boolean
): void {
  const o = n * ZONE_STRIDE;
  zones[o] = x;
  zones[o + 1] = y;
  zones[o + 2] = w;
  zones[o + 3] = h;
  zones[o + 4] = soft ? 1 : 0;
}

/**
 * Hard keep-out zones for the labels, in dial coordinates (read on resize
 * only): the headline's lines (their words, not the full block), the lead,
 * the CTA row, the HUD and the score caption; stacked layouts keep
 * everything below the headline's top.
 */
function measureZones(
  dial: HTMLElement,
  copy: HTMLElement | null,
  hud: HTMLElement | null,
  note: HTMLElement | null,
  zones: Float32Array,
  countRef: { current: number }
): void {
  let n = 0;
  const push = (x: number, y: number, w: number, h: number) => {
    if (n >= MAX_STATIC_ZONES || !(w > 0) || !(h > 0)) return;
    writeZone(zones, n, x - dial.offsetLeft, y - dial.offsetTop, w, h, false);
    n++;
  };
  if (copy) {
    const title = copy.querySelector<HTMLElement>(".bridge-title");
    const stacked = window.innerWidth < 1024;
    if (title && stacked) {
      push(-1e4, copy.offsetTop + title.offsetTop - 6, 2e4, 1e5);
    } else if (title) {
      copy.querySelectorAll<HTMLElement>(".bridge-title .wr-line").forEach((line) => {
        let left = Infinity;
        let right = -Infinity;
        line.querySelectorAll<HTMLElement>(".wr-w").forEach((word) => {
          left = Math.min(left, word.offsetLeft);
          right = Math.max(right, word.offsetLeft + word.offsetWidth);
        });
        if (right > left) {
          // Lines and words are laid out against the copy block (their offset parent).
          push(
            copy.offsetLeft + left - 8,
            copy.offsetTop + line.offsetTop,
            right - left + 16,
            line.offsetHeight
          );
        }
      });
      for (const sel of [".bridge-version", ".bridge-line3", ".bridge-lead", ".bridge-cta"]) {
        const el = copy.querySelector<HTMLElement>(sel);
        if (el && el.offsetWidth > 0)
          push(
            copy.offsetLeft + el.offsetLeft,
            copy.offsetTop + el.offsetTop,
            el.offsetWidth,
            el.offsetHeight
          );
      }
    }
  }
  if (hud && hud.offsetWidth > 0) {
    push(hud.offsetLeft - 8, hud.offsetTop - 8, hud.offsetWidth + 16, hud.offsetHeight + 16);
  }
  if (note && note.offsetWidth > 0) {
    // Inside the dial already: its own offsets are dial coordinates.
    writeZone(
      zones,
      n,
      note.offsetLeft - 4,
      note.offsetTop - 4,
      note.offsetWidth + 8,
      note.offsetHeight + 8,
      false
    );
    n++;
  }
  countRef.current = n;
}

/** "3.1k" → 3100: the sample table's token counts, for locale formatting. */
function tokenCount(text: string): number {
  const match = /^([\d.]+)\s*([kKmM]?)$/.exec(text.trim());
  if (!match) return Number.NaN;
  const unit = match[2].toLowerCase();
  return Number(match[1]) * (unit === "k" ? 1e3 : unit === "m" ? 1e6 : 1);
}

/**
 * The sample this candidate ranks best on, so a visitor who makes it fail
 * sees the very next take try it first (503) and fall back.
 */
function bestSampleFor(world: World, id: string): SampleKey {
  let best: SampleKey = world.featured.sample;
  let bestPos = Infinity;
  let bestScore = -Infinity;
  for (const key of SAMPLE_KEYS) {
    const ranking = rank(world, key);
    const pos = ranking.findIndex((entry) => entry.id === id);
    if (pos < 0) continue;
    const score = ranking[pos].score;
    if (pos < bestPos || (pos === bestPos && score > bestScore)) {
      best = key;
      bestPos = pos;
      bestScore = score;
    }
  }
  return best;
}

function sampleTokens(key: string): string {
  return SAMPLES.find((s) => s.key === key)?.tokens ?? "";
}

export default function HeroBridge({ stats, poster }: { stats: LandingStats; poster: ReactNode }) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const reduced = usePrefersReducedMotion();
  const fmt = useMemo(() => numberFormat(locale), [locale]);

  const scene = useMemo(() => getGyroScene(stats.catalog, CATALOG_IDS), [stats.catalog]);

  // Yaw-0 label anchors in the 1000-unit dial box, for SSR (container units).
  const anchors = useMemo(() => {
    const proj = posterStars(scene);
    return CANDIDATES.map((_, slot) => {
      const i = scene.candStar[slot];
      if (i < 0) return { x: 500, y: 500, front: false };
      const o = i * PROJECTED_STRIDE;
      return { x: round2(proj[o]), y: round2(proj[o + 1]), front: proj[o + 3] < 0 };
    });
  }, [scene]);

  /* ---- deck state ------------------------------------------------------ */

  const featured = useDeck(selectFeatured);
  const breakers = useDeck(selectBreakers, shallowEqual);
  // What the copy shows lags the needle: it updates once the sequence lands.
  const [shown, setShown] = useState<Featured>(featured);
  useEffect(() => {
    if (featured === shown) return;
    const delay =
      canAnimate() && featured.take > shown.take ? sequenceMs(featured.attempts.length) : 0;
    const id = window.setTimeout(() => setShown(featured), delay);
    return () => window.clearTimeout(id);
  }, [featured, shown]);

  const [announce, setAnnounce] = useState("");

  /* ---- refs and geometry ----------------------------------------------- */

  const sectionRef = useRef<HTMLElement>(null);
  const dialRef = useRef<HTMLElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const cardinalRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const labelRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tipRef = useRef<HTMLDivElement>(null);
  const geomRef = useRef<Geometry>({
    cx: 0,
    cy: 0,
    R: 0,
    S: 0,
    dialX: 0,
    dialY: 0,
    w: 0,
    h: 0,
    navH: 56,
  });
  const labelSize = useRef(new Float32Array(CANDIDATES.length * 2));
  const boxRef = useRef(new Float32Array(CANDIDATES.length * LABEL_STRIDE));
  const orderRef = useRef(new Int8Array(CANDIDATES.length));
  const zoneRef = useRef(new Float32Array(MAX_ZONES * ZONE_STRIDE));
  const zoneCount = useRef(0);
  const boundsRef = useRef(new Float32Array(BOUNDS_SIZE));
  /** Per label: 1 when it last sat on its star's left. */
  const sideRef = useRef(new Int8Array(CANDIDATES.length));
  /** The candidate the needle aims at this frame (its label is never hidden). */
  const targetRef = useRef(-1);
  /** Labels are hidden until script first places them. */
  const placedRef = useRef(false);
  /** Whether the S cardinal is shown (desktop only); measured on resize. */
  const southRef = useRef(false);
  const copyRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLParagraphElement>(null);
  const written = useRef(new Float32Array(CANDIDATES.length * 4 + 8).fill(NaN));
  const fxRef = useRef(createTakeFx());
  const probeRef = useRef(createProbeFx(CANDIDATES.length));
  const lastDrawRef = useRef(-1);
  const rtlRef = useRef(false);
  const fontRef = useRef("600 12px ui-monospace, monospace");
  const weightsRef = useRef<readonly number[] | null>(null);
  const dragRef = useRef<{ id: number; x: number; t: number; dragging: boolean } | null>(null);
  const hoverRef = useRef(-1);
  /** True once the hero has projected the stars (the overlay waits for it). */
  const projectedRef = useRef(false);
  const syncRef = useRef<() => void>(() => {});
  const [hover, setHover] = useState(-1);

  // Scroll exit: writes `--p` on the section; hero.css scales the sphere away.
  useScrollProgress(sectionRef, { mode: "traverse" });

  /* ---- canvas ------------------------------------------------------------ */

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, s: StageSize, dt: number, now: number) => {
      ctx.clearRect(0, 0, s.w, s.h);
      const g = geomRef.current;
      if (!(g.R > 0)) return;
      const state = gyroState;
      const intro = state.driver === "intro";
      // Under the intro's curtain the hero has nothing to show until the hand-off.
      if (intro && state.introT < 2300) return;
      const animate = canAnimate();
      const fx = fxRef.current;
      const world = getWorld();

      if (!intro && animate) {
        stepGyro(state, dt, dragRef.current?.dragging === true);
        stepSpring(state.parallaxX, state.parallaxTargetX, dt, CAMERA);
        stepSpring(state.parallaxY, state.parallaxTargetY, dt, CAMERA);
      }
      aimFromState(scene, g, state);
      projectStars(scene);
      projectedRef.current = true;

      // A new featured take: animate it, unless this is the first look or a
      // return from off screen (then just land on it).
      const feat = world.featured;
      if (feat.take !== fx.take) {
        const first = fx.take === -1;
        const gap = lastDrawRef.current < 0 || now - lastDrawRef.current > 600;
        if (!first && state.needleMode === "north") {
          state.needleMode = "route";
          fx.winner = -1;
          fx.active = false;
        }
        beginTake(fx, feat, slotOf, now, animate && !first && !gap && !intro, rtlRef.current);
        if (first && state.needleMode === "north") fx.winner = -1;
      }
      lastDrawRef.current = now;

      const look = resetLook(scene.look);
      for (let c = 0; c < world.candidates.length && c < look.candState.length; c++) {
        look.candState[c] = STATE_CODE[world.candidates[c].breaker.state];
      }
      if (weightsRef.current !== world.weights) {
        weightsRef.current = world.weights;
        setFactorWeights(look, world.weights);
      }
      factorLit(fx, now, look.factorLit, look.factorCount);
      const north = state.needleMode === "north";
      look.winner = north ? -1 : glowSlot(fx, now);

      targetRef.current = -1;
      if (!intro) {
        const slot = north ? -1 : needleSlot(fx, now);
        targetRef.current = slot;
        const star = slot >= 0 ? scene.candStar[slot] : -1;
        const target =
          star >= 0
            ? starBearing(scene, g, star, state.needle.angle)
            : state.needle.angle + ((((0 - state.needle.angle) % 360) + 540) % 360) - 180;
        if (animate && dt > 0) {
          stepSpring(state.needle, target, dt, north ? INTRO_NEEDLE : NEEDLE);
        } else if (!animate) {
          state.needle.angle = target;
          state.needle.velocity = 0;
        }
      }

      const pitch = gyroPitch(state.clock, state.parallaxY.angle);
      drawGyroBack(ctx, scene, g, state, now);
      drawTakeMid(ctx, fx, scene, g, s.dpr, now, pitch, fontRef.current);
      if (animate && !intro) drawProbes(ctx, probeRef.current, scene, g, now, fontRef.current);
      drawGyroFront(ctx, scene, g, state, now, getQualityTier());
      drawTakeComet(ctx, fx, g, s.w, s.h, s.dpr, now);
      // A still frame (reduced motion, Pause) has no DOM loop to follow it.
      if (!animate) syncRef.current();
    },
    [scene]
  );

  // The stage re-measures on every resize (before its synchronous redraw).
  const measureRef = useRef<() => void>(() => {});
  const setup = useCallback(() => measureRef.current(), []);

  const {
    wrapRef: stageWrap,
    canvasRef,
    requestDraw,
  } = useCanvasStage({
    id: "hero-gyro",
    priority: 2,
    staticWhenReduced: true,
    setup,
    draw,
  });

  const measure = useCallback(() => {
    const dial = dialRef.current;
    const stage = stageWrap.current;
    if (!dial || !stage) return;
    const S = dial.offsetWidth;
    const dialX = dial.offsetLeft - stage.offsetLeft;
    const dialY = dial.offsetTop - stage.offsetTop;
    geomRef.current = {
      cx: dialX + S / 2,
      cy: dialY + S / 2,
      R: S * GYRO_R_RATIO,
      S,
      dialX,
      dialY,
      w: stage.offsetWidth,
      h: stage.offsetHeight,
      navH: parseFloat(getComputedStyle(stage).getPropertyValue("--nav-h")) || 56,
    };
    rtlRef.current = getComputedStyle(stage.parentElement ?? stage).direction === "rtl";
    const mono = getComputedStyle(stage).getPropertyValue("--font-mono").trim();
    fontRef.current = `600 12px ${mono || "ui-monospace, monospace"}`;
    written.current.fill(NaN);
    for (let i = 0; i < CANDIDATES.length; i++) {
      const el = labelRefs.current[i];
      if (!el) continue;
      labelSize.current[i * 2] = el.offsetWidth;
      labelSize.current[i * 2 + 1] = el.offsetHeight;
    }
    measureZones(
      dial,
      copyRef.current,
      hudRef.current,
      noteRef.current,
      zoneRef.current,
      zoneCount
    );
    southRef.current = (cardinalRefs.current[2]?.offsetWidth ?? 0) > 0;
  }, [stageWrap]);

  useLayoutEffect(() => {
    measureRef.current = measure;
  }, [measure]);

  /* ---- overlay: labels, cardinals, front arc, tooltip ------------------- */

  const syncOverlay = useCallback(() => {
    const g = geomRef.current;
    if (!(g.R > 0) || !projectedRef.current) return;
    const state = gyroState;
    const memo = written.current;
    const pitch = gyroPitch(state.clock, state.parallaxY.angle);

    // Nutation: the static front arc and the cardinals follow the tilt.
    const sy = round2(horizonScaleY(pitch) * 1000) / 1000;
    if (memo[0] !== sy && frontRef.current) {
      memo[0] = sy;
      frontRef.current.style.transform = `scaleY(${sy})`;
    }
    const half = g.S / 2;
    const top = round2(half + g.R * horizonBackY(pitch));
    const bottom = round2(half + g.R * horizonFrontY(pitch));
    if (memo[1] !== top) {
      memo[1] = top;
      const n = cardinalRefs.current[0];
      if (n) n.style.transform = `translate3d(${half}px, ${top}px, 0)`;
      const s = cardinalRefs.current[2];
      if (s) s.style.transform = `translate3d(${half}px, ${bottom}px, 0)`;
    }

    // The cardinal letters are soft keep-outs: labels leave them readable when they can.
    const zones = zoneRef.current;
    let zc = zoneCount.current;
    writeZone(zones, zc++, half - 8, top - 23, 16, 17, true);
    if (southRef.current) writeZone(zones, zc++, half - 8, bottom + 6, 16, 17, true);
    writeZone(zones, zc++, half + g.R + 6, half - 9, 16, 18, true);
    writeZone(zones, zc++, half - g.R - 22, half - 9, 16, 18, true);

    // Labels: beside their stars, clear of the copy, the HUD and each other.
    const bounds = boundsRef.current;
    bounds[0] = -g.dialX + 8;
    bounds[1] = g.navH - g.dialY + 4;
    bounds[2] = g.w - g.dialX - 8;
    bounds[3] = g.h - g.dialY - 8;
    const proj = scene.proj;
    const boxes = boxRef.current;
    const sides = sideRef.current;
    const winner = scene.look.winner;
    const target = targetRef.current;
    const focused = typeof document !== "undefined" ? document.activeElement : null;
    const count = CANDIDATES.length;
    for (let c = 0; c < count; c++) {
      const i = scene.candStar[c];
      const b = c * LABEL_STRIDE;
      const o = i * PROJECTED_STRIDE;
      const ax = i >= 0 ? proj[o] - g.dialX : -1e5;
      const ay = i >= 0 ? proj[o + 1] - g.dialY : -1e5;
      const front = i >= 0 && proj[o + 3] < 0;
      // Outward of the sphere's centre line, with hysteresis so labels do not flicker.
      const dx = ax - half;
      let left = sides[c] === 1;
      if (dx < -SIDE_HYSTERESIS) left = true;
      else if (dx > SIDE_HYSTERESIS) left = false;
      sides[c] = left ? 1 : 0;
      const keep =
        i >= 0 &&
        (c === winner || c === target || (focused !== null && focused === labelRefs.current[c]));
      boxes[b + L_W] = labelSize.current[c * 2];
      boxes[b + L_H] = labelSize.current[c * 2 + 1];
      boxes[b + L_AX] = ax;
      boxes[b + L_AY] = ay;
      boxes[b + L_PRIO] = (keep ? 8 : 0) + (front ? 2 : 0) - c * 0.01;
      boxes[b + L_FLAGS] =
        (front ? LABEL_FRONT : 0) | (left ? LABEL_FLIP : 0) | (keep ? LABEL_KEEP : 0);
    }
    resolveLabels(boxes, count, zones, zc, orderRef.current, bounds);
    for (let c = 0; c < count; c++) {
      const el = labelRefs.current[c];
      if (!el || scene.candStar[c] < 0) continue;
      const b = c * LABEL_STRIDE;
      const lx = round2(boxes[b + L_X]);
      const ly = round2(boxes[b + L_Y]);
      const flags = boxes[b + L_FLAGS];
      const m = 8 + c * 4;
      if (memo[m] !== lx || memo[m + 1] !== ly || memo[m + 2] !== flags) {
        const front = (flags & LABEL_FRONT) !== 0;
        const side =
          flags & LABEL_ABOVE
            ? "above"
            : flags & LABEL_BELOW
              ? "below"
              : flags & LABEL_FLIP
                ? "start"
                : "end";
        memo[m] = lx;
        memo[m + 1] = ly;
        memo[m + 2] = flags;
        el.style.transformOrigin =
          side === "start"
            ? "100% 50%"
            : side === "above"
              ? "50% 100%"
              : side === "below"
                ? "50% 0"
                : "0 50%";
        el.style.transform = `translate3d(${lx}px, ${ly}px, 0) scale(${front ? 1 : 0.85})`;
        el.dataset.front = front ? "1" : "0";
        el.dataset.side = side;
        if (flags & LABEL_HIDDEN) el.dataset.hidden = "1";
        else delete el.dataset.hidden;
      }
    }
    if (!placedRef.current) {
      placedRef.current = true;
      dialRef.current?.setAttribute("data-placed", "");
    }

    const hovered = hoverRef.current;
    const tip = tipRef.current;
    if (tip && hovered >= 0) {
      const o = hovered * PROJECTED_STRIDE;
      tip.style.transform = `translate3d(${round2(proj[o] - g.dialX)}px, ${round2(proj[o + 1] - g.dialY)}px, 0)`;
    }
  }, [scene]);

  useLayoutEffect(() => {
    syncRef.current = syncOverlay;
  }, [syncOverlay]);

  useDomLoop("hero-overlay", syncOverlay, { target: sectionRef });

  // Geometry follows the dial and the stage.
  useLayoutEffect(() => {
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      measure();
      if (!canAnimate()) {
        requestDraw();
        syncOverlay();
      }
    });
    for (const el of [dialRef.current, copyRef.current, hudRef.current, ...labelRefs.current]) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [measure, requestDraw, syncOverlay]);

  // A still frame (reduced motion, Pause) must still reflect every change.
  useEffect(() => {
    if (canAnimate()) return;
    requestDraw();
    syncOverlay();
  }, [featured, breakers, reduced, requestDraw, syncOverlay]);

  // Half-open probes: the beam waits on the breaker's verdict (deck events).
  useEffect(
    () =>
      subscribeEvents((event) => {
        if (event.kind !== "breaker") return;
        const slot = slotOf(event.id);
        const now = performance.now();
        if (event.state === "halfOpen") startProbe(probeRef.current, slot, now);
        else if (event.state === "closed") endProbe(probeRef.current, slot, true, now);
        else if (event.state === "open") endProbe(probeRef.current, slot, false, now);
      }),
    []
  );

  /* ---- interaction ------------------------------------------------------- */

  const toggleCandidate = useCallback(
    (slot: number) => {
      const id = CANDIDATES[slot].id;
      const candidate = getWorld().candidates[slot];
      const down = !(candidate?.upstreamDown ?? false);
      dispatch(act.setUpstreamDown(id, down), { user: true });
      // Route the request this provider would have won, right away: the
      // needle tries it first and plays the real fallback. Without a clock
      // (reduced motion, Pause) the fault is already resolved, so this shows
      // the settled state (OPEN, the fallback winner) at once.
      if (down || !canAnimate()) {
        const sample = bestSampleFor(getWorld(), id);
        dispatch((w: World) => nextTake(w, sample));
      }
      if (!canAnimate()) {
        requestDraw();
        syncOverlay();
      }
      const winner = getWorld().featured.winner;
      const winnerSlot = slotOf(winner);
      setAnnounce(
        t("instrumentDialAria", {
          provider: winnerSlot >= 0 ? CANDIDATES[winnerSlot].catalogId : winner,
        })
      );
    },
    [requestDraw, syncOverlay, t]
  );

  const advanceSample = useCallback(() => {
    dispatch((w: World) => nextTake(w));
    if (!canAnimate()) {
      requestDraw();
      syncOverlay();
    }
  }, [requestDraw, syncOverlay]);

  const hitStar = useCallback(
    (clientX: number, clientY: number, radius: number): number => {
      const stage = stageWrap.current;
      if (!stage) return -1;
      const rect = stage.getBoundingClientRect();
      const g = geomRef.current;
      // The stage may be scaled by the scroll exit; map back to its own px.
      const k = rect.width > 0 ? g.w / rect.width : 1;
      const x = (clientX - rect.left) * k;
      const y = (clientY - rect.top) * k;
      let best = -1;
      let bestD = radius * radius;
      for (let i = 0; i < scene.n; i++) {
        const o = i * PROJECTED_STRIDE;
        if (scene.proj[o + 3] >= 0) continue;
        const dx = scene.proj[o] - x;
        const dy = scene.proj[o + 1] - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },
    [scene, stageWrap]
  );

  const showTip = useCallback(
    (i: number) => {
      if (hoverRef.current === i) return;
      hoverRef.current = i;
      setHover(i);
      if (i >= 0) syncOverlay();
    },
    [syncOverlay]
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      t: event.timeStamp,
      dragging: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (drag && drag.id === event.pointerId) {
      const dx = event.clientX - drag.x;
      if (!drag.dragging && Math.abs(dx) > DRAG_SLOP) {
        drag.dragging = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        showTip(-1);
      }
      if (drag.dragging) {
        const R = geomRef.current.R || 200;
        const dyaw = dx / R;
        const dt = Math.max(1, event.timeStamp - drag.t) / 1000;
        gyroState.yaw += dyaw;
        gyroState.spin = gyroState.spin * 0.5 + (dyaw / dt) * 0.5;
        drag.x = event.clientX;
        drag.t = event.timeStamp;
        if (!canAnimate()) {
          gyroState.spin = 0;
          requestDraw();
          syncOverlay();
        }
        return;
      }
    }
    if (event.pointerType === "mouse") showTip(hitStar(event.clientX, event.clientY, HIT_FINE));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.dragging) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (!canAnimate()) gyroState.spin = 0;
      return;
    }
    // A tap without a drag: touch shows the nearest star's tooltip.
    if (event.pointerType !== "mouse") {
      showTip(hitStar(event.clientX, event.clientY, HIT_TOUCH));
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    if (canAnimate()) {
      gyroState.spin += step * 1.6;
    } else {
      gyroState.yaw += step * 15 * DEG;
      requestDraw();
      syncOverlay();
    }
  };

  // Desktop parallax: the camera leans towards a fine pointer, up to ±6°.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !hasFinePointer()) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const g = geomRef.current;
      const rect = section.getBoundingClientRect();
      const nx = (event.clientX - rect.left - g.cx) / Math.max(1, rect.width / 2);
      const ny = (event.clientY - rect.top - g.cy) / Math.max(1, rect.height / 2);
      gyroState.parallaxTargetX = Math.max(-1, Math.min(1, nx)) * PARALLAX_MAX_DEG;
      gyroState.parallaxTargetY = Math.max(-1, Math.min(1, ny)) * PARALLAX_MAX_DEG;
    };
    const onLeave = () => {
      gyroState.parallaxTargetX = 0;
      gyroState.parallaxTargetY = 0;
    };
    section.addEventListener("pointermove", onMove, { passive: true });
    section.addEventListener("pointerleave", onLeave);
    return () => {
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  // A touch tooltip clears itself.
  useEffect(() => {
    if (hover < 0) return;
    const id = window.setTimeout(() => {
      if (!hasFinePointer()) showTip(-1);
    }, 2600);
    return () => window.clearTimeout(id);
  }, [hover, showTip]);

  /* ---- copy -------------------------------------------------------------- */

  const scoreOf = (slot: number): number | null => {
    const entry = shown.ranking.find((r) => r.id === CANDIDATES[slot].id);
    return entry ? entry.score : null;
  };
  // A dropped request (every target failed) has no provider to name.
  const winnerSlot = shown.served ? slotOf(shown.winner) : -1;
  const winnerId = !shown.served
    ? "—"
    : winnerSlot >= 0
      ? CANDIDATES[winnerSlot].catalogId
      : shown.winner;
  const failedIds = shown.attempts
    .slice(0, shown.fallbackAttempts)
    .map((id) => CANDIDATES[slotOf(id)]?.catalogId ?? id);
  // Two header lines, as a response would carry them.
  const headerText = `${HEADER.provider}: ${winnerId}\n${HEADER.fallbackAttempts}: ${shown.fallbackAttempts}`;
  const headerTokens: TypeToken[] = [
    { t: `${HEADER.provider}: `, c: "kw" },
    { t: winnerId, c: "str" },
    { t: "\n" },
    { t: `${HEADER.fallbackAttempts}: `, c: "kw" },
    { t: String(shown.fallbackAttempts), c: shown.fallbackAttempts > 0 ? "accent" : "num" },
  ];
  const sampleText = t(shown.sample);
  const tokenText = sampleTokens(shown.sample);
  const tokenValue = tokenCount(tokenText);
  const tokens = Number.isFinite(tokenValue)
    ? numberFormat(locale, TOKENS_FORMAT).format(tokenValue)
    : tokenText;
  const scoreFmt = numberFormat(locale, SCORE_FORMAT);
  const hovered = hover >= 0 ? stats.catalog[hover] : null;

  return (
    <section
      ref={sectionRef}
      id="bridge"
      data-station="bridge"
      aria-labelledby="bridge-title"
      className="bridge graticule"
    >
      <div className="bridge-sky">
        <div ref={stageWrap} className="stage bridge-stage" dir="ltr" aria-hidden="true">
          <div className="bridge-rhumbs">
            {Array.from({ length: RHUMB_COUNT }, (_, k) => (
              <i
                key={k}
                className={k % 4 === 0 ? "bridge-rhumb bridge-rhumb-major" : "bridge-rhumb"}
                style={{ "--r": `${k * (360 / RHUMB_COUNT) - 90}deg` } as CSSProperties}
              />
            ))}
          </div>
          <div className="stage-poster bridge-poster">{poster}</div>
          <canvas ref={canvasRef} aria-hidden="true" />
        </div>

        <figure
          ref={dialRef}
          className="bridge-dial"
          data-hero-dial=""
          dir="ltr"
          tabIndex={0}
          aria-labelledby="bridge-dial-caption"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") showTip(-1);
          }}
          onKeyDown={onKeyDown}
        >
          <div ref={frontRef} className="bridge-front" aria-hidden="true">
            <svg viewBox={`0 0 ${POSTER_BOX} ${POSTER_BOX}`} width="100%" height="100%">
              <path d={HORIZON_FRONT_PATH} />
              <path d={HORIZON_TICKS_PATH} />
            </svg>
          </div>
          {(["N", "E", "S", "W"] as const).map((c, k) => (
            <span
              key={c}
              ref={(el) => {
                cardinalRefs.current[k] = el;
              }}
              className="bridge-cardinal"
              data-c={c}
              aria-hidden="true"
            >
              <span className="bridge-cardinal-in">{c}</span>
            </span>
          ))}

          {CANDIDATES.map((cand, slot) => {
            const down = breakers[slot * 3] === 1;
            const stateCode = breakers[slot * 3 + 1] ?? 0;
            const failures = breakers[slot * 3 + 2] ?? 0;
            const failing = down || stateCode !== CAND_CLOSED;
            const score = scoreOf(slot);
            const scoreText = score === null ? "—" : scoreFmt.format(score);
            const anchor = anchors[slot];
            const flip = anchor.x < 482;
            const isWinner = slot === winnerSlot && stateCode !== CAND_OPEN;
            return (
              <button
                key={cand.id}
                ref={(el) => {
                  labelRefs.current[slot] = el;
                }}
                type="button"
                className="bridge-cand"
                data-slot={slot}
                data-state={STATE_NAME[stateCode]}
                data-down={down ? "1" : undefined}
                data-winner={isWinner ? "1" : undefined}
                data-front={anchor.front ? "1" : "0"}
                data-side={flip ? "start" : "end"}
                aria-pressed={down}
                aria-label={t("heroToggleAria", { down: String(down), provider: cand.catalogId })}
                onClick={() => toggleCandidate(slot)}
                style={{
                  transformOrigin: flip ? "100% 50%" : "0 50%",
                  transform: `translate3d(calc(${round2(anchor.x / 10)}cqw ${flip ? "- 100% - " : "+ "}${LABEL_GAP}px), calc(${round2(anchor.y / 10)}cqh - 50%), 0) scale(${anchor.front ? 1 : 0.85})`,
                }}
              >
                <span className="bridge-cand-led" aria-hidden="true" />
                <span className="bridge-cand-name">{cand.catalogId}</span>
                <span className="bridge-cand-score" aria-hidden="true">
                  {/* A new take re-keys the figure: it clicks in, always legible. */}
                  <span key={scoreText} className="bridge-cand-num">
                    {scoreText}
                  </span>
                </span>
                {failing ? (
                  <span className="bridge-cand-fail" aria-hidden="true">
                    <span className="bridge-cand-x">✕</span>
                    <span className="bridge-cand-meter" dir="ltr">
                      {fmt.format(failures)}/{fmt.format(OPENS_AFTER[slot])}
                      <span
                        className="bridge-cand-bar"
                        style={
                          { "--fill": Math.min(1, failures / OPENS_AFTER[slot]) } as CSSProperties
                        }
                      />
                    </span>
                    {stateCode !== CAND_CLOSED ? (
                      <span className="bridge-cand-state">{t(STATE_KEY[stateCode])}</span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            );
          })}

          <div
            ref={tipRef}
            className="bridge-tip"
            data-on={hovered ? "1" : undefined}
            aria-hidden="true"
          >
            {hovered ? (
              <span className="bridge-tip-body">
                <span className="bridge-tip-name">{hovered.name}</span>
                <span className="bridge-tip-meta">
                  {t(KIND_KEY[hovered.kind])}
                  {hovered.free ? ` · ${t("catalogFreeMark")}` : ""}
                </span>
              </span>
            ) : null}
          </div>

          <p ref={noteRef} className="bridge-scores">
            <SimBadge note={t("instrumentSampleNote")} />
          </p>

          <figcaption id="bridge-dial-caption" className="sr-only">
            {t("instrumentAria")}: {t("heroHint")}
          </figcaption>
          <p className="sr-only" aria-live="polite">
            {announce}
          </p>
        </figure>

        <div ref={copyRef} className="bridge-copy">
          <p className="bridge-version">
            <span className="live-dot" aria-hidden="true" />
            <span>{t("heroVersion", { version: stats.version })}</span>
          </p>
          <WordReveal
            as="h1"
            trigger="intro"
            id="bridge-title"
            className="serif-display bridge-title"
            lines={[
              t("heroCardLine1"),
              t("heroCardLine2", { providers: fmt.format(stats.providers) }),
            ]}
          />
          <p className="italic-line bridge-line3">{t("heroCardLine3")}</p>
          <button type="button" className="bridge-hud-line" onClick={advanceSample}>
            <SimBadge />
            {failedIds.length > 0 ? (
              <span className="bridge-hud-route" dir="ltr">
                {failedIds.map((id, k) => (
                  <span key={id + k}>
                    {id} <b className="bridge-x">✕ {shown.codes[k] ?? 503}</b>{" "}
                  </span>
                ))}
                → <b>{winnerId}</b> · Fallback-Attempts: {shown.fallbackAttempts}
              </span>
            ) : (
              <span className="bridge-hud-route">
                <span>{sampleText}</span>
                <Glyph name="arrow" size={16} tone="current" className="bridge-hud-arrow" />
                <b dir="ltr">{winnerId}</b>
              </span>
            )}
          </button>
          <p className="bridge-lead">
            {t("heroLead", {
              providers: fmt.format(stats.providers),
              free: fmt.format(stats.freeProviders),
            })}
          </p>
          <div className="bridge-cta">
            <MagneticButton href="/dashboard" variant="gold" size="lg" icon="arrow">
              {t("heroCtaDashboard")}
            </MagneticButton>
            <CopyChip text={INSTALL_COMMAND} />
          </div>
          <p className="bridge-hint">
            <Glyph name="lock" size={16} />
            <span>{t("heroInstallHint")}</span>
          </p>
          <p className="bridge-hint-phone">{t("heroHint")}</p>
        </div>

        <div ref={hudRef} className="bridge-hud">
          <button type="button" className="bridge-hud-req" onClick={advanceSample}>
            <SimBadge />
            <span className="bridge-hud-text">
              {t("instrumentRequest")} · {sampleText} · {tokens} {t("instrumentTokens")}
            </span>
            <Glyph name="chevron" size={16} className="bridge-hud-next" />
          </button>
          <div className="bridge-hud-header" dir="ltr">
            <TypeLine
              id="bridge-header"
              text={headerText}
              tokens={headerTokens}
              restartKey={shown.take}
              cps={110}
            />
          </div>
          <p className="bridge-hud-hint">{t("heroHint")}</p>
        </div>
      </div>
      <AlmanacBoard stats={stats} />
    </section>
  );
}
