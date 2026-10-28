"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { SAMPLE_CANDIDATES, type LandingStats } from "../../landingTypes";
import { usePrefersReducedMotion } from "../../landingMotion";
import { dispatch, getSeedWorld, getWorld, shallowEqual, useDeck } from "../../runtime/deckStore";
import { canAnimate, usePaused } from "../../runtime/heartbeat";
import { useDomLoop } from "../../runtime/useDomLoop";
import { useScrollProgress } from "../../runtime/scrollProgress";
import {
  CANDIDATE_IDS,
  SAMPLES,
  act,
  candidate,
  measurements,
  rank,
  type SampleKey,
  type World,
} from "../../sim/landingSim";
import { MagneticButton, Needle, SimBadge, Station } from "../primitives";
import FactorRose, { type RoseLayout } from "./FactorRose";
import StrategyBand from "./StrategyBand";
import {
  MAX_SHARE,
  SILENT_EPS,
  type PinGeometry,
  busBearing,
  busOrder,
  factorKey,
  rawWeightForShare,
  weightedScore,
} from "./routingKit";
import "./routing.css";

/**
 * Station SE, 135°: "Routing you can read" (spec §6.5).
 *
 * Part A, the rose of sixteen: the auto strategy's real scoring factors drawn
 * as a compass rose sized by the shipped weights (`FactorRose`), beside an
 * output bus that ranks the six sample candidates for one sample request with
 * the deck's live weights — best on top, re-ranking (FLIP) whenever a retune,
 * a new sample or an open breaker changes the order. Pinned from 1280px in the
 * station's own track (so the strategy band below stays in flow); the stage is
 * as tall as its content and centred while it is stuck, so no black band sits
 * above or below the rose.
 *
 * Retuning (drag, keyboard, range rows) dispatches `act.setWeight`, so the
 * hero needle and the map's routes follow the visitor's weights.
 *
 * Part B, the strategy band (`StrategyBand`): every id in `stats.strategies`,
 * each demonstrated live on four lanes.
 */

const WIDE_QUERY = "(min-width: 1024px)";
const PIN_QUERY = "(min-width: 1280px)";
/** Idle: the next of the top three candidates refills every 5 s. */
const CYCLE_MS = 5000;
/** After a retune the idle cycle waits this long. */
const RETUNE_HOLD_MS = 8000;
/** The bus re-ranks over this long (FLIP, transform only). */
const RERANK_MS = 620;

const SCORE3: Intl.NumberFormatOptions = { minimumFractionDigits: 3, maximumFractionDigits: 3 };

function subscribeMedia(query: string) {
  return (onChange: () => void) => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  };
}
const subscribeWide = subscribeMedia(WIDE_QUERY);
const subscribePin = subscribeMedia(PIN_QUERY);
const readMedia = (query: string) => () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(query).matches
    : true;
const readWide = readMedia(WIDE_QUERY);
const readPin = readMedia(PIN_QUERY);
/** The server renders the desktop layout; CSS carries the phone one until hydration. */
const serverTrue = () => true;

const selectWeights = (w: World) => w.weights;

const CATALOG = new Map<string, string>(SAMPLE_CANDIDATES.map((c) => [c.id, c.catalogId]));
const SAMPLE_TOKENS = new Map<string, string>(SAMPLES.map((s) => [s.key, s.tokens]));

/** Scores (×6), open flags (×6) and the ranking (candidate indices, −1 padded) for a sample. */
function busSnapshot(w: World, sample: SampleKey): number[] {
  const out = new Array<number>(18).fill(-1);
  for (let c = 0; c < CANDIDATE_IDS.length; c++) {
    const id = CANDIDATE_IDS[c];
    out[c] = Math.round(weightedScore(w.weights, measurements(w, sample, id)) * 10000) / 10000;
    out[6 + c] = candidate(w, id).breaker.state === "open" ? 1 : 0;
  }
  const ranking = rank(w, sample);
  for (let r = 0; r < ranking.length && r < 6; r++) {
    out[12 + r] = CANDIDATE_IDS.indexOf(ranking[r].id);
  }
  return out;
}

export default function RoutingStation({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const rtl = locale === "fa";
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const wide = useSyncExternalStore(subscribeWide, readWide, serverTrue);
  const pinned = useSyncExternalStore(subscribePin, readPin, serverTrue);
  const layout: RoseLayout = pinned ? "pinned" : wide ? "wide" : "compact";

  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackProgress = useScrollProgress(trackRef, { mode: "traverse" });
  const pinGeo = useRef<PinGeometry>({ trackH: 0, stageH: 0, vh: 0, top: 0 });

  /*
   * The sticky stage is as tall as its content: CSS centres it and sizes the
   * track from this height, and the rose's reveal maps the track's progress
   * onto the real pinned stretch (measured here, never in a loop).
   */
  useEffect(() => {
    const stage = stageRef.current;
    const track = trackRef.current;
    if (!stage || !track) return;
    const measure = () => {
      const stageH = Math.ceil(stage.offsetHeight);
      track.style.setProperty("--rt-stage-h", `${stageH}px`);
      pinGeo.current = {
        trackH: track.offsetHeight,
        stageH,
        vh: window.innerHeight,
        top: Number.parseFloat(getComputedStyle(stage).top) || 0,
      };
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(stage);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const factors = stats.scoringFactors;
  const weights = useDeck(selectWeights);

  /* ---- what the rose shows: one sample, one of its top three candidates ---- */
  // The first sample is the tick-0 featured one (server and hydration agree); later ones are live.
  const [cycle, setCycle] = useState<{ sample: SampleKey; k: number; n: number }>(() => ({
    sample: getSeedWorld().featured.sample,
    k: 0,
    n: 0,
  }));
  const [played, setPlayed] = useState(false);

  const selectBus = useMemo(() => (w: World) => busSnapshot(w, cycle.sample), [cycle.sample]);
  const bus = useDeck(selectBus, shallowEqual);
  const ranking = useMemo(() => bus.slice(12).filter((i) => i >= 0), [bus]);
  const order = useMemo(() => busOrder(ranking, CANDIDATE_IDS.length), [ranking]);
  const focusIndex = ranking.length > 0 ? ranking[Math.min(cycle.k, ranking.length - 1)] : 0;
  const winnerIndex = ranking.length > 0 ? ranking[0] : -1;
  const focusId = CANDIDATE_IDS[focusIndex];

  const selectFills = useMemo(
    () => (w: World) =>
      measurements(w, cycle.sample, focusId).map((x) => Math.round(x * 1000) / 1000),
    [cycle.sample, focusId]
  );
  const fills = useDeck(selectFills, shallowEqual);

  /* ---- idle cycle: every 5 s the next of the top three; then a fresh sample ---- */
  const cycleMs = useRef(0);
  const rankingSize = useRef(ranking.length);
  useEffect(() => {
    rankingSize.current = ranking.length;
  }, [ranking.length]);
  useDomLoop(
    "routing-cycle",
    (dt) => {
      cycleMs.current += dt * 1000;
      if (cycleMs.current < CYCLE_MS) return;
      cycleMs.current = 0;
      setCycle((prev) => {
        const top = Math.min(3, rankingSize.current);
        if (prev.k + 1 < top) return { sample: prev.sample, k: prev.k + 1, n: prev.n + 1 };
        return { sample: getWorld().featured.sample, k: 0, n: prev.n + 1 };
      });
    },
    { target: stageRef, enabled: played && !reduced && !paused }
  );

  const onPlayed = useCallback(() => setPlayed(true), []);
  const onRetune = useCallback(() => {
    cycleMs.current = CYCLE_MS - RETUNE_HOLD_MS;
    setCycle((prev) => (prev.k === 0 ? prev : { sample: prev.sample, k: 0, n: prev.n + 1 }));
  }, []);

  const resetWeights = useCallback(() => {
    dispatch(act.resetWeights());
    onRetune();
  }, [onRetune]);

  const setShare = useCallback(
    (i: number, share: number) => {
      const factor = factors[i];
      if (!factor) return;
      dispatch(act.setWeight(factor.id, rawWeightForShare(getWorld().weights, i, share)), {
        user: true,
      });
      onRetune();
    },
    [factors, onRetune]
  );

  /* ---- the bus re-ranks: FLIP each meter from where it was drawn to its new row ---- */
  const busListRef = useRef<HTMLOListElement>(null);
  const busSlots = useRef(new Map<string, { x: number; y: number }>());
  const busLayoutSeen = useRef(wide);
  const orderKey = order.join();
  useLayoutEffect(() => {
    const list = busListRef.current;
    if (!list) return;
    // A layout switch (column ↔ grid) moves every meter: record, do not animate.
    const relayout = busLayoutSeen.current !== wide;
    busLayoutSeen.current = wide;
    const animate = !relayout && canAnimate() && typeof list.animate === "function";
    for (const node of Array.from(list.children) as HTMLElement[]) {
      const id = node.dataset.id ?? "";
      const next = { x: node.offsetLeft, y: node.offsetTop };
      const prev = busSlots.current.get(id);
      busSlots.current.set(id, next);
      if (!animate || !prev || (prev.x === next.x && prev.y === next.y)) continue;
      // An interrupted move starts from where the meter is drawn right now.
      const drawn = getComputedStyle(node).transform;
      const m = drawn && drawn !== "none" ? new DOMMatrixReadOnly(drawn) : null;
      for (const running of node.getAnimations()) running.cancel();
      const dx = prev.x + (m?.e ?? 0) - next.x;
      const dy = prev.y + (m?.f ?? 0) - next.y;
      node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
        duration: RERANK_MS,
        easing: "cubic-bezier(.16,1,.3,1)",
      });
    }
  }, [orderKey, wide]);

  /* ---- formatting ---- */
  const score3 = useMemo(() => new Intl.NumberFormat(locale, SCORE3), [locale]);
  const percent1 = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [locale]
  );
  const plain = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const factorLabel = (id: string) => {
    const key = factorKey(id);
    return t.has(key) ? t(key) : id;
  };
  const vote = (w: number) =>
    w > SILENT_EPS ? t("routingVote", { percent: percent1.format(w) }) : t("routingFactorSilent");

  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const focusScore = weightedScore(weights, fills);
  const busLayout = wide ? "column" : "grid";
  const focusRow = Math.max(0, order.indexOf(focusIndex));
  const needleBearing = busBearing(focusRow, busLayout, rtl);
  const sampleTokens = SAMPLE_TOKENS.get(cycle.sample) ?? "";
  const fillKey = `${cycle.sample}:${focusId}:${cycle.n}`;
  const sumText = `Σ w = ${score3.format(weightSum)}`;

  return (
    <Station id="routing" title={t("routingTitle")} lead={t("routingLead")} className="rt">
      <div ref={trackRef} className="rt-track">
        <div ref={stageRef} className="rt-stage">
          <div className="station-inner rt-auto">
            <header className="rt-auto-head">
              <h3 className="rt-h3">
                {t("routingAutoTitle", { count: plain.format(factors.length) })}
              </h3>
              <p className="rt-lead">{t("routingAutoLead")}</p>
            </header>

            <div className="rt-auto-figure">
              <FactorRose
                factors={factors}
                weights={weights}
                fills={fills}
                fillKey={fillKey}
                focusName={CATALOG.get(focusId) ?? focusId}
                focusScore={focusScore}
                locale={locale}
                layout={layout}
                trackProgress={trackProgress}
                pinGeo={pinGeo}
                onPlayed={onPlayed}
                onRetune={onRetune}
              />
            </div>

            <div className="rt-auto-panel">
              <p className="rt-sample">
                <span className="rt-sample-dot" aria-hidden="true" />
                <span className="rt-sample-text">
                  {t("instrumentRequest")} · {t(cycle.sample)} ·{" "}
                  <span className="readout" dir="ltr">
                    {sampleTokens}
                  </span>{" "}
                  {t("instrumentTokens")}
                </span>
              </p>

              <div className="rt-bus" data-layout={busLayout}>
                <span className="rt-bus-needle" aria-hidden="true">
                  <Needle size={wide ? 64 : 52} bearing={needleBearing} />
                </span>
                <ol
                  ref={busListRef}
                  className="rt-bus-list"
                  aria-label={t("instrumentRankingAria")}
                >
                  {order.map((c) => {
                    const id = CANDIDATE_IDS[c];
                    const open = bus[6 + c] === 1;
                    const score = bus[c];
                    return (
                      <li
                        key={id}
                        data-id={id}
                        className="rt-meter"
                        data-winner={c === winnerIndex ? "" : undefined}
                        data-focus={c === focusIndex ? "" : undefined}
                        data-open={open ? "" : undefined}
                      >
                        <span className="rt-meter-name readout" dir="ltr">
                          {CATALOG.get(id) ?? id}
                        </span>
                        <span className="rt-meter-bar" aria-hidden="true">
                          <span
                            className="rt-meter-fill"
                            style={{ "--s": open ? 0 : score } as CSSProperties}
                          />
                        </span>
                        {open ? (
                          <span className="rt-meter-score rt-meter-state">✕ {t("stateOpen")}</span>
                        ) : (
                          <span className="rt-meter-score readout">{score3.format(score)}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* fine pointer ≥1024: drag the points; the sum and the reset sit here */}
              <div className="rt-retune-row">
                <p className="rt-sum readout" dir="ltr">
                  {sumText}
                </p>
                <p className="rt-retune-text">{t("routingRetune")}</p>
                <MagneticButton variant="ghost" onClick={resetWeights} className="rt-reset">
                  {t("routingResetWeights")}
                </MagneticButton>
                <p className="rt-caption">{t("routingAutoCaption")}</p>
              </div>

              {/* phone and touch: the factor list and its sliders, folded */}
              <details className="rt-retune">
                <summary className="rt-retune-summary">
                  {/* the ranges, not a drag: touch never drags the rose */}
                  <span>
                    {t.has("routingRetuneRanges") ? t("routingRetuneRanges") : t("routingRetune")}
                  </span>
                </summary>
                <div className="rt-ranges">
                  <p className="rt-sum readout" dir="ltr">
                    {sumText}
                  </p>
                  {factors.map((factor, i) => {
                    const w = weights[i] ?? 0;
                    const inputId = `rt-range-${factor.id}`;
                    return (
                      <div
                        key={factor.id}
                        className="rt-range"
                        data-silent={w <= SILENT_EPS ? "" : undefined}
                      >
                        <label htmlFor={inputId} className="rt-range-label">
                          <span className="rt-range-num readout">{plain.format(i + 1)}</span>
                          <span className="rt-range-name">{factorLabel(factor.id)}</span>
                          <span className="rt-range-vote">{vote(w)}</span>
                        </label>
                        <input
                          id={inputId}
                          type="range"
                          min={0}
                          max={MAX_SHARE * 100}
                          step={0.5}
                          value={Math.round(w * 1000) / 10}
                          aria-valuetext={vote(w)}
                          style={
                            { "--v": `${Math.min(100, (w / MAX_SHARE) * 100)}%` } as CSSProperties
                          }
                          onChange={(event) => setShare(i, Number(event.target.value) / 100)}
                        />
                      </div>
                    );
                  })}
                  <MagneticButton variant="ghost" onClick={resetWeights} className="rt-reset">
                    {t("routingResetWeights")}
                  </MagneticButton>
                  <p className="rt-caption">{t("routingAutoCaption")}</p>
                </div>
              </details>

              <SimBadge note={t("routingInputsNote")} className="rt-badge" />
            </div>
          </div>
        </div>
      </div>

      <StrategyBand
        strategies={stats.strategies}
        locale={locale}
        wide={wide}
        tuner={pinned}
        rtl={rtl}
      />
    </Station>
  );
}
