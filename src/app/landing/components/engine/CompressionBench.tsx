"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { RTL_LOCALES } from "@/i18n/config";
import type { LandingStats } from "../../landingTypes";
import { usePrefersReducedMotion } from "../../landingMotion";
import { canAnimate, usePaused } from "../../runtime/heartbeat";
import { useCanvasStage } from "../../runtime/useCanvasStage";
import { MagneticButton, SimBadge, Terminal, Toggle, type TypeLineProps } from "../primitives";
import { cx, numberFormat, watchView } from "../primitives/primitiveKit";
import {
  BENCH_COMPACT,
  BENCH_WIDE,
  PROMPT_ROWS,
  PROMPT_TILES,
  STATUS_LINE,
  anchorCss,
  envelopeAt,
  hitHeaders,
  lensAnchor,
  lensRates,
  missHeaders,
  promptOutcome,
  promptTiles,
  survivalByStage,
  type Anchor,
  type BenchGeometry,
  type PromptTile,
} from "./benchModel";
import type { BenchInput } from "./benchRender";

/**
 * Part A of the engine room (spec §6.8): the compression bench.
 *
 * A full-bleed process flow, prompt source → semantic-cache mirror → the 12
 * engines as lenses in stack order → upstream. Three layers share one
 * geometry (`benchModel.ts`):
 *   1. the server-rendered poster: the static before/after bench (the whole
 *      picture under reduced motion);
 *   2. the canvas (`benchRender.ts`, loaded on demand): the live grain beam,
 *      shimmering lenses and the prompt flights;
 *   3. the DOM overlay: lens labels and their hit targets, the source and
 *      mirror captions.
 *
 * "New prompt" sends a fresh prompt (cache MISS: the stack runs, and the
 * compression header's `tokens=` annotation counts this prompt's tiles before
 * and after); "Send it again" repeats it (cache HIT, the port stays dark). The header terminal types the outcome when the tiles
 * land, so every example value comes from the illustration itself.
 */

type RendererModule = typeof import("./benchRender");

type Exchange = {
  seq: number;
  kind: "miss" | "hit";
  /** Tiles removed by the stack (MISS); 0 on a HIT. */
  savings: number;
};

const TERMINAL_TITLE = "POST /v1/chat/completions";
/** Fallback landing times (ms) when the canvas is not ticking (frozen, off screen). */
const LAND_FALLBACK_MS = { miss: 4200, hit: 2900 } as const;
/** The poster's "after" block: survivors packed in this many rows. */
const AFTER_ROWS = 6;

function geometryVars(g: BenchGeometry, p: "w" | "c"): Record<string, string> {
  const srcTop = g.beamY - ((PROMPT_ROWS - 1) * g.rowPitch + g.tileH) / 2;
  return {
    [`--${p}-h`]: `${g.h}px`,
    [`--${p}-beam`]: `${g.beamY}px`,
    [`--${p}-env0`]: `${g.env0}px`,
    [`--${p}-pitch`]: `${g.rowPitch}px`,
    [`--${p}-tile-h`]: `${g.tileH}px`,
    [`--${p}-src-w`]: anchorCss(g.srcW),
    [`--${p}-src-top`]: `${srcTop}px`,
    [`--${p}-mirror-top`]: `${g.mirrorTop}px`,
    [`--${p}-mirror-bottom`]: `${g.mirrorBottom}px`,
    [`--${p}-lens-rx`]: `${g.lensRx}px`,
    [`--${p}-lens-ry`]: `${g.lensRy}px`,
    [`--${p}-mark-y`]: `${g.markY}px`,
    [`--${p}-label-y`]: `${g.labelY}px`,
    [`--${p}-port-r`]: `${g.portR}px`,
  };
}

function midAnchor(a: Anchor, b: Anchor): Anchor {
  return { a: (a.a + b.a) / 2, b: (a.b + b.b) / 2 };
}

/** Inline vars for an element placed at an anchor in both geometries. */
function atVars(wide: Anchor, compact: Anchor, extra?: Record<string, string | number>) {
  return { "--xw": anchorCss(wide), "--xc": anchorCss(compact), ...extra } as CSSProperties;
}

/** ◇ lossless / ◆ lossy. */
function Mark({ lossy }: { lossy: boolean }) {
  return <span className="bench-mark" data-lossy={lossy ? "" : undefined} aria-hidden="true" />;
}

export default function CompressionBench({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const rtl = (RTL_LOCALES as readonly string[]).includes(locale);
  const fmt = useCallback((n: number) => numberFormat(locale).format(n), [locale]);
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const engines = stats.compressionEngineList;
  const lensCount = engines.length;

  const [losslessOnly, setLosslessOnly] = useState(false);
  const [seed, setSeed] = useState(0);
  const [shown, setShown] = useState<Exchange>(() => ({
    seq: 0,
    kind: "miss",
    savings: promptOutcome(0, engines, false).removed,
  }));
  /** The engine picked by a click or tap (`aria-pressed`). */
  const [selected, setSelected] = useState(-1);
  /** The engine under the mouse or keyboard focus: highlighted, never "pressed". */
  const [hover, setHover] = useState(-1);
  const highlight = hover >= 0 ? hover : selected;
  const [renderer, setRenderer] = useState<RendererModule | null>(null);

  const benchRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const lensListRef = useRef<HTMLUListElement>(null);
  const seqRef = useRef(0);
  const pendingRef = useRef<{ exchange: Exchange; timer: number } | null>(null);
  const inputRef = useRef<BenchInput | null>(null);

  const tiles = useMemo(() => promptTiles(seed), [seed]);
  const rates = useMemo(() => lensRates(engines, losslessOnly), [engines, losslessOnly]);

  const land = useCallback((seq: number) => {
    const pending = pendingRef.current;
    if (!pending || pending.exchange.seq !== seq) return;
    window.clearTimeout(pending.timer);
    pendingRef.current = null;
    setShown(pending.exchange);
  }, []);

  const getInput = useCallback((): BenchInput => {
    if (!inputRef.current) {
      inputRef.current = {
        rtl,
        lossy: Uint8Array.from(engines, (e) => (e.lossy ? 1 : 0)),
        rates: new Float32Array(lensCount),
        focus: -1,
        powered: false,
        prompt: [],
        flight: { seq: 0, kind: "miss", issuedAt: 0, removedAt: new Int8Array(PROMPT_TILES) },
        onLand: () => {},
        box: null,
      };
    }
    return inputRef.current;
  }, [rtl, engines, lensCount]);

  useEffect(
    () => () => {
      if (pendingRef.current) window.clearTimeout(pendingRef.current.timer);
    },
    []
  );

  /* ---- renderer, loaded when the bench is near ---- */
  useEffect(() => {
    if (reduced) return;
    const node = benchRef.current;
    if (!node) return;
    let cancelled = false;
    let started = false;
    const load = () => {
      if (started) return;
      started = true;
      import("./benchRender")
        .then((mod) => {
          if (!cancelled) setRenderer(mod);
        })
        .catch((error: unknown) => {
          // The poster stays: the bench is complete without the canvas.
          console.error("[landing] compression bench renderer failed to load", error);
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

  const { wrapRef, canvasRef, requestDraw } = useCanvasStage({
    id: "compression-bench",
    priority: 1,
    enabled: renderer !== null,
    setup: (ctx, s) => {
      const input = getInput();
      input.box = boxRef.current;
      renderer?.setup(ctx, s, input);
    },
    draw: (ctx, s, dt, now) => renderer?.draw(ctx, s, dt, now, getInput()),
  });

  // Keep the renderer's view of React state current. While the heartbeat
  // cannot animate (Pause, or the tab hidden), nothing redraws on its own, so
  // every change, and Pause itself, asks for one still frame: the renderer
  // settles it on the final picture.
  useEffect(() => {
    const input = getInput();
    input.rtl = rtl;
    input.rates.set(rates);
    input.focus = highlight;
    input.prompt = tiles;
    input.onLand = land;
    input.box = boxRef.current;
    if (!canAnimate()) requestDraw();
  }, [getInput, rtl, rates, highlight, tiles, land, requestDraw, paused, shown]);

  /* ---- power-on: lenses and labels light up staggered as the bench scrolls in ---- */
  useEffect(() => {
    const node = benchRef.current;
    const list = lensListRef.current;
    if (!node) return;
    if (reduced) {
      list?.removeAttribute("data-power");
      getInput().powered = true;
      return;
    }
    if (list && node.getBoundingClientRect().top > window.innerHeight) {
      list.setAttribute("data-power", "armed");
    }
    return watchView(node, {
      enterThreshold: 0.25,
      onEnter: () => {
        getInput().powered = true;
        if (list?.hasAttribute("data-power")) list.setAttribute("data-power", "on");
      },
    });
  }, [reduced, getInput]);

  /* ---- the two sends ---- */
  const send = useCallback(
    (kind: "miss" | "hit") => {
      const nextSeed = kind === "miss" ? seed + 1 : seed;
      const outcome = promptOutcome(nextSeed, engines, losslessOnly);
      const seq = ++seqRef.current;
      const exchange: Exchange = {
        seq,
        kind,
        savings: kind === "miss" ? outcome.removed : 0,
      };
      if (kind === "miss") setSeed(nextSeed);
      if (pendingRef.current) window.clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;

      const live = wrapRef.current?.getAttribute("data-live") === "on";
      if (!canAnimate() || !live) {
        // Still: the outcome shows at once (the sync effect redraws the bench).
        setShown(exchange);
        return;
      }
      const input = getInput();
      input.prompt = promptTiles(nextSeed);
      input.flight = {
        seq,
        kind,
        issuedAt: performance.now(),
        removedAt: outcome.removedAt,
      };
      const timer = window.setTimeout(() => land(seq), LAND_FALLBACK_MS[kind]);
      pendingRef.current = { exchange, timer };
    },
    [seed, engines, losslessOnly, getInput, land, wrapRef]
  );

  /* ---- terminal ---- */
  const lines = useMemo<TypeLineProps[]>(() => {
    const headers = shown.kind === "miss" ? missHeaders(shown.savings) : hitHeaders();
    return [
      {
        id: "status",
        text: STATUS_LINE,
        tokens: [{ t: "HTTP/1.1 " }, { t: "200", c: "num" }, { t: " OK" }],
      },
      ...headers.map((h, i) => {
        const valueClass = h.value === "HIT" ? "accent" : /^[\d.]+$/.test(h.value) ? "num" : "str";
        // One token per `; ` field, so a long value wraps between fields, never inside one.
        const fields = h.value.split("; ");
        const valueTokens = fields.flatMap((field, k) => {
          const token = {
            t: k < fields.length - 1 ? `${field};` : field,
            c: valueClass as "accent" | "num" | "str",
          };
          return k === 0 ? [token] : [{ t: " " }, token];
        });
        return {
          id: `h${i}`,
          text: `${h.name}: ${h.value}`,
          tokens: [{ t: h.name, c: "kw" as const }, { t: ": " }, ...valueTokens],
          caret: i === headers.length - 1,
        };
      }),
    ];
  }, [shown]);

  /* ---- geometry vars ---- */
  const rootVars = useMemo(
    () =>
      ({ ...geometryVars(BENCH_WIDE, "w"), ...geometryVars(BENCH_COMPACT, "c") }) as CSSProperties,
    []
  );
  const lensAnchors = useMemo(
    () =>
      engines.map((_, k) => ({
        w: lensAnchor(BENCH_WIDE, k, lensCount),
        c: lensAnchor(BENCH_COMPACT, k, lensCount),
      })),
    [engines, lensCount]
  );

  const enginesTitle = t("compressionEnginesTitle", { count: fmt(stats.compressionEngines) });
  const classWord = (lossy: boolean) => (lossy ? t("benchLossy") : t("benchLossless"));
  const lit = highlight >= 0 ? engines[highlight] : null;

  const toggleSelected = (k: number) => setSelected((current) => (current === k ? -1 : k));
  const hoverOn = (k: number) => setHover(k);
  const hoverOff = (k: number) => setHover((h) => (h === k ? -1 : h));

  const legend = (className: string) => (
    <p className={cx("bench-legend", className)}>
      <span>
        <Mark lossy={false} /> {t("benchLossless")}
      </span>
      <span>
        <Mark lossy /> {t("benchLossy")}
      </span>
    </p>
  );

  return (
    <div className="bench-wrap" data-lossless={losslessOnly ? "" : undefined}>
      {/* ---- the bench ---- */}
      <div ref={benchRef} className="bench" style={rootVars}>
        <div ref={wrapRef} className="stage bench-stage" aria-hidden="true">
          <BenchPoster
            tiles={tiles}
            rates={rates}
            lensAnchors={lensAnchors}
            lossy={engines.map((e) => e.lossy)}
            kind={shown.kind}
            survivors={PROMPT_TILES - shown.savings}
          />
          <canvas ref={canvasRef} aria-hidden="true" />
        </div>
        <div className="bench-overlay">
          <div ref={boxRef} className="bench-box">
            <p className="bench-cap bench-cap-src readout">
              {fmt(PROMPT_TILES)} {t("instrumentTokens")}
            </p>
            <p
              className="bench-cap bench-cap-mirror bench-at"
              style={atVars(BENCH_WIDE.mirror, BENCH_COMPACT.mirror)}
            >
              <span>{t("compressionCacheTitle")}</span>
            </p>
            {legend("bench-legend-band")}
            <p className="bench-readout readout" aria-live="polite">
              {lit ? (
                <>
                  <Mark lossy={lit.lossy} />
                  <span dir="ltr" className="bench-readout-name">
                    {lit.label}
                  </span>
                  <span className="bench-readout-class">· {classWord(lit.lossy)}</span>
                </>
              ) : null}
            </p>
            <ul ref={lensListRef} className="bench-lenses" aria-label={enginesTitle}>
              {engines.map((engine, k) => (
                <li
                  key={engine.id}
                  className="bench-lens bench-at"
                  style={atVars(lensAnchors[k].w, lensAnchors[k].c, { "--i": k })}
                  data-off={losslessOnly && engine.lossy ? "" : undefined}
                  data-hi={highlight === k ? "" : undefined}
                >
                  <button
                    type="button"
                    className="bench-lens-hit"
                    aria-pressed={selected === k}
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse") hoverOn(k);
                    }}
                    onPointerLeave={(event) => {
                      if (event.pointerType === "mouse") hoverOff(k);
                    }}
                    onFocus={() => hoverOn(k)}
                    onBlur={() => hoverOff(k)}
                    onClick={() => toggleSelected(k)}
                  >
                    <span className="bench-lens-label" dir="ltr" aria-hidden="true">
                      {engine.label}
                    </span>
                    <span className="sr-only">
                      {engine.label} · {classWord(engine.lossy)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ---- phone and touch tablets: the engines as one snap row of chips ---- */}
      <ul className="bench-chips" aria-label={enginesTitle}>
        {engines.map((engine, k) => (
          <li key={engine.id}>
            <button
              type="button"
              className="bench-chip"
              aria-pressed={selected === k}
              data-off={losslessOnly && engine.lossy ? "" : undefined}
              data-hi={highlight === k ? "" : undefined}
              onFocus={() => hoverOn(k)}
              onBlur={() => hoverOff(k)}
              onClick={() => toggleSelected(k)}
            >
              <Mark lossy={engine.lossy} />
              <span dir="ltr">{engine.label}</span>
              <span className="sr-only"> · {classWord(engine.lossy)}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* ---- the response, the two sends and the lossless switch; the facts beside it ---- */}
      <div className="bench-out station-inner">
        <Terminal
          className="bench-term"
          title={TERMINAL_TITLE}
          lines={lines}
          restartKey={shown.seq}
          footer={
            <div className="bench-foot">
              <div className="bench-actions">
                <MagneticButton
                  variant="gold"
                  icon="play"
                  onClick={() => send("miss")}
                  className="bench-btn"
                >
                  {t("benchNewPrompt")}
                </MagneticButton>
                <MagneticButton variant="ghost" onClick={() => send("hit")} className="bench-btn">
                  {t("benchSendAgain")}
                </MagneticButton>
              </div>
              <div className="bench-switch">
                <Toggle
                  pressed={losslessOnly}
                  onChange={setLosslessOnly}
                  label={t("benchLosslessOnly")}
                  className="bench-toggle"
                />
                {legend("bench-legend-foot")}
              </div>
            </div>
          }
        />
        <div className="bench-notes">
          <SimBadge note={t("benchIllustration")} className="bench-badge" />
          <dl className="bench-facts">
            <div>
              <dt>{enginesTitle}</dt>
              <dd>{t("compressionEnginesDesc")}</dd>
            </div>
            <div>
              <dt>{t("compressionCacheTitle")}</dt>
              <dd>{t("compressionCacheDesc")}</dd>
            </div>
            <div>
              <dt>{t("compressionSavingsTitle")}</dt>
              <dd>{t("compressionSavingsDesc")}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Poster: the static bench (server-rendered; the whole picture when still) */
/* ------------------------------------------------------------------------ */

function BenchPoster({
  tiles,
  rates,
  lensAnchors,
  lossy,
  kind,
  survivors,
}: {
  tiles: readonly PromptTile[];
  rates: Float32Array;
  lensAnchors: readonly { w: Anchor; c: Anchor }[];
  lossy: readonly boolean[];
  kind: "miss" | "hit";
  survivors: number;
}) {
  const survival = survivalByStage(rates);
  const n = lensAnchors.length;
  const segments: ReactNode[] = [];
  const srcEnd = { w: BENCH_WIDE.srcW, c: BENCH_COMPACT.srcW };
  const portStart = {
    w: { a: BENCH_WIDE.port.a, b: BENCH_WIDE.port.b - BENCH_WIDE.portR },
    c: { a: BENCH_COMPACT.port.a, b: BENCH_COMPACT.port.b - BENCH_COMPACT.portR },
  };
  for (let k = 0; k <= n; k++) {
    const from = k === 0 ? srcEnd : lensAnchors[k - 1];
    const to = k === n ? portStart : lensAnchors[k];
    const ratio = envelopeAt(1, survival[k]);
    segments.push(
      <span
        key={k}
        className="bench-seg"
        style={
          {
            "--x1w": anchorCss(from.w),
            "--x1c": anchorCss(from.c),
            "--x2w": anchorCss(to.w),
            "--x2c": anchorCss(to.c),
            "--r": Math.round(ratio * 1000) / 1000,
          } as CSSProperties
        }
      />
    );
  }
  const afterAt = {
    w: midAnchor(BENCH_WIDE.lensLast, BENCH_WIDE.port),
    c: midAnchor(BENCH_COMPACT.lensLast, BENCH_COMPACT.port),
  };

  return (
    <div className="stage-poster bench-poster" data-mode={kind}>
      <span className="bench-rail" />
      <div className="bench-box">
        {segments}
        <div className="bench-src">
          {tiles.map((tile, i) => (
            <span
              key={i}
              className="bench-tile"
              style={
                {
                  insetInlineStart: `${tile.x * 100}%`,
                  width: `${tile.w * 100}%`,
                  "--row": tile.row,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <span
          className="bench-mirror bench-at"
          style={atVars(BENCH_WIDE.mirror, BENCH_COMPACT.mirror)}
        />
        <span
          className="bench-reflect bench-at"
          style={atVars(BENCH_WIDE.mirror, BENCH_COMPACT.mirror)}
        >
          <svg viewBox="0 0 64 40" aria-hidden="true">
            <path d="M62 8 C 40 8, 30 30, 4 30" />
            <path d="M12 23 L 4 30 L 12 37" />
          </svg>
        </span>
        {lensAnchors.map((anchor, k) => (
          <span
            key={k}
            className="bench-plens bench-at"
            style={atVars(anchor.w, anchor.c)}
            data-lossy={lossy[k] ? "" : undefined}
            data-off={rates[k] > 0 ? undefined : ""}
          >
            <i />
          </span>
        ))}
        <span className="bench-after bench-at" style={atVars(afterAt.w, afterAt.c)}>
          <span className="bench-after-grid">
            {Array.from({ length: survivors }, (_, i) => (
              <i key={i} style={{ "--k": i % AFTER_ROWS } as CSSProperties} />
            ))}
          </span>
        </span>
        <span
          className={cx("bench-port", "bench-at")}
          style={atVars(BENCH_WIDE.port, BENCH_COMPACT.port)}
        >
          <i />
        </span>
      </div>
    </div>
  );
}
