"use client";
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  SAMPLE_CANDIDATES,
  type CatalogEntry,
  type CatalogKind,
  type LandingStats,
} from "../../landingTypes";
import { usePrefersReducedMotion } from "../../landingMotion";
import { useDeck } from "../../runtime/deckStore";
import { canAnimate } from "../../runtime/heartbeat";
import { useDomLoop } from "../../runtime/useDomLoop";
import type { CandidateId, World } from "../../sim/landingSim";
import { hash32, mulberry32, type Rng } from "../../sim/prng";
import { Glyph, LiveNumber, SimBadge, Station } from "../primitives";
import { cx, numberFormat, watchView } from "../primitives/primitiveKit";
import {
  KIND_LABEL_KEY,
  buildSearchIndex,
  collapsedPicks,
  filterKey,
  hiddenWhenCollapsed,
  isFiltering,
  kindTotal,
  labelFitBucket,
  matchCatalog,
  pickOrder,
  spectrumLayout,
  wallContentHeight,
  type CatalogFilter,
  type CatalogFlag,
} from "./catalogModel";
import "./catalog.css";

/**
 * Station E (090°): the provider wall (spec §6.4).
 *
 * Every provider is a real `<li>` (SEO, find-in-page, screen readers): a
 * terminal search, three chips and a spectrum of service kinds filter it
 * live; nothing collapses on desktop, non-matches only dim. On a phone the
 * wall shows 40 names until "Show {count} more".
 *
 * Alive: every 9s a faint gold band sweeps down the part of the wall that is
 * on screen, and every 900ms one matching name in view pings phosphor (one
 * loop on the heartbeat's dom lane: a transform, an opacity and attribute
 * writes; the geometry is measured on scroll and resize, never in the loop).
 * Each featured take of the page's simulation flashes the winner's real
 * catalog entry ember, with the take spelled out beside a `SimBadge`. Off
 * screen the CSS loops pause; under reduced motion or Pause none of it runs
 * and filtering is instant.
 */

const WALL_ID = "catalog-wall";
/** Seconds between idle pings. */
const PING_S = 0.9;
/** The sweep: one pass down the visible wall, every `SWEEP_CYCLE_S`. */
const SWEEP_CYCLE_S = 9;
const SWEEP_PASS_S = 3.6;
/** Height of the sweep band (`.cw-sweep-band`), in CSS px. */
const SWEEP_BAND_PX = 64;
/** What the nav covers at the top of the viewport (52px phone, 56px desktop), plus a little. */
const NAV_CLEAR_PX = 60;
/**
 * Names under the nav or the stuck control bar (≈132px on desktop) and the
 * last row at the bottom edge do not count as visible for a ping.
 */
const PING_ROOT_MARGIN = "-132px 0px -24px 0px";

/** The catalog entries the deck's sample candidates stand for. */
const CATALOG_ID_OF = new Map<CandidateId, string>(
  SAMPLE_CANDIDATES.map((c) => [c.id as CandidateId, c.catalogId])
);
const PINNED_IDS: readonly string[] = SAMPLE_CANDIDATES.map((c) => c.catalogId);

/** Private-use sentinel: splits `catalogShowing` around the rolling number. */
const SENTINEL = "";

type WallNameProps = {
  entry: CatalogEntry;
  index: number;
  pick: number;
  match: boolean;
  filtering: boolean;
  freeLabel: string;
  localLabel: string;
};

/** Names longer than this are likely truncated in a column: give them a tooltip. */
const TOOLTIP_CHARS = 18;

const WallName = memo(function WallName({
  entry,
  index,
  pick,
  match,
  filtering,
  freeLabel,
  localLabel,
}: WallNameProps) {
  const markLabel = entry.local
    ? entry.free
      ? `${localLabel} · ${freeLabel}`
      : localLabel
    : entry.free
      ? freeLabel
      : null;
  const title = entry.local
    ? `${entry.name} · ${localLabel}`
    : entry.name.length > TOOLTIP_CHARS
      ? entry.name
      : undefined;
  const style: Record<string, number> =
    pick >= 0 ? { "--i": index, "--j": pick } : { "--i": index };
  return (
    <li
      className="cw-li"
      data-id={entry.id}
      data-kind={entry.kind}
      data-free={entry.free ? "1" : undefined}
      data-local={entry.local ? "1" : undefined}
      data-match={match ? "1" : "0"}
      data-pick={pick >= 0 ? "1" : undefined}
      aria-hidden={filtering && !match ? true : undefined}
      title={title}
      style={style as CSSProperties}
    >
      {markLabel ? (
        <span className="cw-mark" role="img" aria-label={markLabel}>
          <i className="cw-dot" />
        </span>
      ) : (
        <span className="cw-mark" aria-hidden="true" />
      )}
      <span className="cw-n" dir="auto" data-n={entry.name}>
        {entry.name}
      </span>
    </li>
  );
});

const selectFeatured = (w: World) => w.featured;

/**
 * The deck echo: which sample request the page's simulation just routed and
 * where, spelled out (fallbacks struck through), and that provider's real
 * catalog entry flashed ember on the wall. Its own component, so a take
 * re-renders this line and not 358 names.
 */
function DeckEcho({
  names,
  wallRef,
  onscreen,
}: {
  names: ReadonlyMap<string, string>;
  wallRef: RefObject<HTMLUListElement | null>;
  onscreen: RefObject<boolean>;
}) {
  const t = useTranslations("landing");
  const featured = useDeck(selectFeatured);
  const lastTake = useRef(featured.take);
  const flip = useRef(false);

  useEffect(() => {
    if (featured.take === lastTake.current) return;
    lastTake.current = featured.take;
    if (!featured.served || !canAnimate() || !onscreen.current) return;
    const id = CATALOG_ID_OF.get(featured.winner);
    const wall = wallRef.current;
    if (!id || !wall) return;
    const li = wall.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!li) return;
    // Alternate between two identical keyframes so a repeat winner flashes again.
    flip.current = !flip.current;
    li.setAttribute("data-echo", flip.current ? "a" : "b");
  }, [featured, wallRef, onscreen]);

  const nameOf = (id: CandidateId) => names.get(CATALOG_ID_OF.get(id) ?? "") ?? id;
  const failed = featured.served ? featured.attempts.slice(0, -1) : featured.attempts;

  return (
    <p className="cw-echo">
      <SimBadge />
      <span key={featured.take} className="cw-echo-line">
        <span className="cw-echo-sample">{t(featured.sample)}</span>
        {failed.map((id) => (
          <span key={id} className="cw-echo-hop" data-failed="1">
            <Glyph name="arrow" size={16} tone="current" />
            <Glyph name="close" size={16} tone="current" className="cw-echo-x" />
            <s dir="auto">{nameOf(id)}</s>
          </span>
        ))}
        {featured.served ? (
          <span className="cw-echo-hop">
            <Glyph name="arrow" size={16} tone="current" />
            <span className="cw-echo-win" dir="auto">
              {nameOf(featured.winner)}
            </span>
          </span>
        ) : null}
      </span>
    </p>
  );
}

export default function CatalogWall({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const reduced = usePrefersReducedMotion();
  const fmt = useMemo(() => numberFormat(locale), [locale]);

  const catalog = stats.catalog;
  const total = catalog.length;
  const slots = useMemo(() => spectrumLayout(stats.kindCounts), [stats.kindCounts]);
  const index = useMemo(() => buildSearchIndex(catalog), [catalog]);
  const picks = useMemo(() => collapsedPicks(catalog, PINNED_IDS), [catalog]);
  const order = useMemo(() => pickOrder(picks), [picks]);
  const names = useMemo(() => new Map(catalog.map((e) => [e.id, e.name])), [catalog]);
  // The reveal stagger, and the wall's `content-visibility` placeholder at 4,
  // 5 and 6 columns (the phone wall renders for real; see `catalog.css`).
  const wallStyle = useMemo(
    () =>
      ({
        "--cw-step": `${(1300 / Math.max(1, total)).toFixed(2)}ms`,
        "--cw-h4": `${wallContentHeight(total, 4)}px`,
        "--cw-h5": `${wallContentHeight(total, 5)}px`,
        "--cw-h6": `${wallContentHeight(total, 6)}px`,
      }) as CSSProperties,
    [total]
  );

  const [query, setQuery] = useState("");
  const [flag, setFlag] = useState<CatalogFlag>("all");
  const [kind, setKind] = useState<CatalogKind | null>(null);
  const [expanded, setExpanded] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const filter = useMemo<CatalogFilter>(
    () => ({ query: deferredQuery, flag, kind }),
    [deferredQuery, flag, kind]
  );
  const filtering = isFiltering(filter);
  const result = useMemo(() => matchCatalog(catalog, index, filter), [catalog, index, filter]);
  const hidden = hiddenWhenCollapsed(total, result.shown, filtering);

  const freeLabel = t("catalogFreeMark");
  const localLabel = t("catalogLocalMark");
  const wallRef = useRef<HTMLUListElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const cwRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLSpanElement>(null);
  /** True while the station's body is on screen (`data-onscreen` on `.cw`). */
  const onscreen = useRef(false);

  // Off screen the CSS loops (search caret, SimBadge dot) pause, and the deck
  // echo does not flash.
  useEffect(() => {
    const node = cwRef.current;
    if (!node) return;
    return watchView(node, {
      onEnter: () => {
        onscreen.current = true;
        node.setAttribute("data-onscreen", "");
      },
      onExit: () => {
        onscreen.current = false;
        node.removeAttribute("data-onscreen");
      },
    });
  }, []);

  // ---- Which names are in view (the ping pool), outside the loop ----------
  const matchRef = useRef<Uint8Array>(result.match);
  useEffect(() => {
    matchRef.current = result.match;
  }, [result]);
  /** 1 per catalog index whose `<li>` is in view (a hidden `<li>` never is). */
  const inView = useRef<Uint8Array>(new Uint8Array(0));
  /** Scratch list of ping candidates, reused every ping. */
  const candidates = useRef<Int16Array>(new Int16Array(0));

  useEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;
    const items = Array.from(wall.children);
    const seen = new Uint8Array(items.length);
    inView.current = seen;
    candidates.current = new Int16Array(items.length);
    if (typeof IntersectionObserver === "undefined") return;
    const indexOf = new Map<Element, number>();
    items.forEach((item, i) => indexOf.set(item, i));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const i = indexOf.get(entry.target);
          if (i !== undefined) seen[i] = entry.isIntersecting ? 1 : 0;
        }
      },
      { rootMargin: PING_ROOT_MARGIN }
    );
    for (const item of items) observer.observe(item);
    return () => observer.disconnect();
  }, []);

  // ---- Where the wall is on screen (the sweep's span), outside the loop ---
  /** The visible band of the wall, in wall-wrap px from its top. */
  const span = useRef({ lo: 0, hi: 0 });

  useEffect(() => {
    const wrap = wrapRef.current;
    const bar = barRef.current;
    if (!wrap || !bar) return;
    let near = false;
    const measure = () => {
      if (!near) return;
      const rect = wrap.getBoundingClientRect();
      // The stuck control bar (desktop) or the nav (phone) hides the top.
      const top = Math.max(bar.getBoundingClientRect().bottom, NAV_CLEAR_PX) - rect.top;
      span.current.lo = Math.min(rect.height, Math.max(0, top));
      span.current.hi = Math.min(rect.height, Math.max(0, window.innerHeight - rect.top));
    };
    const stopView = watchView(wrap, {
      nearMargin: "120px 0px",
      onNear: () => {
        near = true;
        measure();
      },
      onFar: () => {
        near = false;
      },
    });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resize?.observe(wrap);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      stopView();
      resize?.disconnect();
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  // ---- The loop: the sweep, and a ping every 900ms ------------------------
  const loop = useRef<{
    sweepT: number;
    bandY: number;
    bandOn: boolean;
    acc: number;
    last: number;
    rng: Rng | null;
  }>({ sweepT: 0, bandY: Number.NaN, bandOn: false, acc: 0, last: -1, rng: null });

  useEffect(() => {
    loop.current.rng = mulberry32(hash32("catalog-ping"));
  }, []);

  useDomLoop(
    "catalog-wall",
    (dt) => {
      const state = loop.current;

      // Sweep: one pass across what is on screen of the wall, then rest.
      state.sweepT = (state.sweepT + dt) % SWEEP_CYCLE_S;
      const band = bandRef.current;
      if (band) {
        const { lo, hi } = span.current;
        const p = state.sweepT / SWEEP_PASS_S;
        const on = p < 1 && hi - lo > SWEEP_BAND_PX;
        if (on) {
          const y = Math.round(lo - SWEEP_BAND_PX + p * (hi - lo + SWEEP_BAND_PX));
          if (y !== state.bandY) {
            state.bandY = y;
            band.style.transform = `translate3d(0,${y}px,0)`;
          }
        }
        if (on !== state.bandOn) {
          state.bandOn = on;
          band.style.opacity = on ? "1" : "0";
        }
      }

      // Ping: one matching name in view.
      state.acc += dt;
      if (state.acc < PING_S) return;
      state.acc = 0;
      const wall = wallRef.current;
      if (!wall || !state.rng) return;
      const seen = inView.current;
      const match = matchRef.current;
      const pool = candidates.current;
      let count = 0;
      for (let i = 0; i < seen.length && count < pool.length; i++) {
        if (seen[i] === 1 && match[i] === 1 && i !== state.last) pool[count++] = i;
      }
      if (state.last >= 0) wall.children[state.last]?.removeAttribute("data-ping");
      if (count === 0) {
        state.last = -1;
        return;
      }
      state.last = pool[Math.floor(state.rng() * count)];
      wall.children[state.last]?.setAttribute("data-ping", "");
    },
    { target: wrapRef, enabled: !reduced }
  );

  // ---- Search -------------------------------------------------------------
  const clearTarget = useCallback(() => {
    wallRef.current?.querySelector("[data-target]")?.removeAttribute("data-target");
  }, []);

  /**
   * Enter locks a crosshair on the first match and scrolls it into view. The
   * wall renders the deferred query, so the lock waits until the filter it
   * was asked for has committed; any later filter change releases it.
   */
  const lock = useRef<{ pending: string | null; locked: string | null }>({
    pending: null,
    locked: null,
  });

  const applyLock = useCallback(
    (first: number) => {
      const wall = wallRef.current;
      const li = wall && first >= 0 ? (wall.children[first] as HTMLElement | undefined) : undefined;
      if (!li) return;
      clearTarget();
      li.setAttribute("data-target", "");
      li.scrollIntoView({ block: "center", behavior: canAnimate() ? "smooth" : "auto" });
    },
    [clearTarget]
  );

  useEffect(() => {
    const key = filterKey(filter);
    const state = lock.current;
    if (state.pending === key) {
      state.pending = null;
      state.locked = key;
      applyLock(result.first);
    } else if (state.locked !== null && state.locked !== key) {
      state.locked = null;
      clearTarget();
    }
  }, [filter, result, applyLock, clearTarget]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const now: CatalogFilter = { query, flag, kind };
    if (!isFiltering(now)) return;
    const key = filterKey(now);
    if (key === filterKey(filter)) {
      lock.current.locked = key;
      applyLock(result.first);
    } else {
      lock.current.pending = key;
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && query) {
      event.preventDefault();
      setQuery("");
    }
  };
  const onChange = (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    // Folding the long list back: bring the wall's top back into view.
    if (!next) {
      const wrap = wrapRef.current;
      if (wrap && wrap.getBoundingClientRect().top < 0) {
        wrap.scrollIntoView({ block: "start", behavior: canAnimate() ? "smooth" : "auto" });
      }
    }
  };

  // ---- Copy ---------------------------------------------------------------
  const kindLabel = (k: CatalogKind) => t(KIND_LABEL_KEY[k]);
  const [countBefore, countAfter] = t("catalogShowing", {
    shown: SENTINEL,
    total: fmt.format(total),
  }).split(SENTINEL);
  const noMatchQuery =
    deferredQuery.trim() ||
    [flag === "free" ? freeLabel : flag === "local" ? localLabel : "", kind ? kindLabel(kind) : ""]
      .filter(Boolean)
      .join(" · ");

  return (
    <Station
      id="catalog"
      className="cw-station"
      title={t("catalogTitle", { count: fmt.format(stats.providers) })}
      lead={t("catalogLead", {
        kinds: fmt.format(kindTotal(stats.kindCounts)),
        free: fmt.format(stats.freeProviders),
        local: fmt.format(stats.localProviders),
      })}
    >
      <div ref={cwRef} className="station-inner cw">
        {/* Control bar: sticky under the nav on desktop. */}
        <div ref={barRef} className="cw-bar" data-query={query ? "1" : undefined}>
          <form role="search" className="cw-search" onSubmit={onSubmit}>
            <span className="cw-prompt" aria-hidden="true">
              &gt;
            </span>
            <input
              id="catalog-search"
              className="cw-input"
              type="search"
              value={query}
              onChange={onChange}
              onKeyDown={onKeyDown}
              placeholder={t("catalogSearch")}
              aria-label={t("catalogSearch")}
              aria-controls={WALL_ID}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="search"
            />
            <span className="cw-caret" aria-hidden="true" />
            {query ? (
              <button
                type="button"
                className="cw-clear"
                aria-label={t("reset")}
                onClick={() => setQuery("")}
              >
                <Glyph name="close" size={16} tone="current" />
              </button>
            ) : null}
          </form>

          <div className="cw-chips">
            <button
              type="button"
              className="cw-chip"
              aria-pressed={flag === "all" && kind === null}
              onClick={() => {
                setFlag("all");
                setKind(null);
              }}
            >
              {t("catalogAll")}
              <span className="cw-chip-n">{fmt.format(total)}</span>
            </button>
            <button
              type="button"
              className="cw-chip"
              data-flag="free"
              aria-pressed={flag === "free"}
              onClick={() => setFlag(flag === "free" ? "all" : "free")}
            >
              <i className="cw-dot" aria-hidden="true" />
              {freeLabel}
              <span className="cw-chip-n">{fmt.format(stats.freeProviders)}</span>
            </button>
            <button
              type="button"
              className="cw-chip"
              data-flag="local"
              aria-pressed={flag === "local"}
              onClick={() => setFlag(flag === "local" ? "all" : "local")}
            >
              <i className="cw-dot" aria-hidden="true" />
              {localLabel}
              <span className="cw-chip-n">{fmt.format(stats.localProviders)}</span>
            </button>
          </div>

          <p className="cw-count readout" aria-live="polite" aria-atomic="true">
            {countBefore}
            <LiveNumber
              value={result.shown}
              mode="roll"
              duration={700}
              stagger={40}
              className="cw-count-n"
            />
            {countAfter}
          </p>
        </div>

        {/* Spectrum: one segment per kind, proportional; zero kinds omitted. */}
        <div className="cw-spectrum reveal" data-active={kind ? "1" : undefined}>
          <div className="cw-spec-track" aria-hidden="true" />
          <div className="cw-spec-row">
            {slots.map((slot, k) => {
              const label = kindLabel(slot.kind);
              const count = fmt.format(slot.count);
              const hits = result.kindHits[slot.kind];
              return (
                <button
                  key={slot.kind}
                  type="button"
                  className="cw-kind"
                  data-kind={slot.kind}
                  data-fit={labelFitBucket(label.length + 1 + count.length, slot.share)}
                  data-empty={hits === 0 ? "1" : undefined}
                  aria-pressed={kind === slot.kind}
                  aria-controls={WALL_ID}
                  onClick={() => setKind(kind === slot.kind ? null : slot.kind)}
                  style={
                    {
                      "--start": slot.start,
                      "--share": slot.share,
                      "--k": k,
                      "--fill": slot.count > 0 ? hits / slot.count : 0,
                    } as CSSProperties
                  }
                >
                  <span className="cw-seg" aria-hidden="true">
                    <span className="cw-seg-fill" />
                    <span className="cw-seg-label">
                      <span className="cw-seg-name">{label}</span>
                      <span className="cw-seg-n">{count}</span>
                    </span>
                  </span>
                  <span className="cw-kind-legend">
                    <i className="cw-swatch" aria-hidden="true" />
                    <span className="cw-kind-name">{label}</span>
                    <span className="cw-kind-n">{count}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Key, and the deck's echo on the wall. */}
        <div className="cw-keyline">
          <p className="cw-legend">
            <span className="cw-legend-item" data-flag="free">
              <i className="cw-dot" aria-hidden="true" />
              {freeLabel}
            </span>
            <span className="cw-legend-sep" aria-hidden="true">
              ·
            </span>
            <span className="cw-legend-item" data-flag="local">
              <i className="cw-dot" aria-hidden="true" />
              {localLabel}
            </span>
          </p>
          <DeckEcho names={names} wallRef={wallRef} onscreen={onscreen} />
        </div>

        {result.shown === 0 ? (
          <p className="cw-nomatch">
            <Glyph name="search" size={16} tone="current" />
            <span>{t("catalogNoMatch", { query: noMatchQuery })}</span>
          </p>
        ) : null}

        <div ref={wrapRef} className="cw-wall-wrap">
          <ul
            id={WALL_ID}
            ref={wallRef}
            className="cw-wall reveal"
            data-filtering={filtering ? "on" : "off"}
            data-collapsed={expanded ? "off" : "on"}
            style={wallStyle}
          >
            {catalog.map((entry, i) => (
              <WallName
                key={entry.id}
                entry={entry}
                index={i}
                pick={order[i]}
                match={result.match[i] === 1}
                filtering={filtering}
                freeLabel={freeLabel}
                localLabel={localLabel}
              />
            ))}
          </ul>
          <span className="cw-sweep" aria-hidden="true">
            <span ref={bandRef} className="cw-sweep-band" />
          </span>
        </div>

        {hidden > 0 || expanded ? (
          <button
            type="button"
            className={cx("cw-more", expanded && "is-open")}
            aria-expanded={expanded}
            aria-controls={WALL_ID}
            onClick={toggleExpanded}
          >
            <span>
              {expanded ? t("catalogShowLess") : t("catalogShowAll", { count: fmt.format(hidden) })}
            </span>
            <Glyph name="chevron" size={16} tone="current" className="cw-more-glyph" />
          </button>
        ) : null}
      </div>
    </Station>
  );
}
