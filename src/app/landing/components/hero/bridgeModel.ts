/**
 * The bridge's model of the deck: the sample candidates in their gyro slots,
 * the deck selectors the hero subscribes to, and the helpers that turn a
 * featured take into copy (scores, token counts, the sample a candidate
 * wins on).
 *
 * No DOM and no React: `HeroBridge.tsx` renders from it.
 */
import { BREAKER_PROFILES, SAMPLE_CANDIDATES, type CatalogKind } from "../../landingTypes";
import {
  SAMPLES,
  SAMPLE_KEYS,
  normalizeWeights,
  rank,
  type BreakerState,
  type SampleKey,
  type World,
} from "../../sim/landingSim";
import { CAND_CLOSED, CAND_DEGRADED, CAND_HALF_OPEN, CAND_OPEN } from "./gyro";

/** The sample candidates; a candidate's slot is its index here (and its star's). */
export const CANDIDATES = SAMPLE_CANDIDATES;
const CANDIDATE_IDS: readonly string[] = CANDIDATES.map((c) => c.id);
export const CATALOG_IDS: readonly string[] = CANDIDATES.map((c) => c.catalogId);
export const slotOf = (id: string) => CANDIDATE_IDS.indexOf(id);

/** Breaker states as the gyro's candidate codes (`CAND_*`), and their copy keys and names. */
export const STATE_CODE: Record<BreakerState, number> = {
  closed: CAND_CLOSED,
  degraded: CAND_DEGRADED,
  open: CAND_OPEN,
  halfOpen: CAND_HALF_OPEN,
};
export const STATE_KEY = ["stateClosed", "stateDegraded", "stateOpen", "stateHalfOpen"] as const;
export const STATE_NAME = ["closed", "degraded", "open", "halfOpen"] as const;

/** The tooltip's catalog-kind copy keys. */
export const KIND_KEY: Record<CatalogKind, string> = {
  llm: "catalogKindLlm",
  webSearch: "catalogKindSearch",
  imageToText: "catalogKindImageToText",
  webFetch: "catalogKindWebFetch",
  embedding: "catalogKindEmbedding",
  video: "catalogKindVideo",
  other: "catalogKindOther",
};

export const selectFeatured = (w: World) => w.featured;
/**
 * The visitor has retuned the scoring weights (the routing rose): the hero's
 * scores are theirs. Shares within 0.1% of the shipped ones (rounding, a
 * no-op drag at a cap) are not a retune.
 */
export const selectTuned = (w: World): boolean => {
  const shipped = normalizeWeights(w.defaults, w.defaults);
  for (let i = 0; i < shipped.length; i++) {
    if (Math.abs((w.weights[i] ?? 0) - shipped[i]) > 1e-3) return true;
  }
  return false;
};

/**
 * A selector that keeps returning what it first read: off screen the hero
 * stops following the deck (no re-render, no retyping, spec §7.6), and the
 * live selector takes over again when it comes back.
 */
export function frozenSelector<T>(select: (w: World) => T): (w: World) => T {
  let held: { value: T } | null = null;
  return (w: World) => (held ??= { value: select(w) }).value;
}

/** [down, state, failures] per candidate, flat, for `shallowEqual`. */
export const selectBreakers = (w: World): number[] => {
  const out: number[] = [];
  for (const c of w.candidates) {
    out.push(c.upstreamDown ? 1 : 0, STATE_CODE[c.breaker.state], c.breaker.failures);
  }
  return out;
};

/** Failures that open each candidate's breaker (its profile), for the plate meter. */
export const OPENS_AFTER = CANDIDATES.map(
  (c) => BREAKER_PROFILES.find((p) => p.id === c.profile)?.opensAfter ?? 1
);

export const SCORE_FORMAT: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};
export const TOKENS_FORMAT: Intl.NumberFormatOptions = {
  notation: "compact",
  maximumFractionDigits: 1,
};

/** "3.1k" → 3100: the sample table's token counts, for locale formatting. */
export function tokenCount(text: string): number {
  const match = /^([\d.]+)\s*([kKmM]?)$/.exec(text.trim());
  if (!match) return Number.NaN;
  const unit = match[2].toLowerCase();
  return Number(match[1]) * (unit === "k" ? 1e3 : unit === "m" ? 1e6 : 1);
}

/**
 * The sample this candidate ranks best on, so a visitor who makes it fail
 * sees the very next take try it first (503) and fall back.
 */
export function bestSampleFor(world: World, id: string): SampleKey {
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

/** The sample table's token count text for a sample key ("" when unknown). */
export function sampleTokens(key: string): string {
  return SAMPLES.find((s) => s.key === key)?.tokens ?? "";
}
