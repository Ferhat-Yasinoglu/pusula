"use client";
import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { usePrefersReducedMotion } from "../landingMotion";
import { register } from "./heartbeat";

/**
 * A canvas that draws over a server-rendered poster.
 *
 * Markup contract (the section renders it; nothing here creates elements):
 *
 *   <div ref={wrapRef} className="stage">          // sized by CSS, overflow: clip
 *     <Poster className="stage-poster" />          // server SVG, fades out on data-live
 *     <canvas ref={canvasRef} aria-hidden="true" /> // position: absolute; inset-block-start: 0; inset-inline-start: 0
 *   </div>
 *
 * - The backing store follows the wrapper (ResizeObserver) at
 *   `min(devicePixelRatio, innerWidth < 480 ? 1.5 : 2)`. The cap reads the
 *   viewport, not the canvas, so the intro and hero canvases match pixel for
 *   pixel. The context is pre-scaled: `setup`/`draw` work in CSS px.
 * - On `(pointer: coarse)` a height-only change under 120px (the iOS URL bar
 *   sliding) is ignored, so phones do not reallocate and redraw mid-scroll.
 * - One IntersectionObserver (rootMargin 100px) feeds the heartbeat's
 *   `visibility`; a live stage is registered on the `canvas` lane only while
 *   it is near the screen, and the heartbeat ticks at most two stages.
 * - After the first successful draw, `data-live="on"` is set on the wrapper
 *   (CSS fades `.stage-poster`). The canvas gets `aria-hidden="true"`.
 * - `draw` must clear and repaint the whole canvas. Resizing clears it, so
 *   every resize runs `setup` then one `draw(…, 0, now)` straight away.
 * - Reduced motion: the stage never loads or draws and the poster stays,
 *   unless `staticWhenReduced` asks for a single still frame per resize.
 *
 * Renderer code splitting, two ways:
 *   1. `load: () => import("./mapRender")`: called once, when the wrapper is
 *      within `loadMargin` (600px) of the viewport. The module may export
 *      `draw` (and `setup`) or a default `{ draw, setup }`.
 *   2. Caller-managed: do the `import()` in your own effect, keep the module
 *      in state, and pass `enabled: renderer !== null` with `draw: renderer?.draw`.
 *      Nothing mounts until `enabled` is true.
 * Plain `draw`/`setup` props work too; the latest ones are always used, so
 * they may close over fresh props.
 */

export type StageSize = { w: number; h: number; dpr: number };
export type StageSetup = (ctx: CanvasRenderingContext2D, s: StageSize) => void;
export type StageDraw = (
  ctx: CanvasRenderingContext2D,
  s: StageSize,
  dt: number,
  now: number
) => void;
export type StageRenderer = { setup?: StageSetup; draw: StageDraw };
export type StageLoader = () => Promise<StageRenderer | { default: StageRenderer }>;

export type CanvasStageOptions = {
  /** Heartbeat entry id (shown in error reports). */
  id: string;
  /** Canvas-lane priority (≥ 0); read when the stage registers. */
  priority?: number;
  /** false → draw on resize (and `requestDraw()`) only, never per frame. Default true. */
  live?: boolean;
  /** false → mount nothing (no observers, no drawing). Default true. */
  enabled?: boolean;
  /** Rebuild caches/sprites after a resize. */
  setup?: StageSetup;
  draw?: StageDraw;
  /** Lazy renderer; when given, `draw`/`setup` are ignored. */
  load?: StageLoader;
  /** Distance (px) from the viewport at which `load` starts. Default 600. */
  loadMargin?: number;
  /** Under reduced motion, draw one still frame per resize instead of keeping the poster. */
  staticWhenReduced?: boolean;
};

export type CanvasStage = {
  wrapRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Draw one frame now (dt 0), e.g. after a state change on a `live: false` stage. */
  requestDraw: () => void;
};

export const STAGE_VISIBILITY_MARGIN = "100px";
export const STAGE_LOAD_MARGIN_PX = 600;
/** Height-only resizes smaller than this are ignored on coarse pointers. */
export const COARSE_HEIGHT_JITTER_PX = 120;
const VISIBILITY_THRESHOLDS = [0, 0.01, 0.1, 0.25, 0.5, 0.75, 1];

/** The page-wide canvas DPR rule. */
export function stageDpr(devicePixelRatio: number, viewportWidth: number): number {
  const cap = viewportWidth < 480 ? 1.5 : 2;
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(dpr, cap);
}

/** `stageDpr` for the current window (1 on the server); for canvases not mounted through this hook, like the intro. */
export function getStageDpr(): number {
  if (typeof window === "undefined") return 1;
  return stageDpr(window.devicePixelRatio, window.innerWidth);
}

/** True when a measured wrapper size should NOT trigger a reallocation. */
export function isIgnorableResize(
  previous: StageSize | null,
  w: number,
  h: number,
  dpr: number,
  coarsePointer: boolean
): boolean {
  if (w <= 0 || h <= 0) return true;
  if (!previous || previous.dpr !== dpr || previous.w !== w) return false;
  if (previous.h === h) return true;
  return coarsePointer && Math.abs(h - previous.h) < COARSE_HEIGHT_JITTER_PX;
}

type StageController = { requestDraw(): void; destroy(): void };

function resolveRenderer(mod: StageRenderer | { default: StageRenderer }): StageRenderer {
  return "draw" in mod ? mod : mod.default;
}

function mountStage(
  wrap: HTMLDivElement,
  canvas: HTMLCanvasElement,
  read: () => CanvasStageOptions,
  live: boolean
): StageController {
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d");
  const coarsePointer =
    typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

  let size: StageSize | null = null;
  let loaded: StageRenderer | null = null;
  let visible = 0;
  let drawn = false;
  let destroyed = false;
  let unregister: (() => void) | null = null;

  const currentDraw = (): StageDraw | undefined => {
    if (loaded) return loaded.draw;
    const options = read();
    return options.load ? undefined : options.draw;
  };
  const currentSetup = (): StageSetup | undefined => {
    if (loaded) return loaded.setup;
    const options = read();
    return options.load ? undefined : options.setup;
  };

  const paint = (dt: number, now: number) => {
    if (destroyed || !ctx || !size) return;
    const draw = currentDraw();
    if (!draw) return;
    draw(ctx, size, dt, now);
    if (!drawn) {
      drawn = true;
      wrap.setAttribute("data-live", "on");
    }
  };

  const runSetup = () => {
    const setup = currentSetup();
    if (setup && ctx && size) setup(ctx, size);
  };

  const syncRegistration = () => {
    const want = live && !destroyed && visible > 0 && size !== null && currentDraw() !== undefined;
    if (want && !unregister) {
      unregister = register({
        id: read().id,
        lane: "canvas",
        tick: paint,
        visibility: () => visible,
        priority: read().priority ?? 0,
      });
    } else if (!want && unregister) {
      unregister();
      unregister = null;
    }
  };

  const resize = (w: number, h: number, force: boolean) => {
    const dpr = getStageDpr();
    if (!force && isIgnorableResize(size, w, h, dpr, coarsePointer)) return;
    if (w <= 0 || h <= 0) return;
    size = { w, h, dpr };
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    runSetup();
    // RO callbacks run after layout and before paint: no blank frame.
    paint(0, performance.now());
    syncRegistration();
  };

  const resizeObserver =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver((entries) => {
          const entry = entries[entries.length - 1];
          if (entry) resize(entry.contentRect.width, entry.contentRect.height, false);
        })
      : null;
  if (resizeObserver) {
    resizeObserver.observe(wrap);
  } else {
    const rect = wrap.getBoundingClientRect();
    resize(rect.width, rect.height, false);
  }

  // The DPR cap depends on the viewport width, which can cross 480px (or the
  // window can move to another screen) without the wrapper changing size.
  const onWindowResize = () => {
    if (size && getStageDpr() !== size.dpr) resize(size.w, size.h, true);
  };
  window.addEventListener("resize", onWindowResize);

  const visibilityObserver =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(
          (entries) => {
            const entry = entries[entries.length - 1];
            if (!entry) return;
            visible = entry.isIntersecting ? Math.max(entry.intersectionRatio, 0.01) : 0;
            syncRegistration();
          },
          { rootMargin: STAGE_VISIBILITY_MARGIN, threshold: VISIBILITY_THRESHOLDS }
        )
      : null;
  if (visibilityObserver) visibilityObserver.observe(wrap);
  else visible = 1;

  let loadObserver: IntersectionObserver | null = null;
  const loader = read().load;
  if (loader) {
    const startLoading = () => {
      loadObserver?.disconnect();
      loadObserver = null;
      loader()
        .then((mod) => {
          if (destroyed) return;
          loaded = resolveRenderer(mod);
          runSetup();
          paint(0, performance.now());
          syncRegistration();
        })
        .catch((error: unknown) => {
          // The poster simply stays; the page is complete without the canvas.
          console.error(`[landing] stage "${read().id}" renderer failed to load`, error);
        });
    };
    if (typeof IntersectionObserver !== "undefined") {
      const margin = read().loadMargin ?? STAGE_LOAD_MARGIN_PX;
      loadObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) startLoading();
        },
        { rootMargin: `${margin}px 0px` }
      );
      loadObserver.observe(wrap);
    } else {
      startLoading();
    }
  }

  syncRegistration();

  return {
    requestDraw: () => paint(0, performance.now()),
    destroy: () => {
      destroyed = true;
      unregister?.();
      unregister = null;
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      loadObserver?.disconnect();
      window.removeEventListener("resize", onWindowResize);
      // Back to the poster if the stage is switched off (e.g. reduced motion turned on).
      wrap.removeAttribute("data-live");
    },
  };
}

export function useCanvasStage(options: CanvasStageOptions): CanvasStage {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  const controllerRef = useRef<StageController | null>(null);

  const reduced = usePrefersReducedMotion();
  const { id, live = true, enabled = true, staticWhenReduced = false } = options;
  const active = enabled && (!reduced || staticWhenReduced);
  const animate = live && !reduced;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!active || !wrap || !canvas) return;
    const controller = mountStage(wrap, canvas, () => optionsRef.current, animate);
    controllerRef.current = controller;
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, [id, active, animate]);

  const requestDraw = useCallback(() => controllerRef.current?.requestDraw(), []);
  return useMemo(() => ({ wrapRef, canvasRef, requestDraw }), [requestDraw]);
}
