"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DIAL_CX,
  DIAL_CY,
  DIAL_HEIGHT,
  DIAL_WIDTH,
  nearestEquivalentAngle,
  needleTransform,
  polar,
  round2,
  springStep,
  type SpringState,
} from "../landingGeometry";
import { useAnimationFrame, useInView, usePrefersReducedMotion } from "../landingMotion";

/**
 * The hero instrument: an astrolabe whose needle swings to the provider the
 * auto strategy picks for each sample request, with the ranked candidates
 * underneath. Scores are illustrative (labelled as such) — the real 16-factor
 * formula lives in `open-sse/services/autoCombo/scoring.ts` and depends on live
 * quota, health and latency, which a static page cannot show.
 *
 * The rings turn with CSS; the needle and the request particles are driven by
 * one animation-frame loop that writes attributes directly, so React only
 * re-renders when the sample changes.
 */

type Candidate = {
  id: string;
  name: string;
  tag: "oauth" | "api" | "free" | "local";
  bearing: number;
};

const CANDIDATES: readonly Candidate[] = [
  { id: "claude", name: "claude", tag: "oauth", bearing: 42 },
  { id: "gpt", name: "gpt", tag: "api", bearing: 108 },
  { id: "gemini", name: "gemini", tag: "free", bearing: 158 },
  { id: "glm", name: "glm", tag: "api", bearing: 212 },
  { id: "cerebras", name: "cerebras", tag: "free", bearing: 288 },
  { id: "ollama", name: "ollama", tag: "local", bearing: 346 },
];

type Sample = {
  key: "sampleAgentic" | "sampleCheap" | "sampleLongContext" | "sampleLocal" | "sampleVision";
  tokens: string;
  scores: Record<string, number>;
};

const SAMPLES: readonly Sample[] = [
  {
    key: "sampleAgentic",
    tokens: "3.1k",
    scores: { claude: 0.94, gpt: 0.81, glm: 0.71, gemini: 0.62, cerebras: 0.55, ollama: 0.31 },
  },
  {
    key: "sampleCheap",
    tokens: "0.4k",
    scores: { cerebras: 0.91, gemini: 0.86, glm: 0.74, ollama: 0.66, gpt: 0.52, claude: 0.4 },
  },
  {
    key: "sampleLongContext",
    tokens: "180k",
    scores: { gemini: 0.93, claude: 0.88, gpt: 0.79, glm: 0.6, cerebras: 0.35, ollama: 0.22 },
  },
  {
    key: "sampleLocal",
    tokens: "1.2k",
    scores: { ollama: 0.96, cerebras: 0.58, gemini: 0.5, glm: 0.44, gpt: 0.3, claude: 0.28 },
  },
  {
    key: "sampleVision",
    tokens: "2.6k",
    scores: { gpt: 0.9, gemini: 0.87, claude: 0.84, glm: 0.41, ollama: 0.35, cerebras: 0.2 },
  },
];

const STEP_MS = 3600;

/** Radii, outermost first. */
const R_GLOW = 214;
const R_LABEL = 214;
const R_NODE = 196;
const R_BEZEL_OUT = 182;
const R_BEZEL_IN = 162;
const R_CARDINAL = 146;
const R_INNER = 130;
const R_INNER_2 = 118;
const NEEDLE_TIP = 138;
const NEEDLE_TAIL = 44;
const NEEDLE_HALF_WIDTH = 9;

const PARTICLES = 5;
const BEAM_START = 22;
const BEAM_END = R_NODE - 8;

function labelAnchor(bearing: number): "start" | "middle" | "end" {
  if (bearing > 15 && bearing < 165) return "start";
  if (bearing > 195 && bearing < 345) return "end";
  return "middle";
}

export default function Astrolabe({ factorCount }: { factorCount: number }) {
  const t = useTranslations("landing");
  const reduced = usePrefersReducedMotion();
  const [figureRef, inView] = useInView<HTMLElement>("120px");
  const [index, setIndex] = useState(0);

  const needleRef = useRef<SVGGElement>(null);
  const beamRef = useRef<SVGLineElement>(null);
  const particleRefs = useRef<(SVGCircleElement | null)[]>([]);
  const spring = useRef<SpringState>({ angle: 0, velocity: 0 });

  useEffect(() => {
    if (reduced || !inView) return;
    const id = window.setInterval(() => setIndex((value) => (value + 1) % SAMPLES.length), STEP_MS);
    return () => window.clearInterval(id);
  }, [reduced, inView]);

  const sample = SAMPLES[index];
  const ranked = useMemo(
    () =>
      CANDIDATES.map((candidate) => ({
        ...candidate,
        score: sample.scores[candidate.id] ?? 0,
      })).sort((a, b) => b.score - a.score),
    [sample]
  );
  const chosen = ranked[0];

  // Reduced motion: no loop, the needle simply points at the choice.
  useEffect(() => {
    if (!reduced) return;
    spring.current = { angle: chosen.bearing, velocity: 0 };
    needleRef.current?.setAttribute("transform", needleTransform(chosen.bearing));
  }, [reduced, chosen.bearing]);

  useAnimationFrame((dt, now) => {
    const seconds = now / 1000;
    // A compass card is never perfectly still: a faint tremor around the target.
    const tremor = Math.sin(seconds * 1.7) * 0.7 + Math.sin(seconds * 4.3) * 0.25;
    const target = nearestEquivalentAngle(spring.current.angle, chosen.bearing) + tremor;
    spring.current = springStep(spring.current, target, dt);
    const angle = spring.current.angle;
    needleRef.current?.setAttribute("transform", needleTransform(angle));

    const start = polar(DIAL_CX, DIAL_CY, angle, BEAM_START);
    const end = polar(DIAL_CX, DIAL_CY, angle, BEAM_END);
    const beam = beamRef.current;
    if (beam) {
      beam.setAttribute("x1", String(start.x));
      beam.setAttribute("y1", String(start.y));
      beam.setAttribute("x2", String(end.x));
      beam.setAttribute("y2", String(end.y));
    }
    particleRefs.current.forEach((particle, i) => {
      if (!particle) return;
      const phase = (seconds * 0.55 + i / PARTICLES) % 1;
      const point = polar(DIAL_CX, DIAL_CY, angle, BEAM_START + phase * (BEAM_END - BEAM_START));
      particle.setAttribute("cx", String(point.x));
      particle.setAttribute("cy", String(point.y));
      particle.setAttribute("opacity", String(round2(Math.sin(phase * Math.PI))));
    });
  }, !reduced && inView);

  const ticks = useMemo(() => Array.from({ length: 120 }, (_, i) => i * 3), []);
  const numerals = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 30), []);
  const innerMarks = useMemo(() => Array.from({ length: 8 }, (_, i) => i * 45), []);
  const tagLabel: Record<Candidate["tag"], string> = {
    oauth: t("tagOauth"),
    api: t("tagApi"),
    free: t("tagFree"),
    local: t("tagLocal"),
  };

  const sweepEdge = polar(DIAL_CX, DIAL_CY, 0, R_BEZEL_IN);
  const sweepStart = polar(DIAL_CX, DIAL_CY, -38, R_BEZEL_IN);

  return (
    <figure
      ref={figureRef}
      className="glass astrolabe relative w-full max-w-[34rem] rounded-[1.75rem] p-5 sm:p-7"
      aria-label={t("instrumentAria")}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-[var(--mist-dim)]">{t("instrumentRequest")}</div>
          <div
            key={sample.key}
            className="swap-in truncate text-base font-semibold text-[var(--foam)]"
            aria-live="polite"
          >
            {t(sample.key)}
          </div>
        </div>
        <div className="readout shrink-0 rounded-full border border-[var(--rule)] px-2.5 py-1 text-xs text-[var(--gold-bright)]">
          {sample.tokens} {t("instrumentTokens")}
        </div>
      </div>
      <div className="h-px overflow-hidden bg-[var(--rule-soft)]" aria-hidden="true">
        {!reduced && (
          <div
            key={index}
            className="sample-progress h-full bg-[var(--gold)]"
            style={{ animationDuration: `${STEP_MS}ms` }}
          />
        )}
      </div>

      <svg
        viewBox={`0 0 ${DIAL_WIDTH} ${DIAL_HEIGHT}`}
        style={{ direction: "ltr" }}
        className="dial-enter mx-auto mt-2 block w-full"
        role="img"
        aria-label={t("instrumentDialAria", { provider: chosen.name })}
      >
        <defs>
          <radialGradient id="astro-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffd36e" stopOpacity="0.22" />
            <stop offset="55%" stopColor="#d4a840" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#d4a840" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="astro-face" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#1d1910" />
            <stop offset="100%" stopColor="#0a0a0b" />
          </radialGradient>
          <linearGradient id="astro-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffd36e" stopOpacity="0" />
            <stop offset="100%" stopColor="#ffd36e" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="astro-needle-tip" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ff7a45" />
            <stop offset="100%" stopColor="#ffb08a" />
          </linearGradient>
          <filter id="astro-bloom" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx={DIAL_CX} cy={DIAL_CY} r={R_GLOW} fill="url(#astro-glow)" />
        <circle cx={DIAL_CX} cy={DIAL_CY} r={R_BEZEL_OUT} fill="url(#astro-face)" />

        {/* Outer bezel: degree ticks and numerals, turning slowly clockwise. */}
        <g className="spin-slow">
          <circle
            cx={DIAL_CX}
            cy={DIAL_CY}
            r={R_BEZEL_OUT}
            fill="none"
            stroke="var(--gold)"
            strokeOpacity="0.7"
            strokeWidth="1.2"
          />
          <circle
            cx={DIAL_CX}
            cy={DIAL_CY}
            r={R_BEZEL_IN}
            fill="none"
            stroke="var(--gold)"
            strokeOpacity="0.45"
          />
          {ticks.map((deg) => {
            const major = deg % 30 === 0;
            const mid = deg % 15 === 0;
            const outer = polar(DIAL_CX, DIAL_CY, deg, R_BEZEL_OUT - 2);
            const inner = polar(DIAL_CX, DIAL_CY, deg, R_BEZEL_OUT - (major ? 9 : mid ? 6 : 4));
            return (
              <line
                key={deg}
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                stroke="var(--gold-bright)"
                strokeOpacity={major ? 0.95 : mid ? 0.6 : 0.3}
                strokeWidth={major ? 1.4 : 0.8}
              />
            );
          })}
          {numerals.map((deg) => {
            const point = polar(DIAL_CX, DIAL_CY, deg, R_BEZEL_IN + 6.5);
            return (
              <text
                key={deg}
                x={point.x}
                y={point.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="var(--gold)"
                fontSize="6.5"
                fontFamily="var(--font-mono)"
                transform={`rotate(${deg} ${point.x} ${point.y})`}
              >
                {deg}
              </text>
            );
          })}
        </g>

        {/* Radar sweep. */}
        {!reduced && (
          <g className="spin-sweep">
            <path
              d={`M ${DIAL_CX} ${DIAL_CY} L ${sweepStart.x} ${sweepStart.y} A ${R_BEZEL_IN} ${R_BEZEL_IN} 0 0 1 ${sweepEdge.x} ${sweepEdge.y} Z`}
              fill="url(#astro-sweep)"
            />
            <line
              x1={DIAL_CX}
              y1={DIAL_CY}
              x2={sweepEdge.x}
              y2={sweepEdge.y}
              stroke="var(--gold-bright)"
              strokeOpacity="0.55"
              strokeWidth="1"
            />
          </g>
        )}

        {/* Inner ring, turning the other way. */}
        <g className="spin-reverse">
          <circle
            cx={DIAL_CX}
            cy={DIAL_CY}
            r={R_INNER}
            fill="none"
            stroke="var(--gold)"
            strokeOpacity="0.5"
            strokeDasharray="1 5"
            strokeLinecap="round"
          />
          <circle
            cx={DIAL_CX}
            cy={DIAL_CY}
            r={R_INNER_2}
            fill="none"
            stroke="var(--gold)"
            strokeOpacity="0.22"
          />
          {innerMarks.map((deg) => {
            const tip = polar(DIAL_CX, DIAL_CY, deg, R_INNER + 5);
            const left = polar(DIAL_CX, DIAL_CY, deg - 3, R_INNER);
            const base = polar(DIAL_CX, DIAL_CY, deg, R_INNER - 5);
            const right = polar(DIAL_CX, DIAL_CY, deg + 3, R_INNER);
            return (
              <path
                key={deg}
                d={`M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${base.x} ${base.y} L ${right.x} ${right.y} Z`}
                fill="var(--gold)"
                fillOpacity={deg % 90 === 0 ? 0.9 : 0.45}
              />
            );
          })}
        </g>

        {(["N", "E", "S", "W"] as const).map((letter, i) => {
          const point = polar(DIAL_CX, DIAL_CY, i * 90, R_CARDINAL);
          return (
            <text
              key={letter}
              x={point.x}
              y={point.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={letter === "N" ? "var(--signal)" : "var(--mist)"}
              fontSize="12"
              fontFamily="var(--font-mono)"
              fontWeight="700"
            >
              {letter}
            </text>
          );
        })}

        {/* Providers on the outer orbit. */}
        {CANDIDATES.map((candidate) => {
          const point = polar(DIAL_CX, DIAL_CY, candidate.bearing, R_NODE);
          const labelPoint = polar(DIAL_CX, DIAL_CY, candidate.bearing, R_LABEL + 4);
          const isChosen = candidate.id === chosen.id;
          return (
            <g key={candidate.id}>
              {isChosen && !reduced && (
                <circle
                  key={`${candidate.id}-${index}`}
                  className="ping"
                  cx={point.x}
                  cy={point.y}
                  r="7"
                  fill="var(--signal)"
                  fillOpacity="0.55"
                />
              )}
              <circle
                cx={point.x}
                cy={point.y}
                r={isChosen ? 5.5 : 3.2}
                fill={isChosen ? "var(--signal)" : "var(--gold)"}
                filter={isChosen ? "url(#astro-bloom)" : undefined}
                className="node-dot"
              />
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor={labelAnchor(candidate.bearing)}
                dominantBaseline="central"
                fill={isChosen ? "var(--foam)" : "var(--mist)"}
                fontSize="11"
                fontWeight={isChosen ? 700 : 400}
                fontFamily="var(--font-mono)"
              >
                {candidate.name}
              </text>
            </g>
          );
        })}

        {/* The route: a beam along the needle with requests flowing out. */}
        <line
          ref={beamRef}
          className={reduced ? undefined : "beam-flow"}
          x1={DIAL_CX}
          y1={DIAL_CY}
          x2={DIAL_CX}
          y2={DIAL_CY - BEAM_END}
          stroke="var(--signal)"
          strokeOpacity="0.55"
          strokeWidth="1.4"
          strokeDasharray="2 7"
          strokeLinecap="round"
        />
        {!reduced &&
          Array.from({ length: PARTICLES }, (_, i) => (
            <circle
              key={i}
              ref={(node) => {
                particleRefs.current[i] = node;
              }}
              cx={DIAL_CX}
              cy={DIAL_CY}
              r="2.4"
              fill="#ffd2bd"
              opacity="0"
              filter="url(#astro-bloom)"
            />
          ))}

        <g ref={needleRef} transform={needleTransform(0)} filter="url(#astro-bloom)">
          <path
            d={`M ${DIAL_CX} ${DIAL_CY - NEEDLE_TIP} L ${DIAL_CX + NEEDLE_HALF_WIDTH} ${DIAL_CY} L ${DIAL_CX - NEEDLE_HALF_WIDTH} ${DIAL_CY} Z`}
            fill="url(#astro-needle-tip)"
          />
          <path
            d={`M ${DIAL_CX} ${DIAL_CY - NEEDLE_TIP} L ${DIAL_CX + NEEDLE_HALF_WIDTH} ${DIAL_CY} L ${DIAL_CX} ${DIAL_CY} Z`}
            fill="#000"
            fillOpacity="0.18"
          />
          <path
            d={`M ${DIAL_CX} ${DIAL_CY + NEEDLE_TAIL} L ${DIAL_CX + NEEDLE_HALF_WIDTH} ${DIAL_CY} L ${DIAL_CX - NEEDLE_HALF_WIDTH} ${DIAL_CY} Z`}
            fill="var(--foam)"
            fillOpacity="0.85"
          />
        </g>
        <circle cx={DIAL_CX} cy={DIAL_CY} r="11" fill="var(--gold)" />
        <circle cx={DIAL_CX} cy={DIAL_CY} r="7" fill="#0a0a0b" />
        <circle cx={DIAL_CX} cy={DIAL_CY} r="3" fill="var(--gold-bright)" />
      </svg>

      <ol className="mt-3 space-y-2" aria-label={t("instrumentRankingAria")}>
        {ranked.slice(0, 4).map((candidate, i) => {
          const isChosen = i === 0;
          return (
            <li key={candidate.id} className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-3">
              <span className="readout flex min-w-0 items-baseline gap-1.5 text-xs">
                <span className={isChosen ? "font-bold text-[var(--foam)]" : "text-[var(--mist)]"}>
                  {candidate.name}
                </span>
                <span className="truncate text-[10px] text-[var(--mist-dim)]">
                  {tagLabel[candidate.tag]}
                </span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-[var(--rule-soft)]">
                <span
                  className={`score-bar block h-full rounded-full ${isChosen ? "score-bar-hot" : ""}`}
                  style={{ width: `${Math.round(candidate.score * 100)}%` }}
                />
              </span>
              <span
                className={`readout text-end text-xs ${
                  isChosen ? "text-[var(--signal)]" : "text-[var(--mist)]"
                }`}
              >
                {candidate.score.toFixed(2)}
              </span>
            </li>
          );
        })}
      </ol>

      <figcaption className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--rule-soft)] pt-3 text-[11px] text-[var(--mist-dim)]">
        <span>{t("instrumentFactors", { count: factorCount })}</span>
        <span>{t("instrumentSampleNote")}</span>
      </figcaption>
    </figure>
  );
}
