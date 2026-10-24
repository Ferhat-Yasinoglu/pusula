"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

/**
 * The one moving part on the page: a compass whose needle swings to the
 * provider the auto strategy picks for each sample request, with the ranked
 * candidates underneath. Scores are illustrative (labelled as such) — the real
 * 16-factor formula lives in `open-sse/services/autoCombo/scoring.ts` and
 * depends on live quota, health and latency, which a static page cannot show.
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

const STEP_MS = 3400;
const DIAL = 176;
const RING = 118;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** Server snapshot: assume motion is fine; the client corrects it before paint. */
function readReducedMotionOnServer(): boolean {
  return false;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, readReducedMotion, readReducedMotionOnServer);
}

/** Two decimals: identical strings on server and client, so hydration never disagrees. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function polar(bearing: number, radius: number): { x: number; y: number } {
  const rad = ((bearing - 90) * Math.PI) / 180;
  return {
    x: round2(DIAL + Math.cos(rad) * radius),
    y: round2(DIAL + Math.sin(rad) * radius),
  };
}

export default function RoutingInstrument({ factorCount }: { factorCount: number }) {
  const t = useTranslations("landing");
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setIndex((value) => (value + 1) % SAMPLES.length), STEP_MS);
    return () => window.clearInterval(id);
  }, [reduced]);

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

  const ticks = useMemo(() => Array.from({ length: 72 }, (_, i) => i * 5), []);
  const tagLabel: Record<Candidate["tag"], string> = {
    oauth: t("tagOauth"),
    api: t("tagApi"),
    free: t("tagFree"),
    local: t("tagLocal"),
  };

  return (
    <figure
      className="relative w-full max-w-[26rem] rounded-2xl border border-[var(--rule)] bg-[rgba(11,42,49,0.72)] p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] backdrop-blur-sm sm:p-6"
      aria-label={t("instrumentAria")}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-[var(--mist-dim)]">{t("instrumentRequest")}</div>
          <div className="truncate text-sm font-medium text-[var(--foam)]" aria-live="polite">
            {t(sample.key)}
          </div>
        </div>
        <div className="readout shrink-0 text-xs text-[var(--mist)]">
          {sample.tokens} {t("instrumentTokens")}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${DIAL * 2} ${DIAL * 2}`}
        className="mx-auto block w-full max-w-[300px]"
        role="img"
        aria-label={t("instrumentDialAria", { provider: chosen.name })}
      >
        <defs>
          <radialGradient id="pusula-dial-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2ED3C4" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#2ED3C4" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={DIAL} cy={DIAL} r={RING + 24} fill="url(#pusula-dial-glow)" />
        <circle cx={DIAL} cy={DIAL} r={RING} fill="none" stroke="var(--rule)" strokeWidth="1.5" />
        <circle
          cx={DIAL}
          cy={DIAL}
          r={RING - 18}
          fill="none"
          stroke="var(--rule-soft)"
          strokeWidth="1"
        />
        {ticks.map((deg) => {
          const major = deg % 30 === 0;
          const outer = polar(deg, RING - 2);
          const inner = polar(deg, RING - (major ? 12 : 6));
          return (
            <line
              key={deg}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={major ? "var(--mist)" : "var(--mist-dim)"}
              strokeOpacity={major ? 0.9 : 0.5}
              strokeWidth={major ? 1.4 : 1}
              strokeLinecap="round"
            />
          );
        })}
        {(["N", "E", "S", "W"] as const).map((letter, i) => {
          const point = polar(i * 90, RING - 30);
          return (
            <text
              key={letter}
              x={point.x}
              y={point.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--mist)"
              fontSize="11"
              fontFamily="var(--font-mono)"
              fontWeight="600"
            >
              {letter}
            </text>
          );
        })}

        {CANDIDATES.map((candidate) => {
          const point = polar(candidate.bearing, RING - 22);
          const labelPoint = polar(candidate.bearing, RING + 12);
          const anchor =
            candidate.bearing > 15 && candidate.bearing < 165
              ? "start"
              : candidate.bearing > 195 && candidate.bearing < 345
                ? "end"
                : "middle";
          const isChosen = candidate.id === chosen.id;
          return (
            <g key={candidate.id}>
              {isChosen && !reduced && (
                <circle
                  className="ping"
                  cx={point.x}
                  cy={point.y}
                  r="6"
                  fill="var(--amber)"
                  fillOpacity="0.5"
                />
              )}
              <circle
                cx={point.x}
                cy={point.y}
                r={isChosen ? 4.5 : 3}
                fill={isChosen ? "var(--amber)" : "var(--teal-bright)"}
                fillOpacity={isChosen ? 1 : 0.8}
              />
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor={anchor}
                dominantBaseline="central"
                fill={isChosen ? "var(--foam)" : "var(--mist)"}
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                {candidate.name}
              </text>
            </g>
          );
        })}

        <g className="needle" style={{ transform: `rotate(${chosen.bearing}deg)` }}>
          <path
            d={`M ${DIAL} ${DIAL - (RING - 34)} L ${DIAL + 7} ${DIAL} L ${DIAL - 7} ${DIAL} Z`}
            fill="var(--amber)"
          />
          <path
            d={`M ${DIAL} ${DIAL + 34} L ${DIAL + 7} ${DIAL} L ${DIAL - 7} ${DIAL} Z`}
            fill="var(--foam)"
            fillOpacity="0.85"
          />
        </g>
        <circle
          cx={DIAL}
          cy={DIAL}
          r="5"
          fill="var(--ink)"
          stroke="var(--foam)"
          strokeWidth="1.5"
        />
      </svg>

      <ol className="mt-4 space-y-1.5" aria-label={t("instrumentRankingAria")}>
        {ranked.slice(0, 4).map((candidate, i) => {
          const isChosen = i === 0;
          return (
            <li key={candidate.id} className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-3">
              <span className="readout flex min-w-0 items-baseline gap-1.5 text-xs">
                <span className={isChosen ? "text-[var(--foam)]" : "text-[var(--mist)]"}>
                  {candidate.name}
                </span>
                <span className="truncate text-[10px] text-[var(--mist-dim)]">
                  {tagLabel[candidate.tag]}
                </span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-[var(--rule-soft)]">
                <span
                  className="score-bar block h-full rounded-full"
                  style={{
                    width: `${Math.round(candidate.score * 100)}%`,
                    background: isChosen ? "var(--amber)" : "var(--teal)",
                  }}
                />
              </span>
              <span
                className={`readout text-end text-xs ${
                  isChosen ? "text-[var(--amber)]" : "text-[var(--mist)]"
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
