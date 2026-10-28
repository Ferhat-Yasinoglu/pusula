/**
 * The simulated measurements behind the landing page's routing decisions.
 *
 * The auto strategy scores a candidate as Σ wᵢ·mᵢ over its scoring factors
 * (`calculateScore` in `open-sse/services/autoCombo/scoring.ts`). The weights
 * wᵢ shown on the page are the real `DEFAULT_WEIGHTS`, read server-side into
 * `LandingStats.scoringFactors`. The measurements mᵢ are not real — a static
 * page cannot see live quota, latency or health — so they are authored here
 * for six sample candidates and the five sample requests the hero cycles
 * through, and every depiction that uses them carries the simulation badge.
 *
 * The table is authored so that, under `DEFAULT_WEIGHTS`, each sample is won
 * by the candidate a reader would expect (agentic → claude, cheap → cerebras,
 * long context → gemini, local → ollama, vision → gpt). That constraint, and
 * that the factor ids are exactly `DEFAULT_WEIGHTS`' keys minus `health`, are
 * pinned by `tests/unit/landing-sim.test.ts`.
 *
 * `health` is deliberately absent: the deck derives it live from each
 * candidate's simulated circuit breaker (`landingSim.ts`).
 *
 * Client-safe: no gateway imports (scoring.ts pulls pricing data in).
 */

export const CANDIDATE_IDS = ["claude", "gpt", "gemini", "glm", "cerebras", "ollama"] as const;
export type CandidateId = (typeof CANDIDATE_IDS)[number];

/** The hero's five sample requests; the keys are their `landing.sample*` i18n keys. */
export const SAMPLE_KEYS = [
  "sampleAgentic",
  "sampleCheap",
  "sampleLongContext",
  "sampleLocal",
  "sampleVision",
] as const;
export type SampleKey = (typeof SAMPLE_KEYS)[number];

/** Prompt sizes shown beside each sample (carried over from the old astrolabe). */
export const SAMPLES: readonly { key: SampleKey; tokens: string }[] = [
  { key: "sampleAgentic", tokens: "3.1k" },
  { key: "sampleCheap", tokens: "0.4k" },
  { key: "sampleLongContext", tokens: "180k" },
  { key: "sampleLocal", tokens: "1.2k" },
  { key: "sampleVision", tokens: "2.6k" },
];

/** The factor the deck derives from breaker state instead of reading this table. */
export const HEALTH_FACTOR_ID = "health";

/**
 * Every `DEFAULT_WEIGHTS` key except `health`, in the declaration order of
 * `ScoringWeights`. Pinned against the real object by the test.
 */
export const TABLE_FACTOR_IDS = [
  "quota",
  "costInv",
  "latencyInv",
  "taskFit",
  "stability",
  "tierPriority",
  "tierAffinity",
  "specificityMatch",
  "contextAffinity",
  "cacheAffinity",
  "sessionAvailability",
  "resetWindowAffinity",
  "connectionDensity",
  "quality",
  "reliability",
] as const;
export type TableFactorId = (typeof TABLE_FACTOR_IDS)[number];

/**
 * The factors fed by live telemetry in the real scorer (`quotaRemaining` from
 * the quota fetchers, p95 latency from request metrics). The deck's background
 * traffic perturbs these per routing decision, so close runners-up win a share
 * of requests the way they do when real latency and quota fluctuate. The hero's
 * featured take and `rank()` always use the table values unperturbed.
 */
export const LIVE_FACTOR_IDS: readonly TableFactorId[] = ["quota", "latencyInv"];

type Row = Record<TableFactorId, number>;
type CandidateBase = Omit<Row, "taskFit" | "tierAffinity" | "specificityMatch" | "contextAffinity">;

/**
 * Per-candidate measurements that do not depend on the request: who has quota
 * left, who is cheap, who is fast. Values are [0, 1] in the scorer's sense
 * (`costInv` 1 = cheapest in the pool, `latencyInv` 1 = fastest,
 * `connectionDensity` = (pool size − 1) / 10 for three keys, 0 for one local
 * daemon).
 */
const BASE: Readonly<Record<CandidateId, CandidateBase>> = {
  // OAuth subscription: deep quota, premium price, a session that can lapse.
  claude: {
    quota: 0.9,
    costInv: 0.45,
    latencyInv: 0.6,
    stability: 0.75,
    tierPriority: 0.67,
    cacheAffinity: 0.6,
    sessionAvailability: 0.8,
    resetWindowAffinity: 0.5,
    connectionDensity: 0.2,
    quality: 0.8,
    reliability: 0.97,
  },
  gpt: {
    quota: 0.8,
    costInv: 0.5,
    latencyInv: 0.65,
    stability: 0.8,
    tierPriority: 0.67,
    cacheAffinity: 0.5,
    sessionAvailability: 1,
    resetWindowAffinity: 0.5,
    connectionDensity: 0.2,
    quality: 0.75,
    reliability: 0.97,
  },
  gemini: {
    quota: 0.7,
    costInv: 0.7,
    latencyInv: 0.65,
    stability: 0.7,
    tierPriority: 0.33,
    cacheAffinity: 0.4,
    sessionAvailability: 1,
    resetWindowAffinity: 0.5,
    connectionDensity: 0.2,
    quality: 0.7,
    reliability: 0.95,
  },
  glm: {
    quota: 0.75,
    costInv: 0.85,
    latencyInv: 0.6,
    stability: 0.7,
    tierPriority: 0.33,
    cacheAffinity: 0.3,
    sessionAvailability: 1,
    resetWindowAffinity: 0.5,
    connectionDensity: 0.2,
    quality: 0.6,
    reliability: 0.95,
  },
  // Free tier on very fast hardware: cheap and quick, modest quality.
  cerebras: {
    quota: 0.8,
    costInv: 0.9,
    latencyInv: 0.95,
    stability: 0.85,
    tierPriority: 0,
    cacheAffinity: 0.2,
    sessionAvailability: 1,
    resetWindowAffinity: 0.7,
    connectionDensity: 0.2,
    quality: 0.55,
    reliability: 0.93,
  },
  // A local daemon: no quota, no bill, one connection, slower tokens.
  ollama: {
    quota: 1,
    costInv: 1,
    latencyInv: 0.35,
    stability: 0.6,
    tierPriority: 0.33,
    cacheAffinity: 0.5,
    sessionAvailability: 1,
    resetWindowAffinity: 0.5,
    connectionDensity: 0,
    quality: 0.45,
    reliability: 0.99,
  },
};

/** Request-dependent factors: [taskFit, tierAffinity, specificityMatch, contextAffinity]. */
type Fit = readonly [number, number, number, number];

const FIT: Readonly<Record<SampleKey, Readonly<Record<CandidateId, Fit>>>> = {
  // Multi-step tool use: the strongest agentic models fit best.
  sampleAgentic: {
    claude: [0.98, 0.95, 0.95, 0.8],
    gpt: [0.88, 0.75, 0.7, 0.65],
    gemini: [0.7, 0.45, 0.45, 0.6],
    glm: [0.75, 0.6, 0.6, 0.55],
    cerebras: [0.35, 0.2, 0.2, 0.4],
    ollama: [0.3, 0.2, 0.2, 0.4],
  },
  // A short, simple prompt: any capable model will do, so price and speed decide.
  sampleCheap: {
    claude: [0.6, 0.1, 0.2, 0.5],
    gpt: [0.6, 0.3, 0.3, 0.5],
    gemini: [0.7, 0.5, 0.5, 0.5],
    glm: [0.85, 0.9, 0.85, 0.5],
    cerebras: [0.85, 0.9, 0.8, 0.5],
    ollama: [0.6, 0.5, 0.3, 0.5],
  },
  // 180k tokens: only large context windows fit.
  sampleLongContext: {
    claude: [0.85, 0.7, 0.6, 0.7],
    gpt: [0.72, 0.5, 0.5, 0.6],
    gemini: [0.98, 1, 0.9, 1],
    glm: [0.75, 0.7, 0.7, 0.7],
    cerebras: [0.2, 0.1, 0.1, 0.15],
    ollama: [0.2, 0.1, 0.1, 0.15],
  },
  // Must stay on this machine: only the local daemon matches the request's hint.
  sampleLocal: {
    claude: [0.3, 0, 0, 0.5],
    gpt: [0.3, 0, 0, 0.5],
    gemini: [0.3, 0, 0, 0.5],
    glm: [0.35, 0, 0, 0.5],
    cerebras: [0.3, 0, 0, 0.5],
    ollama: [0.95, 1, 1, 0.6],
  },
  // An image in the prompt: vision-capable models only.
  sampleVision: {
    claude: [0.85, 0.7, 0.6, 0.5],
    gpt: [0.97, 0.95, 0.9, 0.6],
    gemini: [0.88, 0.75, 0.65, 0.5],
    glm: [0.55, 0.4, 0.3, 0.5],
    cerebras: [0.1, 0, 0, 0.4],
    ollama: [0.3, 0.2, 0.1, 0.4],
  },
};

/** Where a request changes a candidate-level measurement (180k tokens is slow and dear). */
const OVERRIDES: Partial<Record<SampleKey, Partial<Record<CandidateId, Partial<CandidateBase>>>>> =
  {
    sampleLongContext: {
      claude: { costInv: 0.15 },
      gpt: { costInv: 0.3 },
      cerebras: { latencyInv: 0.3, costInv: 0.6 },
      ollama: { latencyInv: 0.1 },
    },
  };

function buildTable(): Record<SampleKey, Record<CandidateId, Readonly<Row>>> {
  const table = {} as Record<SampleKey, Record<CandidateId, Readonly<Row>>>;
  for (const sample of SAMPLE_KEYS) {
    const bySample = {} as Record<CandidateId, Readonly<Row>>;
    for (const id of CANDIDATE_IDS) {
      const [taskFit, tierAffinity, specificityMatch, contextAffinity] = FIT[sample][id];
      bySample[id] = Object.freeze({
        ...BASE[id],
        taskFit,
        tierAffinity,
        specificityMatch,
        contextAffinity,
        ...OVERRIDES[sample]?.[id],
      });
    }
    table[sample] = Object.freeze(bySample);
  }
  return Object.freeze(table);
}

/** `SAMPLE_TABLE[sample][candidate][factorId] ∈ [0, 1]`. */
export const SAMPLE_TABLE: Readonly<
  Record<SampleKey, Readonly<Record<CandidateId, Readonly<Row>>>>
> = buildTable();

/** Neutral value for a factor the table does not know (a factor added to the gateway later). */
export const NEUTRAL_MEASUREMENT = 0.5;

/**
 * One measurement. Unknown factor ids read as neutral 0.5 (the scorer's own
 * neutral for unobserved signals); `health` is not in the table and also reads
 * 0.5 here — use the deck's live value instead.
 */
export function measurement(sample: SampleKey, candidate: CandidateId, factorId: string): number {
  const value = (SAMPLE_TABLE[sample]?.[candidate] as Record<string, number> | undefined)?.[
    factorId
  ];
  return typeof value === "number" ? value : NEUTRAL_MEASUREMENT;
}

export function isSampleKey(value: unknown): value is SampleKey {
  return typeof value === "string" && (SAMPLE_KEYS as readonly string[]).includes(value);
}

export function isCandidateId(value: unknown): value is CandidateId {
  return typeof value === "string" && (CANDIDATE_IDS as readonly string[]).includes(value);
}
