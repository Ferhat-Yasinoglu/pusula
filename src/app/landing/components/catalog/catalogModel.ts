/**
 * The pure half of the provider wall (spec §6.4): kind order and spectrum
 * geometry, search folding, the filter, and which names a phone shows while
 * the wall is collapsed. No React, no DOM, no clock, no `Math.random`: these
 * run during render, so server and client must agree byte for byte.
 * Pinned by `tests/unit/landing-catalog.test.ts`.
 */
import type { CatalogEntry, CatalogKind } from "../../landingTypes";

/** Spectrum and legend order (zero kinds are omitted by `spectrumLayout`). */
export const KIND_ORDER: readonly CatalogKind[] = [
  "llm",
  "webSearch",
  "imageToText",
  "webFetch",
  "embedding",
  "video",
  "other",
];

/** The existing `landing.catalogKind*` key of each kind. */
export const KIND_LABEL_KEY = {
  llm: "catalogKindLlm",
  webSearch: "catalogKindSearch",
  imageToText: "catalogKindImageToText",
  webFetch: "catalogKindWebFetch",
  embedding: "catalogKindEmbedding",
  video: "catalogKindVideo",
  other: "catalogKindOther",
} as const satisfies Record<CatalogKind, string>;

/** The chip filter: everything, "free tier or no key", or "local CLI bridge". */
export type CatalogFlag = "all" | "free" | "local";

/** Names a phone shows before "Show {count} more". */
export const COLLAPSED_COUNT = 40;

/** Kinds that have at least one provider, in `KIND_ORDER`. */
export function presentKinds(kindCounts: Readonly<Record<CatalogKind, number>>): CatalogKind[] {
  return KIND_ORDER.filter((kind) => (kindCounts[kind] ?? 0) > 0);
}

/** `catalogLead`'s `{kinds}`: the number of kinds with at least one provider. */
export function kindTotal(kindCounts: Readonly<Record<CatalogKind, number>>): number {
  return presentKinds(kindCounts).length;
}

export type SpectrumSlot = {
  kind: CatalogKind;
  count: number;
  /** Where the segment starts, as a fraction of the bar (inline-start side). */
  start: number;
  /** Its width, as a fraction of the bar. The shares of all slots sum to 1. */
  share: number;
};

/** The spectrum bar: one segment per present kind, proportional to its count. */
export function spectrumLayout(kindCounts: Readonly<Record<CatalogKind, number>>): SpectrumSlot[] {
  const kinds = presentKinds(kindCounts);
  let total = 0;
  for (const kind of kinds) total += kindCounts[kind];
  if (total <= 0) return [];
  const slots: SpectrumSlot[] = [];
  let start = 0;
  for (const kind of kinds) {
    const share = kindCounts[kind] / total;
    slots.push({ kind, count: kindCounts[kind], start, share });
    start += share;
  }
  return slots;
}

/**
 * Bar widths (CSS px of the spectrum container) at which a segment's label
 * is tested. `catalog.css` has one container query per bucket.
 */
export const FIT_BUCKETS = [320, 480, 640, 800, 960, 1120, 1280] as const;
export type FitBucket = (typeof FIT_BUCKETS)[number] | "never";

/** Mono 12px advance, and the label's tags plus their gaps and inset, in CSS px. */
export const LABEL_CHAR_PX = 7.4;
export const LABEL_PAD_PX = 44;

/**
 * The narrowest bucket at which a label of `chars` characters fits inside a
 * segment of `share` of the bar, or "never" (its label then lives in the
 * legend row beneath at every width).
 */
export function labelFitBucket(
  chars: number,
  share: number,
  charPx = LABEL_CHAR_PX,
  padPx = LABEL_PAD_PX
): FitBucket {
  if (!(share > 0)) return "never";
  const needed = (chars * charPx + padPx) / share;
  for (const bucket of FIT_BUCKETS) if (needed <= bucket) return bucket;
  return "never";
}

const COMBINING_MARKS = /[̀-ͯ]/g;
const NOT_ALNUM = /[^\p{L}\p{N}]+/gu;

/** Case- and accent-insensitive form of a name or a query. */
export function foldSearch(text: string): string {
  return text.normalize("NFKD").replace(COMBINING_MARKS, "").toLowerCase().trim();
}

/** `foldSearch` without spaces and punctuation: "open router" finds "OpenRouter". */
export function compactSearch(text: string): string {
  return foldSearch(text).replace(NOT_ALNUM, "");
}

export type SearchIndex = { folded: readonly string[]; compact: readonly string[] };

/** Pre-folded names (and ids) for `matchCatalog`, built once per catalog. */
export function buildSearchIndex(catalog: readonly CatalogEntry[]): SearchIndex {
  const folded: string[] = [];
  const compact: string[] = [];
  for (const entry of catalog) {
    folded.push(`${foldSearch(entry.name)} ${foldSearch(entry.id)}`);
    compact.push(`${compactSearch(entry.name)} ${compactSearch(entry.id)}`);
  }
  return { folded, compact };
}

export type CatalogFilter = { query: string; flag: CatalogFlag; kind: CatalogKind | null };

export const EMPTY_FILTER: CatalogFilter = { query: "", flag: "all", kind: null };

/** True when anything narrows the wall (a query, a chip or a kind). */
export function isFiltering(filter: CatalogFilter): boolean {
  return foldSearch(filter.query) !== "" || filter.flag !== "all" || filter.kind !== null;
}

/** Identity of a filter as the wall sees it (query folded), for "is this the same search?". */
export function filterKey(filter: CatalogFilter): string {
  return `${foldSearch(filter.query)}|${filter.flag}|${filter.kind ?? ""}`;
}

export type MatchResult = {
  /** 1 where the entry matches, per catalog index. */
  match: Uint8Array;
  /** How many entries match. */
  shown: number;
  /** Index of the first match in wall order, or -1. */
  first: number;
  /** Matches per kind (the spectrum dims kinds without any). */
  kindHits: Record<CatalogKind, number>;
};

function emptyKindHits(): Record<CatalogKind, number> {
  return { llm: 0, webSearch: 0, imageToText: 0, webFetch: 0, embedding: 0, video: 0, other: 0 };
}

/** The query, the chip and the kind combine (AND). */
export function matchCatalog(
  catalog: readonly CatalogEntry[],
  index: SearchIndex,
  filter: CatalogFilter
): MatchResult {
  const folded = foldSearch(filter.query);
  const compact = compactSearch(filter.query);
  const match = new Uint8Array(catalog.length);
  const kindHits = emptyKindHits();
  let shown = 0;
  let first = -1;
  for (let i = 0; i < catalog.length; i++) {
    const entry = catalog[i];
    if (filter.flag === "free" && !entry.free) continue;
    if (filter.flag === "local" && !entry.local) continue;
    if (filter.kind !== null && entry.kind !== filter.kind) continue;
    if (folded !== "") {
      const byText = index.folded[i]?.includes(folded) ?? false;
      const byCompact = compact !== "" && (index.compact[i]?.includes(compact) ?? false);
      if (!byText && !byCompact) continue;
    }
    match[i] = 1;
    shown += 1;
    kindHits[entry.kind] += 1;
    if (first < 0) first = i;
  }
  return { match, shown, first, kindHits };
}

/**
 * Longest name (in characters) that fits a phone column without an
 * ellipsis: 2 columns of mono 12px (7.2px advance) on a 390px screen leave
 * about 151px for the name.
 */
export const PHONE_FIT_CHARS = 19;

/**
 * Which names a phone shows while the wall is collapsed and nothing is
 * filtered: the providers the page's simulation routes to (so the wall can
 * echo the deck), the local CLI bridges whose names fit a phone column (at
 * least one bridge, so the ◆ mark is on show), then names spread evenly
 * across the alphabet, each the nearest free name that fits a column (an
 * ellipsis in a showcase sample looks careless). Returns 1 per picked catalog
 * index; exactly `min(limit, n)` entries are picked.
 */
export function collapsedPicks(
  catalog: readonly CatalogEntry[],
  pinnedIds: readonly string[],
  limit = COLLAPSED_COUNT,
  fitChars = PHONE_FIT_CHARS
): Uint8Array {
  const n = catalog.length;
  const picks = new Uint8Array(n);
  const want = Math.min(limit, n);
  let count = 0;
  const take = (i: number) => {
    if (count >= want || i < 0 || i >= n || picks[i]) return;
    picks[i] = 1;
    count += 1;
  };
  const fits = (i: number) => catalog[i].name.length <= fitChars;
  for (const id of pinnedIds) take(catalog.findIndex((entry) => entry.id === id));
  let shortestLocal = -1;
  let anyLocal = false;
  for (let i = 0; i < n; i++) {
    if (!catalog[i].local) continue;
    if (fits(i)) {
      take(i);
      anyLocal = true;
    } else if (shortestLocal < 0 || catalog[i].name.length < catalog[shortestLocal].name.length) {
      shortestLocal = i;
    }
  }
  if (!anyLocal) take(shortestLocal);
  const rest = want - count;
  for (let k = 0; k < rest; k++) {
    // Evenly spaced targets; the nearest free name that fits, else the nearest free one.
    const target = Math.min(n - 1, Math.floor(((k + 0.5) * n) / rest));
    let fallback = -1;
    let chosen = -1;
    for (let d = 0; d < n && chosen < 0; d++) {
      for (let side = 0; side < (d === 0 ? 1 : 2) && chosen < 0; side++) {
        const i = side === 0 ? target + d : target - d;
        if (i < 0 || i >= n || picks[i]) continue;
        if (fits(i)) chosen = i;
        else if (fallback < 0) fallback = i;
      }
    }
    take(chosen >= 0 ? chosen : fallback);
  }
  return picks;
}

/** Order of each picked index among the picks (for the phone reveal stagger), -1 elsewhere. */
export function pickOrder(picks: Uint8Array): Int16Array {
  const order = new Int16Array(picks.length).fill(-1);
  let k = 0;
  for (let i = 0; i < picks.length; i++) if (picks[i]) order[i] = k++;
  return order;
}

/**
 * How many matching names a collapsed phone wall leaves out: everything but
 * the picks when nothing is filtered, otherwise the matches past the first
 * `limit`.
 */
export function hiddenWhenCollapsed(
  total: number,
  shown: number,
  filtering: boolean,
  limit = COLLAPSED_COUNT
): number {
  if (!filtering) return Math.max(0, total - Math.min(limit, total));
  return Math.max(0, shown - limit);
}

/**
 * The wall's content height, in CSS px, when `names` names on rows of
 * `rowPx` are balanced across `columns` CSS columns (its 6px padding comes on
 * top). The wall uses it as its `content-visibility` placeholder, so the
 * stations below sit where they will be once it has rendered and the nav's
 * jumps land on their titles.
 */
export function wallContentHeight(names: number, columns: number, rowPx = 24): number {
  return Math.ceil(Math.max(0, names) / Math.max(1, columns)) * rowPx;
}
