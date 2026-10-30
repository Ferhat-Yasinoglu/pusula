"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslations } from "next-intl";
import type { ScoringFactor } from "../../landingTypes";
import { usePrefersReducedMotion } from "../../landingMotion";
import { dispatch, getWorld } from "../../runtime/deckStore";
import { canAnimate, usePaused } from "../../runtime/heartbeat";
import { RECALL, springAt, stepSpring, type SpringState } from "../../runtime/springs";
import { useDomLoop } from "../../runtime/useDomLoop";
import { useScrollProgress } from "../../runtime/scrollProgress";
import { act } from "../../sim/landingSim";
import { LiveNumber, type LiveNumberHandle } from "../primitives";
import { watchView } from "../primitives/primitiveKit";
import {
  ROSE_DISC,
  ROSE_FRAME_H,
  ROSE_FRAME_W,
  ROSE_LABEL_GAP,
  ROSE_R,
  ROSE_SILENT_TO,
  ROSE_VIEW,
  SILENT_EPS,
  clamp01,
  easeOutCubic,
  factorKey,
  fillAt,
  fillTransform,
  framePercent,
  growAt,
  kitePoints,
  labelAnchor,
  pointBearing,
  pinnedReveal,
  pointRadius,
  ratioForDistance,
  type PinGeometry,
  rawWeightForRatio,
  rawWeightForShare,
  weightRatios,
} from "./routingKit";

/**
 * The rose of sixteen (spec §6.5, part A): one compass point per auto scoring
 * factor, in `stats.scoringFactors` order (weight descending) clockwise from
 * north, each a kite whose length is its real shipped weight. Inside each
 * brass kite a bright gold copy rises to the focus candidate's measurement
 * for the sample request; the centre disc adds them up as Σ wᵢ·xᵢ.
 *
 * Motion, all on the heartbeat's dom lane and only while the rose is near the
 * viewport: the reveal (points grow, then fill; driven by `layout`: the pinned
 * scroll progress, the traverse progress, or a 2.4 s timer on phone), the
 * RECALL spring that re-proportions the points when the weights change, the
 * 420 ms refills, and the running score. The points breathe by CSS.
 *
 * Retune: drag a tip radially (fine pointer), or use the hidden sliders (one
 * tab stop; Left/Right move round the rose, Up/Down ±.01 of the vote). Both
 * dispatch `act.setWeight` so the whole deck — hero needle, map routes —
 * follows the visitor's weights.
 *
 * Server, reduced motion and Pause: points at full size, fills at their final
 * values, every control instant.
 */

export type RoseLayout = "pinned" | "wide" | "compact";

export type FactorRoseProps = {
  factors: readonly ScoringFactor[];
  /** Live normalised weights (deck), in `factors` order. */
  weights: readonly number[];
  /** The focus candidate's measurements for the rose sample, in `factors` order. */
  fills: readonly number[];
  /** Changes whenever a new refill should play (sample, focus, retune…). */
  fillKey: string;
  /** Catalog id of the focus candidate (centre disc). */
  focusName: string;
  /** Σ wᵢ·xᵢ for the focus candidate (what the disc lands on). */
  focusScore: number;
  locale: string;
  layout: RoseLayout;
  /** The pinned track's traverse progress (0..1), read every frame while pinned. */
  trackProgress: MutableRefObject<number>;
  /** The pinned stage's geometry (measured by the station). */
  pinGeo: MutableRefObject<PinGeometry>;
  /** Called once when the first reveal has played (idle cycling may start). */
  onPlayed: () => void;
  /** The visitor retuned (drag, key, range, reset). */
  onRetune: () => void;
};

const N_MAX = 32;
const SCORE_FORMAT: Intl.NumberFormatOptions = {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
};
const VOTE_FORMAT: Intl.NumberFormatOptions = {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
};
const REFILL_MS = 420;
const REFILL_STAGGER_MS = 26;
const TIMER_S = 2.4;
/** A scroll-driven reveal left resting this long finishes by itself, over REST_FINISH_S. */
const REST_MS = 1200;
const REST_FINISH_S = 1.8;
const DRAG_MAX_RATIO = 1.35;

/** Wedge hit area of a point, in its local frame (axis up). */
function wedgePath(inner: number, outer: number, halfDeg: number): string {
  const a = (halfDeg * Math.PI) / 180;
  const s = Math.sin(a);
  const c = Math.cos(a);
  const p = (r: number, sign: number) =>
    `${Math.round(sign * r * s * 100) / 100} ${Math.round(-r * c * 100) / 100}`;
  return `M${p(inner, -1)} L${p(outer, -1)} A${outer} ${outer} 0 0 1 ${p(outer, 1)} L${p(inner, 1)} A${inner} ${inner} 0 0 0 ${p(inner, -1)}Z`;
}

const TICKS = (() => {
  const out: string[] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i * Math.PI * 2) / 64;
    const major = i % 4 === 0;
    const r0 = ROSE_R + (major ? 2 : 6);
    const r1 = ROSE_R + 12;
    const x0 = Math.round(Math.sin(a) * r0 * 100) / 100;
    const y0 = Math.round(-Math.cos(a) * r0 * 100) / 100;
    const x1 = Math.round(Math.sin(a) * r1 * 100) / 100;
    const y1 = Math.round(-Math.cos(a) * r1 * 100) / 100;
    out.push(`M${x0} ${y0}L${x1} ${y1}`);
  }
  return out.join("");
})();

export default function FactorRose({
  factors,
  weights,
  fills,
  fillKey,
  focusName,
  focusScore,
  locale,
  layout,
  trackProgress,
  pinGeo,
  onPlayed,
  onRetune,
}: FactorRoseProps) {
  const t = useTranslations("landing");
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const count = Math.min(factors.length, N_MAX);
  const rtl = locale === "fa";

  const figureRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const traverse = useScrollProgress(figureRef, { mode: "traverse" });
  const scoreRef = useRef<LiveNumberHandle>(null);

  const [hot, setHot] = useState(-1);
  const [focusRing, setFocusRing] = useState(-1);

  const voteFormat = useMemo(() => new Intl.NumberFormat(locale, VOTE_FORMAT), [locale]);
  const valueFormat = useMemo(
    () => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [locale]
  );
  const indexFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const label = useCallback(
    (id: string) => {
      const key = factorKey(id);
      return t.has(key) ? t(key) : id;
    },
    [t]
  );
  const vote = useCallback(
    (w: number) =>
      w > SILENT_EPS
        ? t("routingVote", { percent: voteFormat.format(w) })
        : t("routingFactorSilent"),
    [t, voteFormat]
  );

  /* ---- static geometry, from the shipped weights (server and first paint) ---- */
  const shipped = useMemo(() => factors.slice(0, count).map((f) => f.weight), [factors, count]);
  const shippedRatios = useMemo(() => weightRatios(shipped), [shipped]);
  const initialKites = useMemo(
    () => shippedRatios.map((q) => kitePoints(pointRadius(q))),
    [shippedRatios]
  );
  // The server and the first client render show the final reveal state; the loop owns it after.
  const [initialFills] = useState(() => fills.slice(0, count).map((x) => fillTransform(x)));
  const [initialScore] = useState(focusScore);

  /* ---- imperative state (owned by the loop) ---- */
  const els = useRef<{
    grow: (SVGGElement | null)[];
    hi: (SVGPolygonElement | null)[];
    lo: (SVGPolygonElement | null)[];
    edge: (SVGPolygonElement | null)[];
    fill: (SVGPolygonElement | null)[];
    kite: (SVGGElement | null)[];
    silent: (SVGGElement | null)[];
  }>({ grow: [], hi: [], lo: [], edge: [], fill: [], kite: [], silent: [] });
  const sim = useRef<{
    springs: SpringState[];
    drawnRatio: Float64Array;
    drawnGrow: Float64Array;
    drawnFill: Float64Array;
    fillFrom: Float64Array;
    fillTo: Float64Array;
    tweenAt: number;
    seq: number;
    timerOn: boolean;
    played: boolean;
    lastScore: number;
    /** Scroll progress last seen, how long it has rested, and the self-finishing reveal. */
    lastP: number;
    stillMs: number;
    auto: number;
  } | null>(null);
  sim.current ??= {
    springs: shippedRatios.map((q) => springAt(q)),
    drawnRatio: Float64Array.from(shippedRatios),
    drawnGrow: new Float64Array(count).fill(1),
    drawnFill: Float64Array.from(fills.slice(0, count)),
    fillFrom: Float64Array.from(fills.slice(0, count)),
    fillTo: Float64Array.from(fills.slice(0, count)),
    tweenAt: -Infinity,
    seq: 0,
    timerOn: false,
    played: false,
    lastScore: focusScore,
    lastP: -1,
    stillMs: 0,
    auto: 0,
  };

  const live = useRef({ weights, fills, onPlayed, layout });
  useEffect(() => {
    live.current = { weights, fills, onPlayed, layout };
  });

  const ratios = useMemo(() => weightRatios(weights.slice(0, count)), [weights, count]);
  const ratiosRef = useRef(ratios);
  useEffect(() => {
    ratiosRef.current = ratios;
  }, [ratios]);

  /* ---- painters ---- */
  const paintKite = useCallback((i: number, ratio: number) => {
    const e = els.current;
    const silent = ratio <= 0.0005;
    const pts = kitePoints(pointRadius(ratio));
    e.hi[i]?.setAttribute("points", pts.hi);
    e.lo[i]?.setAttribute("points", pts.lo);
    e.edge[i]?.setAttribute("points", pts.full);
    e.fill[i]?.setAttribute("points", pts.full);
    e.kite[i]?.setAttribute("opacity", silent ? "0" : "1");
    e.silent[i]?.setAttribute("opacity", silent ? "1" : "0");
  }, []);

  const paintGrow = useCallback((i: number, g: number) => {
    const node = els.current.grow[i];
    if (!node) return;
    if (g >= 0.999) node.removeAttribute("transform");
    else node.setAttribute("transform", `scale(${Math.round(g * 1000) / 1000})`);
  }, []);

  const paintFill = useCallback((i: number, x: number) => {
    els.current.fill[i]?.setAttribute("transform", fillTransform(x));
  }, []);

  const paintScore = useCallback((score: number) => {
    const s = sim.current;
    if (!s || Math.abs(score - s.lastScore) < 0.0004) return;
    s.lastScore = score;
    scoreRef.current?.set(score);
  }, []);

  /** Everything at rest on its target: server look, reduced motion, Pause. */
  const paintStatic = useCallback(() => {
    const s = sim.current;
    if (!s) return;
    const q = ratiosRef.current;
    const x = live.current.fills;
    for (let i = 0; i < count; i++) {
      s.springs[i].angle = q[i] ?? 0;
      s.springs[i].velocity = 0;
      s.drawnRatio[i] = q[i] ?? 0;
      paintKite(i, q[i] ?? 0);
      s.drawnGrow[i] = 1;
      paintGrow(i, 1);
      s.drawnFill[i] = x[i] ?? 0;
      s.fillFrom[i] = x[i] ?? 0;
      s.fillTo[i] = x[i] ?? 0;
      paintFill(i, x[i] ?? 0);
    }
    s.tweenAt = -Infinity;
    let score = 0;
    const w = live.current.weights;
    for (let i = 0; i < count; i++) score += (w[i] ?? 0) * (x[i] ?? 0);
    paintScore(score);
  }, [count, paintKite, paintGrow, paintFill, paintScore]);

  // Reduced motion or Pause: the reveal counts as played and the rose rests on its targets.
  useEffect(() => {
    if (!reduced && !paused) return;
    const s = sim.current;
    if (s && !s.played) {
      s.played = true;
      live.current.onPlayed();
    }
    paintStatic();
  }, [reduced, paused, paintStatic]);

  // Without a running loop, weight and fill changes land at once.
  useEffect(() => {
    if (!canAnimate()) paintStatic();
  }, [ratios, fills, fillKey, paintStatic]);

  // A refill: tween every point from what it shows now to the new measurement.
  useEffect(() => {
    const s = sim.current;
    if (!s || !s.played) return;
    for (let i = 0; i < count; i++) {
      s.fillFrom[i] = s.drawnFill[i];
      s.fillTo[i] = fills[i] ?? 0;
    }
    s.tweenAt = performance.now();
  }, [fills, fillKey, count]);

  // Phone: the reveal runs on a timer once the rose is a third on screen.
  useEffect(() => {
    const node = figureRef.current;
    if (!node) return;
    return watchView(node, {
      enterThreshold: 0.35,
      onEnter: () => {
        if (sim.current) sim.current.timerOn = true;
      },
    });
  }, []);

  // The CSS breathing runs only while the rose is near the viewport.
  const roseRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = roseRef.current;
    if (!node) return;
    return watchView(node, {
      enterMargin: "100px",
      onEnter: () => node.setAttribute("data-live", ""),
      onExit: () => node.removeAttribute("data-live"),
    });
  }, []);

  useDomLoop(
    "routing-rose",
    (dt, now) => {
      const s = sim.current;
      if (!s) return;
      const { weights: w, fills: x, layout: mode } = live.current;

      // 1. Reveal sequence (until it has played once).
      if (!s.played) {
        if (mode === "compact") {
          if (s.timerOn) s.seq = Math.min(1, s.seq + dt / TIMER_S);
        } else {
          // Scroll-driven; a visitor who stops mid-way sees it finish on its own.
          const pinned =
            mode === "pinned" ? pinnedReveal(trackProgress.current, pinGeo.current) : 0;
          const p = mode === "pinned" ? pinned : traverse.current;
          if (Math.abs(p - s.lastP) < 1e-4) s.stillMs += dt * 1000;
          else {
            s.stillMs = 0;
            s.lastP = p;
          }
          if (s.stillMs > REST_MS && traverse.current > 0.3) {
            s.auto = Math.min(1, Math.max(s.auto, s.seq) + dt / REST_FINISH_S);
          }
          s.seq =
            mode === "pinned"
              ? Math.max(pinned, s.auto)
              : Math.max(s.seq, clamp01((traverse.current - 0.12) / 0.38), s.auto);
        }
        if (s.seq >= 0.999) {
          s.played = true;
          for (let i = 0; i < count; i++) {
            s.fillFrom[i] = x[i] ?? 0;
            s.fillTo[i] = x[i] ?? 0;
          }
          live.current.onPlayed();
        }
      }

      // 2. Weight springs (RECALL): re-proportion the points.
      const q = ratiosRef.current;
      for (let i = 0; i < count; i++) {
        const spring = s.springs[i];
        const target = q[i] ?? 0;
        if (spring.angle !== target || spring.velocity !== 0) {
          stepSpring(spring, target, dt, RECALL);
          if (Math.abs(spring.angle - target) < 0.0005 && Math.abs(spring.velocity) < 0.002) {
            spring.angle = target;
            spring.velocity = 0;
          }
        }
        const ratio = Math.max(0, spring.angle);
        if (Math.abs(ratio - s.drawnRatio[i]) > 0.0002) {
          s.drawnRatio[i] = ratio;
          paintKite(i, ratio);
        }
      }

      // 3. Grow and fill.
      let score = 0;
      for (let i = 0; i < count; i++) {
        let g = 1;
        let f: number;
        if (!s.played) {
          g = growAt(s.seq, i, count);
          f = (x[i] ?? 0) * fillAt(s.seq, i, count);
        } else {
          const u = clamp01((now - s.tweenAt - i * REFILL_STAGGER_MS) / REFILL_MS);
          f = s.fillFrom[i] + (s.fillTo[i] - s.fillFrom[i]) * easeOutCubic(u);
        }
        if (Math.abs(g - s.drawnGrow[i]) > 0.0005) {
          s.drawnGrow[i] = g;
          paintGrow(i, g);
        }
        if (Math.abs(f - s.drawnFill[i]) > 0.0005) {
          s.drawnFill[i] = f;
          paintFill(i, f);
        }
        score += (w[i] ?? 0) * s.drawnFill[i];
      }
      paintScore(score);
    },
    { target: figureRef, enabled: !reduced && !paused }
  );

  /* ---- retune ---- */
  const drag = useRef<{ index: number; inverse: DOMMatrix | null; pointer: number } | null>(null);

  const setShare = useCallback(
    (i: number, share: number) => {
      const factor = factors[i];
      if (!factor) return;
      const raw = rawWeightForShare(getWorld().weights, i, share);
      dispatch(act.setWeight(factor.id, raw), { user: true });
      onRetune();
    },
    [factors, onRetune]
  );

  const onPointerDown = (i: number) => (event: ReactPointerEvent<SVGPathElement>) => {
    setHot(i);
    if (event.pointerType === "touch") return; // phone: a tap shows the caption; ranges retune
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { index: i, inverse: matrix.inverse(), pointer: event.pointerId };
  };

  const onPointerMove = (i: number) => (event: ReactPointerEvent<SVGPathElement>) => {
    const d = drag.current;
    if (!d || d.index !== i || d.pointer !== event.pointerId || !d.inverse) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(d.inverse);
    const rad = (pointBearing(i, count) * Math.PI) / 180;
    const distance = p.x * Math.sin(rad) - p.y * Math.cos(rad);
    const ratio = Math.min(ratioForDistance(distance), DRAG_MAX_RATIO);
    const factor = factors[i];
    if (!factor) return;
    const raw = rawWeightForRatio(getWorld().weights, i, ratio);
    dispatch(act.setWeight(factor.id, raw), { user: true });
    onRetune();
  };

  const endDrag = (event: ReactPointerEvent<SVGPathElement>) => {
    if (drag.current && drag.current.pointer === event.pointerId) drag.current = null;
  };

  /*
   * The keyboard twins are one tab stop (roving): Left/Right move round the
   * rose (clockwise is Right; the rose is never mirrored), Up/Down retune.
   */
  const [roving, setRoving] = useState(0);
  const sliderRefs = useRef<(HTMLDivElement | null)[]>([]);
  const onSliderKey = (i: number) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const next = (i + (event.key === "ArrowRight" ? 1 : -1) + count) % count;
      setRoving(next);
      sliderRefs.current[next]?.focus();
      return;
    }
    const w = getWorld().weights[i] ?? 0;
    let next: number | null = null;
    switch (event.key) {
      case "ArrowUp":
        next = w + 0.01;
        break;
      case "ArrowDown":
        next = w - 0.01;
        break;
      case "PageUp":
        next = w + 0.05;
        break;
      case "PageDown":
        next = w - 0.05;
        break;
      case "Home":
        next = 0;
        break;
      default:
        return;
    }
    event.preventDefault();
    setShare(i, Math.max(0, next));
  };

  /* ---- render ---- */
  const inner = Math.round(ROSE_DISC * ROSE_R * 100) / 100;
  const silentTo = ROSE_SILENT_TO * ROSE_R;
  const wedge = wedgePath(inner, ROSE_R + 14, 180 / Math.max(count, 1) - 0.5);
  const hotFactor = hot >= 0 ? factors[hot] : undefined;

  return (
    <div ref={roseRef} className="rt-rose" data-hot={hot >= 0 ? "" : undefined}>
      <div
        ref={figureRef}
        className="rt-rose-figure"
        dir="ltr"
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch" && !drag.current) setHot(-1);
        }}
      >
        <svg
          ref={svgRef}
          className="rt-rose-svg"
          viewBox={`${-ROSE_VIEW} ${-ROSE_VIEW} ${ROSE_VIEW * 2} ${ROSE_VIEW * 2}`}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <radialGradient id="rt-disc-grad" cx="50%" cy="38%" r="65%">
              <stop offset="0%" style={{ stopColor: "var(--bezel)" }} />
              <stop offset="100%" style={{ stopColor: "var(--void)" }} />
            </radialGradient>
            {/*
              The measured part of each point is the classic shaded gold rose (a
              bright half and a darker half); the unmeasured rest stays brass.
              Ember (decision) marks only the point under the pointer.
            */}
            <linearGradient id="rt-fill-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" style={{ stopColor: "var(--gold-hi)" }} />
              <stop offset="0.5" style={{ stopColor: "var(--gold-hi)" }} />
              <stop offset="0.5" style={{ stopColor: "var(--gold)" }} />
              <stop offset="1" style={{ stopColor: "var(--gold)" }} />
            </linearGradient>
            <linearGradient id="rt-fill-hot" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" style={{ stopColor: "var(--ember)" }} />
              <stop offset="0.5" style={{ stopColor: "var(--ember)" }} />
              <stop offset="0.5" style={{ stopColor: "var(--ember)", stopOpacity: 0.62 }} />
              <stop offset="1" style={{ stopColor: "var(--ember)", stopOpacity: 0.62 }} />
            </linearGradient>
          </defs>
          {/* compass card: rings, 64 ticks, the weightless radius */}
          <circle className="rt-ring" r={ROSE_R + 12} />
          <circle className="rt-ring rt-ring-soft" r={ROSE_R + 2} />
          <path className="rt-ticks" d={TICKS} />
          <circle className="rt-ring rt-ring-dot" r={pointRadius(0)} />
          <circle className="rt-ring rt-ring-soft" r={pointRadius(0.5)} />
          {Array.from({ length: count }, (_, i) => {
            const bearing = pointBearing(i, count);
            const kite = initialKites[i];
            const silentNow = shippedRatios[i] <= 0.0005;
            return (
              <g
                key={factors[i].id}
                className="rt-pt"
                transform={bearing ? `rotate(${bearing})` : undefined}
                data-hot={hot === i ? "" : undefined}
                data-focus={focusRing === i ? "" : undefined}
              >
                <line className="rt-spoke" x1="0" y1={-inner} x2="0" y2={-(ROSE_R + 2)} />
                <g className="rt-pt-lift">
                  <g
                    ref={(node) => {
                      els.current.grow[i] = node;
                    }}
                    className="rt-pt-grow"
                  >
                    <g className="rt-pt-breathe" style={{ "--rt-i": i } as CSSProperties}>
                      <g
                        ref={(node) => {
                          els.current.silent[i] = node;
                        }}
                        opacity={silentNow ? 1 : 0}
                      >
                        <line className="rt-silent" x1="0" y1={-inner} x2="0" y2={-silentTo} />
                        <circle className="rt-silent-end" cx="0" cy={-silentTo} r="3" />
                      </g>
                      <g
                        ref={(node) => {
                          els.current.kite[i] = node;
                        }}
                        opacity={silentNow ? 0 : 1}
                      >
                        <polygon
                          ref={(node) => {
                            els.current.hi[i] = node;
                          }}
                          className="rt-kite-hi"
                          points={kite.hi}
                        />
                        <polygon
                          ref={(node) => {
                            els.current.lo[i] = node;
                          }}
                          className="rt-kite-lo"
                          points={kite.lo}
                        />
                        <polygon
                          ref={(node) => {
                            els.current.fill[i] = node;
                          }}
                          className="rt-kite-fill"
                          points={kite.full}
                          transform={initialFills[i]}
                        />
                        <polygon
                          ref={(node) => {
                            els.current.edge[i] = node;
                          }}
                          className="rt-kite-edge"
                          points={kite.full}
                        />
                      </g>
                    </g>
                  </g>
                </g>
                <path
                  className="rt-hit"
                  d={wedge}
                  onPointerDown={onPointerDown(i)}
                  onPointerMove={onPointerMove(i)}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onPointerEnter={(event) => {
                    if (event.pointerType !== "touch" && !drag.current) setHot(i);
                  }}
                />
              </g>
            );
          })}
          <circle className="rt-disc" r={inner} fill="url(#rt-disc-grad)" />
          <circle className="rt-disc-rim" r={inner - 5} />
        </svg>

        {/* labels (≥1024) and numbered points (phone): HTML, so type keeps its real size */}
        <div className="rt-rose-labels" aria-hidden="true">
          {factors.slice(0, count).map((factor, i) => {
            const bearing = pointBearing(i, count);
            const anchor = labelAnchor(bearing);
            const wide = framePercent(bearing, ROSE_R + ROSE_LABEL_GAP, ROSE_FRAME_W, ROSE_FRAME_H);
            const num = framePercent(bearing, ROSE_R + 30, ROSE_VIEW * 2, ROSE_VIEW * 2);
            const w = weights[i] ?? 0;
            return (
              <span
                key={factor.id}
                className="rt-label"
                data-h={anchor.h}
                data-v={anchor.v}
                data-hot={hot === i ? "" : undefined}
                data-silent={w <= SILENT_EPS ? "" : undefined}
                style={
                  {
                    "--lx": `${wide.left}%`,
                    "--ly": `${wide.top}%`,
                    "--nx": `${num.left}%`,
                    "--ny": `${num.top}%`,
                  } as CSSProperties
                }
                onPointerEnter={(event) => {
                  if (event.pointerType !== "touch") setHot(i);
                }}
                onPointerDown={() => setHot(i)}
              >
                <span className="rt-label-num readout">{indexFormat.format(i + 1)}</span>
                <span className="rt-label-text" dir={rtl ? "rtl" : "ltr"}>
                  <span className="rt-label-name">{label(factor.id)}</span>
                  <span className="rt-label-vote readout">{vote(w)}</span>
                </span>
              </span>
            );
          })}
        </div>

        <div className="rt-disc-text" aria-hidden="true">
          <span className="rt-disc-auto readout">auto</span>
          <span className="rt-disc-name readout">{focusName}</span>
          <LiveNumber
            ref={scoreRef}
            value={initialScore}
            mode="tick"
            format={SCORE_FORMAT}
            className="rt-disc-score readout"
          />
        </div>

        {/* keyboard twins of the points (visually hidden; focus lights the point) */}
        <div className="rt-sliders" role="group" aria-label={t("routingRetune")}>
          {factors.slice(0, count).map((factor, i) => {
            const w = weights[i] ?? 0;
            return (
              <div
                key={factor.id}
                ref={(node) => {
                  sliderRefs.current[i] = node;
                }}
                role="slider"
                tabIndex={i === roving ? 0 : -1}
                aria-label={label(factor.id)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(w * 1000) / 10}
                aria-valuetext={vote(w)}
                aria-orientation="vertical"
                onKeyDown={onSliderKey(i)}
                onFocus={() => {
                  setRoving(i);
                  setHot(i);
                  setFocusRing(i);
                }}
                onBlur={() => {
                  setHot(-1);
                  setFocusRing(-1);
                }}
              />
            );
          })}
        </div>
      </div>

      <p className="rt-rose-caption" dir={rtl ? "rtl" : "ltr"}>
        {hotFactor ? (
          <>
            <span className="rt-cap-name">{label(hotFactor.id)}</span>
            <span className="rt-cap-sep"> · </span>
            <span>{vote(weights[hot] ?? 0)}</span>
            <span className="rt-cap-sep"> · </span>
            <span className="readout" dir="ltr">
              {focusName} x = {valueFormat.format(fills[hot] ?? 0)}
            </span>
          </>
        ) : (
          <span className="readout" dir="ltr">
            score = Σ wᵢ·xᵢ
          </span>
        )}
      </p>
    </div>
  );
}
