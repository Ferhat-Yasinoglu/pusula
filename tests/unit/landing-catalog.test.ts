import test from "node:test";
import assert from "node:assert/strict";
import type { CatalogEntry, CatalogKind } from "../../src/app/landing/landingTypes";
import {
  COLLAPSED_COUNT,
  EMPTY_FILTER,
  FIT_BUCKETS,
  KIND_LABEL_KEY,
  KIND_ORDER,
  PHONE_FIT_CHARS,
  buildSearchIndex,
  collapsedPicks,
  compactSearch,
  filterKey,
  foldSearch,
  hiddenWhenCollapsed,
  isFiltering,
  kindTotal,
  labelFitBucket,
  matchCatalog,
  presentKinds,
  revealDirection,
  SCROLL_EDGE_SLACK_PX,
  scrollEdges,
  spectrumLayout,
  wallContentHeight,
  WALL_MAX_COLUMNS,
  type MatchResult,
} from "../../src/app/landing/components/catalog/catalogModel";

function matchingIndices(result: MatchResult): number[] {
  const out: number[] = [];
  for (let i = 0; i < result.match.length; i++) if (result.match[i]) out.push(i);
  return out;
}

const KIND_COUNTS: Record<CatalogKind, number> = {
  llm: 299,
  webSearch: 17,
  imageToText: 0,
  webFetch: 2,
  embedding: 0,
  video: 1,
  other: 39,
};

function entry(
  id: string,
  name: string,
  kind: CatalogKind = "llm",
  free = false,
  local = false
): CatalogEntry {
  return { id, name, kind, free, local };
}

const SMALL: CatalogEntry[] = [
  entry("anthropic", "Anthropic"),
  entry("brave", "Brave Search", "webSearch", true),
  entry("claude", "Claude Code", "llm", false),
  entry("codex-app-server", "OpenAI Codex (App-Server)", "llm", true, true),
  entry("mistral", "Mistral"),
  entry("openrouter", "OpenRouter", "llm", true),
  entry("crème", "Crème Brûlée AI", "other"),
];

test("kinds: order is fixed, zero kinds are omitted, {kinds} counts present ones", () => {
  assert.deepEqual(KIND_ORDER, [
    "llm",
    "webSearch",
    "imageToText",
    "webFetch",
    "embedding",
    "video",
    "other",
  ]);
  assert.deepEqual(presentKinds(KIND_COUNTS), ["llm", "webSearch", "webFetch", "video", "other"]);
  assert.equal(kindTotal(KIND_COUNTS), 5);
  for (const kind of KIND_ORDER) assert.match(KIND_LABEL_KEY[kind], /^catalogKind[A-Z]/);
});

test("spectrumLayout: shares are proportional, contiguous and sum to 1", () => {
  const slots = spectrumLayout(KIND_COUNTS);
  assert.deepEqual(
    slots.map((s) => s.kind),
    ["llm", "webSearch", "webFetch", "video", "other"]
  );
  let start = 0;
  let sum = 0;
  for (const slot of slots) {
    assert.ok(Math.abs(slot.start - start) < 1e-12);
    assert.ok(Math.abs(slot.share - slot.count / 358) < 1e-12);
    start += slot.share;
    sum += slot.share;
  }
  assert.ok(Math.abs(sum - 1) < 1e-12);
  assert.deepEqual(
    spectrumLayout({ ...KIND_COUNTS, llm: 0, webSearch: 0, webFetch: 0, video: 0, other: 0 }),
    []
  );
});

test("labelFitBucket: the narrowest bucket that holds the label, or never", () => {
  // "Chat and coding 299" in 83.5% of the bar fits even on a phone.
  assert.equal(labelFitBucket(19, 299 / 358), FIT_BUCKETS[0]);
  // "Other 39" (10.9%) needs a wide bar.
  const other = labelFitBucket(8, 39 / 358);
  assert.notEqual(other, "never");
  assert.ok(typeof other === "number" && other >= 640 && other <= 960);
  // "Video 1" at 0.28% never fits.
  assert.equal(labelFitBucket(7, 1 / 358), "never");
  assert.equal(labelFitBucket(7, 0), "never");
});

test("foldSearch / compactSearch: case, accents and punctuation do not matter", () => {
  assert.equal(foldSearch("  Crème BRÛLÉE "), "creme brulee");
  assert.equal(compactSearch("Open-Router (beta)"), "openrouterbeta");
  assert.equal(compactSearch("  "), "");
});

test("matchCatalog: query, chip and kind combine; first and per-kind hits", () => {
  const index = buildSearchIndex(SMALL);
  const all = matchCatalog(SMALL, index, EMPTY_FILTER);
  assert.equal(all.shown, SMALL.length);
  assert.equal(all.first, 0);
  assert.equal(all.kindHits.llm, 5);
  assert.equal(isFiltering(EMPTY_FILTER), false);
  assert.equal(isFiltering({ ...EMPTY_FILTER, query: "   " }), false);

  const open = matchCatalog(SMALL, index, { query: "open router", flag: "all", kind: null });
  assert.deepEqual(matchingIndices(open), [5]);

  const accent = matchCatalog(SMALL, index, { query: "creme", flag: "all", kind: null });
  assert.deepEqual(matchingIndices(accent), [6]);

  const byId = matchCatalog(SMALL, index, { query: "app-server", flag: "all", kind: null });
  assert.deepEqual(matchingIndices(byId), [3]);

  const free = matchCatalog(SMALL, index, { query: "", flag: "free", kind: null });
  assert.deepEqual(matchingIndices(free), [1, 3, 5]);
  assert.equal(free.first, 1);

  const local = matchCatalog(SMALL, index, { query: "", flag: "local", kind: null });
  assert.deepEqual(matchingIndices(local), [3]);

  const freeSearch = matchCatalog(SMALL, index, { query: "", flag: "free", kind: "webSearch" });
  assert.deepEqual(matchingIndices(freeSearch), [1]);
  assert.equal(freeSearch.kindHits.webSearch, 1);
  assert.equal(freeSearch.kindHits.llm, 0);

  const none = matchCatalog(SMALL, index, { query: "zzz", flag: "all", kind: null });
  assert.equal(none.shown, 0);
  assert.equal(none.first, -1);
});

test("collapsedPicks: pinned ids, a local bridge, exactly 40, deterministic", () => {
  const catalog: CatalogEntry[] = [];
  for (let i = 0; i < 358; i++) {
    catalog.push(
      entry(`p${String(i).padStart(3, "0")}`, `Provider ${i}`, "llm", i % 3 === 0, i === 77)
    );
  }
  const pinned = ["p300", "p010", "missing"];
  const picks = collapsedPicks(catalog, pinned);
  const picked = Array.from(picks).reduce((n, v) => n + v, 0);
  assert.equal(picked, COLLAPSED_COUNT);
  assert.equal(picks[300], 1);
  assert.equal(picks[10], 1);
  assert.equal(picks[77], 1);
  assert.deepEqual(Array.from(collapsedPicks(catalog, pinned)), Array.from(picks));
  // The fill spreads across the whole alphabet.
  assert.ok(picks.slice(0, 60).some(Boolean));
  assert.ok(picks.slice(300).some(Boolean));

  // Small catalogs pick everything.
  assert.equal(
    Array.from(collapsedPicks(SMALL, [])).reduce((n, v) => n + v, 0),
    SMALL.length
  );
});

test("collapsedPicks: the fill prefers names that fit a phone column", () => {
  // Every third name is too long for a phone column.
  const catalog: CatalogEntry[] = [];
  for (let i = 0; i < 300; i++) {
    const name = i % 3 === 0 ? `A Very Long Provider Name ${i}` : `Short ${i}`;
    catalog.push(entry(`p${String(i).padStart(3, "0")}`, name, "llm", false, i === 5 || i === 9));
  }
  // Pinned names are kept whatever their length.
  const picks = collapsedPicks(catalog, ["p000"]);
  assert.equal(picks[0], 1);
  const longFill = Array.from(picks).filter(
    (v, i) => v && i !== 0 && catalog[i].name.length > PHONE_FIT_CHARS
  );
  assert.equal(longFill.length, 0);
  // A local bridge that fits is picked; one that does not fit is not needed then.
  assert.equal(picks[5], 1);
  assert.equal(picks[9], 0);

  // When no local bridge fits, the shortest one is still shown (the ◆ mark).
  const longLocals: CatalogEntry[] = catalog.map((e, i) =>
    i === 12 || i === 15
      ? {
          ...e,
          local: true,
          name: i === 12 ? "Local Bridge Long Name X" : "Local Bridge Longer Name",
        }
      : { ...e, local: false }
  );
  const lp = collapsedPicks(longLocals, []);
  assert.equal(lp[12], 1);
  assert.equal(
    Array.from(lp).reduce((n, v) => n + v, 0),
    COLLAPSED_COUNT
  );

  // With no short names at all, the fill still takes the nearest free ones.
  const allLong = catalog.map((e) => ({ ...e, local: false, name: `${e.name} with a long tail` }));
  assert.equal(
    Array.from(collapsedPicks(allLong, [])).reduce((n, v) => n + v, 0),
    COLLAPSED_COUNT
  );
});

test("hiddenWhenCollapsed: the count behind Show more", () => {
  assert.equal(hiddenWhenCollapsed(358, 358, false), 318);
  assert.equal(hiddenWhenCollapsed(358, 156, true), 116);
  assert.equal(hiddenWhenCollapsed(358, 12, true), 0);
  assert.equal(hiddenWhenCollapsed(20, 20, false), 0);
});

test("wallContentHeight: balanced 24px rows per column count (the cv placeholder)", () => {
  assert.equal(wallContentHeight(358, 6), 60 * 24);
  assert.equal(wallContentHeight(358, 5), 72 * 24);
  assert.equal(wallContentHeight(358, 4), 90 * 24);
  assert.equal(wallContentHeight(COLLAPSED_COUNT, 2), 20 * 24);
  assert.equal(wallContentHeight(0, 6), 0);
  assert.equal(wallContentHeight(5, 0), 5 * 24);
});

test("filterKey: same search regardless of case and padding; chip and kind count", () => {
  const base = filterKey({ query: " Ollama ", flag: "all", kind: null });
  assert.equal(filterKey({ query: "ollama", flag: "all", kind: null }), base);
  assert.notEqual(filterKey({ query: "ollama", flag: "free", kind: null }), base);
  assert.notEqual(filterKey({ query: "ollama", flag: "all", kind: "webSearch" }), base);
});

test("revealDirection: uncover upwards only when the wall comes in across the top edge", () => {
  // Scrolling down: the wall's top enters at the bottom of the viewport.
  assert.equal(revealDirection(876, 2328, 900), "down");
  // A jump into the middle of the wall: it spans the viewport.
  assert.equal(revealDirection(-300, 1152, 900), "down");
  // Scrolling back up: its bottom enters at the top of the viewport.
  assert.equal(revealDirection(-1430, 22, 900), "up");
  // A wall shorter than the viewport, fully in view: from its top.
  assert.equal(revealDirection(120, 600, 844), "down");
  // The shutters cover the widest layout's columns.
  assert.equal(WALL_MAX_COLUMNS, 6);
});

test("scrollEdges: which ends of a horizontal scroller hide content", () => {
  // Nothing to scroll (or only sub-slack rounding).
  assert.equal(scrollEdges(0, 390, 390), null);
  assert.equal(scrollEdges(0, 390 + SCROLL_EDGE_SLACK_PX, 390), null);
  // At the start, in the middle, at the end.
  assert.equal(scrollEdges(0, 610, 390), "end");
  assert.equal(scrollEdges(105, 610, 390), "both");
  assert.equal(scrollEdges(220, 610, 390), "start");
  // Within the slack of either end counts as that end.
  assert.equal(scrollEdges(1, 610, 390), "end");
  assert.equal(scrollEdges(219, 610, 390), "start");
  // RTL: scrollLeft runs negative from 0 to -(max); only the magnitude counts.
  assert.equal(scrollEdges(-0, 484, 390), "end");
  assert.equal(scrollEdges(-47, 484, 390), "both");
  assert.equal(scrollEdges(-94, 484, 390), "start");
  // Overscroll past either end is clamped.
  assert.equal(scrollEdges(-500, 484, 390), "start");
});
